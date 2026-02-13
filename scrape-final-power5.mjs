#!/usr/bin/env node
/**
 * Final scrape attempt for remaining Power 5 teams
 * Using verified correct URLs
 */

import fs from 'fs';
import puppeteer from 'puppeteer';

const FINAL_TEAMS = [
  // ACC (2 remaining - SMU doesn't have D1 baseball)
  { id: 'stanford', name: 'Stanford Cardinal', conference: 'ACC', url: 'https://gostanford.com/sports/baseball/roster/2025-26' },
  { id: 'virginia-tech', name: 'Virginia Tech Hokies', conference: 'ACC', url: 'https://hokiesports.com/sports/baseball/roster/2025-26' },
  
  // Big 12 (3 remaining)
  { id: 'arizona-state', name: 'Arizona State Sun Devils', conference: 'Big 12', url: 'https://thesundevils.com/sports/baseball/roster/2025-26' },
  { id: 'colorado', name: 'Colorado Buffaloes', conference: 'Big 12', url: 'https://cubuffs.com/sports/baseball/roster/2025-26' },
  { id: 'ucf', name: 'UCF Knights', conference: 'Big 12', url: 'https://ucfknights.com/sports/baseball/roster/2025-26' },
  
  // Big Ten (2 remaining)
  { id: 'oregon', name: 'Oregon Ducks', conference: 'Big Ten', url: 'https://goducks.com/sports/baseball/roster/2025-26' },
  { id: 'wisconsin', name: 'Wisconsin Badgers', conference: 'Big Ten', url: 'https://uwbadgers.com/sports/baseball/roster/2025-26' },
];

const OUTPUT_FILE = './data/final_power5_pitchers.json';
const DEBUG_DIR = './debug_html';
const DELAY_MS = 3500;

