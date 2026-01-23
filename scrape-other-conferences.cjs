/**
 * Big 12, Big Ten, Pac-12 Baseball Pitcher Scraper
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const KNOWN_WEBSITES = require('./known-athletic-websites.cjs');

const DATA_DIR = path.join(__dirname, 'data');
const TEAMS_FILE = path.join(DATA_DIR, 'teams.json');
const OUTPUT_FILE = path.join(DATA_DIR, 'other_conferences_pitchers.json');
const TARGET_CONFERENCES = ['Big 12', 'Big Ten', 'Pac-12'];

const delay = ms => new Promise(r => setTimeout(r, ms));

function cleanText(text) {
  if (!text) return '';
  return text.replace(/\s+/g, ' ').replace(/\n+/g, ' ').trim();
}

function drawProgressBar(current, total, teamName, pitchers, failed) {
  const barWidth = 50;
  const percentage = Math.floor((current / total) * 100);
  const filled = Math.floor((current / total) * barWidth);
  const empty = barWidth - filled;
  const bar = '█'.repeat(filled) + '░'.repeat(empty);
  const stats = `⚾${pitchers} ✗${failed}`;
  process.stdout.write(`\r[${bar}] ${percentage}% (${current}/${total}) ${stats} | ${teamName.padEnd(30).substring(0, 30)}`);
}

function isPitcher(position) {
  if (!position) return false;
  const pos = cleanText(position).toUpperCase();
  if (pos.includes('PITCHER') || pos.includes('RHP') || pos.includes('LHP')) return true;
  const words = pos.split(/[\s,/]+/);
  return words.includes('P') || words.includes('SP') || words.includes('RP') || words.includes('CL');
}

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

async function main() {
  console.log('⚾ Big 12 / Big Ten / Pac-12 Pitcher Scraper');
  console.log('==============================================\n');
  
  const teamsData = JSON.parse(fs.readFileSync(TEAMS_FILE, 'utf8'));
  const teamsToScrape = teamsData.teams.filter(t => 
    KNOWN_WEBSITES[t.id] && TARGET_CONFERENCES.includes(t.conference)
  );
  
  console.log(`📊 Teams to scrape: ${teamsToScrape.length}\n`);
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const pitchersData = {};
  let totalPitchers = 0;
  let failedCount = 0;
  
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
            bioUrl: p.bioUrl || ''
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
        
        if ((i + 1) % 10 === 0) {
          fs.writeFileSync(OUTPUT_FILE, JSON.stringify(pitchersData, null, 2));
        }
        
      } catch (err) {
        failedCount++;
      }
      
      await delay(1500);
    }
    
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(pitchersData, null, 2));
    
    console.log('\n\n' + '='.repeat(60));
    console.log('📊 Final Summary:');
    console.log(`   Teams scraped: ${teamsToScrape.length}`);
    console.log(`   ✓ Successful: ${teamsToScrape.length - failedCount}`);
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
