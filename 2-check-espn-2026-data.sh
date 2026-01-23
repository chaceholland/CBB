#!/bin/bash
# 2-check-espn-2026-data.sh
# Test what 2026 data ESPN API has available

cd /Users/chace/Desktop/CBB

echo "🔍 Checking ESPN API for 2026 College Baseball Data"
echo "===================================================="
echo ""

# Create temporary test script
cat > /tmp/test-espn-2026.cjs << 'EOF'
const https = require('https');

// Test teams from different conferences
const testTeams = [
  { name: 'LSU (SEC)', id: 99 },
  { name: 'Vanderbilt (SEC)', id: 238 },
  { name: 'Texas (SEC)', id: 251 },
  { name: 'Stanford (ACC)', id: 24 },
  { name: 'Florida State (ACC)', id: 52 },
  { name: 'TCU (Big 12)', id: 2628 },
  { name: 'Oregon State (Pac-12)', id: 204 }
];

console.log('Testing ESPN API for 2026 schedules across conferences...\n');

let completed = 0;
const total = testTeams.length;

testTeams.forEach(team => {
  const url = `https://site.api.espn.com/apis/site/v2/sports/baseball/college-baseball/teams/${team.id}/schedule?season=2026`;
  
  https.get(url, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      try {
        const json = JSON.parse(data);
        const events = json.events || [];
        console.log(`✅ ${team.name}: ${events.length} games found`);
        if (events.length > 0) {
          const firstGame = events[0];
          const date = new Date(firstGame.date);
          console.log(`   First game: ${firstGame.name}`);
          console.log(`   Date: ${date.toLocaleDateString()}\n`);
        } else {
          console.log('   No games scheduled yet\n');
        }
      } catch(e) {
        console.log(`❌ ${team.name}: API error or no data\n`);
      }
      
      completed++;
      if (completed === total) {
        console.log('\n📊 Summary:');
        console.log('If you see 0 games for most teams, ESPN hasn\'t populated 2026 yet.');
        console.log('Use Script 1 to scrape team athletic sites instead.');
      }
    });
  }).on('error', (e) => {
    console.error(`❌ ${team.name}: ${e.message}\n`);
    completed++;
  });
});
EOF

node /tmp/test-espn-2026.cjs

echo ""
echo "💡 Note: ESPN typically doesn't populate college baseball schedules"
echo "   until January/February before the season starts."
echo ""
echo "   Team athletic websites (Script 1) are your best source for"
echo "   early 2026 data, as schools publish schedules months in advance."