function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function scrapePitchers(page, url, teamId) {
  try {
    console.log(`  Loading ${url}...`);
    
    // Try both with and without year suffix
    let response = await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 }).catch(() => null);
    
    // If 404, try without year
    if (!response || response.status() === 404) {
      const baseUrl = url.replace('/2025-26', '');
      console.log(`  Trying base URL: ${baseUrl}`);
      response = await page.goto(baseUrl, { waitUntil: 'networkidle2', timeout: 45000 });
    }
    
    await delay(2500);
    
    // Scroll multiple times to trigger lazy loading
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.scrollBy(0, 500));
      await delay(500);
    }
    
    // Save debug HTML
    const html = await page.content();
    fs.writeFileSync(`${DEBUG_DIR}/${teamId}_final.html`, html);
    
    // Check page title for redirects
    const title = await page.title();
    const currentUrl = page.url();
    console.log(`  Page: ${title.substring(0, 50)}...`);
    
    const pitchers = await page.evaluate(() => {
      const results = [];
      const seen = new Set();
      
      const addPitcher = (name, number, position, headshot) => {
        const cleanName = name?.trim().replace(/\s+/g, ' ');
        if (!cleanName || cleanName.length < 2 || seen.has(cleanName)) return;
        seen.add(cleanName);
        
        let pos = (position || '').toUpperCase();
        if (!pos.includes('RHP') && !pos.includes('LHP') && !pos.includes('PITCHER') && pos !== 'P') return;
        
        if (pos.includes('LEFT') || pos.includes('LHP')) pos = 'LHP';
        else if (pos.includes('RIGHT') || pos.includes('RHP')) pos = 'RHP';
        else pos = 'P';
        
        results.push({ name: cleanName, number: (number || '').replace('#', '').trim(), position: pos, headshot: headshot || '' });
      };
      
      // Strategy 1: SIDEARM modern cards
      document.querySelectorAll('.s-person-card, [class*="s-person"]').forEach(card => {
        const posText = card.textContent || '';
        if (posText.match(/RHP|LHP|Pitcher/i)) {
          const nameEl = card.querySelector('[class*="name"] a, [class*="name"], h3, h4, .s-stamp__text');
          const numEl = card.querySelector('[class*="number"], [class*="jersey"]');
          const imgEl = card.querySelector('img');
          const posMatch = posText.match(/(RHP|LHP|Pitcher)/i);
          addPitcher(nameEl?.textContent, numEl?.textContent, posMatch?.[1], imgEl?.src);
        }
      });
      
      // Strategy 2: sidearm-roster-player  
      document.querySelectorAll('.sidearm-roster-player, [class*="roster-player"]').forEach(player => {
        const posEl = player.querySelector('[class*="position"]');
        const pos = posEl?.textContent || '';
        if (pos.match(/RHP|LHP|Pitcher/i)) {
          const nameEl = player.querySelector('[class*="name"] a, [class*="name"]');
          const numEl = player.querySelector('[class*="jersey"], [class*="number"]');
          const imgEl = player.querySelector('img');
          addPitcher(nameEl?.textContent, numEl?.textContent, pos, imgEl?.src);
        }
      });
      
      // Strategy 3: Table rows with position column
      document.querySelectorAll('table tr, [class*="roster"] tr').forEach(row => {
        const cells = Array.from(row.querySelectorAll('td, th'));
        const rowText = row.textContent || '';
        if (rowText.match(/RHP|LHP/i)) {
          const nameLink = row.querySelector('a[href*="roster"], a[href*="bio"]');
          const posMatch = rowText.match(/(RHP|LHP)/i);
          const numCell = cells.find(c => c.textContent.match(/^\s*\d{1,2}\s*$/));
          const img = row.querySelector('img');
          addPitcher(nameLink?.textContent || cells[1]?.textContent, numCell?.textContent, posMatch?.[1], img?.src);
        }
      });
      
      // Strategy 4: Grid/list with data attributes or classes
      document.querySelectorAll('[data-position], [class*="pitcher"]').forEach(el => {
        const pos = el.dataset?.position || el.className;
        if (pos.match(/RHP|LHP|pitcher/i)) {
          const nameEl = el.querySelector('[class*="name"], h3, h4, a');
          const img = el.querySelector('img');
          addPitcher(nameEl?.textContent, '', pos, img?.src);
        }
      });
      
      // Strategy 5: Look for position labels near names in any container
      document.querySelectorAll('li, article, [class*="card"], [class*="player"]').forEach(item => {
        const text = item.textContent || '';
        const posMatch = text.match(/\b(RHP|LHP)\b/i);
        if (posMatch) {
          // Find the name - usually in a link or heading
          const nameEl = item.querySelector('a[href*="roster"], a[href*="bio"], h3, h4, [class*="name"]');
          if (nameEl) {
            const img = item.querySelector('img[src*="headshot"], img[src*="player"], img');
            addPitcher(nameEl.textContent, '', posMatch[1], img?.src);
          }
        }
      });
      
      return results;
    });
    
    return pitchers;
  } catch (err) {
    console.error(`  ❌ Error: ${err.message}`);
    return [];
  }
}

async function main() {
  console.log('=== Final Scrape for Remaining Teams ===\n');
  
  if (!fs.existsSync(DEBUG_DIR)) fs.mkdirSync(DEBUG_DIR, { recursive: true });
  
  const browser = await puppeteer.launch({ 
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  await page.setViewport({ width: 1400, height: 900 });
  
  const results = [];
  
  for (const team of FINAL_TEAMS) {
    console.log(`\n[${results.length + 1}/${FINAL_TEAMS.length}] ${team.name}`);
    
    const pitchers = await scrapePitchers(page, team.url, team.id);
    const pitchersWithIds = pitchers.map((p, idx) => ({ id: `${team.id}-P${idx + 1}`, ...p }));
    
    results.push({
      teamId: team.id,
      team: team.name,
      slug: team.id,
      conference: team.conference,
      pitchers: pitchersWithIds
    });
    
    console.log(`  ${pitchers.length > 0 ? '✓' : '⚠'} ${pitchers.length} pitchers`);
    
    await delay(DELAY_MS);
  }
  
  await browser.close();
  
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));
  
  console.log('\n=== Summary ===');
  results.forEach(t => {
    const icon = t.pitchers.length > 0 ? '✓' : '✗';
    console.log(`  ${icon} ${t.team}: ${t.pitchers.length} pitchers`);
  });
  
  const total = results.reduce((sum, t) => sum + t.pitchers.length, 0);
  console.log(`\nTotal: ${total} pitchers from ${results.filter(t => t.pitchers.length > 0).length}/${results.length} teams`);
}

main().catch(console.error);
