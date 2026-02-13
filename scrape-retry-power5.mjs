#!/usr/bin/env node
/**
 * Scrape remaining Power 5 teams with CORRECTED URLs
 * These are the teams that failed in the first pass
 */

import fs from 'fs';
import puppeteer from 'puppeteer';

const RETRY_TEAMS = [
  // ACC (4) - corrected URLs
  { id: 'georgia-tech', name: 'Georgia Tech Yellow Jackets', conference: 'ACC', url: 'https://ramblinwreck.com/sports/m-basebl/roster/' },
  { id: 'smu', name: 'SMU Mustangs', conference: 'ACC', url: 'https://smumustangs.com/sports/baseball/roster' },
  { id: 'stanford', name: 'Stanford Cardinal', conference: 'ACC', url: 'https://gostanford.com/sports/baseball/roster' },
  { id: 'virginia-tech', name: 'Virginia Tech Hokies', conference: 'ACC', url: 'https://hokiesports.com/sports/baseball/roster' },
  
  // Big 12 (3 remaining)
  { id: 'arizona-state', name: 'Arizona State Sun Devils', conference: 'Big 12', url: 'https://thesundevils.com/sports/baseball/roster' },
  { id: 'colorado', name: 'Colorado Buffaloes', conference: 'Big 12', url: 'https://cubuffs.com/sports/baseball/roster' },
  { id: 'ucf', name: 'UCF Knights', conference: 'Big 12', url: 'https://ucfknights.com/sports/baseball/roster' },
  
  // Big Ten (3 remaining)  
  { id: 'oregon', name: 'Oregon Ducks', conference: 'Big Ten', url: 'https://goducks.com/sports/baseball/roster' },
  { id: 'purdue', name: 'Purdue Boilermakers', conference: 'Big Ten', url: 'https://purduesports.com/sports/baseball/roster' },
  { id: 'wisconsin', name: 'Wisconsin Badgers', conference: 'Big Ten', url: 'https://uwbadgers.com/sports/baseball/roster' },
];

const OUTPUT_FILE = './data/retry_power5_pitchers.json';
const DEBUG_DIR = './debug_html';
const DELAY_MS = 3000;

