#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const https = require('https');

console.log('⚾ Fetching Pitcher Participation from Box Scores');
console.log('==================================================\n');

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
  // Load schedule
  const scheduleData = JSON.parse(fs.readFileSync(scheduleFile, 'utf8'));
  const games = scheduleData.games || [];
  
  const completedGames = games.filter(g => 
    g.status === 'status_final' || g.status === 'final' || g.status === 'STATUS_FINAL'
  );
  
  console.log(`📋 Total games: ${games.length}`);
  console.log(`✓ Completed games: ${completedGames.length}\n`);
  
  // Limit to first 50 games for testing
  const gamesToProcess = completedGames.slice(0, 50);
  console.log(`🔬 Processing first ${gamesToProcess.length} games as test...\n`);
  
  const pitcherIndex = {};
  let processedCount = 0;
  
  for (const game of gamesToProcess) {
    processedCount++;
    const gameId = game.id || game.espn_game_id;
    
    process.stdout.write(`\r[${processedCount}/${gamesToProcess.length}] Fetching game ${gameId}...`);
    
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
                    opponent: team.team?.id === game.home_team_id ? game.away_team_name : game.home_team_name,
                    stats: stats
                  });
                }
              });
            }
          }
        });
      }
      
      await delay(300); // Be nice to ESPN
      
    } catch (error) {
      console.error(`\n  ⚠️  Error fetching game ${gameId}: ${error.message}`);
    }
  }
  
  console.log('\n\n📊 Summary:');
  console.log(`   Pitchers found: ${Object.keys(pitcherIndex).length}`);
  console.log(`   Games processed: ${processedCount}/${gamesToProcess.length}`);
  
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
