#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const scheduleData = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'schedule.json'), 'utf8'));
const teamsData = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'teams.json'), 'utf8'));

const searchNames = ['Fordham', 'Quinnipiac', 'Long Island', 'Lehigh'];

// Build reverse lookup: id -> team
const teamsById = {};
teamsData.teams.forEach(t => {
  teamsById[t.id] = t;
});

// Build name lookup
const teamsByName = {};
teamsData.teams.forEach(t => {
  const key = (t.name || '').toLowerCase();
  teamsByName[key] = t;
});

console.log('Searching for teams in schedule:\n');

searchNames.forEach(searchName => {
  const searchKey = searchName.toLowerCase();

  // Find team in teams.json
  const teamEntry = Object.values(teamsById).find(t =>
    (t.name || '').toLowerCase().includes(searchKey)
  );

  if (!teamEntry) {
    console.log(`❌ ${searchName} - NOT FOUND in teams.json\n`);
    return;
  }

  console.log(`${searchName}:`);
  console.log(`  ID in teams.json: ${teamEntry.id}`);
  console.log(`  Logo: ${teamEntry.logo || '(none)'}`);

  // Find games with this team
  const games = scheduleData.games.filter(g =>
    String(g.home) === String(teamEntry.id) ||
    String(g.away) === String(teamEntry.id)
  );

  console.log(`  Games found: ${games.length}`);

  if (games.length > 0) {
    const sampleGame = games[0];
    console.log(`  Sample game: ${sampleGame.away} @ ${sampleGame.home}`);
  }

  console.log();
});
