#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('⚾ Rebuilding Pitcher Participation Index');
console.log('==========================================\n');

const dataDir = path.join(__dirname, 'data');
const scheduleFile = path.join(dataDir, 'schedule.json');
const outputFile = path.join(dataDir, 'pitchers_played_index.json');

// Load schedule
if (!fs.existsSync(scheduleFile)) {
  console.error('❌ schedule.json not found!');
  process.exit(1);
}

const scheduleData = JSON.parse(fs.readFileSync(scheduleFile, 'utf8'));
const games = scheduleData.games || [];

console.log(`📋 Found ${games.length} games in schedule`);

// Filter completed games (status_final)
const completedGames = games.filter(g => 
  g.status === 'status_final' || 
  g.status === 'final' ||
  g.status === 'STATUS_FINAL'
);

console.log(`✓ ${completedGames.length} completed games to process\n`);

if (completedGames.length === 0) {
  console.log('⚠️  No completed games found. Index will be empty.');
  const emptyIndex = {
    lastUpdated: new Date().toISOString(),
    totalGames: games.length,
    completedGames: 0,
    index: {}
  };
  fs.writeFileSync(outputFile, JSON.stringify(emptyIndex, null, 2));
  console.log(`✅ Saved empty index: ${outputFile}`);
  process.exit(0);
}

// TODO: Build actual pitcher participation from box scores
// For now, create a valid structure
const index = {
  lastUpdated: new Date().toISOString(),
  totalGames: games.length,
  completedGames: completedGames.length,
  index: {}
};

fs.writeFileSync(outputFile, JSON.stringify(index, null, 2));
console.log(`✅ Saved index with ${completedGames.length} completed games`);
console.log(`📁 Output: ${outputFile}\n`);
