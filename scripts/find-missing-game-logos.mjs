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

console.log('Total unique teams in schedule:', gameTeams.size);
console.log('Total teams in teams.json:', Object.keys(teamsById).length);

// Find teams in games that have no logo
const noLogo = [];
const notInTeamsJson = [];

gameTeams.forEach(tid => {
  const team = teamsById[tid];
  if (!team) {
    notInTeamsJson.push(tid);
  } else if (!team.logo || team.logo.trim() === '') {
    noLogo.push({ id: tid, name: team.name });
  }
});

console.log('\n📋 Teams in games with MISSING LOGOS:', noLogo.length);
if (noLogo.length > 0) {
  noLogo.forEach(t => {
    console.log(' -', t.id, t.name);
  });
}

console.log('\n⚠️  Teams in games NOT in teams.json:', notInTeamsJson.length);
if (notInTeamsJson.length > 0) {
  notInTeamsJson.slice(0, 10).forEach(tid => {
    console.log(' -', tid);
  });
  if (notInTeamsJson.length > 10) {
    console.log(` ... and ${notInTeamsJson.length - 10} more`);
  }
}
