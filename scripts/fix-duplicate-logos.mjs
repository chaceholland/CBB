#!/usr/bin/env node
import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const LOGOS_DIR = path.join(ROOT, 'logos');

// Teams with wrong logos (duplicates)
const teamsToFix = [
  '198', '352', '91', '73', '193', '82', '88', '363',
  '294', '93', '167', '386', '189', '76'
];

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
  console.log('Re-downloading logos for teams with duplicates...\n');

  let fixed = 0, failed = 0;

  for (const teamId of teamsToFix) {
    const dest = path.join(LOGOS_DIR, `${teamId}.png`);
    const espnUrl = `https://a.espncdn.com/i/teamlogos/ncaa/500/${teamId}.png`;

    process.stdout.write(`\r  Downloading ${teamId}...`);

    try {
      // Delete old duplicate
      if (fs.existsSync(dest)) fs.unlinkSync(dest);

      await downloadFile(espnUrl, dest);
      fixed++;
    } catch (e) {
      console.log(`\n  ⚠️  Failed ${teamId}: ${e.message}`);
      failed++;
    }

    await sleep(150);
  }

  console.log(`\n\n✅ Fixed: ${fixed}`);
  console.log(`❌ Failed: ${failed}`);
}

main().catch(e => { console.error('\nFatal:', e); process.exit(1); });
