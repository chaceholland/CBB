/**
 * SAFE Conference Scraper - Merges with existing data instead of overwriting
 * 
 * Usage:
 *   node scrape-conferences-safe.cjs SEC
 *   node scrape-conferences-safe.cjs ACC
 *   node scrape-conferences-safe.cjs "Big 12"
 *   node scrape-conferences-safe.cjs "Big Ten"
 *   node scrape-conferences-safe.cjs "Pac-12"
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const KNOWN_WEBSITES = require('./known-athletic-websites.cjs');
const SLUG_MAP = require('./slug-to-website-map.cjs');

const DATA_DIR = path.join(__dirname, 'data');
const TEAMS_FILE = path.join(DATA_DIR, 'teams.json');
const OUTPUT_FILE = path.join(DATA_DIR, 'pitchers.json');

const delay = ms => new Promise(r => setTimeout(r, ms));

// Conference to team mapping
const CONFERENCES = {
  'SEC': ['alabama-crimson-tide', 'arkansas-razorbacks', 'auburn-tigers', 'florida-gators', 
          'georgia-bulldogs', 'kentucky-wildcats', 'lsu-tigers', 'mississippi-state-bulldogs',
          'ole-miss-rebels', 'south-carolina-gamecocks', 'tennessee-volunteers', 
          'vanderbilt-commodores', 'texas-am-aggies', 'missouri-tigers', 
          'oklahoma-sooners', 'texas-longhorns'],
  'ACC': ['boston-college-eagles', 'clemson-tigers', 'duke-blue-devils', 'florida-state-seminoles', 
          'georgia-tech-yellow-jackets', 'louisville-cardinals', 'miami-hurricanes', 'nc-state-wolfpack', 
          'north-carolina-tar-heels', 'notre-dame-fighting-irish', 'pittsburgh-panthers', 
          'syracuse-orange', 'virginia-cavaliers', 'virginia-tech-hokies', 'wake-forest-demon-deacons', 
          'california-golden-bears', 'stanford-cardinal', 'smu-mustangs'],
  'Big 12': ['baylor-bears', 'cincinnati-bearcats', 'houston-cougars', 'iowa-state-cyclones', 
             'kansas-jayhawks', 'kansas-state-wildcats', 'oklahoma-state-cowboys', 'tcu-horned-frogs', 
             'texas-tech-red-raiders', 'west-virginia-mountaineers', 'ucf-knights', 'byu-cougars',
             'arizona-wildcats', 'arizona-state-sun-devils', 'colorado-buffaloes', 'utah-utes'],
  'Big Ten': ['illinois-fighting-illini', 'indiana-hoosiers', 'iowa-hawkeyes', 'maryland-terrapins', 
              'michigan-wolverines', 'michigan-state-spartans', 'minnesota-golden-gophers', 
              'nebraska-cornhuskers', 'northwestern-wildcats', 'ohio-state-buckeyes', 
              'penn-state-nittany-lions', 'purdue-boilermakers', 'rutgers-scarlet-knights', 
              'wisconsin-badgers', 'ucla-bruins', 'usc-trojans', 'oregon-ducks', 'washington-huskies'],
  'Pac-12': ['oregon-state-beavers', 'washington-state-cougars']
};

// Progress bar
function drawProgressBar(current, total, teamName, pitchers, failed) {
  const barWidth = 50;
  const percentage = Math.floor((current / total) * 100);
  const filled = Math.floor((current / total) * barWidth);
  const empty = barWidth - filled;
  
  const bar = '█'.repeat(filled) + '░'.repeat(empty);
  const stats = `⚾${pitchers} ✗${failed}`;
  
  process.stdout.write(`\r[${bar}] ${percentage}% (${current}/${total}) ${stats} | ${teamName.padEnd(30).substring(0, 30)}`);
}

// Check if position is pitcher
function isPitcher(position) {
  if (!position) return false;
  const pos = position.trim().toUpperCase();
  const codes = ['P', 'RHP', 'LHP', 'SP', 'RP', 'CL'];
  return codes.some(code => 
    pos === code || pos.startsWith(code + '/') || pos.endsWith('/' + code) ||
    pos.includes('PITCHER')
  );
}

// Scrape team roster
async function scrapeTeam(browser, team, websiteInfo) {
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
  
  try {
    const url = websiteInfo.base + websiteInfo.roster;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await delay(2000);
    
    const roster = await page.evaluate((baseUrl) => {
      const players = [];
      const getText = (el, selectors) => {
        if (!el) return '';
        for (const sel of selectors) {
          const found = el.querySelector(sel);
          if (found) return found.textContent?.trim() || '';
        }
        return '';
      };
      
      const getAttr = (el, selectors, attr) => {
        if (!el) return '';
        for (const sel of selectors) {
          const found = el.querySelector(sel);
          if (found) {
            const val = found.getAttribute(attr);
            if (val) return val;
          }
        }
        return '';
      };
      
      // SIDEARM roster cards
      const sidearmPlayers = document.querySelectorAll('.sidearm-roster-player');
      sidearmPlayers.forEach(player => {
        let headshot = getAttr(player, ['.sidearm-roster-player-image img'], 'srcset') || 
                      getAttr(player, ['.sidearm-roster-player-image img'], 'src') || '';
        
        if (headshot.includes(' ')) {
          const match = headshot.match(/(https?:\/\/[^\s,]+)/);
          if (match) headshot = match[1];
        }
        
        if (headshot.startsWith('/')) headshot = baseUrl + headshot;
        
        let bioUrl = getAttr(player, ['.sidearm-roster-player-name a'], 'href') || '';
        if (bioUrl && bioUrl.startsWith('/')) bioUrl = baseUrl + bioUrl;
        
        const name = getText(player, ['.sidearm-roster-player-name']);
        const number = getText(player, ['.sidearm-roster-player-jersey-number']);
        const position = getText(player, ['.sidearm-roster-player-position']);
        const year = getText(player, ['.sidearm-roster-player-academic-year']);
        
        if (name) {
          players.push({ name, number, position, year, headshot, bioUrl });
        }
      });
      
      return players;
    }, websiteInfo.base);
    
    await page.close();
    
    const pitchers = roster.filter(p => isPitcher(p.position));
    return pitchers;
    
  } catch (err) {
    await page.close();
    throw err;
  }
}

// Generate bio URL
function generateBioUrl(team, playerName, websiteInfo) {
  const nameSlug = playerName.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  
  return `${websiteInfo.base}${websiteInfo.roster}/${nameSlug}`;
}

// Main
async function main() {
  const conference = process.argv[2];
  
  if (!conference || !CONFERENCES[conference]) {
    console.log('❌ Please specify a valid conference:');
    console.log('   node scrape-conferences-safe.cjs SEC');
    console.log('   node scrape-conferences-safe.cjs ACC');
    console.log('   node scrape-conferences-safe.cjs "Big 12"');
    console.log('   node scrape-conferences-safe.cjs "Big Ten"');
    console.log('   node scrape-conferences-safe.cjs "Pac-12"');
    process.exit(1);
  }
  
  console.log(`⚾ SAFE ${conference} Pitcher Scraper`);
  console.log('='.repeat(60));
  console.log('🛡️  MERGE MODE: Will preserve existing data\n');
  
  // Load existing data
  let existingData = {};
  if (fs.existsSync(OUTPUT_FILE)) {
    try {
      existingData = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf8'));
      console.log(`📂 Loaded existing data: ${Object.keys(existingData).length} teams\n`);
    } catch (err) {
      console.log('⚠️  Could not load existing data, starting fresh\n');
    }
  }
  
  // Create backup
  if (Object.keys(existingData).length > 0) {
    const backupFile = OUTPUT_FILE.replace('.json', `-backup-${Date.now()}.json`);
    fs.writeFileSync(backupFile, JSON.stringify(existingData, null, 2));
    console.log(`💾 Backup created: ${path.basename(backupFile)}\n`);
  }
  
  // Get teams to scrape
  const teamsData = JSON.parse(fs.readFileSync(TEAMS_FILE, 'utf8'));
  const teamSlugs = CONFERENCES[conference];
  
  // Match teams by slug using mapping
  const teamsToScrape = teamsData.teams.filter(t => {
    const slug = t.slug || t.id;
    if (teamSlugs.includes(slug)) {
      const websiteId = SLUG_MAP[slug];
      if (websiteId && KNOWN_WEBSITES[websiteId]) {
        t._websiteId = websiteId;
        return true;
      }
    }
    return false;
  });
  
  console.log(`📊 Teams to scrape: ${teamsToScrape.length}`);
  console.log(`   Conference: ${conference}\n`);
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  // Start with existing data
  const pitchersData = { ...existingData };
  let totalPitchers = 0;
  let failedCount = 0;
  let updatedCount = 0;
  
  try {
    for (let i = 0; i < teamsToScrape.length; i++) {
      const team = teamsToScrape[i];
      const websiteInfo = KNOWN_WEBSITES[team._websiteId];
      
      drawProgressBar(i + 1, teamsToScrape.length, team.name, totalPitchers, failedCount);
      
      try {
        const pitchers = await scrapeTeam(browser, team, websiteInfo);
        
        if (pitchers && pitchers.length > 0) {
          const enrichedPitchers = pitchers.map((p, idx) => ({
            id: `${team.id}-P${idx + 1}`,
            name: p.name,
            number: p.number || '',
            position: p.position || '',
            year: p.year || '',
            height: '',
            weight: '',
            batsThrows: '',
            hometown: '',
            headshot: p.headshot || '',
            bioUrl: p.bioUrl || generateBioUrl(team, p.name, websiteInfo)
          }));
          
          // MERGE: Update or add team data
          pitchersData[team.id] = {
            team: team.name,
            teamId: team.id,
            slug: team.slug,
            pitchers: enrichedPitchers
          };
          
          totalPitchers += pitchers.length;
          updatedCount++;
        } else {
          failedCount++;
        }
        
        // Save progress every 5 teams
        if ((i + 1) % 5 === 0) {
          fs.writeFileSync(OUTPUT_FILE, JSON.stringify(pitchersData, null, 2));
        }
        
      } catch (err) {
        failedCount++;
      }
      
      await delay(1500);
    }
    
    // Save final output
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(pitchersData, null, 2));
    
    console.log('\n\n' + '='.repeat(60));
    console.log('📊 Final Summary:');
    console.log(`   Teams attempted: ${teamsToScrape.length}`);
    console.log(`   ✓ Successfully scraped: ${updatedCount}`);
    console.log(`   ✗ Failed: ${failedCount}`);
    console.log(`   ⚾ New pitchers added: ${totalPitchers}`);
    console.log(`   📁 Total teams in file: ${Object.keys(pitchersData).length}`);
    console.log(`\n💾 Saved to: ${OUTPUT_FILE}`);
    console.log('✅ Done! Existing data preserved.\n');
    
  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error('\n❌ Fatal error:', err);
  process.exit(1);
});
