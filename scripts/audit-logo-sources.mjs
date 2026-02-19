#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const scheduleData = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'schedule.json'), 'utf8'));
const teamsData = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'teams.json'), 'utf8'));

// Build teams index
const teamsById = {};
teamsData.teams.forEach(t => {
  teamsById[t.id] = t;
});

// Find all unique team IDs in games
const gameTeams = new Set();
const games = scheduleData.games || [];

games.forEach(g => {
  if (g.home) gameTeams.add(String(g.home));
  if (g.away) gameTeams.add(String(g.away));
});

// Categorize logos
const espnCdn = [];
const localLogos = [];
const noLogo = [];
const notInTeamsJson = [];

gameTeams.forEach(tid => {
  const team = teamsById[tid];

  if (!team) {
    notInTeamsJson.push(tid);
  } else if (!team.logo || team.logo.trim() === '') {
    noLogo.push({ id: tid, name: team.name });
  } else if (team.logo.startsWith('http')) {
    espnCdn.push({ id: tid, name: team.name, logo: team.logo });
  } else {
    localLogos.push({ id: tid, name: team.name, logo: team.logo });
  }
});

console.log('Logo Source Audit for Teams in Schedule:\n');
console.log(`Total teams in schedule: ${gameTeams.size}`);
console.log(`├─ ESPN CDN URLs: ${espnCdn.length}`);
console.log(`├─ Local logos: ${localLogos.length}`);
console.log(`├─ No logo: ${noLogo.length}`);
console.log(`└─ Not in teams.json: ${notInTeamsJson.length}\n`);

console.log(`📊 ${espnCdn.length} teams are using ESPN CDN - these might fail to load if ESPN blocks requests\n`);

// Sample some ESPN CDN teams
if (espnCdn.length > 0) {
  console.log('Sample teams using ESPN CDN:');
  espnCdn.slice(0, 10).forEach(t => {
    console.log(`  - ${t.id}: ${t.name}`);
  });
  if (espnCdn.length > 10) {
    console.log(`  ... and ${espnCdn.length - 10} more`);
  }
}
