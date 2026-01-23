#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('📅 Creating Weekly Pitcher Participation Indexes');
console.log('=================================================\n');

const dataDir = path.join(__dirname, 'data');
const mainIndexFile = path.join(dataDir, 'pitchers_played_index.json');

// Load main index
const mainIndex = JSON.parse(fs.readFileSync(mainIndexFile, 'utf8'));
const pitchers = mainIndex.pitchers || {};

console.log(`📋 Loaded ${Object.keys(pitchers).length} pitchers\n`);

// Create weekly indexes
const weeklyData = {};
for (let week = 1; week <= 26; week++) {
  weeklyData[week] = {};
}

// Organize pitchers by week
Object.values(pitchers).forEach(pitcher => {
  pitcher.games?.forEach(game => {
    const week = game.week;
    if (week >= 1 && week <= 26) {
      if (!weeklyData[week][pitcher.id]) {
        weeklyData[week][pitcher.id] = {
          id: pitcher.id,
          name: pitcher.name,
          games: []
        };
      }
      weeklyData[week][pitcher.id].games.push(game);
    }
  });
});

// Save individual week files
console.log('Creating week files...');
for (let week = 1; week <= 26; week++) {
  const weekNum = String(week).padStart(2, '0');
  const weekFile = {
    week: week,
    lastUpdated: new Date().toISOString(),
    pitchers: weeklyData[week]
  };
  
  const filePath = path.join(dataDir, `pitchers_played_index_week_${weekNum}.json`);
  fs.writeFileSync(filePath, JSON.stringify(weekFile, null, 2));
  
  const pitcherCount = Object.keys(weeklyData[week]).length;
  if (pitcherCount > 0) {
    console.log(`  ✅ Week ${weekNum}: ${pitcherCount} pitchers`);
  }
}

// Create summary week index
const weekSummary = {
  lastUpdated: new Date().toISOString(),
  weeks: {}
};

for (let week = 1; week <= 26; week++) {
  weekSummary.weeks[week] = {
    pitcherCount: Object.keys(weeklyData[week]).length,
    gameCount: Object.values(weeklyData[week]).reduce((sum, p) => sum + p.games.length, 0)
  };
}

fs.writeFileSync(
  path.join(dataDir, 'pitchers_played_index_week.json'),
  JSON.stringify(weekSummary, null, 2)
);
console.log('\n✅ Created pitchers_played_index_week.json');

console.log('\n📊 Summary:');
console.log(`   Total pitchers: ${Object.keys(pitchers).length}`);
console.log(`   Weeks with data: ${Object.keys(weekSummary.weeks).filter(w => weekSummary.weeks[w].pitcherCount > 0).length}`);
console.log('\n✨ Done!\n');
