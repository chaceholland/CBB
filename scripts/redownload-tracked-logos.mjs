#!/usr/bin/env node
import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const LOGOS_DIR = path.join(ROOT, 'logos');

const sleep = ms => new Promise(r => setTimeout(r, ms));

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        try { fs.unlinkSync(dest); } catch {}
        return downloadFile(res.headers.location, dest).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        file.close();
        try { fs.unlinkSync(dest); } catch {}
        return reject(new Error(`HTTP ${res.statusCode}`));
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
  console.log('Re-downloading logos for 64 tracked teams...\n');

  // Load tracked teams from pitchers.json
  const pitchersData = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'pitchers.json'), 'utf8'));
  const teamIds = pitchersData.teams.map(t => String(t.teamId || t.team_id));

  console.log(`Total teams: ${teamIds.length}\n`);

  let downloaded = 0, failed = 0;

  for (const teamId of teamIds) {
    const dest = path.join(LOGOS_DIR, `${teamId}.png`);
    const espnUrl = `https://a.espncdn.com/i/teamlogos/ncaa/500/${teamId}.png`;

    // Delete existing file
    if (fs.existsSync(dest)) fs.unlinkSync(dest);

    process.stdout.write(`\r  Downloading ${teamId}...`);

    try {
      await downloadFile(espnUrl, dest);
      downloaded++;
    } catch (e) {
      console.log(`\n  ⚠️  Failed ${teamId}: ${e.message}`);
      failed++;
    }

    await sleep(150);
  }

  console.log(`\n\n✅ Downloaded: ${downloaded}`);
  console.log(`❌ Failed: ${failed}`);
}

main().catch(e => { console.error('\nFatal:', e); process.exit(1); });
