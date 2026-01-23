#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const https = require('https');

console.log('⚾ Fetching ALL Pitcher Participation from Box Scores');
console.log('=====================================================\n');

const dataDir = path.join(__dirname, 'data');
const scheduleFile = path.join(dataDir, 'schedule.json');
const outputFile = path.join(dataDir, 'pitchers_played_index.json');

// Fetch JSON from URL
function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  const startTime = Date.now();
  
  // Load schedule
  const scheduleData = JSON.parse(fs.readFileSync(scheduleFile, 'utf8'));
  const games = scheduleData.games || [];
  
  const completedGames = games.filter(g => 
    g.status === 'status_final' || g.status === 'final' || g.status === 'STATUS_FINAL'
  );
  
  console.log(`📋 Total games: ${games.length}`);
  console.log(`✓ Completed games: ${completedGames.length}`);
  console.log(`⏱️  Estimated time: ${Math.round(completedGames.length * 0.3 / 60)} minutes\n`);
  console.log('🔄 Processing ALL games...\n');
  
  const pitcherIndex = {};
  let processedCount = 0;
  let errorCount = 0;
  
  for (const game of completedGames) {
    processedCount++;
    const gameId = game.id || game.espn_game_id;
    
    // Progress indicator every 100 games
    if (processedCount % 100 === 0) {
      const elapsed = (Date.now() - startTime) / 1000 / 60;
      const remaining = ((completedGames.length - processedCount) * 0.3) / 60;
      console.log(`[${processedCount}/${completedGames.length}] Pitchers: ${Object.keys(pitcherIndex).length} | Elapsed: ${elapsed.toFixed(1)}m | Remaining: ~${remaining.toFixed(1)}m`);
    } else {
      process.stdout.write(`\r[${processedCount}/${completedGames.length}] Processing...`);
    }
    
    try {
      const url = `https://site.api.espn.com/apis/site/v2/sports/baseball/college-baseball/summary?event=${gameId}`;
      const boxScore = await fetchJSON(url);
      
      // Extract pitcher data from box score
      if (boxScore.boxscore && boxScore.boxscore.players) {
        boxScore.boxscore.players.forEach(team => {
          if (team.statistics && team.statistics.length > 0) {
            // Find pitching stats
            const pitchingStats = team.statistics.find(stat => 
              stat.name === 'pitching' || stat.type === 'pitching'
            );
            
            if (pitchingStats && pitchingStats.athletes) {
              pitchingStats.athletes.forEach(athlete => {
                const playerId = athlete.athlete?.id;
                const playerName = athlete.athlete?.displayName || athlete.athlete?.fullName;
                
                if (playerId) {
                  if (!pitcherIndex[playerId]) {
                    pitcherIndex[playerId] = {
                      id: playerId,
                      name: playerName,
                      games: []
                    };
                  }
                  
                  // Get stats
                  const stats = {};
                  athlete.stats?.forEach((stat, idx) => {
                    const label = pitchingStats.labels?.[idx];
                    if (label) stats[label] = stat;
                  });
                  
                  pitcherIndex[playerId].games.push({
                    gameId: gameId,
                    date: game.date,
                    week: game.week,
                    opponent: team.team?.id === game.home_team_id ? game.away_team_name : game.home_team_name,
                    stats: stats
                  });
                }
              });
            }
          }
        });
      }
      
      await delay(300); // Be nice to ESPN (300ms between requests)
      
    } catch (error) {
      errorCount++;
      if (errorCount < 10) {
        console.error(`\n  ⚠️  Error fetching game ${gameId}: ${error.message}`);
      }
    }
  }
  
  const totalTime = (Date.now() - startTime) / 1000 / 60;
  
  console.log('\n\n📊 Final Summary:');
  console.log(`   ✅ Pitchers found: ${Object.keys(pitcherIndex).length}`);
  console.log(`   ✅ Games processed: ${processedCount}/${completedGames.length}`);
  console.log(`   ⚠️  Errors: ${errorCount}`);
  console.log(`   ⏱️  Total time: ${totalTime.toFixed(1)} minutes`);
  
  const output = {
    lastUpdated: new Date().toISOString(),
    totalGames: games.length,
    completedGames: completedGames.length,
    processedGames: processedCount,
    pitchers: pitcherIndex
  };
  
  fs.writeFileSync(outputFile, JSON.stringify(output, null, 2));
  console.log(`\n✅ Saved to: ${outputFile}\n`);
}

main().catch(console.error);
