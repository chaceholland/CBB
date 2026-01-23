/**
 * All D1 College Baseball Team Scraper
 * Fetches team list from ESPN, then scrapes rosters/schedules from athletic sites
 * 
 * Usage: 
 *   node scrape-all-d1-teams.cjs --rosters
 *   node scrape-all-d1-teams.cjs --schedules
 *   node scrape-all-d1-teams.cjs --rosters --schedules
 *   node scrape-all-d1-teams.cjs --conference=SEC (or ACC, Big12, etc.)
 */

const puppeteer = require('puppeteer');
const https = require('https');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const delay = ms => new Promise(r => setTimeout(r, ms));

// Parse command line args
const args = process.argv.slice(2);
const shouldScrapeRosters = args.includes('--rosters');
const shouldScrapeSchedules = args.includes('--schedules');
const conferenceFilter = args.find(a => a.startsWith('--conference='))?.split('=')[1];

if (!shouldScrapeRosters && !shouldScrapeSchedules) {
  console.log('❌ Please specify --rosters and/or --schedules');
  console.log('Example: node scrape-all-d1-teams.cjs --rosters --schedules');
  process.exit(1);
}

// Athletic site URL patterns (most schools use these)
const URL_PATTERNS = [
  { pattern: 'https://{slug}.com', paths: ['/sports/baseball/roster', '/sports/baseball/schedule'] },
  { pattern: 'https://go{slug}.com', paths: ['/sports/baseball/roster', '/sports/baseball/schedule'] },
  { pattern: 'https://{slug}athletics.com', paths: ['/sports/baseball/roster', '/sports/baseball/schedule'] },
  { pattern: 'https://{slug}sports.com', paths: ['/sports/baseball/roster', '/sports/baseball/schedule'] }
];

/**
 * Fetch all D1 teams from ESPN
 */
function fetchAllTeams() {
  return new Promise((resolve, reject) => {
    const url = 'https://site.api.espn.com/apis/site/v2/sports/baseball/college-baseball/teams?limit=400';
    
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const teams = json.sports[0].leagues[0].teams.map(item => ({
            id: item.team.id,
            name: item.team.displayName,
            slug: item.team.slug,
            abbrev: item.team.abbreviation,
            conference: item.team.groups?.name || 'Independent',
            logo: item.team.logos?.[0]?.href
          }));
          resolve(teams);
        } catch(e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

/**
 * Guess athletic site URLs for a team
 */
function guessAthleticSiteUrls(team) {
  const slug = team.slug.toLowerCase().replace(/[^a-z0-9]/g, '');
  const possibilities = [];
  
  // Known team site mappings (manually verified)
  const KNOWN_SITES = {
    'lsu': 'https://lsusports.net',
    'alabama': 'https://rolltide.com',
    'arkansas': 'https://arkansasrazorbacks.com',
    'auburn': 'https://auburntigers.com',
    'florida': 'https://floridagators.com',
    'georgia': 'https://georgiadogs.com',
    'kentucky': 'https://ukathletics.com',
    'vanderbilt': 'https://vucommodores.com',
    'tennessee': 'https://utsports.com',
    'texas': 'https://texaslonghorns.com',
    'texasam': 'https://12thman.com',
    'olemiss': 'https://olemisssports.com',
    'mississippistate': 'https://hailstate.com',
    'southcarolina': 'https://gamecocksonline.com',
    'missouri': 'https://mutigers.com',
    'oklahoma': 'https://soonersports.com'
  };
  
  if (KNOWN_SITES[slug]) {
    return {
      base: KNOWN_SITES[slug],
      roster: '/sports/baseball/roster',
      schedule: '/sports/baseball/schedule'
    };
  }
  
  // Try common patterns
  return {
    base: `https://go${slug}.com`,
    roster: '/sports/baseball/roster',
    schedule: '/sports/baseball/schedule'
  };
}

function isPitcher(position) {
  if (!position) return false;
  const pos = position.toUpperCase();
  return pos.includes('P') && !pos.includes('DP') && !pos.includes('DH');
}

/**
 * Scrape roster from team website
 */
async function scrapeRoster(browser, team) {
  const urls = guessAthleticSiteUrls(team);
  const url = urls.base + urls.roster;
  
  console.log(`\n📋 Scraping ${team.name} roster: ${url}`);
  
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await delay(2000);
    
    const players = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('table tbody tr, .sidearm-roster-player'));
      return rows.map(row => {
        // SIDEARM platform
        const nameEl = row.querySelector('.sidearm-roster-player-name, td:nth-child(2) a, .rp_name a');
        const posEl = row.querySelector('.sidearm-roster-player-position, td:nth-child(3), .rp_position');
        const classEl = row.querySelector('.sidearm-roster-player-academic-year, td:nth-child(4), .rp_year');
        
        return {
          name: nameEl?.textContent?.trim(),
          position: posEl?.textContent?.trim(),
          year: classEl?.textContent?.trim()
        };
      }).filter(p => p.name);
    });
    
    await page.close();
    
    const pitchers = players.filter(p => isPitcher(p.position));
    console.log(`   ✅ Found ${players.length} players (${pitchers.length} pitchers)`);
    
    return { team, players, pitchers };
    
  } catch(e) {
    console.log(`   ❌ Failed: ${e.message}`);
    return { team, players: [], pitchers: [], error: e.message };
  }
}

