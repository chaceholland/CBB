#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const https = require('https');

console.log('⚾ Fetching ALL Pitcher Participation WITH INNINGS from Box Scores');
console.log('===================================================================\n');

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

// Extract innings list from play-by-play or detailed box score
function extractInningsList(boxScore, playerId) {
  const innings = new Set();
  
  try {
    // Try to get from play-by-play if available
    if (boxScore.plays && Array.isArray(boxScore.plays)) {
      boxScore.plays.forEach(play => {
        if (play.period && play.participants) {
          play.participants.forEach(p => {
            if (String(p.athlete?.id) === String(playerId)) {
              innings.add(play.period);
            }
          });
        }
      });
    }
    
    // Alternative: check scoring plays
    if (boxScore.scoringPlays && Array.isArray(boxScore.scoringPlays)) {
      boxScore.scoringPlays.forEach(play => {
        if (play.period && play.team) {
          // Check if pitcher was involved
          if (play.text && play.text.includes(playerId)) {
            innings.add(play.period);
          }
        }
      });
    }
    
    // Alternative: check play summaries
    if (boxScore.header && boxScore.header.competitions) {
      boxScore.header.competitions.forEach(comp => {
        if (comp.details && Array.isArray(comp.details)) {
          comp.details.forEach(detail => {
            if (detail.inning && detail.athletesInvolved) {
              detail.athletesInvolved.forEach(athlete => {
                if (String(athlete.id) === String(playerId)) {
                  innings.add(detail.inning);
                }
              });
            }
          });
        }
      });
    }
  } catch (e) {
    // Innings extraction failed, will return empty
  }
  
  return Array.from(innings).sort((a, b) => a - b);
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
  console.log('🔄 Processing ALL games with innings data...\n');
  
  const pitcherIndex = {};
  let processedCount = 0;
  let errorCount = 0;
  let inningsFoundCount = 0;
  
  for (const game of completedGames) {
    processedCount++;
    const gameId = game.id || game.espn_game_id;
    
    // Progress indicator every 100 games
    if (processedCount % 100 === 0) {
      const elapsed = (Date.now() - startTime) / 1000 / 60;
      const remaining = ((completedGames.length - processedCount) * 0.3) / 60;
      console.log(`[${processedCount}/${completedGames.length}] Pitchers: ${Object.keys(pitcherIndex).length} | With innings: ${inningsFoundCount} | Elapsed: ${elapsed.toFixed(1)}m | Remaining: ~${remaining.toFixed(1)}m`);
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
                  
                  // Extract innings list
                  const inningsList = extractInningsList(boxScore, playerId);
                  if (inningsList.length > 0) {
                    inningsFoundCount++;
                  }
                  
                  pitcherIndex[playerId].games.push({
                    gameId: gameId,
                    date: game.date,
                    week: game.week,
                    opponent: team.team?.id === game.home_team_id ? game.away_team_name : game.home_team_name,
                    innings_list: inningsList,
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
  console.log(`   ✅ Games with innings data: ${inningsFoundCount}`);
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
