const SUPABASE_URL = 'https://dtnozcqkuzhjmjvsfjqk.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0bm96Y3FrdXpoam1qdnNmanFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ5MDY4MzAsImV4cCI6MjA4MDQ4MjgzMH0.7puo2RCr6VMNNp_lywpAqufLEGnnE3TYqAtX8zQ0X8c';
const headers = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'resolution=merge-duplicates,return=minimal'
};
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fetchESPN(gameId) {
  const resp = await fetch(`https://site.api.espn.com/apis/site/v2/sports/baseball/college-baseball/summary?event=${gameId}`);
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp.json();
}

function extractPitchers(data, gameId) {
  const records = [];
  try {
    const players = data?.boxscore?.players;
    if (!players) return records;
    for (const teamData of players) {
      const teamId = String(teamData.team?.id || '');
      const pitching = teamData.statistics?.find(s => s.name === 'pitching' || s.type === 'pitching');
      if (!pitching?.athletes) continue;
      for (const athlete of pitching.athletes) {
        const pitcherId = String(athlete.athlete?.id || '');
        if (!pitcherId) continue;
        const labels = pitching.labels || [];
        const stats = {};
        (athlete.stats || []).forEach((v, i) => { if (labels[i]) stats[labels[i]] = v; });
        records.push({ game_id: gameId, team_id: teamId, pitcher_id: pitcherId, pitcher_name: athlete.athlete?.displayName || '', stats });
      }
    }
  } catch(e) {}
  return records;
}

async function main() {
  const today = new Date().toISOString().split('T')[0];

  // --- Phase 1: Mark past games as completed ---
  console.log('Phase 1: Checking incomplete past games...');
  const r1 = await fetch(`${SUPABASE_URL}/rest/v1/cbb_games?completed=eq.false&date=lte.${today}&select=game_id,date&order=date.desc`, { headers });
  const incomplete = await r1.json();
  console.log(`  ${incomplete.length} past games to check`);
  let marked = 0;
  for (const game of incomplete) {
    await sleep(300);
    try {
      const data = await fetchESPN(game.game_id);
      const comp = data?.header?.competitions?.[0];
      const isComplete = comp?.status?.type?.completed === true;
      if (isComplete) {
        const homeScore = comp?.competitors?.find(t => t.homeAway === 'home')?.score;
        const awayScore = comp?.competitors?.find(t => t.homeAway === 'away')?.score;
        const homeName = comp?.competitors?.find(t => t.homeAway === 'home')?.team?.displayName;
        const awayName = comp?.competitors?.find(t => t.homeAway === 'away')?.team?.displayName;
        const venue = comp?.venue?.fullName;
        await fetch(`${SUPABASE_URL}/rest/v1/cbb_games?game_id=eq.${game.game_id}`, {
          method: 'PATCH', headers,
          body: JSON.stringify({ completed: true, status: 'final', home_score: homeScore, away_score: awayScore, home_name: homeName, away_name: awayName, venue })
        });
        marked++;
        process.stdout.write(`\r  Marked complete: ${marked} (latest: ${game.game_id})`);
      }
    } catch(e) { process.stdout.write(`\r  Error ${game.game_id}: ${e.message}`); }
  }
  console.log(`\n  ✓ Marked ${marked} games as completed`);

  // --- Phase 2: Scrape participation for completed games without data ---
  console.log('\nPhase 2: Scraping pitcher participation...');
  const r2 = await fetch(`${SUPABASE_URL}/rest/v1/cbb_games?completed=eq.true&select=game_id&order=date.desc`, { headers });
  const allCompleted = await r2.json();
  console.log(`  ${allCompleted.length} total completed games`);

  // Find which have no participation in batches
  const allIds = allCompleted.map(g => g.game_id);
  const scrapedIds = new Set();
  for (let i = 0; i < allIds.length; i += 200) {
    const chunk = allIds.slice(i, i + 200);
    const r = await fetch(`${SUPABASE_URL}/rest/v1/cbb_pitcher_participation?game_id=in.(${chunk.join(',')})&select=game_id`, { headers });
    const existing = await r.json();
    existing.forEach(p => scrapedIds.add(p.game_id));
  }

  const toScrape = allCompleted.filter(g => !scrapedIds.has(g.game_id));
  console.log(`  ${toScrape.length} games need participation data`);

  let scraped = 0, records = 0, errors = 0;
  const batchRecords = [];

  for (const game of toScrape) {
    await sleep(300);
    try {
      const data = await fetchESPN(game.game_id);
      const pitchers = extractPitchers(data, game.game_id);
      batchRecords.push(...pitchers);
      records += pitchers.length;
      scraped++;
      process.stdout.write(`\r  Scraped ${scraped}/${toScrape.length} games, ${records} pitcher records (${errors} errors)`);

      // Insert in batches of 200 records
      if (batchRecords.length >= 200) {
        await fetch(`${SUPABASE_URL}/rest/v1/cbb_pitcher_participation?on_conflict=game_id,pitcher_id`, {
          method: 'POST', headers, body: JSON.stringify(batchRecords.splice(0))
        });
      }
    } catch(e) {
      errors++;
    }
  }

  // Insert remaining
  if (batchRecords.length > 0) {
    await fetch(`${SUPABASE_URL}/rest/v1/cbb_pitcher_participation?on_conflict=game_id,pitcher_id`, {
      method: 'POST', headers, body: JSON.stringify(batchRecords)
    });
  }

  console.log(`\n  ✓ Scraped ${scraped} games, ${records} pitcher records, ${errors} errors`);
  console.log('\nDone!');
}

main().catch(console.error);
