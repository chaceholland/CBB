#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';

const TEAMS = [
  { id: 'alabama', name: 'Alabama Crimson Tide', url: 'https://rolltide.com/sports/baseball/roster' },
  { id: 'arkansas', name: 'Arkansas Razorbacks', url: 'https://arkansasrazorbacks.com/sports/baseball/roster' },
  { id: 'auburn', name: 'Auburn Tigers', url: 'https://auburntigers.com/sports/baseball/roster' },
  { id: 'florida', name: 'Florida Gators', url: 'https://floridagators.com/sports/baseball/roster' },
  { id: 'georgia', name: 'Georgia Bulldogs', url: 'https://georgiadogs.com/sports/baseball/roster' },
  { id: 'kentucky', name: 'Kentucky Wildcats', url: 'https://ukathletics.com/sports/baseball/roster' },
  { id: 'lsu', name: 'LSU Tigers', url: 'https://lsusports.net/sports/baseball/roster' },
  { id: 'mississippi-state', name: 'Mississippi State Bulldogs', url: 'https://hailstate.com/sports/baseball/roster' },
  { id: 'ole-miss', name: 'Ole Miss Rebels', url: 'https://olemisssports.com/sports/baseball/roster' },
  { id: 'south-carolina', name: 'South Carolina Gamecocks', url: 'https://gamecocksonline.com/sports/baseball/roster' },
  { id: 'tennessee', name: 'Tennessee Volunteers', url: 'https://utsports.com/sports/baseball/roster' },
  { id: 'vanderbilt', name: 'Vanderbilt Commodores', url: 'https://vucommodores.com/sports/baseball/roster' },
  { id: 'texas-a&m', name: 'Texas A&M Aggies', url: 'https://12thman.com/sports/baseball/roster' },
  { id: 'missouri', name: 'Missouri Tigers', url: 'https://mutigers.com/sports/baseball/roster' }
];

const OUTPUT_FILE = path.join('./data', 'sec_pitchers_hybrid.json');
const DELAY_MS = 3000;

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function scrapeTeam(page, team) {
  console.log(`\n[Team: ${team.name}] URL: ${team.url}`);
  try {
    await page.goto(team.url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await delay(2000);

    const pitchers = await page.evaluate(() => {
      const results = [];
      const rows = Array.from(document.querySelectorAll('tr, [class*="roster‑card"], [class*="player‑card"]'));
      rows.forEach(row => {
        const txt = row.innerText.trim();
        const match = txt.match(/\b(RHP|LHP)\b/);
        if (match) {
          const position = match[0];
          const parts = txt.split(/\s{2,}/);
          const jersey = parts[0] && parts[0].match(/^\d+/) ? parts[0] : '';
          const name   = parts[1] || '';
          const year   = parts.find(p => /Fr|So|Jr|Sr|R‑Sr/i.test(p)) || '';
          const hometown = parts[parts.length-1] || '';
          results.push({
            jersey: jersey,
            name: name,
            position: position,
            year: year,
            hometown: hometown,
            raw: txt
          });
        }
      });
      return results;
    });

    console.log(`  ✅ Found ${pitchers.length} pitcher entries`);
    return pitchers;
  } catch (err) {
    console.warn(`  ⚠️ Error scraping ${team.name}: ${err.message}`);
    return [];
  }
}

async function main() {
  console.log('🚀 SEC Pitcher Scraper (Hybrid)');
  console.log('================================');
  const browser = await puppeteer.launch({ headless: true, args:['--no-sandbox','--disable-setuid-sandbox'] });
  const page = await browser.newPage();

  if (!fs.existsSync(path.dirname(OUTPUT_FILE))) {
    fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  }

  const results = [];
  for (const team of TEAMS) {
    const teamPitchers = await scrapeTeam(page, team);
    results.push({ team_id: team.id, team: team.name, pitchers: teamPitchers });
    await delay(DELAY_MS);
  }

  await browser.close();

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify({ fetchedAt: new Date().toISOString(), data: results }, null, 2));
  console.log(`\n💾 Saved output to ${OUTPUT_FILE}`);
}

main().catch(err => {
  console.error('\n❌ Fatal error:', err);
  process.exit(1);
});
