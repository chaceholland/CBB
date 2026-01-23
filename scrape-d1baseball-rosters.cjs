import fs from 'fs';
import puppeteer from 'puppeteer';
import teams from './teams.json' assert { type: 'json' };

const OUTPUT_FILE = './pitchers.json';
const BACKUP_FILE = './pitchers_backup.json';
const DELAY_MS = 3000;

async function scrapeTeamRoster(page, teamName, teamId) {
  const urlsToTry = [
    `https://d1baseball.com/teams/${teamId}/2024/`,
    `https://d1baseball.com/teams/${teamId}/`,
    `https://d1baseball.com/teams/${teamId}/2024/roster/`
  ];

  for (const url of urlsToTry) {
    try {
      console.log(`  Trying: ${url}`);
      const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

      if (!response || response.status() >= 400) {
        console.log(`    ⚠️ Not found or invalid`);
        continue;
      }

      console.log(`    ✓ Page loaded successfully`);

      const result = await page.evaluate(() => {
        const extractRowText = row => {
          return Array.from(row.querySelectorAll('td, th'))
            .map(cell => cell.textContent.trim())
            .join(' | ');
        };

        const pitchers = [];
        const rows = document.querySelectorAll('tr');
        rows.forEach(row => {
          const cells = row.innerText.toLowerCase();
          if (cells.includes('pitcher')) {
            pitchers.push(extractRowText(row));
          }
        });

        // Return debug info if no pitchers found
        const debug = pitchers.length === 0
          ? Array.from(rows).slice(0, 5).map(extractRowText)
          : [];

        return { pitchers, debug };
      });

      if (result.pitchers.length === 0) {
        console.log('  ⚠️ No pitchers found. Sample table rows:');
        result.debug.forEach(row => console.log(`    › ${row}`));
      }

      return result.pitchers;
    } catch (err) {
      console.log(`    ⚠️ Error: ${err.message}`);
    }
  }

  return [];
}

async function main() {
  console.log('\n🚀 Starting main()');
  console.log('⚾ D1Baseball Roster Scraper\n');

  console.log(`📋 Loaded ${teams.length} teams`);
  console.log('Launching browser...\n');

  const browser = await puppeteer.launch({
    headless: true,
    executablePath: puppeteer.executablePath(),
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  if (fs.existsSync(OUTPUT_FILE)) {
    fs.copyFileSync(OUTPUT_FILE, BACKUP_FILE);
    console.log(`📦 Backed up existing pitchers.json`);
  }

  const teamsToProcess = teams.slice(0, 5); // Only process first 5 teams
  const pitchersByTeam = [];
  let totalPitchers = 0;
  let processed = 0;

  for (const team of teamsToProcess) {
    console.log(`\n[${processed + 1}/${teamsToProcess.length}] ${team.displayName}`);

    const pitchers = await scrapeTeamRoster(page, team.displayName, team.id);

    if (pitchers.length > 0) {
      pitchersByTeam.push({
        team_id: String(team.id),
        team: team.team,
        displayName: team.displayName,
        logo: team.logo,
        pitchers
      });
      totalPitchers += pitchers.length;
    }

    processed++;
    await new Promise(resolve => setTimeout(resolve, DELAY_MS));
  }

  await browser.close();

  console.log(`\n✅ Scraping complete! Total pitchers found: ${totalPitchers}`);

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(pitchersByTeam, null, 2));
  console.log(`💾 Saved output to: ${OUTPUT_FILE}`);
}

main().catch(err => {
  console.error('\n❌ Fatal error:', err);
  process.exit(1);
});
