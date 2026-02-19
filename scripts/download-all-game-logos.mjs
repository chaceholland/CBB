#!/usr/bin/env node
import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const LOGOS_DIR = path.join(ROOT, 'logos');

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

async function main() {
  console.log('⚾  Downloading all game team logos');
  console.log('====================================\n');

  if (!fs.existsSync(LOGOS_DIR)) fs.mkdirSync(LOGOS_DIR, { recursive: true });

  const scheduleData = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'schedule.json'), 'utf8'));
  const teamsData = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'teams.json'), 'utf8'));

  // Build teams index
  const teamsById = {};
  teamsData.teams.forEach(t => { teamsById[t.id] = t; });

  // Find all unique team IDs in games
  const gameTeams = new Set();
  (scheduleData.games || []).forEach(g => {
    if (g.home) gameTeams.add(String(g.home));
    if (g.away) gameTeams.add(String(g.away));
  });

  console.log(`Found ${gameTeams.size} unique teams in schedule`);

  // Download logos for teams with ESPN CDN URLs
  let downloaded = 0, skipped = 0, failed = 0, updated = 0;

  for (const tid of gameTeams) {
    const team = teamsById[tid];
    if (!team) {
      console.log(`⚠️  Team ${tid} not in teams.json, skipping`);
      continue;
    }

    // Skip teams that already have local logos
    if (team.logo && team.logo.startsWith('/logos/')) {
      skipped++;
      continue;
    }

    // Skip teams with no logo
    if (!team.logo || !team.logo.trim()) {
      console.log(`⚠️  ${tid} ${team.name} has no logo URL, skipping`);
      failed++;
      continue;
    }

    const dest = path.join(LOGOS_DIR, `${tid}.png`);
    const localPath = `/logos/${tid}.png`;

    // Skip if already exists
    if (fs.existsSync(dest)) {
      team.logo = localPath;
      updated++;
      skipped++;
      continue;
    }

    process.stdout.write(`\r  Downloading ${tid} ${team.name}...                              `);

    try {
      await downloadFile(team.logo, dest);
      team.logo = localPath;
      downloaded++;
      updated++;
    } catch (e) {
      process.stdout.write(`\n  ⚠️  Failed ${tid} ${team.name}: ${e.message}\n`);
      failed++;
    }

    await sleep(100); // Rate limit
  }

  console.log(`\n\n📊 Summary:`);
  console.log(`  Downloaded : ${downloaded}`);
  console.log(`  Already had: ${skipped}`);
  console.log(`  Failed     : ${failed}`);
  console.log(`  Updated in teams.json: ${updated}`);

  // Write updated teams.json
  fs.writeFileSync(path.join(ROOT, 'data', 'teams.json'), JSON.stringify(teamsData, null, 2));
  console.log('\n✅ teams.json updated with local logo paths');
}

main().catch(e => { console.error('\nFatal:', e); process.exit(1); });
