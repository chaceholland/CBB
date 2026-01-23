#!/usr/bin/env node

/**
 * Optimize pitchers_played_index.json by removing excessive innings detail
 * 
 * BEFORE: 165MB with full innings_list arrays
 * AFTER: ~10-20MB with just participation indicators
 * 
 * Preserves:
 * - Pitcher participation per game
 * - Game metadata (date, week, opponent)
 * - Essential stats
 * 
 * Removes:
 * - Detailed innings_list arrays (165+ items per game)
 * - Excessive play-by-play data
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const INPUT_FILE = path.join(DATA_DIR, 'pitchers_played_index.json');
const OUTPUT_FILE = path.join(DATA_DIR, 'pitchers_played_index_optimized.json');
const BACKUP_FILE = path.join(DATA_DIR, 'pitchers_played_index_full.json');

console.log('🔧 Optimizing pitcher participation data...\n');

// Read the bloated file
console.log('📖 Reading input file...');
const data = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf8'));
const inputSize = (fs.statSync(INPUT_FILE).size / (1024 * 1024)).toFixed(1);
console.log(`   Input size: ${inputSize} MB`);
console.log(`   Pitchers: ${Object.keys(data.pitchers).length}`);

// Optimize each pitcher's game data
console.log('\n🗜️  Optimizing...');
let totalGamesProcessed = 0;
let totalInningsRemoved = 0;

const optimized = {
  lastUpdated: data.lastUpdated,
  totalGames: data.totalGames,
  completedGames: data.completedGames,
  processedGames: data.processedGames,
  pitchers: {}
};

for (const [pitcherId, pitcher] of Object.entries(data.pitchers)) {
  optimized.pitchers[pitcherId] = {
    id: pitcher.id,
    name: pitcher.name,
    games: pitcher.games.map(game => {
      totalGamesProcessed++;
      
      // Count innings removed
      if (game.innings_list) {
        totalInningsRemoved += game.innings_list.length;
      }
      
      // Keep only essential game data
      return {
        gameId: game.gameId,
        date: game.date,
        week: game.week,
        opponent: game.opponent,
        // Keep inning count but not full list
        inningsCount: game.innings_list ? game.innings_list.length : 0,
        // Keep any stats that might exist
        ...(game.stats && { stats: game.stats })
      };
    })
  };
}

// Backup original file
console.log('\n💾 Creating backup...');
fs.copyFileSync(INPUT_FILE, BACKUP_FILE);
console.log(`   Backup: ${path.basename(BACKUP_FILE)}`);

// Write optimized file
console.log('\n✍️  Writing optimized file...');
fs.writeFileSync(OUTPUT_FILE, JSON.stringify(optimized, null, 2));
const outputSize = (fs.statSync(OUTPUT_FILE).size / (1024 * 1024)).toFixed(1);

// Replace original with optimized
fs.copyFileSync(OUTPUT_FILE, INPUT_FILE);

console.log('\n✅ Optimization complete!\n');
console.log('📊 Results:');
console.log(`   Before: ${inputSize} MB`);
console.log(`   After:  ${outputSize} MB`);
console.log(`   Saved:  ${(inputSize - outputSize).toFixed(1)} MB (${((1 - outputSize/inputSize) * 100).toFixed(1)}% reduction)`);
console.log(`\n   Games processed: ${totalGamesProcessed}`);
console.log(`   Innings details removed: ${totalInningsRemoved.toLocaleString()}`);
console.log(`\n   Full backup saved as: ${path.basename(BACKUP_FILE)}`);
console.log(`   Optimized file: ${path.basename(INPUT_FILE)}`);
console.log('\n🚀 Ready for fast loading!\n');
