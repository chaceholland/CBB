#!/usr/bin/env node
/**
 * Improved scraper for remaining Power 5 teams
 * Handles different website architectures
 */
import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';

const REMAINING_TEAMS = [
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
  
  // Big Ten (2 still missing after first run)
  { slug: 'oregon', name: 'Oregon Ducks', conference: 'Big Ten', url: 'https://goducks.com/sports/baseball/roster' },
  { slug: 'wisconsin', name: 'Wisconsin Badgers', conference: 'Big Ten', url: 'https://uwbadgers.com/sports/baseball/roster' },
];

const OUTPUT_FILE = './data/remaining_power5_pitchers.json';
const DEBUG_DIR = './debug_html';
const DELAY_MS = 3000;

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}


async function scrapeTeam(page, team) {
  console.log(`\n📍 Scraping ${team.name}...`);
  console.log(`   URL: ${team.url}`);
  
  try {
    await page.goto(team.url, { waitUntil: 'networkidle2', timeout: 45000 });
    await delay(3000); // Extra wait for Vue/dynamic content
    
    // Scroll to trigger lazy loading
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight / 2);
    });
    await delay(1500);
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    await delay(1500);
    
    // Save debug HTML
    const html = await page.content();
    const debugPath = path.join(DEBUG_DIR, `${team.slug}_v2.html`);
    fs.writeFileSync(debugPath, html);
    
    // Extract pitchers using multiple strategies
    const pitchers = await page.evaluate(() => {
      const results = [];
      const seen = new Set();
      
      // Strategy 1: roster-list-item (Stanford style)
      document.querySelectorAll('.roster-list-item').forEach(item => {
        const posEl = item.querySelector('.roster-list-item__profile-field--position, [class*="position"]');
        const pos = posEl?.textContent?.trim() || '';
        if (!/\b(RHP|LHP)\b/i.test(pos)) return;
        
        const nameEl = item.querySelector('.roster-list-item__heading a, [class*="heading"] a, h3 a, h4 a');
        const name = nameEl?.textContent?.trim() || '';
        if (!name || seen.has(name)) return;
        seen.add(name);
        
        const numEl = item.querySelector('.roster-list-item__jersey-number, [class*="jersey"]');
        const imgEl = item.querySelector('img');
        
        results.push({
          name,
          position: pos.match(/\b(RHP|LHP)\b/i)?.[0] || 'P',
          number: numEl?.textContent?.trim().replace('#', '') || '',
          headshot: imgEl?.src || ''
        });
      });
      
      // Strategy 2: sidearm-roster-player (traditional SIDEARM)
      if (results.length === 0) {
        document.querySelectorAll('.sidearm-roster-player, .s-person-card').forEach(item => {
          const posEl = item.querySelector('.sidearm-roster-player-position, [class*="position"]');
          const pos = posEl?.textContent?.trim() || '';
          if (!/\b(RHP|LHP)\b/i.test(pos)) return;
          
          const nameEl = item.querySelector('.sidearm-roster-player-name a, .s-person-details__personal-single-line-name');
          const name = nameEl?.textContent?.trim() || '';
          if (!name || seen.has(name)) return;
          seen.add(name);
          
          const numEl = item.querySelector('.sidearm-roster-player-jersey-number, .s-stamp');
          const imgEl = item.querySelector('img');
          
          results.push({
            name,
            position: pos.match(/\b(RHP|LHP)\b/i)?.[0] || 'P',
            number: numEl?.textContent?.trim().replace('#', '') || '',
            headshot: imgEl?.src || ''
          });
        });
      }
      
      // Strategy 3: Table rows
      if (results.length === 0) {
        document.querySelectorAll('table tbody tr').forEach(row => {
          const cells = row.querySelectorAll('td');
          const rowText = row.textContent || '';
          if (!/\b(RHP|LHP)\b/i.test(rowText)) return;
          
          const nameLink = row.querySelector('a[href*="roster"]');
          const name = nameLink?.textContent?.trim() || cells[1]?.textContent?.trim() || '';
          if (!name || seen.has(name) || name.length < 3) return;
          seen.add(name);
          
          const posMatch = rowText.match(/\b(RHP|LHP)\b/i);
          
          results.push({
            name,
            position: posMatch?.[0] || 'P',
            number: cells[0]?.textContent?.trim().replace('#', '') || '',
            headshot: row.querySelector('img')?.src || ''
          });
        });
      }
      
      // Strategy 4: Generic card/player elements
      if (results.length === 0) {
        document.querySelectorAll('[class*="player-card"], [class*="roster-card"], article[class*="player"]').forEach(item => {
          const text = item.textContent || '';
          if (!/\b(RHP|LHP)\b/i.test(text)) return;
          
          const links = item.querySelectorAll('a');
          links.forEach(link => {
            const name = link.textContent?.trim();
            if (name && name.length > 3 && name.length < 40 && !seen.has(name) && !/roster|schedule|stats/i.test(name)) {
              seen.add(name);
              results.push({
                name,
                position: text.match(/\b(RHP|LHP)\b/i)?.[0] || 'P',
                number: '',
                headshot: item.querySelector('img')?.src || ''
              });
            }
          });
        });
      }
      
      return results;
    });
    
    console.log(`   Found: ${pitchers.length} pitchers`);
    
    return {
      ...team,
      pitchers: pitchers.map((p, i) => ({
        id: `${team.slug}-P${i + 1}`,
        ...p,
        year: '',
        height: '',
        weight: '',
        batsThrows: '',
        hometown: ''
      })),
      scrapedAt: new Date().toISOString()
    };
    
  } catch (err) {
    console.log(`   ❌ Error: ${err.message}`);
    return { ...team, pitchers: [], error: err.message };
  }
}


async function main() {
  console.log('='.repeat(60));
  console.log('🏟️  Remaining Power 5 Teams Scraper (Improved)');
  console.log('='.repeat(60));
  
  if (!fs.existsSync(DEBUG_DIR)) {
    fs.mkdirSync(DEBUG_DIR, { recursive: true });
  }
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
  await page.setViewport({ width: 1280, height: 900 });
  
  const results = [];
  
  for (const team of REMAINING_TEAMS) {
    const result = await scrapeTeam(page, team);
    results.push(result);
    await delay(DELAY_MS);
  }
  
  await browser.close();
  
  // Save results
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 RESULTS');
  console.log('='.repeat(60));
  
  let total = 0;
  results.forEach(t => {
    const icon = t.pitchers.length > 0 ? '✅' : '❌';
    console.log(`${icon} ${t.name}: ${t.pitchers.length}`);
    total += t.pitchers.length;
  });
  
  console.log(`\nTotal: ${total} pitchers from ${results.filter(t => t.pitchers.length > 0).length}/${results.length} teams`);
  console.log(`Saved to: ${OUTPUT_FILE}`);
}

main().catch(console.error);
