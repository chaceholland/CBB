#!/usr/bin/env node
/**
 * Scrape missing Power 5 teams from official athletic websites
 * Missing: ACC (4), Big 12 (5), Big Ten (6) = 15 teams
 */
import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';

const MISSING_TEAMS = [
  // ACC (4 missing)
  { slug: 'georgia-tech', name: 'Georgia Tech Yellow Jackets', conference: 'ACC', url: 'https://ramblinwreck.com/sports/baseball/roster' },
  { slug: 'smu', name: 'SMU Mustangs', conference: 'ACC', url: 'https://smumustangs.com/sports/baseball/roster' },
  { slug: 'stanford', name: 'Stanford Cardinal', conference: 'ACC', url: 'https://gostanford.com/sports/baseball/roster' },
  { slug: 'virginia-tech', name: 'Virginia Tech Hokies', conference: 'ACC', url: 'https://hokiesports.com/sports/baseball/roster' },
  
  // Big 12 (5 missing)
  { slug: 'arizona-state', name: 'Arizona State Sun Devils', conference: 'Big 12', url: 'https://thesundevils.com/sports/baseball/roster' },
  { slug: 'arizona', name: 'Arizona Wildcats', conference: 'Big 12', url: 'https://arizonawildcats.com/sports/baseball/roster' },
  { slug: 'cincinnati', name: 'Cincinnati Bearcats', conference: 'Big 12', url: 'https://gobearcats.com/sports/baseball/roster' },
  { slug: 'colorado', name: 'Colorado Buffaloes', conference: 'Big 12', url: 'https://cubuffs.com/sports/baseball/roster' },
  { slug: 'ucf', name: 'UCF Knights', conference: 'Big 12', url: 'https://ucfknights.com/sports/baseball/roster' },
  
  // Big Ten (6 missing)
  { slug: 'iowa', name: 'Iowa Hawkeyes', conference: 'Big Ten', url: 'https://hawkeyesports.com/sports/baseball/roster' },
  { slug: 'nebraska', name: 'Nebraska Cornhuskers', conference: 'Big Ten', url: 'https://huskers.com/sports/baseball/roster' },
  { slug: 'oregon', name: 'Oregon Ducks', conference: 'Big Ten', url: 'https://goducks.com/sports/baseball/roster' },
  { slug: 'penn-state', name: 'Penn State Nittany Lions', conference: 'Big Ten', url: 'https://gopsusports.com/sports/baseball/roster' },
  { slug: 'purdue', name: 'Purdue Boilermakers', conference: 'Big Ten', url: 'https://purduesports.com/sports/baseball/roster' },
  { slug: 'wisconsin', name: 'Wisconsin Badgers', conference: 'Big Ten', url: 'https://uwbadgers.com/sports/baseball/roster' },
];

const OUTPUT_FILE = './data/missing_power5_pitchers.json';
const DEBUG_DIR = './debug_html';
const DELAY_MS = 2000;


function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Multiple selector strategies for different SIDEARM implementations
const SELECTORS = {
  // Strategy 1: Modern SIDEARM data attributes
  sidearmModern: {
    container: '.s-person-card, .sidearm-roster-player, [class*="roster-player"]',
    name: '.s-person-details__personal-single-line-name, .sidearm-roster-player-name a, .roster-player-name a',
    position: '[data-test-id="s-person-details__bio-stats-person-position-short"], .sidearm-roster-player-position, .roster-player-position',
    number: '.s-stamp, .sidearm-roster-player-jersey-number, .roster-player-jersey-number',
    year: '.s-person-details__bio-stats-item:has(.s-person-details__bio-stats-label:contains("Yr")) .s-person-details__bio-stats-value, .sidearm-roster-player-class-name',
    headshot: '.s-person-card__header img, .sidearm-roster-player-image img, .roster-player-image img'
  },
  // Strategy 2: Table-based rosters
  tableRoster: {
    container: 'table tbody tr',
    name: 'td:nth-child(2) a, td.name a',
    position: 'td:nth-child(3), td.position',
    number: 'td:nth-child(1), td.jersey',
    year: 'td:nth-child(4), td.year',
    headshot: 'td img'
  },
  // Strategy 3: Generic fallback
  generic: {
    container: '[class*="player"], [class*="roster"] li, .card',
    name: 'a[href*="roster"], h3, h4, .name',
    position: '[class*="position"], .pos',
    number: '[class*="number"], [class*="jersey"], .num',
    year: '[class*="year"], [class*="class"]',
    headshot: 'img[src*="headshot"], img[src*="player"], img[src*="roster"]'
  }
};

