#!/usr/bin/env node

/**
 * MLB Pitcher Participation Index Builder
 * ======================================================
 * Reads completed games from schedule.json and fetches box scores
 * to determine which pitchers played in each game.
 * 
 * Usage: node rebuild_played_index.js
 * 
 * Input: data/schedule.json
 * Output: data/pitchers_played_index.json
 * 
 * What it tracks:
 * - Pitcher ID
 * - Innings pitched
 * - Which specific innings (1, 2, 3...)
 * - Pitch count
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const DATA_DIR = path.join(__dirname, 'data');
const SCHEDULE_FILE = path.join(DATA_DIR, 'schedule.json');
const OUTPUT_FILE = path.join(DATA_DIR, 'pitchers_played_index.json');

/**
 * Fetch JSON from URL
 */
function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timeout')), 10000);
    
    https.get(url, (res) => {
      clearTimeout(timeout);
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

/**
 * Fetch game box score from ESPN
 */
async function fetchGameBoxScore(gameId) {
  const url = `https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/summary?event=${gameId}`;
  
  try {
    const response = await fetchJSON(url);
    return response;
  } catch (error) {
    console.error(`  ⚠️  Error fetching game ${gameId}:`, error.message);
    return null;
  }
}

/**
 * Extract pitcher data from box score
 */
function extractPitcherData(boxScore, teamId) {
  if (!boxScore || !boxScore.boxscore) return [];
  
  const pitchers = [];
  const teams = boxScore.boxscore.teams || [];
  
  for (const team of teams) {
    if (String(team.team?.id) !== String(teamId)) continue;
    
    // Look for pitching statistics
    const pitchingStats = team.statistics?.find(s => 
      s.name?.toLowerCase().includes('pitching') || 
      s.type?.toLowerCase() === 'pitching'
    );
    
    if (!pitchingStats || !pitchingStats.athletes) continue;
    
    for (const athlete of pitchingStats.athletes) {
      const player = athlete.athlete || {};
      const stats = athlete.stats || [];
      
      // Parse pitching stats
      const ipStat = stats.find(s => s.abbreviation === 'IP' || s.name?.includes('Innings'));
      const pcStat = stats.find(s => s.abbreviation === 'PC' || s.abbreviation === 'NP' || s.name?.includes('Pitches'));
      
      if (!ipStat) continue; // No innings pitched = didn't play
      
      const inningsPitched = parseFloat(ipStat.displayValue || '0');
      if (inningsPitched === 0) continue;
      
      // Calculate which innings (approximate based on IP)
      const inningsList = calculateInningsList(inningsPitched);
      
      pitchers.push({
        id: String(player.id || ''),
        pitcher_id: String(player.id || ''),
        name: player.displayName || player.name || '',
        innings_pitched: String(inningsPitched),
        innings_list: inningsList,
        pitch_count: parseInt(pcStat?.displayValue || '0')
      });
    }
  }
  
  return pitchers;
}

/**
 * Calculate innings list from IP value
 * Example: 6.1 innings = [1,2,3,4,5,6,7] (7th inning was partial)
 */
function calculateInningsList(ip) {
  const fullInnings = Math.floor(ip);
  const partialOuts = Math.round((ip - fullInnings) * 10);
  
  const innings = [];
  for (let i = 1; i <= fullInnings; i++) {
    innings.push(i);
  }
  
  // Add partial inning if exists
  if (partialOuts > 0 && fullInnings < 9) {
    innings.push(fullInnings + 1);
  }
  
  return innings;
}

/**
 * Process a single game
 */
async function processGame(game) {
  if (game.status !== 'completed' && 
      game.status !== 'final' && 
      game.status !== 'status_final' &&
      game.status !== 'STATUS_FINAL') {
    return null; // Skip in-progress or scheduled games
  }
  
  console.log(`  Processing: ${game.away_team_name} @ ${game.home_team_name}`);
  
  const boxScore = await fetchGameBoxScore(game.id);
  if (!boxScore) return null;
  
  const homePitchers = extractPitcherData(boxScore, game.home_team_id);
  const awayPitchers = extractPitcherData(boxScore, game.away_team_id);
  
  console.log(`    Home pitchers: ${homePitchers.length}`);
  console.log(`    Away pitchers: ${awayPitchers.length}`);
  
  return {
    gameId: game.id,
    [game.home_team_id]: homePitchers,
    [game.away_team_id]: awayPitchers
  };
}

/**
 * Main rebuild function
 */
async function rebuildPlayedIndex() {
  console.log('⚾ Rebuilding Pitcher Participation Index');
  console.log('==========================================\n');
  
  // Check if schedule exists
  if (!fs.existsSync(SCHEDULE_FILE)) {
    console.error('❌ Schedule file not found:', SCHEDULE_FILE);
    console.error('   Run: node tools/fetch_schedule.js first');
    process.exit(1);
  }
  
  // Load schedule
  const scheduleData = JSON.parse(fs.readFileSync(SCHEDULE_FILE, 'utf8'));
  const games = scheduleData.games || [];
  
  console.log(`📋 Found ${games.length} games in schedule`);
  
  // Filter to completed games
  const completedGames = games.filter(g => 
    g.status === 'completed' || 
    g.status === 'final' || 
    g.status === 'status_final' ||
    g.status === 'STATUS_FINAL'
  );
  
  console.log(`✓ ${completedGames.length} completed games to process\n`);
  
  if (completedGames.length === 0) {
    console.log('⚠️  No completed games found. Index will be empty.');
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify({}, null, 2));
    console.log(`✅ Saved empty index: ${OUTPUT_FILE}`);
    return;
  }
  
  // Process games
  const playedIndex = {};
  let processedCount = 0;
  let errorCount = 0;
  
  for (let i = 0; i < completedGames.length; i++) {
    const game = completedGames[i];
    console.log(`\n[${i + 1}/${completedGames.length}] Week ${game.week}`);
    
    try {
      const gameData = await processGame(game);
      
      if (gameData) {
        const { gameId, ...teamData } = gameData;
        playedIndex[gameId] = teamData;
        processedCount++;
      }
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 250));
      
    } catch (error) {
      console.error(`  ❌ Error:`, error.message);
      errorCount++;
    }
  }
  
  // Save index
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(playedIndex, null, 2));
  
  console.log('\n' + '='.repeat(50));
  console.log('✅ Rebuild complete!');
  console.log(`📁 Saved to: ${OUTPUT_FILE}`);
  console.log(`\n📊 Summary:`);
  console.log(`   Completed games: ${completedGames.length}`);
  console.log(`   Successfully processed: ${processedCount}`);
  console.log(`   Errors: ${errorCount}`);
  
  // Calculate total pitchers tracked
  let totalPitchers = 0;
  Object.values(playedIndex).forEach(game => {
    Object.values(game).forEach(pitchers => {
      if (Array.isArray(pitchers)) {
        totalPitchers += pitchers.length;
      }
    });
  });
  
  console.log(`   Total pitcher appearances: ${totalPitchers}`);
  
  // Save weekly indexes
  console.log('\n📂 Creating weekly index files...');
  const weeklyIndexes = {};
  
  games.forEach(game => {
    if (playedIndex[game.id]) {
      const week = String(game.week).padStart(2, '0');
      if (!weeklyIndexes[week]) {
        weeklyIndexes[week] = {};
      }
      weeklyIndexes[week][game.id] = playedIndex[game.id];
    }
  });
  
  for (const [week, index] of Object.entries(weeklyIndexes)) {
    const weekFile = path.join(DATA_DIR, `pitchers_played_index_week_${week}.json`);
    fs.writeFileSync(weekFile, JSON.stringify(index, null, 2));
    console.log(`   ✓ Week ${week}: ${Object.keys(index).length} games`);
  }
  
  console.log('\n🎉 All done!');
}

// Run
rebuildPlayedIndex().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
