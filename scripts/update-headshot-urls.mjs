/**
 * Update cbb_pitchers.headshot from pitchers.json.
 * Uses Storage URLs for locally-uploaded headshots and direct HTTP URLs for scraped ones.
 * Includes 'name' in upsert to satisfy NOT NULL constraint.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '../data');

const SUPABASE_URL = 'https://dtnozcqkuzhjmjvsfjqk.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0bm96Y3FrdXpoam1qdnNmanFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDkwNjgzMCwiZXhwIjoyMDgwNDgyODMwfQ.JcESpa1uZq8tbc6XrGJynrEkW-eA9JHi41KrKlnXeUA';
const BUCKET = 'pitcher-headshots-2026';
const authHeaders = { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' };

const raw = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'pitchers.json'), 'utf8'));

const updates = []; // { pitcher_id, name, headshot }

for (const team of raw.teams) {
  for (const pitcher of (team.pitchers || [])) {
    const headshot = pitcher.headshot;
    if (!headshot) continue;

    let headshotUrl;
    if (headshot.startsWith('http')) {
      headshotUrl = headshot;
    } else {
      // Local file — use Storage URL
      const localPath = path.join(__dirname, '..', headshot);
      if (!fs.existsSync(localPath)) continue;
      const ext = path.extname(headshot).toLowerCase();
      const storageKey = `${pitcher.id.replace(/\//g, '_')}${ext}`;
      headshotUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${storageKey}`;
    }

    updates.push({ pitcher_id: pitcher.id, name: pitcher.name, headshot: headshotUrl });
  }
}

console.log(`Updating ${updates.length} pitcher headshots in cbb_pitchers...`);

const BATCH = 100;
let dbUpdated = 0, dbFailed = 0;

for (let i = 0; i < updates.length; i += BATCH) {
  const batch = updates.slice(i, i + BATCH);
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/cbb_pitchers`, {
    method: 'POST',
    headers: { ...authHeaders, 'Prefer': 'resolution=merge-duplicates' },
    body: JSON.stringify(batch.map(u => ({ pitcher_id: u.pitcher_id, name: u.name, headshot: u.headshot })))
  });
  if (!resp.ok) {
    console.error(`\nBatch ${i}-${i + BATCH} failed:`, await resp.text());
    dbFailed += batch.length;
  } else {
    dbUpdated += batch.length;
    process.stdout.write(`\r  Updated: ${dbUpdated}/${updates.length}`);
  }
}

console.log(`\n\n✅ Done! Updated ${dbUpdated} headshots. Failed: ${dbFailed}`);