async function scrapeTeam(page, team, saveDebug = true) {
  console.log(`\n📍 Scraping ${team.name}...`);
  console.log(`   URL: ${team.url}`);
  
  try {
    await page.goto(team.url, { waitUntil: 'networkidle2', timeout: 30000 });
    await delay(1500); // Wait for dynamic content
    
    // Save debug HTML
    if (saveDebug) {
      const html = await page.content();
      const debugPath = path.join(DEBUG_DIR, `${team.slug}_roster.html`);
      fs.writeFileSync(debugPath, html);
    }
    
    // Try each selector strategy
    let pitchers = [];
    
    for (const [strategyName, selectors] of Object.entries(SELECTORS)) {
      pitchers = await page.evaluate((sel) => {
        const results = [];
        const containers = document.querySelectorAll(sel.container);
        
        containers.forEach((container, idx) => {
          // Get position first to filter pitchers
          const posEl = container.querySelector(sel.position);
          const position = posEl?.textContent?.trim() || '';
          
          // Only include pitchers (RHP, LHP, P, Pitcher)
          const isPitcher = /\b(RHP|LHP|P|Pitcher)\b/i.test(position);
          if (!isPitcher) return;
          
          const nameEl = container.querySelector(sel.name);
          const name = nameEl?.textContent?.trim() || '';
          if (!name) return;
          
          const numEl = container.querySelector(sel.number);
          const number = numEl?.textContent?.trim().replace('#', '') || '';
          
          const yearEl = container.querySelector(sel.year);
          const year = yearEl?.textContent?.trim() || '';
          
          const imgEl = container.querySelector(sel.headshot);
          const headshot = imgEl?.src || '';
          
          results.push({
            id: `P${idx + 1}`,
            name,
            number,
            position,
            year,
            headshot,
            hometown: '',
            height: '',
            weight: '',
            batsThrows: ''
          });
        });
        
        return results;
      }, selectors);
      
      if (pitchers.length > 0) {
        console.log(`   ✅ Found ${pitchers.length} pitchers using ${strategyName} strategy`);
        break;
      }
    }
    
    if (pitchers.length === 0) {
      console.log(`   ⚠️ No pitchers found, trying broad search...`);
      
      // Fallback: search all text for pitcher indicators
      pitchers = await page.evaluate(() => {
        const results = [];
        const allText = document.body.innerText;
        
        // Look for any elements containing RHP or LHP
        const allElements = document.querySelectorAll('*');
        allElements.forEach((el, idx) => {
          if (el.children.length > 0) return; // Skip containers
          const text = el.textContent?.trim() || '';
          if (/\b(RHP|LHP)\b/.test(text) && text.length < 50) {
            // Found a position indicator, try to find associated name
            const parent = el.closest('tr, li, div, article');
            if (parent) {
              const links = parent.querySelectorAll('a');
              links.forEach(link => {
                const name = link.textContent?.trim();
                if (name && name.length > 2 && name.length < 50 && !/roster|schedule|stats/i.test(name)) {
                  results.push({
                    id: `P${results.length + 1}`,
                    name,
                    position: text,
                    number: '',
                    year: '',
                    headshot: '',
                    hometown: '',
                    height: '',
                    weight: '',
                    batsThrows: ''
                  });
                }
              });
            }
          }
        });
        
        // Deduplicate by name
        const seen = new Set();
        return results.filter(p => {
          if (seen.has(p.name)) return false;
          seen.add(p.name);
          return true;
        });
      });
      
      if (pitchers.length > 0) {
        console.log(`   ✅ Found ${pitchers.length} pitchers using fallback search`);
      }
    }
    
    return {
      ...team,
      pitchers,
      scrapedAt: new Date().toISOString()
    };
    
  } catch (err) {
    console.log(`   ❌ Error: ${err.message}`);
    return {
      ...team,
      pitchers: [],
      error: err.message,
      scrapedAt: new Date().toISOString()
    };
  }
}


async function main() {
  console.log('='.repeat(60));
  console.log('🏟️  Missing Power 5 Teams Scraper');
  console.log('='.repeat(60));
  console.log(`Teams to scrape: ${MISSING_TEAMS.length}`);
  console.log(`Output: ${OUTPUT_FILE}`);
  
  // Ensure debug directory exists
  if (!fs.existsSync(DEBUG_DIR)) {
    fs.mkdirSync(DEBUG_DIR, { recursive: true });
  }
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
  await page.setViewport({ width: 1280, height: 800 });
  
  const results = [];
  let successCount = 0;
  let failCount = 0;
  
  for (const team of MISSING_TEAMS) {
    const result = await scrapeTeam(page, team);
    results.push(result);
    
    if (result.pitchers.length > 0) {
      successCount++;
    } else {
      failCount++;
    }
    
    await delay(DELAY_MS);
  }
  
  await browser.close();
  
  // Save results
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));
  
  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 SCRAPE SUMMARY');
  console.log('='.repeat(60));
  
  let totalPitchers = 0;
  results.forEach(team => {
    const status = team.pitchers.length > 0 ? '✅' : '❌';
    console.log(`${status} ${team.name}: ${team.pitchers.length} pitchers`);
    totalPitchers += team.pitchers.length;
  });
  
  console.log('-'.repeat(60));
  console.log(`Success: ${successCount}/${MISSING_TEAMS.length} teams`);
  console.log(`Total pitchers found: ${totalPitchers}`);
  console.log(`Output saved to: ${OUTPUT_FILE}`);
  
  // List teams that need manual attention
  const failed = results.filter(t => t.pitchers.length === 0);
  if (failed.length > 0) {
    console.log('\n⚠️ Teams needing manual review:');
    failed.forEach(t => console.log(`   - ${t.name}: ${t.url}`));
  }
}

main().catch(console.error);
