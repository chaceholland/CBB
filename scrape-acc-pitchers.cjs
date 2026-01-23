/**
 * ACC Baseball Pitcher Scraper with Enhanced Data Cleaning
 * 
 * Focused scraper for ACC teams only with improved text cleanup
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const TEAMS_FILE = path.join(DATA_DIR, 'teams.json');
const OUTPUT_FILE = path.join(DATA_DIR, 'acc_pitchers.json');

// ACC team URLs (using teams.json IDs)
const ACC_WEBSITES = {
  '86': { base: 'https://bceagles.com', roster: '/sports/baseball/roster' }, // Boston College
  '117': { base: 'https://clemsontigers.com', roster: '/sports/baseball/roster' }, // Clemson
  '93': { base: 'https://goduke.com', roster: '/sports/baseball/roster' }, // Duke
  '72': { base: 'https://seminoles.com', roster: '/sports/baseball/roster' }, // Florida State
  '77': { base: 'https://ramblinwreck.com', roster: '/sports/baseball/roster' }, // Georgia Tech
  '83': { base: 'https://gocards.com', roster: '/sports/baseball/roster' }, // Louisville
  '176': { base: 'https://hurricanesports.com', roster: '/sports/baseball/roster' }, // Miami
  '96': { base: 'https://goheels.com', roster: '/sports/baseball/roster' }, // North Carolina
  '95': { base: 'https://gopack.com', roster: '/sports/baseball/roster' }, // NC State
  '81': { base: 'https://und.com', roster: '/sports/baseball/roster' }, // Notre Dame
  '115': { base: 'https://pittsburghpanthers.com', roster: '/sports/baseball/roster' }, // Pittsburgh
  '64': { base: 'https://gostanford.com', roster: '/sports/baseball/roster' }, // Stanford
  '433': { base: 'https://smumustangs.com', roster: '/sports/baseball/roster' }, // SMU
  '131': { base: 'https://virginiasports.com', roster: '/sports/baseball/roster' }, // Virginia
  '132': { base: 'https://hokiesports.com', roster: '/sports/baseball/roster' }, // Virginia Tech
  '97': { base: 'https://godeacs.com', roster: '/sports/baseball/roster' }, // Wake Forest
  '65': { base: 'https://calbears.com', roster: '/sports/baseball/roster' } // California
};

const delay = ms => new Promise(r => setTimeout(r, ms));

// Clean text - remove all extra whitespace and newlines
function cleanText(text) {
  if (!text) return '';
  return text
    .replace(/\s+/g, ' ')  // Replace all whitespace sequences with single space
    .replace(/\n+/g, ' ')  // Replace newlines with space
    .trim();
}

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
  const pos = cleanText(position).toUpperCase();
  
  // Check for pitcher keywords
  if (pos.includes('PITCHER')) return true;
  if (pos.includes('RHP')) return true;
  if (pos.includes('LHP')) return true;
  
  // Check for single letter P position
  const words = pos.split(/[\s,/]+/);
  if (words.includes('P') || words.includes('SP') || words.includes('RP') || words.includes('CL')) {
    return true;
  }
  
  return false;
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
      
      const cleanText = (text) => {
        if (!text) return '';
        return text.replace(/\s+/g, ' ').replace(/\n+/g, ' ').trim();
      };
      
      const getText = (el, selectors) => {
        if (!el) return '';
        for (const sel of selectors) {
          const found = el.querySelector(sel);
          if (found) return cleanText(found.textContent || '');
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
        
        // Extract first URL from srcset
        if (headshot.includes(' ')) {
          const match = headshot.match(/(https?:\/\/[^\s,]+)/);
          if (match) headshot = match[1];
        }
        
        if (headshot && headshot.startsWith('/')) headshot = baseUrl + headshot;
        
        let bioUrl = getAttr(player, ['.sidearm-roster-player-name a'], 'href') || '';
        if (bioUrl && bioUrl.startsWith('/')) bioUrl = baseUrl + bioUrl;
        
        const name = cleanText(getText(player, ['.sidearm-roster-player-name']));
        const number = cleanText(getText(player, ['.sidearm-roster-player-jersey-number']));
        const position = cleanText(getText(player, ['.sidearm-roster-player-position']));
        const year = cleanText(getText(player, ['.sidearm-roster-player-academic-year']));
        
        if (name) {
          players.push({ name, number, position, year, headshot, bioUrl });
        }
      });
      
      return players;
    }, websiteInfo.base);
    
    await page.close();
    
    // Filter to pitchers only
    const pitchers = roster.filter(p => {
      const pos = cleanText(p.position).toUpperCase();
      return pos.includes('PITCHER') || pos.includes('RHP') || pos.includes('LHP') || 
             pos.split(/[\s,/]+/).some(word => ['P', 'SP', 'RP', 'CL'].includes(word));
    });
    
    return pitchers;
    
  } catch (err) {
    await page.close().catch(() => {});
    return null;
  }
}

// Generate bio URL
function generateBioUrl(team, playerName, websiteInfo) {
  const nameSlug = playerName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  
  return `${websiteInfo.base}${websiteInfo.roster}/${nameSlug}`;
}

// Main
async function main() {
  console.log('⚾ ACC Baseball Pitcher Scraper');
  console.log('===============================\n');
  
  // Load teams and filter to ACC
  const teamsData = JSON.parse(fs.readFileSync(TEAMS_FILE, 'utf8'));
  const accTeams = teamsData.teams.filter(t => 
    t.conference === 'ACC' && ACC_WEBSITES[t.id]
  );
  
  console.log(`📊 ACC Teams to scrape: ${accTeams.length}\n`);
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const pitchersData = {};
  let totalPitchers = 0;
  let failedCount = 0;
  
  try {
    for (let i = 0; i < accTeams.length; i++) {
      const team = accTeams[i];
      const websiteInfo = ACC_WEBSITES[team.id];
      
      drawProgressBar(i + 1, accTeams.length, team.name, totalPitchers, failedCount);
      
      try {
        const pitchers = await scrapeTeam(browser, team, websiteInfo);
        
        if (pitchers && pitchers.length > 0) {
          const enrichedPitchers = pitchers.map((p, idx) => ({
            id: `${team.id}-P${idx + 1}`,
            name: cleanText(p.name),
            number: cleanText(p.number),
            position: cleanText(p.position),
            year: cleanText(p.year),
            height: '',
            weight: '',
            batsThrows: '',
            hometown: '',
            headshot: p.headshot || '',
            bioUrl: p.bioUrl || generateBioUrl(team, p.name, websiteInfo)
          }));
          
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
    console.log(`   Teams scraped: ${accTeams.length}`);
    console.log(`   ✓ Successful: ${accTeams.length - failedCount}`);
    console.log(`   ✗ Failed: ${failedCount}`);
    console.log(`   ⚾ Total pitchers: ${totalPitchers}`);
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
