// Vercel Serverless Cron Job for CBB (College Baseball) Pitcher Tracker
// Optimized for large game volumes - processes in batches

const SUPABASE_URL = 'https://dtnozcqkuzhjmjvsfjqk.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0bm96Y3FrdXpoam1qdnNmanFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ5MDY4MzAsImV4cCI6MjA4MDQ4MjgzMH0.7puo2RCr6VMNNp_lywpAqufLEGnnE3TYqAtX8zQ0X8c';

const headers = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'resolution=merge-duplicates,return=minimal'
};

const THROTTLE_MS = 350;
const MAX_GAMES_PER_RUN = 15; // Limit games per invocation (cron-job.org has ~30s timeout)
const MAX_RUNTIME_MS = 240000; // 4 min safety margin (Vercel limit is 5 min)
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function normalizeId(id) {
  return id ? String(id) : null;
}

async function fetchWithRetry(url, retries = 2) {
  for (let i = 0; i < retries; i++) {
    try {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      return await resp.json();
    } catch (e) {
      if (i === retries - 1) throw e;
      await sleep(500 * (i + 1));
    }
  }
}

// Get current CBB week from Supabase games
async function getCurrentWeek() {
  const resp = await fetch(
    `${SUPABASE_URL}/rest/v1/cbb_games?order=week.desc&limit=100`,
    { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
  );
  const games = await resp.json();
  if (!games.length) return 1;
  
  const now = new Date();
  const startedWeeks = games
    .filter(g => new Date(g.date) <= now)
    .map(g => g.week);
  
  return Math.max(...startedWeeks, 1);
}

// Get games needing scrape (completed but not yet scraped) - checks ALL weeks
async function getGamesNeedingScrape() {
  // Get all completed games across all weeks (ordered by week desc so recent games come first)
  const gamesResp = await fetch(
    `${SUPABASE_URL}/rest/v1/cbb_games?completed=eq.true&select=game_id,week,home_team_id,away_team_id,date&order=week.desc&limit=500`,
    { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
  );
  const completedGames = await gamesResp.json();
  if (!completedGames.length) return [];

  // Get game IDs that already have participation data
  const gameIds = completedGames.map(g => g.game_id);

  // Supabase URL limit: batch the lookup in chunks of 100
  const scrapedGameIds = new Set();
  for (let i = 0; i < gameIds.length; i += 100) {
    const chunk = gameIds.slice(i, i + 100);
    const partResp = await fetch(
      `${SUPABASE_URL}/rest/v1/cbb_pitcher_participation?game_id=in.(${chunk.join(',')})&select=game_id`,
      { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
    );
    const existing = await partResp.json();
    existing.forEach(p => scrapedGameIds.add(p.game_id));
  }

  // Return only games that haven't been scraped, recent weeks first
  return completedGames.filter(g => !scrapedGameIds.has(g.game_id));
}

// Get incomplete games for status check across all weeks (limited batch)
async function getIncompleteGames(limit = 50) {
  const resp = await fetch(
    `${SUPABASE_URL}/rest/v1/cbb_games?completed=eq.false&select=game_id,week,home_team_id,away_team_id,date&order=week.desc&limit=${limit}`,
    { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
  );
  return await resp.json();
}

// Update game completion status from ESPN
async function updateGameStatus(game) {
  const url = `https://site.api.espn.com/apis/site/v2/sports/baseball/college-baseball/summary?event=${game.game_id}`;
  const data = await fetchWithRetry(url);
  const isComplete = data?.header?.competitions?.[0]?.status?.type?.completed === true;
  
  if (isComplete) {
    await fetch(`${SUPABASE_URL}/rest/v1/cbb_games?game_id=eq.${game.game_id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ completed: true, status: 'final' })
    });
    return { updated: true, game_id: game.game_id };
  }
  return { updated: false, game_id: game.game_id };
}

// Extract pitcher participation from game data
function extractPitchersFromGame(data, game) {
  const records = [];
  
  try {
    const boxscore = data?.boxscore;
    if (!boxscore?.players) return records;
    
    boxscore.players.forEach(teamData => {
      const teamId = normalizeId(teamData.team?.id);
      
      const pitchingStats = teamData.statistics?.find(stat => 
        stat.name === 'pitching' || stat.type === 'pitching'
      );
      if (!pitchingStats?.athletes) return;
      
      pitchingStats.athletes.forEach(athlete => {
        const pitcherId = normalizeId(athlete.athlete?.id);
        const pitcherName = athlete.athlete?.displayName || '';
        
        if (!pitcherId) return;
        
        const statsObj = {};
        const labels = pitchingStats.labels || [];
        const values = athlete.stats || [];
        
        labels.forEach((label, i) => {
          if (values[i] !== undefined) {
            statsObj[label] = values[i];
          }
        });
        
        records.push({
          game_id: game.game_id,
          team_id: teamId,
          pitcher_id: pitcherId,
          pitcher_name: pitcherName,
          stats: statsObj
        });
      });
    });
  } catch (error) {
    console.log(`Error extracting pitchers: ${error.message}`);
  }
  
  return records;
}

// Scrape participation for a game
async function scrapeGameParticipation(game) {
  const url = `https://site.api.espn.com/apis/site/v2/sports/baseball/college-baseball/summary?event=${game.game_id}`;
  const data = await fetchWithRetry(url);
  return extractPitchersFromGame(data, game);
}

// Sync participation records to Supabase
async function syncParticipation(records) {
  if (!records.length) return { success: true, count: 0 };
  
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/cbb_pitcher_participation?on_conflict=game_id,pitcher_id`, {
    method: 'POST',
    headers,
    body: JSON.stringify(records)
  });
  
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Sync failed: ${err}`);
  }
  
  return { success: true, count: records.length };
}

// Log sync activity
async function logSync(syncType, recordsCount, status, details = null) {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/cbb_sync_log`, {
      method: 'POST',
      headers: { ...headers, 'Prefer': 'return=minimal' },
      body: JSON.stringify({
        sync_type: syncType,
        records_count: recordsCount,
        status,
        error_message: details
      })
    });
  } catch (e) {
    console.warn('Could not log sync:', e.message);
  }
}

export default async function handler(req, res) {
  // Verify the request is from Vercel Cron (optional but recommended)
  // To enable: add CRON_SECRET to your Vercel environment variables
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers['authorization'] !== `Bearer ${cronSecret}`) {
    // Allow requests without auth if CRON_SECRET is not set (for testing)
    // Once you set CRON_SECRET in Vercel, only cron jobs can trigger this
    if (req.headers['authorization']) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  const startTime = Date.now();
  const results = {
    week: null,
    statusChecked: 0,
    gamesUpdated: 0,
    gamesScraped: 0,
    gamesRemaining: 0,
    participationRecords: 0,
    errors: [],
    earlyExit: false
  };

  const checkTimeout = () => (Date.now() - startTime) > MAX_RUNTIME_MS;
  
  try {
    results.week = await getCurrentWeek();
    console.log(`Current week: ${results.week}`);

    // Phase 1: Check status of incomplete games (all weeks, recent first)
    const incompleteGames = await getIncompleteGames(50);
    console.log(`Checking ${incompleteGames.length} incomplete games across all weeks`);

    for (const game of incompleteGames) {
      if (checkTimeout()) {
        results.earlyExit = true;
        console.log('Timeout approaching, exiting status check');
        break;
      }
      await sleep(THROTTLE_MS);
      try {
        const status = await updateGameStatus(game);
        results.statusChecked++;
        if (status.updated) {
          results.gamesUpdated++;
          console.log(`✓ Game ${game.game_id} (week ${game.week}) marked complete`);
        }
      } catch (e) {
        results.errors.push(`Status ${game.game_id}: ${e.message}`);
      }
    }

    // Phase 2: Scrape games that need participation data (all weeks, recent first)
    if (!checkTimeout()) {
      const gamesToScrape = await getGamesNeedingScrape();
      const batch = gamesToScrape.slice(0, MAX_GAMES_PER_RUN);
      results.gamesRemaining = gamesToScrape.length - batch.length;
      
      const weekRange = batch.length > 0 ? `weeks ${Math.min(...batch.map(g=>g.week))}-${Math.max(...batch.map(g=>g.week))}` : '';
      console.log(`Scraping ${batch.length} of ${gamesToScrape.length} games needing data (${weekRange})`);
      
      const allParticipation = [];
      for (const game of batch) {
        if (checkTimeout()) {
          results.earlyExit = true;
          console.log('Timeout approaching, exiting scrape');
          break;
        }
        await sleep(THROTTLE_MS);
        try {
          const records = await scrapeGameParticipation(game);
          allParticipation.push(...records);
          results.gamesScraped++;
        } catch (e) {
          results.errors.push(`Scrape ${game.game_id}: ${e.message}`);
        }
      }
      
      if (allParticipation.length > 0) {
        const syncResult = await syncParticipation(allParticipation);
        results.participationRecords = syncResult.count;
      }
    }
    
    await logSync('cron_update', results.participationRecords, 'success', JSON.stringify(results));
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`Completed in ${duration}s`);
    
    return res.status(200).json({
      success: true,
      duration: `${duration}s`,
      ...results
    });
    
  } catch (error) {
    console.error('Cron job failed:', error);
    await logSync('cron_update', 0, 'error', error.message);
    
    return res.status(500).json({
      success: false,
      error: error.message,
      ...results
    });
  }
}
