#!/usr/bin/env node

/**
 * Strip Unused Stats from Participation File
 * 
 * Reduces file size from 9MB to ~2-3MB by removing unused stats
 * Keeps only: IP, PC (the only stats displayed in the UI)
 * Removes: H, R, ER, BB, K, HR, PC-ST, ERA
 */

const fs = require('fs');
const path = require('path');

const INPUT_FILE = path.join(__dirname, 'data', 'pitchers_played_index.json');
const OUTPUT_FILE = path.join(__dirname, 'data', 'pitchers_played_index_optimized_stripped.json');
const BACKUP_FILE = path.join(__dirname, 'data', 'pitchers_played_index_backup_before_strip.json');

console.log('📊 Stripping unused stats from participation file...\n');

// Create backup first
console.log('💾 Creating backup...');
try {
  fs.copyFileSync(INPUT_FILE, BACKUP_FILE);
  console.log(`✅ Backup created: ${BACKUP_FILE}\n`);
} catch (err) {
  console.error('❌ Failed to create backup:', err.message);
  process.exit(1);
}
// Read input file
console.log('📖 Reading input file...');
let data;
try {
  const fileContent = fs.readFileSync(INPUT_FILE, 'utf8');
  data = JSON.parse(fileContent);
  console.log(`✅ Loaded ${Object.keys(data.pitchers || {}).length} pitchers\n`);
} catch (err) {
  console.error('❌ Failed to read input file:', err.message);
  process.exit(1);
}

// Strip unused stats
console.log('✂️  Stripping unused stats...');
let totalGames = 0;
let totalStatsRemoved = 0;

if (data.pitchers) {
  for (const pitcherId in data.pitchers) {
    const pitcher = data.pitchers[pitcherId];
    
    if (pitcher.games && Array.isArray(pitcher.games)) {
      pitcher.games.forEach(game => {
        totalGames++;
        
        if (game.stats) {
          // Keep only IP and PC
          const strippedStats = {
            IP: game.stats.IP || null,
            PC: game.stats.PC || null
          };
          
          // Count removed stats
          const removedCount = Object.keys(game.stats).length - 2;
          totalStatsRemoved += removedCount;
          
          // Replace with stripped version
          game.stats = strippedStats;
        }
      });
    }
  }
}

console.log(`✅ Processed ${totalGames} games`);
console.log(`✅ Removed ${totalStatsRemoved} unused stat fields\n`);

// Write output file
console.log('💾 Writing optimized file...');
try {
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(data, null, 2));
  console.log(`✅ Written: ${OUTPUT_FILE}\n`);
} catch (err) {
  console.error('❌ Failed to write output file:', err.message);
  process.exit(1);
}

// Show file sizes
const originalSize = fs.statSync(INPUT_FILE).size;
const optimizedSize = fs.statSync(OUTPUT_FILE).size;
const savedBytes = originalSize - optimizedSize;
const savedPercent = ((savedBytes / originalSize) * 100).toFixed(1);

console.log('📊 Results:');
console.log(`   Original:  ${(originalSize / 1024 / 1024).toFixed(2)} MB`);
console.log(`   Optimized: ${(optimizedSize / 1024 / 1024).toFixed(2)} MB`);
console.log(`   Saved:     ${(savedBytes / 1024 / 1024).toFixed(2)} MB (${savedPercent}%)\n`);

console.log('✅ Done! To use the optimized file:');
console.log('   1. Review the optimized file');
console.log('   2. If satisfied, replace the original:');
console.log('      mv data/pitchers_played_index_optimized_stripped.json data/pitchers_played_index.json');
console.log('   3. Refresh browser\n');
console.log(`💾 Backup available at: ${BACKUP_FILE}`);
