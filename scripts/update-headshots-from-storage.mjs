/**
 * Update cbb_pitchers.headshot with Supabase Storage URLs.
 * Enumerates all files in athlete-headshots bucket, matches to pitchers by name,
 * and updates the headshot column. Does NOT overwrite existing storage URLs.
 */
import fs from 'fs';

const SUPABASE_URL = 'https://dtnozcqkuzhjmjvsfjqk.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0bm96Y3FrdXpoam1qdnNmanFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDkwNjgzMCwiZXhwIjoyMDgwNDgyODMwfQ.JcESpa1uZq8tbc6XrGJynrEkW-eA9JHi41KrKlnXeUA';
const BUCKET = 'athlete-headshots';
const headers = { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' };

const norm = s => s?.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim() ?? '';
const slugToName = slug => slug.replace(/\.[^.]+$/, '').replace(/-/g, ' '); // "ben-wilson.jpg" -> "ben wilson"

// --- Step 1: Enumerate all storage files ---
console.log('Enumerating storage files...');
const foldersResp = await fetch(`${SUPABASE_URL}/storage/v1/object/list/${BUCKET}`, {
  method: 'POST', headers,
  body: JSON.stringify({ limit: 100, offset: 0, prefix: '' })
});
const folders = await foldersResp.json();
// Filter out any loose files (not folders)
const teamFolders = folders.filter(f => !f.name.includes('.'));
console.log(`Found ${teamFolders.length} team folders`);

// Build map: normalizedName -> storageUrl
const storageByName = {}; // norm(name) -> publicUrl
let totalFiles = 0;

for (const folder of teamFolders) {
  const filesResp = await fetch(`${SUPABASE_URL}/storage/v1/object/list/${BUCKET}`, {
    method: 'POST', headers,
    body: JSON.stringify({ limit: 300, offset: 0, prefix: `${folder.name}/` })
  });
  const files = await filesResp.json();
  for (const file of files) {
    const playerName = slugToName(file.name);
    const normalized = norm(playerName);
    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${folder.name}/${file.name}`;
    storageByName[normalized] = publicUrl;
    totalFiles++;
  }
}
console.log(`Total storage files indexed: ${totalFiles}`);

// --- Step 2: Fetch all pitchers from cbb_pitchers ---
console.log('Fetching pitchers from cbb_pitchers...');
let allPitchers = [];
for (let offset = 0; offset < 2000; offset += 1000) {
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/cbb_pitchers?select=pitcher_id,name,headshot&limit=1000&offset=${offset}`, {
    headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` }
  });
  const rows = await resp.json();
  allPitchers = allPitchers.concat(rows);
  if (rows.length < 1000) break;
}
console.log(`Fetched ${allPitchers.length} pitchers`);

// --- Step 3: Match and update ---
const updates = [];
let alreadyHasStorage = 0;
let noMatch = 0;

for (const pitcher of allPitchers) {
  // Skip if already has a Supabase Storage URL
  if (pitcher.headshot?.includes('/storage/v1/object/public/')) {
    alreadyHasStorage++;
    continue;
  }

  const pitcherNorm = norm(pitcher.name);
  // Try exact match first
  let url = storageByName[pitcherNorm];

  // Try partial matches if no exact
  if (!url) {
    const parts = pitcherNorm.split(' ');
    for (const [key, val] of Object.entries(storageByName)) {
      const keyParts = key.split(' ');
      // Match if last name matches and first name starts match
      if (parts.length >= 2 && keyParts.length >= 2) {
        if (parts[parts.length-1] === keyParts[keyParts.length-1] &&
            (parts[0] === keyParts[0] || parts[0].startsWith(keyParts[0]) || keyParts[0].startsWith(parts[0]))) {
          url = val;
          break;
        }
      }
    }
  }

  if (url) {
    updates.push({ pitcher_id: pitcher.pitcher_id, name: pitcher.name, headshot: url });
  } else {
    noMatch++;
  }
}

console.log(`\nMatches found: ${updates.length}`);
console.log(`Already has storage URL: ${alreadyHasStorage}`);
console.log(`No match in storage: ${noMatch}`);

if (!updates.length) {
  console.log('Nothing to update.');
  process.exit(0);
}

// --- Step 4: Batch update Supabase ---
console.log('\nUpdating cbb_pitchers...');
const BATCH = 100;
let updated = 0;
for (let i = 0; i < updates.length; i += BATCH) {
  const batch = updates.slice(i, i + BATCH);
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/cbb_pitchers`, {
    method: 'POST',
    headers: { ...headers, 'Prefer': 'resolution=merge-duplicates' },
    body: JSON.stringify(batch.map(u => ({ pitcher_id: u.pitcher_id, name: u.name, headshot: u.headshot })))
  });
  if (!resp.ok) {
    console.error(`Batch ${i}-${i+BATCH} failed:`, await resp.text());
  } else {
    updated += batch.length;
    process.stdout.write(`\r  Updated ${updated}/${updates.length}...`);
  }
}

console.log(`\n\n✅ Done! Updated ${updated} pitcher headshots with Supabase Storage URLs.`);

// Save report
const report = {
  timestamp: new Date().toISOString(),
  totalStorageFiles: totalFiles,
  matched: updates.length,
  alreadyHasStorage,
  noMatch,
  sample: updates.slice(0, 5).map(u => ({ name: u.name, url: u.headshot.split('/').pop() }))
};
fs.writeFileSync('/Users/chace/Desktop/CBB/data/headshot-storage-update-report.json', JSON.stringify(report, null, 2));
console.log('Report saved to data/headshot-storage-update-report.json');
