import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';

const OUTPUT_FILE = 'pitchers.json';
const BACKUP_FILE = `pitchers-${Date.now()}.bak.json`;
const DELAY_MS = 3000;

const teamsPath = path.resolve('./teams.json');
const teams = JSON.parse(fs.readFileSync(teamsPath, 'utf-8'));

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getRosterUrls(teamSlug) {
  return [
    `https://d1baseball.com/teams/${teamSlug}/2024/`,
    `https://d1baseball.com/teams/${teamSlug}/`,
    `https://d1baseball.com/teams/${teamSlug}/2024/roster/`
  ];
}

async function extractPitchers(page) {
  try {
    await page.waitForSelector('table.roster-table', { timeout: 5000 });
    const pitchers = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('table.roster-table tbody tr'));
      return rows
        .map(row => {
          const cols = row.querySelectorAll('td');
          if (cols.length < 5) return null;

          const pos = cols[2].innerText.trim().toUpperCase();
          if (!pos.includes('P')) return null;

          return {
            name: cols[1].innerText.trim(),
            position: pos,
            class: cols[3].innerText.trim(),
            hometown: cols[4].innerText.trim()
          };
        })
        .filter(p => p !== null);
    });
    if (pitchers.length === 0) {
      const sampleRows = Array.from(document.querySelectorAll("table tbody tr")).slice(0,5)
        .map(r => Array.from(r.querySelectorAll("td, th")).map(c => c.textContent.trim()).join(" | "));
      return { pitchers, sampleRows };
    }
    return { pitchers };
  } catch {
    return [];
  }
}

async function main() {
  console.log(`\n🚀 Starting main()\n⚾ D1Baseball Roster Scraper\n`);

  if (!Array.isArray(teams)) {
    console.error('❌ teams.json is not formatted as an array.');
    process.exit(1);
  }

  console.log(`📋 Loaded ${teams.length} teams\nLaunching browser...`);

  const browser = await puppeteer.launch({ headless: 'new', protocolTimeout: 60000 });
  const page = await browser.newPage();

  if (fs.existsSync(OUTPUT_FILE)) {
    fs.copyFileSync(OUTPUT_FILE, BACKUP_FILE);
    console.log(`📦 Backed up existing ${OUTPUT_FILE}`);
  }

  const pitchersByTeam = [];
  const failedTeams = [];

  let totalPitchers = 0;
  let teamsFound = 0;
  let processed = 0;

  for (const team of teams) {
    console.log(`[${processed + 1}/${teams.length}] ${team.displayName}`);
    const urls = getRosterUrls(team.team);
    let success = false;

    for (const url of urls) {
      try {
        console.log(`  Trying: ${url}`);
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

        const pitches = await extractPitchers(page);

        if (pitches.length > 0) {
          pitchersByTeam.push({
            team_id: String(team.id),
            team: team.team,
            displayName: team.displayName,
            logo: team.logo,
            pitchers: pitches
          });

          totalPitchers += pitches.length;
          teamsFound++;
        }

        success = true;
        break;
      } catch (err) {
        console.warn(`    ⚠️ Failed: ${err.message}`);
      }
    }

    if (!success) {
      failedTeams.push(team);
    }

    processed++;
    if (processed % 10 === 0) {
      console.log(`Progress: ${processed}/${teams.length}, Pitchers: ${totalPitchers}`);
    }

    await delay(DELAY_MS);
  }

  await browser.close();

  console.log(`\n✅ Finished! Processed: ${processed}, Teams Found: ${teamsFound}, Pitchers: ${totalPitchers}`);
  if (failedTeams.length) {
    console.log(`⚠️ Failed Teams (${failedTeams.length}): ${failedTeams.map(t => t.displayName).join(', ')}`);
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify({
    teams: pitchersByTeam,
    metadata: {
      fetchedAt: new Date().toISOString(),
      source: 'D1Baseball.com',
      teamsCount: teamsFound,
      pitchersCount: totalPitchers,
      failedTeams: failedTeams.map(t => t.displayName)
    }
  }, null, 2));

  console.log(`💾 Saved to ${OUTPUT_FILE}\n📌 Please verify scraped data.`);
}

main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
