#!/usr/bin/env node
/**
 * Backfill ESPN pitcher IDs into pitchers.json
 *
 * Fetches distinct (pitcher_id, pitcher_name, team_id) from Supabase
 * cbb_pitcher_participation, then matches by normalized name + team_id
 * to add espnId to each pitcher entry in pitchers.json.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SUPABASE_URL = 'https://dtnozcqkuzhjmjvsfjqk.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0bm96Y3FrdXpoam1qdnNmanFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ5MDY4MzAsImV4cCI6MjA4MDQ4MjgzMH0.7puo2RCr6VMNNp_lywpAqufLEGnnE3TYqAtX8zQ0X8c';
const PITCHERS_PATH = path.join(__dirname, 'data/pitchers.json');

function normName(s) {
  return String(s || '').toLowerCase().trim().replace(/\s+/g, ' ');
}

async function fetchAllParticipation() {
  const rows = [];
  let offset = 0;
  const pageSize = 1000;
  const headers = { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` };

  console.log('Fetching participation data from Supabase...');
  while (true) {
    const url = `${SUPABASE_URL}/rest/v1/cbb_pitcher_participation?select=pitcher_id,pitcher_name,team_id&order=pitcher_id.asc&limit=${pageSize}&offset=${offset}`;
    const resp = await fetch(url, { headers });
    if (!resp.ok) {
      console.error(`  Supabase error: ${resp.status} ${resp.statusText}`);
      break;
    }
    const page = await resp.json();
    if (!page.length) break;
    rows.push(...page);
    offset += page.length;
    if (page.length < pageSize) break;
  }

  console.log(`  Fetched ${rows.length} rows`);
  return rows;
}

function buildLookup(rows) {
  // Build two lookup maps:
  // 1. normName(pitcher_name) + team_id → pitcher_id  (preferred: name+team match)
  // 2. normName(pitcher_name) → pitcher_id            (fallback: name only)
  const byNameTeam = {};
  const byName = {};
  const conflicts = new Set();

  for (const row of rows) {
    const pid = String(row.pitcher_id || '');
    const name = normName(row.pitcher_name);
    const tid = String(row.team_id || '');
    if (!pid || !name) continue;

    const key1 = `${name}|${tid}`;
    if (!byNameTeam[key1]) byNameTeam[key1] = pid;

    if (!byName[name]) {
      byName[name] = pid;
    } else if (byName[name] !== pid) {
      conflicts.add(name); // same name, different IDs across teams
    }
  }

  return { byNameTeam, byName, conflicts };
}

function main() {
  fetchAllParticipation().then(rows => {
    if (!rows.length) {
      console.error('No participation data found. Cannot backfill.');
      process.exit(1);
    }

    const { byNameTeam, byName, conflicts } = buildLookup(rows);
    console.log(`\nBuilt lookup: ${Object.keys(byNameTeam).length} name+team combos, ${Object.keys(byName).length} unique names`);
    if (conflicts.size) {
      console.log(`  Names with multiple IDs (will require team match): ${conflicts.size}`);
    }

    const data = JSON.parse(fs.readFileSync(PITCHERS_PATH, 'utf-8'));

    // Backup
    const bak = PITCHERS_PATH.replace('.json', `_prebak_${Date.now()}.json`);
    fs.writeFileSync(bak, JSON.stringify(data, null, 2));
    console.log(`\nBackup saved: ${bak}`);

    let matched = 0, unmatched = 0, alreadyHad = 0;
    const unmatchedList = [];

    for (const team of data.teams) {
      const tid = String(team.teamId || team.team_id || '');

      for (const pitcher of (team.pitchers || [])) {
        // Skip if already has a valid ESPN ID
        const existing = pitcher.espnId || pitcher.espn_id;
        if (existing && /^\d+$/.test(String(existing))) {
          alreadyHad++;
          continue;
        }

        const name = normName(pitcher.name || pitcher.displayName);

        // Try name+team first, then name-only (unless name has conflicts)
        const key1 = `${name}|${tid}`;
        let espnId = byNameTeam[key1];

        if (!espnId && !conflicts.has(name)) {
          espnId = byName[name];
        }

        if (espnId) {
          pitcher.espnId = espnId;
          matched++;
        } else {
          unmatched++;
          unmatchedList.push({ name: pitcher.name, team: team.team, teamId: tid });
        }
      }
    }

    fs.writeFileSync(PITCHERS_PATH, JSON.stringify(data, null, 2));

    console.log('\n' + '='.repeat(60));
    console.log('RESULTS');
    console.log('='.repeat(60));
    console.log(`  Already had ESPN ID : ${alreadyHad}`);
    console.log(`  Matched (added)     : ${matched}`);
    console.log(`  Unmatched           : ${unmatched}`);

    if (unmatchedList.length) {
      console.log('\nUnmatched pitchers (not in participation data yet):');
      for (const p of unmatchedList) {
        console.log(`  - ${p.name} (${p.team}, teamId=${p.teamId})`);
      }
    }

    console.log('\n✅ pitchers.json updated');
    console.log('\nNext steps:');
    console.log('  git add data/pitchers.json');
    console.log('  git commit -m "data: backfill ESPN pitcher IDs from Supabase"');
    console.log('  vercel --prod');
  }).catch(err => {
    console.error('Fatal error:', err.message);
    process.exit(1);
  });
}

main();
