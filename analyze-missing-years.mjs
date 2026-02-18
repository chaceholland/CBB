#!/usr/bin/env node

import fs from 'fs';

const pitchersData = JSON.parse(fs.readFileSync('data/pitchers.json', 'utf-8'));

const teamStats = [];

for (const team of pitchersData.teams) {
  const totalPitchers = team.pitchers.length;
  const missingYears = team.pitchers.filter(p => !p.year || p.year === '').length;

  if (missingYears > 0) {
    teamStats.push({
      team: team.team,
      total: totalPitchers,
      missing: missingYears,
      percentage: Math.round((missingYears / totalPitchers) * 100)
    });
  }
}

// Sort by number of missing years
teamStats.sort((a, b) => b.missing - a.missing);

console.log('Teams with Missing Year Data');
console.log('='.repeat(60));
console.log('Team'.padEnd(30) + 'Missing'.padEnd(10) + 'Total'.padEnd(10) + '%');
console.log('-'.repeat(60));

for (const stat of teamStats) {
  console.log(
    stat.team.padEnd(30) +
    stat.missing.toString().padEnd(10) +
    stat.total.toString().padEnd(10) +
    stat.percentage + '%'
  );
}

console.log('\nTotal teams with missing years: ' + teamStats.length);
console.log('Total pitchers missing years: ' + teamStats.reduce((sum, s) => sum + s.missing, 0));
