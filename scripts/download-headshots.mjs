#!/usr/bin/env node
/**
 * Download all pitcher headshots locally:
 *  1. Download the 172 external https:// headshots to data/headshots/
 *  2. Scrape missing headshots from ESPN team rosters (e.g. Duke)
 *  3. Update pitchers.json to reference local paths
 *
 * Usage: node scripts/download-headshots.mjs
 */

import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const HEADSHOTS_DIR = path.join(ROOT, 'data', 'headshots');
const PITCHERS_FILE = path.join(ROOT, 'data', 'pitchers.json');

const sleep = ms => new Promise(r => setTimeout(r, ms));

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(dest);
    proto.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
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

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
      let buf = '';
      res.on('data', c => buf += c);
      res.on('end', () => { try { resolve(JSON.parse(buf)); } catch(e) { reject(e); } });
    }).on('error', reject);
  });
}

function slugify(str) {
  return (str || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

async function main() {
  console.log('⚾  Downloading pitcher headshots');
  console.log('==================================\n');

  if (!fs.existsSync(HEADSHOTS_DIR)) fs.mkdirSync(HEADSHOTS_DIR, { recursive: true });

  const data = JSON.parse(fs.readFileSync(PITCHERS_FILE, 'utf8'));
  const teams = data.teams || [];

  let downloaded = 0, skipped = 0, failed = 0, espnFound = 0;

  // ── Step 1: Download external https:// headshots ────────────────────────────
  console.log('Step 1: Downloading external headshot URLs...\n');

  for (const team of teams) {
    const teamId = String(team.teamId || team.team_id || '');
    const teamSlug = slugify(team.team || team.name || teamId);

    for (const pitcher of (team.pitchers || [])) {
      if (!pitcher.headshot || !pitcher.headshot.startsWith('https://')) continue;

      const pitcherSlug = slugify(pitcher.name || pitcher.id);
      const filename = `${teamSlug}_${teamId}-${pitcherSlug}.jpg`;
      const dest = path.join(HEADSHOTS_DIR, filename);
      const localPath = `data/headshots/${filename}`;

      if (fs.existsSync(dest)) {
        pitcher.headshot = localPath;
        skipped++;
        continue;
      }

      process.stdout.write(`\r  Downloading ${pitcher.name} (${team.team || teamId})...              `);

      try {
        await downloadFile(pitcher.headshot, dest);
        pitcher.headshot = localPath;
        downloaded++;
      } catch (e) {
        process.stdout.write(`\n  ⚠️  Failed ${pitcher.name}: ${e.message}\n`);
        // Keep original URL as fallback
        failed++;
      }

      await sleep(150);
    }
  }

  console.log(`\n\n  Downloaded: ${downloaded}, Skipped (cached): ${skipped}, Failed: ${failed}`);

  // ── Step 2: ESPN roster scrape for pitchers with no headshot ────────────────
  console.log('\nStep 2: Scraping ESPN rosters for missing headshots...\n');

  // Find teams with pitchers missing headshots
  const teamsNeedingHeadshots = teams.filter(t =>
    (t.pitchers || []).some(p => !p.headshot || !p.headshot.trim())
  );

  for (const team of teamsNeedingHeadshots) {
    const teamId = String(team.teamId || team.team_id || '');
    const teamSlug = slugify(team.team || team.name || teamId);
    const missingPitchers = (team.pitchers || []).filter(p => !p.headshot || !p.headshot.trim());

    console.log(`  Fetching ESPN roster for ${team.team || teamId} (${missingPitchers.length} missing)...`);

    try {
      const url = `https://site.api.espn.com/apis/site/v2/sports/baseball/college-baseball/teams/${teamId}/roster`;
      const rosterData = await fetchJSON(url);
      const athletes = rosterData?.athletes || [];

      // Build name -> headshot map from ESPN roster
      const espnMap = {};
      athletes.forEach(a => {
        const name = (a.fullName || a.displayName || '').toLowerCase();
        const lastName = (a.lastName || '').toLowerCase();
        const headshot = a.headshot?.href || a.athlete?.headshot?.href || '';
        if (headshot) {
          espnMap[name] = headshot;
          if (lastName) espnMap[lastName] = headshot;
        }
      });

      for (const pitcher of missingPitchers) {
        const nameLower = (pitcher.name || '').toLowerCase();
        const lastName = nameLower.split(' ').pop();
        const espnUrl = espnMap[nameLower] || espnMap[lastName];

        if (!espnUrl) {
          process.stdout.write(`\n  ⚠️  No ESPN headshot found for ${pitcher.name}`);
          failed++;
          continue;
        }

        const pitcherSlug = slugify(pitcher.name || pitcher.id);
        const filename = `${teamSlug}_${teamId}-${pitcherSlug}.jpg`;
        const dest = path.join(HEADSHOTS_DIR, filename);
        const localPath = `data/headshots/${filename}`;

        if (fs.existsSync(dest)) {
          pitcher.headshot = localPath;
          skipped++;
          continue;
        }

        try {
          await downloadFile(espnUrl, dest);
          pitcher.headshot = localPath;
          espnFound++;
          process.stdout.write(`\r  ✓ ${pitcher.name}                              `);
        } catch (e) {
          process.stdout.write(`\n  ⚠️  Download failed for ${pitcher.name}: ${e.message}\n`);
          failed++;
        }

        await sleep(150);
      }
    } catch (e) {
      console.log(`  ⚠️  ESPN roster fetch failed for ${team.team || teamId}: ${e.message}`);
    }
  }

  console.log(`\n\n📊 Summary:`);
  console.log(`  External URLs downloaded : ${downloaded}`);
  console.log(`  ESPN roster headshots    : ${espnFound}`);
  console.log(`  Already cached (skipped) : ${skipped}`);
  console.log(`  Failed                   : ${failed}`);

  // Save updated pitchers.json
  fs.writeFileSync(PITCHERS_FILE, JSON.stringify(data, null, 2));
  console.log('\n✅ pitchers.json updated with local headshot paths');
}

main().catch(e => { console.error('\nFatal:', e); process.exit(1); });
