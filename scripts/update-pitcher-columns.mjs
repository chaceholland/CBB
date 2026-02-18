/**
 * Populate new cbb_pitchers columns (position, year, height, weight, hometown, bats_throws)
 * from pitchers.json via REST API PATCH
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SUPABASE_URL = 'https://dtnozcqkuzhjmjvsfjqk.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0bm96Y3FrdXpoam1qdnNmanFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDkwNjgzMCwiZXhwIjoyMDgwNDgyODMwfQ.JcESpa1uZq8tbc6XrGJynrEkW-eA9JHi41KrKlnXeUA';

const HEADERS = {
  'apikey': SERVICE_KEY,
  'Authorization': `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'resolution=merge-duplicates',
};

const raw = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/pitchers.json'), 'utf8'));

const updates = raw.teams.flatMap(team =>
  (team.pitchers || []).map(p => ({
    pitcher_id: p.id,
    team_id: team.team_id || team.teamId,
    name: p.name,
    display_name: p.displayName || p.name,
    position: p.position || null,
    year: p.year || null,
    height: p.height || null,
    weight: p.weight ? String(p.weight) : null,
    hometown: p.hometown || null,
    bats_throws: p.batsThrows || p.bats_throws || null,
  }))
).filter(p => p.pitcher_id && p.name);

console.log(`Updating ${updates.length} pitchers with new columns...`);

// Use upsert (POST with merge-duplicates) in batches
const BATCH = 100;
let done = 0;
for (let i = 0; i < updates.length; i += BATCH) {
  const chunk = updates.slice(i, i + BATCH);
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/cbb_pitchers`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify(chunk),
  });
  if (!resp.ok) {
    const err = await resp.text();
    console.error(`Batch ${i}-${i + BATCH} FAILED:`, err);
    process.exit(1);
  }
  done += chunk.length;
  process.stdout.write(`  ${done}/${updates.length}\r`);
}

console.log(`\n✅ Done updating pitcher columns`);

// Summary of what was populated
const withPos = updates.filter(p => p.position).length;
const withYear = updates.filter(p => p.year).length;
const withHeight = updates.filter(p => p.height).length;
const withWeight = updates.filter(p => p.weight).length;
const withBT = updates.filter(p => p.bats_throws).length;
console.log(`  position:   ${withPos}`);
console.log(`  year:       ${withYear}`);
console.log(`  height:     ${withHeight}`);
console.log(`  weight:     ${withWeight}`);
console.log(`  bats_throws:${withBT}`);
