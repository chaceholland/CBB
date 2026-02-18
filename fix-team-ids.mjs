#!/usr/bin/env node
/**
 * Fix slug-based teamIds in pitchers.json → replace with numeric ESPN IDs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PITCHERS_PATH = path.join(__dirname, 'data/pitchers.json');

const FIX_MAP = {
  'iowa':          '167',
  'nebraska':      '99',
  'oregon':        '273',
  'cincinnati':    '161',
  'penn-state':    '414',
  'georgia-tech':  '77',
  'purdue':        '189',
  'virginia-tech': '132',
  'arizona-state': '59',
  'stanford':      '64',
  'arizona':       '60',
};

const data = JSON.parse(fs.readFileSync(PITCHERS_PATH, 'utf-8'));

// Backup
const bak = PITCHERS_PATH.replace('.json', `_teamid_bak_${Date.now()}.json`);
fs.writeFileSync(bak, JSON.stringify(data, null, 2));
console.log(`Backup: ${bak}`);

let fixed = 0;
for (const team of data.teams) {
  const slug = team.teamId || team.team_id;
  if (FIX_MAP[slug]) {
    const numericId = FIX_MAP[slug];
    console.log(`  ${team.team}: "${slug}" → "${numericId}"`);
    team.teamId  = numericId;
    team.team_id = numericId;
    fixed++;
  }
}

fs.writeFileSync(PITCHERS_PATH, JSON.stringify(data, null, 2));
console.log(`\n✅ Fixed ${fixed} teams`);
