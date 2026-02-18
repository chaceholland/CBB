/**
 * Task 3: Populate cbb_pitchers from pitchers.json via REST API
 * Uses existing columns: pitcher_id, team_id, name, display_name, number, headshot
 * (position, year, height, weight, hometown, bats_throws added after ALTER TABLE)
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

const pitchers = raw.teams.flatMap(team =>
  (team.pitchers || []).map(p => ({
    pitcher_id: p.id,
    team_id: team.team_id || team.teamId,
    name: p.name,
    display_name: p.displayName || p.name,
    number: p.number || null,
    // Use HTTP URLs directly; local paths won't resolve on Vercel
    headshot: p.headshot && p.headshot.startsWith('http') ? p.headshot : null,
    espn_link: p.espnLink || p.espn_link || null,
  }))
).filter(p => p.pitcher_id && p.name);

console.log(`Upserting ${pitchers.length} pitchers...`);

const BATCH = 100;
let inserted = 0;
for (let i = 0; i < pitchers.length; i += BATCH) {
  const chunk = pitchers.slice(i, i + BATCH);
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/cbb_pitchers`, {
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
  process.stdout.write(`  ${inserted}/${pitchers.length}\r`);
}

console.log(`\n✅ cbb_pitchers populated: ${pitchers.length} pitchers`);

// Count how many have headshots
const withHeadshot = pitchers.filter(p => p.headshot).length;
console.log(`  ${withHeadshot} with headshot URL, ${pitchers.length - withHeadshot} without`);

// Verify
const check = await fetch(`${SUPABASE_URL}/rest/v1/cbb_pitchers?select=count`, {
  headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` },
});
const [{ count }] = await check.json();
console.log(`Verified: ${count} rows in cbb_pitchers`);
