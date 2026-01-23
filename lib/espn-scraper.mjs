/**
 * ESPN Roster Scraper
 * Fetches current roster data from ESPN team pages
 */

import puppeteer from 'puppeteer';

const DELAY_MS = 2000; // 2 seconds between requests
const MAX_RETRIES = 3;
const TIMEOUT_MS = 30000;

/**
 * Delay helper
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetch roster for a single team from ESPN
 * @param {Object} team - Team object with id and slug
 * @param {Object} browser - Puppeteer browser instance
 * @returns {Object|null} Roster data or null on failure
 */
export async function fetchTeamRoster(team, browser) {
  const url = `https://www.espn.com/college-baseball/team/roster/_/id/${team.id}`;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const page = await browser.newPage();
      await page.setDefaultTimeout(TIMEOUT_MS);

      console.log(`  Fetching ${team.name} (attempt ${attempt}/${MAX_RETRIES})...`);

      await page.goto(url, { waitUntil: 'networkidle2' });

      // Wait for roster table to load
      await page.waitForSelector('.ResponsiveTable, .Table__TBODY', { timeout: 10000 });

      // Extract roster data
      const players = await page.evaluate(() => {
        const rows = Array.from(document.querySelectorAll('.Table__TR'));
        const playerData = [];

        rows.forEach(row => {
          const cells = row.querySelectorAll('.Table__TD');
          if (cells.length === 0) return; // Skip header rows

          // ESPN roster table columns (may vary slightly)
          const name = cells[1]?.textContent?.trim() || '';
          const number = cells[0]?.textContent?.trim() || '';
          const position = cells[2]?.textContent?.trim() || '';
          const year = cells[3]?.textContent?.trim() || '';
          const height = cells[4]?.textContent?.trim() || '';
          const weight = cells[5]?.textContent?.trim() || '';
          const batsThrows = cells[6]?.textContent?.trim() || '';
          const hometown = cells[7]?.textContent?.trim() || '';

          if (name) {
            playerData.push({
              name,
              number,
              position,
              year,
              height,
              weight,
              batsThrows,
              hometown
            });
          }
        });

        return playerData;
      });

      await page.close();

      if (players.length === 0) {
        console.log(`  ⚠️  No players found for ${team.name}`);
        return null;
      }

      console.log(`  ✓ Found ${players.length} players for ${team.name}`);

      return {
        team: team.name,
        teamId: team.id,
        slug: team.slug,
        totalPlayers: players.length,
        allPlayers: players,
        scrapedAt: new Date().toISOString()
      };

    } catch (error) {
      console.error(`  ❌ Error fetching ${team.name} (attempt ${attempt}): ${error.message}`);

      if (attempt === MAX_RETRIES) {
        return null;
      }

      // Exponential backoff
      const backoffDelay = DELAY_MS * Math.pow(2, attempt - 1);
      await delay(backoffDelay);
    }
  }

  return null;
}

/**
 * Fetch rosters for all teams
 * @param {Array} teams - Array of team objects
 * @returns {Object} { rosters: Array, failed: Array }
 */
export async function fetchAllRosters(teams) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const rosters = [];
  const failed = [];

  console.log(`\n🔍 Fetching rosters for ${teams.length} teams...\n`);

  for (let i = 0; i < teams.length; i++) {
    const team = teams[i];

    // Progress logging every 10 teams
    if (i > 0 && i % 10 === 0) {
      console.log(`\n📊 Progress: ${i}/${teams.length} teams processed\n`);
    }

    const roster = await fetchTeamRoster(team, browser);

    if (roster) {
      rosters.push(roster);
    } else {
      failed.push({ teamId: team.id, teamName: team.name });
    }

    // Rate limiting delay between requests
    if (i < teams.length - 1) {
      await delay(DELAY_MS);
    }
  }

  await browser.close();

  console.log(`\n✅ Scraping complete: ${rosters.length} successful, ${failed.length} failed\n`);

  return { rosters, failed };
}
