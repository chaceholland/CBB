#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const pitchersData = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'pitchers.json'), 'utf8'));
const teamsData = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'teams.json'), 'utf8'));

// Get all 64 tracked teams
const trackedTeams = new Set();
(pitchersData.teams || []).forEach(t => {
  const tid = String(t.teamId || t.team_id || '');
  if (tid) trackedTeams.add(tid);
});

// Build teams index
const teamsById = {};
teamsData.teams.forEach(t => {
  teamsById[t.id] = t;
});

console.log('Reading games from schedule.html...\n');

// Read games from schedule.html
const scheduleHtml = fs.readFileSync(path.join(ROOT, 'schedule.html'), 'utf8');
const gamesMatch = scheduleHtml.match(/const GAMES2026\s*=\s*(\[[\s\S]*?\]);/);

if (!gamesMatch) {
  console.log('Could not find GAMES2026 in schedule.html');
  process.exit(1);
}

const games = eval(gamesMatch[1]);

// Find all unique team IDs in games
const gameTeams = new Set();
games.forEach(g => {
  gameTeams.add(String(g.home));
  gameTeams.add(String(g.away));
});

console.log('Total unique teams in games:', gameTeams.size);
console.log('Tracked teams:', trackedTeams.size);

// Find teams in games that have no logo
const noLogo = [];
gameTeams.forEach(tid => {
  const team = teamsById[tid];
  if (!team) {
    noLogo.push({ id: tid, reason: 'Not in teams.json' });
  } else if (!team.logo || team.logo.trim() === '') {
    noLogo.push({ id: tid, name: team.name, reason: 'Empty logo' });
  }
});

console.log('\nTeams in games with missing logos:', noLogo.length);
if (noLogo.length > 0) {
  noLogo.slice(0, 20).forEach(t => {
    console.log(' -', t.id, t.name || '(unknown)', '-', t.reason);
  });
  if (noLogo.length > 20) {
    console.log(` ... and ${noLogo.length - 20} more`);
  }
}
