#!/usr/bin/env node
/**
 * Download all team logos from ESPN CDN and save locally to logos/{teamId}.png
 * Then update pitchers.json to use local paths.
 *
 * Usage: node scripts/download-logos.mjs
 */

import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const LOGOS_DIR = path.join(ROOT, 'logos');
const PITCHERS_FILE = path.join(ROOT, 'data', 'pitchers.json');

const sleep = ms => new Promise(r => setTimeout(r, ms));

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, res => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        fs.unlinkSync(dest);
        return downloadFile(res.headers.location, dest).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        file.close();
        fs.unlinkSync(dest);
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', err => {
      file.close();
      try { fs.unlinkSync(dest); } catch {}
      reject(err);
    });
  });
}

async function main() {
  console.log('⚾  Downloading team logos');
  console.log('==========================\n');

  if (!fs.existsSync(LOGOS_DIR)) fs.mkdirSync(LOGOS_DIR, { recursive: true });

  const data = JSON.parse(fs.readFileSync(PITCHERS_FILE, 'utf8'));
  const teams = data.teams || [];

  let downloaded = 0, skipped = 0, failed = 0;

  for (const team of teams) {
    const teamId = String(team.teamId || team.team_id || '');
    if (!teamId) { failed++; continue; }

    const dest = path.join(LOGOS_DIR, `${teamId}.png`);
    const localPath = `/logos/${teamId}.png`;

    // Skip if already downloaded
    if (fs.existsSync(dest)) {
      team.logo = localPath;
      skipped++;
      process.stdout.write(`\r  ✓ ${skipped + downloaded} done (${skipped} cached)...`);
      continue;
    }

    const espnUrl = `https://a.espncdn.com/i/teamlogos/ncaa/500/${teamId}.png`;
    process.stdout.write(`\r  Downloading ${teamId} (${team.name || teamId})...                    `);

    try {
      await downloadFile(espnUrl, dest);
      team.logo = localPath;
      downloaded++;
    } catch (e) {
      console.log(`\n  ⚠️  Failed ${teamId}: ${e.message}`);
      // Keep original ESPN URL as fallback
      failed++;
    }

    await sleep(100);
  }

  console.log(`\n\n📊 Summary:`);
  console.log(`  Downloaded : ${downloaded}`);
  console.log(`  Already had: ${skipped}`);
  console.log(`  Failed     : ${failed}`);

  // Write updated pitchers.json
  fs.writeFileSync(PITCHERS_FILE, JSON.stringify(data, null, 2));
  console.log('\n✅ pitchers.json updated with local logo paths');
  console.log('   Deploy to Vercel to serve logos from /logos/');
}

main().catch(e => { console.error('\nFatal:', e); process.exit(1); });
