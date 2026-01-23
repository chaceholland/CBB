#!/usr/bin/env node
/**
 * Scrape ACC, Big 12, Big Ten, Pac-12 pitchers
 * Merge with existing SEC data
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const TEAMS_FILE = path.join(DATA_DIR, 'teams.json');
const OUTPUT_FILE = path.join(DATA_DIR, 'pitchers.json');

// Known website mappings (from your known-athletic-websites.cjs)
const KNOWN_WEBSITES = {
  // ACC
  '103': { base: 'https://bceagles.com', roster: '/sports/baseball/roster' },
  '228': { base: 'https://clemsontigers.com', roster: '/sports/baseball/roster' },
  '93': { base: 'https://goduke.com', roster: '/sports/baseball/roster' },
  '52': { base: 'https://seminoles.com', roster: '/sports/baseball/roster' },
  '59': { base: 'https://ramblinwreck.com', roster: '/sports/baseball/roster' },
  '97': { base: 'https://uoflsports.com', roster: '/sports/baseball/roster' },
  '152': { base: 'https://goheels.com', roster: '/sports/baseball/roster' },
  '513': { base: 'https://ndsports.com', roster: '/sports/baseball/roster' },
  '221': { base: 'https://pittsburghpanthers.com', roster: '/sports/baseball/roster' },
  '64': { base: 'https://gostanford.com', roster: '/sports/baseball/roster' },
  '120': { base: 'https://cuse.com', roster: '/sports/baseball/roster' },
  '259': { base: 'https://virginiasports.com', roster: '/sports/baseball/roster' },
  '154': { base: 'https://hokiesports.com', roster: '/sports/baseball/roster' },
  '235': { base: 'https://godukemdeacs.com', roster: '/sports/baseball/roster' },
  '65': { base: 'https://calbears.com', roster: '/sports/baseball/roster' },
  
  // Big 12
  '9': { base: 'https://arizonawildcats.com', roster: '/sports/baseball/roster' },
  '239': { base: 'https://baylorbears.com', roster: '/sports/baseball/roster' },
  '236': { base: 'https://byucougars.com', roster: '/sports/baseball/roster' },
  '38': { base: 'https://gobearcats.com', roster: '/sports/baseball/roster' },
};

const delay = ms => new Promise(r => setTimeout(r, ms));

function isPitcher(position) {
  if (!position) return false;
  const pos = position.trim().toUpperCase();
  return pos.includes('RHP') || pos.includes('LHP') || pos.includes('PITCHER') || 
         pos === 'P' || pos === 'SP' || pos === 'RP';
}

async function scrapeTeam(browser, team, websiteInfo) {
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
  
  try {
    const url = websiteInfo.base + websiteInfo.roster;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await delay(2000);
    
    const pitchers = await page.evaluate(() => {
      const players = [];
      const cards = document.querySelectorAll('.sidearm-roster-player');
      
      cards.forEach(card => {
        const name = card.querySelector('.sidearm-roster-player-name')?.textContent?.trim();
        const number = card.querySelector('.sidearm-roster-player-jersey-number')?.textContent?.trim();
        const position = card.querySelector('.sidearm-roster-player-position')?.textContent?.trim();
        const year = card.querySelector('.sidearm-roster-player-academic-year')?.textContent?.trim();
        
        if (name && position) {
          players.push({ name, number, position, year });
        }
      });
      
      return players;
    });
    
    await page.close();
    return pitchers.filter(p => isPitcher(p.position));
    
  } catch (err) {
    await page.close();
    throw err;
  }
}

async function main() {
  const TARGET_CONFERENCES = ['ACC', 'Big 12', 'Big Ten', 'Pac-12'];
  
  console.log('⚾ Major Conference Scraper (Merge-Safe)\n');
  console.log('═══════════════════════════════════════\n');
  
  // Load existing data
  let existingData = {};
  if (fs.existsSync(OUTPUT_FILE)) {
    existingData = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf8'));
    const count = Object.keys(existingData).length;
    const pitchers = Object.values(existingData).reduce((s, t) => s + t.pitchers.length, 0);
    console.log(`📂 Existing: ${count} teams, ${pitchers} pitchers\n`);
  }
  
  // Get teams to scrape
  const teamsData = JSON.parse(fs.readFileSync(TEAMS_FILE, 'utf8'));
  const teamsToScrape = teamsData.teams.filter(t => 
    TARGET_CONFERENCES.includes(t.conference) && KNOWN_WEBSITES[t.id]
  );
  
  console.log(`🎯 Target: ${TARGET_CONFERENCES.join(', ')}`);
  console.log(`📊 Teams to scrape: ${teamsToScrape.length}\n`);
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox']
  });
  
  let added = 0;
  let failed = 0;
  
  for (let i = 0; i < teamsToScrape.length; i++) {
    const team = teamsToScrape[i];
    const websiteInfo = KNOWN_WEBSITES[team.id];
    
    process.stdout.write(`\r[${i+1}/${teamsToScrape.length}] ${team.name.substring(0,35).padEnd(35)}`);
    
    try {
      const pitchers = await scrapeTeam(browser, team, websiteInfo);
      
      if (pitchers.length > 0) {
        existingData[team.id] = {
          team: team.name,
          teamId: team.id,
          slug: team.slug,
          pitchers: pitchers.map((p, idx) => ({
            id: `${team.id}-P${idx + 1}`,
            name: p.name,
            number: p.number || '',
            position: p.position || '',
            year: p.year || '',
            height: '',
            weight: '',
            batsThrows: '',
            hometown: '',
            headshot: '',
            bioUrl: ''
          }))
        };
        added += pitchers.length;
        console.log(` ✓ ${pitchers.length}`);
      } else {
        console.log(` ✗ 0`);
        failed++;
      }
      
      // Save every 5 teams
      if ((i + 1) % 5 === 0) {
        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(existingData, null, 2));
      }
      
    } catch (err) {
      console.log(` ✗ Error`);
      failed++;
    }
    
    await delay(1500);
  }
  
  await browser.close();
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(existingData, null, 2));
  
  console.log('\n' + '═'.repeat(50));
  console.log('✅ Complete!');
  console.log(`   Total teams: ${Object.keys(existingData).length}`);
  console.log(`   Total pitchers: ${Object.values(existingData).reduce((s,t) => s + t.pitchers.length, 0)}`);
  console.log(`   New pitchers added: ${added}`);
  console.log(`   Failed: ${failed}\n`);
}

main().catch(console.error);
