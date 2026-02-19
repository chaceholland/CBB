#!/usr/bin/env node
import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const LOGOS_DIR = path.join(ROOT, 'logos');

// Load tracked teams
const pitchersData = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'pitchers.json'), 'utf8'));
const teamIds = pitchersData.teams.map(t => String(t.teamId || t.team_id));

const sleep = ms => new Promise(r => setTimeout(r, ms));

function getTeamInfo(teamId) {
  return new Promise((resolve) => {
    https.get(`https://site.api.espn.com/apis/site/v2/sports/baseball/college-baseball/teams/${teamId}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const logoUrl = json.team?.logos?.[0]?.href || null;
          const name = json.team?.displayName || null;
          resolve({ logoUrl, name });
        } catch {
          resolve({ logoUrl: null, name: null });
        }
      });
    }).on('error', () => resolve({ logoUrl: null, name: null }));
  });
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
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
  console.log('Re-downloading all 64 logos using ESPN API for correct logo URLs...\n');

  let fixed = 0, failed = 0;

  for (const teamId of teamIds) {
    process.stdout.write(`  ${teamId}...`);

    const { logoUrl, name } = await getTeamInfo(teamId);

    if (!logoUrl) {
      console.log(` ⚠️  No logo URL found`);
      failed++;
      await sleep(200);
      continue;
    }

    console.log(` ${name}`);

    try {
      const dest = path.join(LOGOS_DIR, `${teamId}.png`);
      // Delete old file
      if (fs.existsSync(dest)) fs.unlinkSync(dest);
      await downloadFile(logoUrl, dest);
      process.stdout.write(`    Downloaded ✓\n`);
      fixed++;
    } catch (e) {
      console.log(`    ✗ ${e.message}`);
      failed++;
    }

    await sleep(200);
  }

  console.log(`\n✅ Fixed: ${fixed}`);
  console.log(`❌ Failed: ${failed}`);
}

main().catch(console.error);
