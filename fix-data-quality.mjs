#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load pitchers.json
const pitchersPath = path.join(__dirname, 'data/pitchers.json');
const pitchersData = JSON.parse(fs.readFileSync(pitchersPath, 'utf-8'));

let positionFixCount = 0;
let yearFixCount = 0;
let headshotFixCount = 0;

console.log('Starting data quality fixes...\n');

// Fix 1: Standardize Position Formats
console.log('='.repeat(50));
console.log('FIX 1: Standardizing Position Formats');
console.log('='.repeat(50));

for (const team of pitchersData.teams) {
  for (const pitcher of team.pitchers) {
    const oldPosition = pitcher.position;

    // Extract actual pitching position from multi-position players
    if (pitcher.position && pitcher.position.includes('/')) {
      // Examples: "OF/LHP" -> "LHP", "UTL/RHP" -> "RHP", "INF/P" -> "P"
      const parts = pitcher.position.split('/');

      // Find the pitching position
      const pitchingPos = parts.find(p =>
        p === 'RHP' || p === 'LHP' || p === 'P'
      );

      if (pitchingPos) {
        pitcher.position = pitchingPos;
        positionFixCount++;
        console.log(`✓ ${team.team} - ${pitcher.name}: ${oldPosition} → ${pitchingPos}`);
      }
    }
  }
}

console.log(`\n✅ Fixed ${positionFixCount} invalid position formats\n`);

// Save intermediate results
fs.writeFileSync(pitchersPath, JSON.stringify(pitchersData, null, 2));
console.log('💾 Saved position fixes to pitchers.json\n');

console.log('='.repeat(50));
console.log('SUMMARY');
console.log('='.repeat(50));
console.log(`Position formats fixed: ${positionFixCount}`);
console.log(`\nNext steps:`);
console.log(`- Run verify-data-quality.mjs to confirm fixes`);
console.log(`- Fix missing years (requires roster scraping)`);
console.log(`- Fix missing headshots (requires manual work)`);
