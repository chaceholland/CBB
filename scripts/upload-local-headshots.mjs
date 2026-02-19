/**
 * Upload local headshots from data/headshots/ to Supabase Storage,
 * then update cbb_pitchers.headshot with the public Storage URLs.
 * Uses pitchers.json to map pitcher IDs to local files.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '../data');
const HEADSHOTS_DIR = path.join(DATA_DIR, 'headshots');

const SUPABASE_URL = 'https://dtnozcqkuzhjmjvsfjqk.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0bm96Y3FrdXpoam1qdnNmanFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDkwNjgzMCwiZXhwIjoyMDgwNDgyODMwfQ.JcESpa1uZq8tbc6XrGJynrEkW-eA9JHi41KrKlnXeUA';
const BUCKET = 'pitcher-headshots-2026';
const authHeaders = { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` };

// --- Step 1: Create bucket if needed ---
async function ensureBucket() {
  // Try to get bucket
  const resp = await fetch(`${SUPABASE_URL}/storage/v1/bucket/${BUCKET}`, { headers: authHeaders });
  if (resp.ok) {
    console.log(`Bucket '${BUCKET}' already exists.`);
    return;
  }
  // Create it
  const create = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
    method: 'POST',
    headers: { ...authHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: BUCKET, name: BUCKET, public: true })
  });
  if (!create.ok) {
    console.error('Failed to create bucket:', await create.text());
    process.exit(1);
  }
  console.log(`Bucket '${BUCKET}' created.`);
}

// --- Step 2: Read pitchers.json and build upload plan ---
const raw = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'pitchers.json'), 'utf8'));
const uploadPlan = []; // { pitcher_id, localPath, storageKey, contentType }
const httpUrlUpdates = []; // { pitcher_id, url } for pitchers with existing HTTP URLs

for (const team of raw.teams) {
  for (const pitcher of (team.pitchers || [])) {
    const headshot = pitcher.headshot;
    if (!headshot) continue;

    if (headshot.startsWith('http')) {
      // Already has an external URL — use it directly
      httpUrlUpdates.push({ pitcher_id: pitcher.id, headshot });
    } else {
      // Relative local path like "data/headshots/auburn_2-2-P1.jpg"
      const localPath = path.join(__dirname, '..', headshot);
      if (!fs.existsSync(localPath)) continue;

      const ext = path.extname(headshot).toLowerCase();
      const contentType = ext === '.png' ? 'image/png' : 'image/jpeg';
      // Store in bucket as pitcher_id.ext — replace "/" with "_" for safety
      const storageKey = `${pitcher.id.replace(/\//g, '_')}${ext}`;
      uploadPlan.push({ pitcher_id: pitcher.id, localPath, storageKey, contentType });
    }
  }
}

console.log(`Upload plan: ${uploadPlan.length} local files + ${httpUrlUpdates.length} HTTP URLs`);

// --- Step 3: Upload files to storage ---
await ensureBucket();

const CONCURRENCY = 5;
let uploaded = 0, skipped = 0, failed = 0;
const storageUpdates = []; // { pitcher_id, headshot_url }

async function uploadFile(item) {
  const { pitcher_id, localPath, storageKey, contentType } = item;
  const fileData = fs.readFileSync(localPath);

  // Check if file already exists
  let checkResp;
  try {
    checkResp = await fetch(
      `${SUPABASE_URL}/storage/v1/object/info/public/${BUCKET}/${storageKey}`,
      { headers: authHeaders }
    );
  } catch (e) {
    checkResp = { ok: false };
  }
  if (checkResp.ok) {
    skipped++;
    const url = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${storageKey}`;
    storageUpdates.push({ pitcher_id, headshot: url });
    return;
  }

  // Upload with retries
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const resp = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${storageKey}`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': contentType },
        body: fileData
      });
      if (resp.ok) {
        uploaded++;
        const url = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${storageKey}`;
        storageUpdates.push({ pitcher_id, headshot: url });
        return;
      } else {
        const errText = await resp.text();
        // "already exists" counts as success
        if (errText.includes('already exists') || errText.includes('duplicate')) {
          skipped++;
          const url = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${storageKey}`;
          storageUpdates.push({ pitcher_id, headshot: url });
          return;
        }
        if (attempt === 3) { failed++; console.error(`  ✗ ${pitcher_id}: ${errText.slice(0, 60)}`); }
      }
    } catch (err) {
      if (attempt < 3) await new Promise(r => setTimeout(r, 1000 * attempt));
      else { failed++; }
    }
  }
}

// Process in batches with concurrency
console.log(`\nUploading ${uploadPlan.length} files (concurrency=${CONCURRENCY})...`);
for (let i = 0; i < uploadPlan.length; i += CONCURRENCY) {
  const batch = uploadPlan.slice(i, i + CONCURRENCY);
  await Promise.all(batch.map(uploadFile));
  if ((i + CONCURRENCY) % 50 === 0 || i + CONCURRENCY >= uploadPlan.length) {
    process.stdout.write(`\r  Progress: ${Math.min(i + CONCURRENCY, uploadPlan.length)}/${uploadPlan.length} (uploaded=${uploaded}, skipped=${skipped}, failed=${failed})`);
  }
}
console.log('\n');

// --- Step 4: Update cbb_pitchers in Supabase ---
// Combine storage uploads + direct HTTP URLs
const allUpdates = [
  ...storageUpdates,
  ...httpUrlUpdates
];
console.log(`Updating ${allUpdates.length} pitcher headshots in cbb_pitchers...`);

const BATCH = 100;
let dbUpdated = 0;
for (let i = 0; i < allUpdates.length; i += BATCH) {
  const batch = allUpdates.slice(i, i + BATCH);
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/cbb_pitchers`, {
    method: 'POST',
    headers: { ...authHeaders, 'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates' },
    body: JSON.stringify(batch.map(u => ({ pitcher_id: u.pitcher_id, headshot: u.headshot })))
  });
  if (!resp.ok) {
    console.error(`Batch ${i} DB update failed:`, await resp.text());
  } else {
    dbUpdated += batch.length;
    process.stdout.write(`\r  DB updated: ${dbUpdated}/${allUpdates.length}`);
  }
}
console.log('\n');

console.log('✅ Done!');
console.log(`  Uploaded: ${uploaded} files`);
console.log(`  Skipped (already uploaded): ${skipped}`);
console.log(`  Failed uploads: ${failed}`);
console.log(`  DB rows updated: ${dbUpdated}`);
