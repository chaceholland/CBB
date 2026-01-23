/**
 * MERGE-SAFE Conference Scraper
 * 
 * This scraper MERGES new data with existing pitchers.json
 * instead of overwriting it completely
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const KNOWN_WEBSITES = require('./known-athletic-websites.cjs');

const DATA_DIR = path.join(__dirname, 'data');
const TEAMS_FILE = path.join(DATA_DIR, 'teams.json');
const OUTPUT_FILE = path.join(DATA_DIR, 'pitchers.json');

const delay = ms => new Promise(r => setTimeout(r, ms));

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
    return roster.filter(p => isPitcher(p.position));
    
  } catch (err) {
    await page.close();
    throw err;
  }
}

// Generate bio URL
function generateBioUrl(team, playerName) {
  const websiteInfo = KNOWN_WEBSITES[team.id];
  if (!websiteInfo) return '';
  
  const nameSlug = playerName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  
  return `${websiteInfo.base}${websiteInfo.roster}/${nameSlug}`;
}

// Main
async function main() {
  const targetConferences = process.argv.slice(2);
  
  if (targetConferences.length === 0) {
    console.log('❌ Usage: node scrape-merge-safe.cjs <conference1> [conference2] ...');
    console.log('\nExamples:');
    console.log('  node scrape-merge-safe.cjs SEC');
    console.log('  node scrape-merge-safe.cjs ACC "Big 12" "Big Ten"');
    console.log('  node scrape-merge-safe.cjs Pac-12');
    process.exit(1);
  }
  
  console.log('⚾ MERGE-SAFE Conference Scraper');
  console.log('=================================\n');
  console.log('🔒 This will MERGE with existing data, not overwrite!\n');
  
  // Load existing data
  let existingData = {};
  if (fs.existsSync(OUTPUT_FILE)) {
    try {
      existingData = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf8'));
      const existingCount = Object.keys(existingData).length;
      const existingPitchers = Object.values(existingData).reduce((sum, team) => 
        sum + (team.pitchers?.length || 0), 0);
      console.log(`📂 Found existing data: ${existingCount} teams, ${existingPitchers} pitchers`);
    } catch (err) {
      console.log('⚠️  Could not read existing file, starting fresh');
    }
  }
  
  // Get teams to scrape
  const teamsData = JSON.parse(fs.readFileSync(TEAMS_FILE, 'utf8'));
  const teamsToScrape = teamsData.teams.filter(t => 
    KNOWN_WEBSITES[t.id] && 
    targetConferences.some(conf => t.conference === conf)
  );
  
  console.log(`\n🎯 Target conferences: ${targetConferences.join(', ')}`);
  console.log(`📊 Teams to scrape: ${teamsToScrape.length}\n`);
  
  if (teamsToScrape.length === 0) {
    console.log('❌ No teams found for specified conferences');
    process.exit(1);
  }
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  // Start with existing data
  const pitchersData = { ...existingData };
  let totalPitchers = 0;
  let failedCount = 0;
  let updatedCount = 0;
  let newCount = 0;
  
  try {
    for (let i = 0; i < teamsToScrape.length; i++) {
      const team = teamsToScrape[i];
      const websiteInfo = KNOWN_WEBSITES[team.id];
      
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
            bioUrl: p.bioUrl || generateBioUrl(team, p.name)
          }));
          
          // Check if updating existing or adding new
          if (pitchersData[team.id]) {
            updatedCount++;
          } else {
            newCount++;
          }
          
          pitchersData[team.id] = {
            team: team.name,
            teamId: team.id,
            slug: team.slug,
            pitchers: enrichedPitchers
          };
          
          totalPitchers += pitchers.length;
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
    console.log(`   Teams scraped: ${teamsToScrape.length}`);
    console.log(`   ✓ Successful: ${teamsToScrape.length - failedCount}`);
    console.log(`   ✗ Failed: ${failedCount}`);
    console.log(`   🆕 New teams: ${newCount}`);
    console.log(`   🔄 Updated teams: ${updatedCount}`);
    console.log(`   ⚾ Total pitchers added: ${totalPitchers}`);
    console.log(`   📦 Total teams in file: ${Object.keys(pitchersData).length}`);
    console.log(`\n💾 Saved to: ${OUTPUT_FILE}`);
    console.log('✅ Done!\n');
    
  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error('\n❌ Fatal error:', err);
  process.exit(1);
});
