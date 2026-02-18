#!/usr/bin/env node

import fs from 'fs';

const pitchersPath = 'data/pitchers.json';
const pitchersData = JSON.parse(fs.readFileSync(pitchersPath, 'utf-8'));

console.log('Missing Headshots Report');
console.log('='.repeat(70));

const missingHeadshots = [];

for (const team of pitchersData.teams) {
  for (const pitcher of team.pitchers) {
    if (!pitcher.headshot || pitcher.headshot === '') {
      missingHeadshots.push({
        team: team.team,
        teamId: team.teamId || team.team_id,
        pitcher: pitcher.name,
        pitcherId: pitcher.id
      });
    }
  }
}

// Group by team
const byTeam = {};
for (const missing of missingHeadshots) {
  if (!byTeam[missing.team]) {
    byTeam[missing.team] = [];
  }
  byTeam[missing.team].push(missing);
}

console.log(`\nFound ${missingHeadshots.length} pitchers missing headshots\n`);

for (const [teamName, pitchers] of Object.entries(byTeam)) {
  console.log(`${teamName} (${pitchers.length} missing):`);
  for (const p of pitchers) {
    console.log(`  - ${p.pitcher} (${p.pitcherId})`);
  }
  console.log('');
}

console.log('\nNext Steps:');
console.log('1. Use Chrome extension to scrape these specific teams');
console.log('2. Or manually download headshots and add to data/headshots/');
console.log('3. Update pitcher.headshot field with path like "data/headshots/team_id-P1.jpg"');
