const fs = require('fs');
const path = require('path');

console.log('Building game-first participation index from weekly files...\n');

// Load pitcher rosters to map pitcher ID to team
const pitchersFile = path.join(__dirname, 'data', 'pitchers_enhanced.json');
const pitchersData = JSON.parse(fs.readFileSync(pitchersFile, 'utf8'));

const pitcherToTeam = new Map();
if (pitchersData.teams && Array.isArray(pitchersData.teams)) {
  for (const team of pitchersData.teams) {
    const teamId = String(team.team_id || team.id || '');
    if (!teamId || !team.pitchers) continue;
    
    for (const pitcher of team.pitchers) {
      const pitcherId = String(pitcher.id || pitcher.player_id || '');
      if (pitcherId) {
        pitcherToTeam.set(pitcherId, teamId);
      }
    }
  }
}

console.log(`Loaded ${pitcherToTeam.size} pitcher-to-team mappings\n`);

// Build game-first structure
const gameFirst = {};
let totalPitchers = 0;

for (let w = 1; w <= 26; w++) {
  const weekStr = String(w).padStart(2, '0');
  const weekFile = path.join(__dirname, 'data', `pitchers_played_index_week_${weekStr}.json`);
  
  if (!fs.existsSync(weekFile)) {
    console.log(`  ✗ Week ${w}: file not found`);
    continue;
  }
  
  try {
    const weekData = JSON.parse(fs.readFileSync(weekFile, 'utf8'));
    
    if (!weekData.pitchers) {
      console.log(`  ✗ Week ${w}: no pitchers data`);
      continue;
    }
    
    let weekGames = new Set();
    let weekPitchers = 0;
    
    // Transform from pitcher-first to game-first
    for (const [pitcherId, pitcherData] of Object.entries(weekData.pitchers)) {
      if (!pitcherData.games || !Array.isArray(pitcherData.games)) continue;
      
      for (const game of pitcherData.games) {
        const gameId = String(game.gameId || '').replace(/\D+/g, '');
        if (!gameId) continue;
        
        weekGames.add(gameId);
        weekPitchers++;
        
        // Find which team this pitcher plays for
        const teamId = pitcherToTeam.get(pitcherId) || '0';
        
        // Initialize game entry
        if (!gameFirst[gameId]) {
          gameFirst[gameId] = {};
        }
        
        // Initialize team entry
        if (!gameFirst[gameId][teamId]) {
          gameFirst[gameId][teamId] = [];
        }
        
        // Add pitcher ID (just the ID, simple structure)
        if (!gameFirst[gameId][teamId].includes(pitcherId)) {
          gameFirst[gameId][teamId].push(pitcherId);
        }
      }
    }
    
    totalPitchers += weekPitchers;
    console.log(`  ✓ Week ${w}: ${weekGames.size} games, ${weekPitchers} pitcher appearances`);
  } catch (err) {
    console.log(`  ✗ Week ${w}: ${err.message}`);
  }
}

// Write combined file
const outputFile = path.join(__dirname, 'data', 'pitchers_played_index.json');
const backupFile = path.join(__dirname, 'data', 'pitchers_played_index_pitcher_first.json');

// Backup old file
if (fs.existsSync(outputFile)) {
  fs.copyFileSync(outputFile, backupFile);
}

fs.writeFileSync(outputFile, JSON.stringify(gameFirst, null, 2));

console.log(`\n✅ Created game-first participation index`);
console.log(`   Games: ${Object.keys(gameFirst).length}`);
console.log(`   Total pitcher appearances: ${totalPitchers}`);
console.log(`   File: pitchers_played_index.json`);
console.log(`   Backup: pitchers_played_index_pitcher_first.json`);
