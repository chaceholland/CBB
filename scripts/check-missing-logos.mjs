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

console.log('Checking logos for', trackedTeams.size, 'tracked teams...\n');

// Check which teams have missing logos
const missing = [];
const teamsById = {};
teamsData.teams.forEach(t => { teamsById[t.id] = t; });

trackedTeams.forEach(tid => {
  const team = teamsById[tid];
  if (!team) {
    missing.push({ id: tid, reason: 'Not in teams.json' });
  } else if (!team.logo || team.logo.trim() === '') {
    missing.push({ id: tid, name: team.name, reason: 'Empty logo field' });
  }
});

if (missing.length === 0) {
  console.log('✓ All tracked teams have logos!');
} else {
  console.log('Missing logos for', missing.length, 'teams:');
  missing.forEach(m => {
    console.log(' -', m.id, m.name || '(unknown)', '-', m.reason);
  });
}