function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function scrapePitchers(page, url, teamId) {
  try {
    console.log(`  Loading ${url}...`);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 });
    await delay(2000);
    
    // Save debug HTML
    const html = await page.content();
    fs.writeFileSync(`${DEBUG_DIR}/${teamId}_retry.html`, html);
    
    // Scroll to trigger lazy loading
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await delay(1500);
    
    const pitchers = await page.evaluate(() => {
      const results = [];
      const seen = new Set();
      
      // Helper to add pitcher if valid
      const addPitcher = (name, number, position, headshot) => {
        const cleanName = name?.trim();
        if (cleanName && !seen.has(cleanName)) {
          seen.add(cleanName);
          let pos = position?.toUpperCase() || '';
          if (pos.includes('LHP') || pos.includes('LEFT')) pos = 'LHP';
          else if (pos.includes('RHP') || pos.includes('RIGHT')) pos = 'RHP';
          else if (pos === 'P' || pos.includes('PITCHER')) pos = 'P';
          else return; // Not a pitcher
          
          results.push({
            name: cleanName,
            number: number?.replace('#', '').trim() || '',
            position: pos,
            headshot: headshot || ''
          });
        }
      };
      
      // Strategy 1: SIDEARM modern s-person classes
      document.querySelectorAll('.s-person-card, .s-person-details, [class*="s-person"]').forEach(card => {
        const posEl = card.querySelector('[class*="position"]');
        const pos = posEl?.textContent?.trim() || '';
        if (pos.match(/RHP|LHP|Pitcher/i)) {
          const nameEl = card.querySelector('[class*="name"] a, [class*="name"], h3, h4');
          const numEl = card.querySelector('[class*="number"], [class*="jersey"]');
          const imgEl = card.querySelector('img');
          addPitcher(nameEl?.textContent, numEl?.textContent, pos, imgEl?.src);
        }
      });
      
      // Strategy 2: sidearm-roster-player (older SIDEARM)
      document.querySelectorAll('.sidearm-roster-player').forEach(player => {
        const pos = player.querySelector('.sidearm-roster-player-position')?.textContent || '';
        if (pos.match(/RHP|LHP|Pitcher/i)) {
          const nameEl = player.querySelector('.sidearm-roster-player-name a, .sidearm-roster-player-name');
          const numEl = player.querySelector('.sidearm-roster-player-jersey-number');
          const imgEl = player.querySelector('img');
          addPitcher(nameEl?.textContent, numEl?.textContent, pos, imgEl?.src);
        }
      });
      
      // Strategy 3: Table rows
      document.querySelectorAll('table tbody tr').forEach(row => {
        const text = row.textContent || '';
        if (text.match(/RHP|LHP/i)) {
          const cells = row.querySelectorAll('td');
          const nameLink = row.querySelector('a[href*="roster"]');
          const posMatch = text.match(/(RHP|LHP)/i);
          if (nameLink && posMatch) {
            const numCell = cells[0]?.textContent;
            const img = row.querySelector('img');
            addPitcher(nameLink.textContent, numCell, posMatch[1], img?.src);
          }
        }
      });
      
      // Strategy 4: List items with roster data
      document.querySelectorAll('[class*="roster"] li, [class*="player-card"]').forEach(item => {
        const text = item.textContent || '';
        if (text.match(/RHP|LHP/i)) {
          const nameEl = item.querySelector('a, h3, h4, [class*="name"]');
          const posMatch = text.match(/(RHP|LHP)/i);
          const img = item.querySelector('img');
          if (nameEl && posMatch) {
            addPitcher(nameEl.textContent, '', posMatch[1], img?.src);
          }
        }
      });
      
      // Strategy 5: Any element containing RHP/LHP near a name
      if (results.length === 0) {
        const allText = document.body.innerText;
        const lines = allText.split('\n');
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          if (line.match(/^(RHP|LHP)$/i)) {
            // Position on its own line, name likely above
            const nameLine = lines[i-1]?.trim();
            if (nameLine && nameLine.length > 2 && nameLine.length < 50 && !nameLine.match(/\d{3}/)) {
              addPitcher(nameLine, '', line, '');
            }
          }
        }
      }
      
      return results;
    });
    
    return pitchers;
  } catch (err) {
    console.error(`  ❌ Error: ${err.message}`);
    return [];
  }
}

async function main() {
  console.log('=== Retry Scraping Failed Teams ===\n');
  
  // Ensure debug dir exists
  if (!fs.existsSync(DEBUG_DIR)) fs.mkdirSync(DEBUG_DIR, { recursive: true });
  
  const browser = await puppeteer.launch({ 
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
  await page.setViewport({ width: 1280, height: 900 });
  
  const results = [];
  
  for (const team of RETRY_TEAMS) {
    console.log(`\n[${results.length + 1}/${RETRY_TEAMS.length}] ${team.name}`);
    
    const pitchers = await scrapePitchers(page, team.url, team.id);
    const pitchersWithIds = pitchers.map((p, idx) => ({ id: `${team.id}-P${idx + 1}`, ...p }));
    
    results.push({
      teamId: team.id,
      team: team.name,
      slug: team.id,
      conference: team.conference,
      pitchers: pitchersWithIds
    });
    
    const status = pitchers.length > 0 ? `✓ ${pitchers.length} pitchers` : '⚠ 0 pitchers (check debug HTML)';
    console.log(`  ${status}`);
    
    await delay(DELAY_MS);
  }
  
  await browser.close();
  
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));
  
  console.log('\n=== Summary ===');
  const success = results.filter(t => t.pitchers.length > 0);
  const failed = results.filter(t => t.pitchers.length === 0);
  console.log(`Success: ${success.length} teams`);
  success.forEach(t => console.log(`  ✓ ${t.team}: ${t.pitchers.length}`));
  console.log(`Failed: ${failed.length} teams`);
  failed.forEach(t => console.log(`  ✗ ${t.team} - check ${DEBUG_DIR}/${t.slug}_retry.html`));
}

main().catch(console.error);