/**
 * Scrape schedule from team website
 */
async function scrapeSchedule(browser, team) {
  const urls = guessAthleticSiteUrls(team);
  const url = urls.base + urls.schedule;
  
  console.log(`\n📅 Scraping ${team.name} schedule: ${url}`);
  
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await delay(2000);
    
    const games = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('table tbody tr, .sidearm-schedule-game'));
      return rows.map(row => {
        const dateEl = row.querySelector('.sidearm-schedule-game-opponent-date, td:nth-child(1)');
        const opponentEl = row.querySelector('.sidearm-schedule-game-opponent-name, td:nth-child(2) a');
        const resultEl = row.querySelector('.sidearm-schedule-game-result, td:nth-child(3)');
        
        return {
          date: dateEl?.textContent?.trim(),
          opponent: opponentEl?.textContent?.trim(),
          result: resultEl?.textContent?.trim()
        };
      }).filter(g => g.date);
    });
    
    await page.close();
    
    console.log(`   ✅ Found ${games.length} games`);
    return { team, games };
    
  } catch(e) {
    console.log(`   ❌ Failed: ${e.message}`);
    return { team, games: [], error: e.message };
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('🏈 All D1 College Baseball Scraper\n');
  console.log('Step 1: Fetching team list from ESPN...');
  
  let allTeams;
  try {
    allTeams = await fetchAllTeams();
    console.log(`✅ Found ${allTeams.length} D1 teams`);
    
    // Apply conference filter if specified
    if (conferenceFilter) {
      allTeams = allTeams.filter(t => 
        t.conference.toLowerCase().includes(conferenceFilter.toLowerCase())
      );
      console.log(`📊 Filtered to ${allTeams.length} teams in ${conferenceFilter}`);
    }
  } catch(e) {
    console.error('❌ Failed to fetch teams:', e.message);
    process.exit(1);
  }
  
  console.log('\nStep 2: Launching browser...');
  const browser = await puppeteer.launch({ headless: true });
  
  const allRosters = [];
  const allSchedules = [];
  
  // Process teams in batches to avoid overwhelming the system
  const BATCH_SIZE = 5;
  for (let i = 0; i < allTeams.length; i += BATCH_SIZE) {
    const batch = allTeams.slice(i, i + BATCH_SIZE);
    console.log(`\n📦 Processing batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(allTeams.length/BATCH_SIZE)}`);
    
    const promises = batch.map(async team => {
      const results = {};
      
      if (shouldScrapeRosters) {
        results.roster = await scrapeRoster(browser, team);
      }
      
      if (shouldScrapeSchedules) {
        await delay(1000); // Rate limit
        results.schedule = await scrapeSchedule(browser, team);
      }
      
      return results;
    });
    
    const batchResults = await Promise.all(promises);
    
    batchResults.forEach(({ roster, schedule }) => {
      if (roster) allRosters.push(roster);
      if (schedule) allSchedules.push(schedule);
    });
    
    // Delay between batches
    if (i + BATCH_SIZE < allTeams.length) {
      console.log('⏸️  Pausing 3s before next batch...');
      await delay(3000);
    }
  }
  
  await browser.close();
  
  // Save results
  console.log('\n💾 Saving results...');
  
  if (shouldScrapeRosters && allRosters.length > 0) {
    const rostersFile = path.join(DATA_DIR, 'all_d1_rosters_2026.json');
    fs.writeFileSync(rostersFile, JSON.stringify(allRosters, null, 2));
    console.log(`✅ Saved rosters: ${rostersFile}`);
    
    // Extract all pitchers
    const allPitchers = [];
    allRosters.forEach(({ team, pitchers }) => {
      pitchers.forEach(p => allPitchers.push({
        ...p,
        teamId: team.id,
        teamName: team.name,
        teamSlug: team.slug
      }));
    });
    
    const pitchersFile = path.join(DATA_DIR, 'all_d1_pitchers_2026.json');
    fs.writeFileSync(pitchersFile, JSON.stringify(allPitchers, null, 2));
    console.log(`✅ Saved pitchers: ${pitchersFile} (${allPitchers.length} total)`);
  }
  
  if (shouldScrapeSchedules && allSchedules.length > 0) {
    const schedulesFile = path.join(DATA_DIR, 'all_d1_schedules_2026.json');
    fs.writeFileSync(schedulesFile, JSON.stringify(allSchedules, null, 2));
    console.log(`✅ Saved schedules: ${schedulesFile}`);
  }
  
  console.log('\n🎉 Done!');
  
  // Summary
  const successfulRosters = allRosters.filter(r => !r.error).length;
  const successfulSchedules = allSchedules.filter(s => !s.error).length;
  
  console.log('\n📊 Summary:');
  if (shouldScrapeRosters) {
    console.log(`   Rosters: ${successfulRosters}/${allRosters.length} successful`);
  }
  if (shouldScrapeSchedules) {
    console.log(`   Schedules: ${successfulSchedules}/${allSchedules.length} successful`);
  }
}

main().catch(console.error);
