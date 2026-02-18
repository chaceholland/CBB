/**
 * Task 2: Populate cbb_teams from pitchers.json via REST API
 * Uses existing columns: team_id, name, display_name, conference, logo
 * (slug + abbreviation added after ALTER TABLE migration)
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

const teams = raw.teams.map(t => ({
  team_id: t.team_id || t.teamId,
  name: t.team,
  display_name: t.team,
  conference: t.conference || null,
  logo: t.logo || null,
})).filter(t => t.team_id && t.name);

console.log(`Upserting ${teams.length} teams...`);

// Batch upsert in chunks of 50
const BATCH = 50;
let inserted = 0;
for (let i = 0; i < teams.length; i += BATCH) {
  const chunk = teams.slice(i, i + BATCH);
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/cbb_teams`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify(chunk),
  });
  if (!resp.ok) {
    const err = await resp.text();
    console.error(`Batch ${i}-${i+BATCH} FAILED:`, err);
    process.exit(1);
  }
  inserted += chunk.length;
  process.stdout.write(`  ${inserted}/${teams.length}\r`);
}

console.log(`\n✅ cbb_teams populated: ${teams.length} teams`);

// Verify
const check = await fetch(`${SUPABASE_URL}/rest/v1/cbb_teams?select=count`, {
  headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` },
});
const [{ count }] = await check.json();
console.log(`Verified: ${count} rows in cbb_teams`);
