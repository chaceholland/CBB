#!/usr/bin/env node
/**
 * Quick SEC Pitcher Scraper - Outputs to pitchers.json
 */
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const TEAMS = [
  { id: '148', name: 'Alabama Crimson Tide', slug: 'alabama-crimson-tide', url: 'https://rolltide.com/sports/baseball/roster' },
  { id: '58', name: 'Arkansas Razorbacks', slug: 'arkansas-razorbacks', url: 'https://arkansasrazorbacks.com/sports/baseball/roster' },
  { id: '55', name: 'Auburn Tigers', slug: 'auburn-tigers', url: 'https://auburntigers.com/sports/baseball/roster' },
  { id: '75', name: 'Florida Gators', slug: 'florida-gators', url: 'https://floridagators.com/sports/baseball/roster' },
  { id: '78', name: 'Georgia Bulldogs', slug: 'georgia-bulldogs', url: 'https://georgiadogs.com/sports/baseball/roster' },
  { id: '82', name: 'Kentucky Wildcats', slug: 'kentucky-wildcats', url: 'https://ukathletics.com/sports/baseball/roster' },
  { id: '85', name: 'LSU Tigers', slug: 'lsu-tigers', url: 'https://lsusports.net/sports/baseball/roster' },
  { id: '150', name: 'Mississippi State Bulldogs', slug: 'mississippi-state-bulldogs', url: 'https://hailstate.com/sports/baseball/roster' },
  { id: '92', name: 'Ole Miss Rebels', slug: 'ole-miss-rebels', url: 'https://olemisssports.com/sports/baseball/roster' },
  { id: '193', name: 'South Carolina Gamecocks', slug: 'south-carolina-gamecocks', url: 'https://gamecocksonline.com/sports/baseball/roster' },
  { id: '199', name: 'Tennessee Volunteers', slug: 'tennessee-volunteers', url: 'https://utsports.com/sports/baseball/roster' },
  { id: '120', name: 'Vanderbilt Commodores', slug: 'vanderbilt-commodores', url: 'https://vucommodores.com/sports/baseball/roster' },
  { id: '123', name: 'Texas A&M Aggies', slug: 'texas-am-aggies', url: 'https://12thman.com/sports/baseball/roster' },
  { id: '91', name: 'Missouri Tigers', slug: 'missouri-tigers', url: 'https://mutigers.com/sports/baseball/roster' }
];

const OUTPUT_FILE = './data/pitchers.json';
const delay = ms => new Promise(r => setTimeout(r, ms));

function isPitcher(position) {
  if (!position) return false;
  const pos = position.trim().toUpperCase();
  return pos.includes('RHP') || pos.includes('LHP') || pos.includes('PITCHER') || pos === 'P';
}

async function scrapeTeam(browser, team) {
  console.log(`[${team.name}]`);
  const page = await browser.newPage();
  
  try {
    await page.goto(team.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
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
    console.log(`  ✗ Error: ${err.message}`);
    await page.close();
    return [];
  }
}

async function main() {
  console.log('⚾ SEC Pitcher Scraper - Rebuilding SEC Data\n');
  console.log('═══════════════════════════════════════════\n');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox']
  });
  
  const results = {};
  let totalPitchers = 0;
  
  for (let i = 0; i < TEAMS.length; i++) {
    const team = TEAMS[i];
    process.stdout.write(`\r[${i+1}/${TEAMS.length}] ${team.name.padEnd(35)}`);
    
    const pitchers = await scrapeTeam(browser, team);
    
    if (pitchers.length > 0) {
      results[team.id] = {
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
      totalPitchers += pitchers.length;
      console.log(` ✓ ${pitchers.length} pitchers`);
    } else {
      console.log(` ✗ 0 pitchers`);
    }
    
    await delay(1500);
  }
  
  await browser.close();
  
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));
  
  console.log('\n' + '═'.repeat(50));
  console.log(`✅ Complete!`);
  console.log(`   Teams: ${Object.keys(results).length}/14`);
  console.log(`   Total pitchers: ${totalPitchers}`);
  console.log(`\n💾 Saved to: ${OUTPUT_FILE}\n`);
}

main().catch(console.error);
