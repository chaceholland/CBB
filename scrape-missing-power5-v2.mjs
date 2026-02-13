#!/usr/bin/env node
/**
 * Scrape missing Power 5 teams - FIXED URLs
 */

import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';

const MISSING_TEAMS = [
  // ACC (4 missing) - CORRECTED URLs
  { slug: 'georgia-tech', name: 'Georgia Tech Yellow Jackets', conference: 'ACC', url: 'https://ramblinwreck.com/sports/m-basebl/roster/' },
  { slug: 'smu', name: 'SMU Mustangs', conference: 'ACC', url: 'https://smumustangs.com/sports/baseball/roster' },
  { slug: 'stanford', name: 'Stanford Cardinal', conference: 'ACC', url: 'https://gostanford.com/sports/baseball/roster' },
  { slug: 'virginia-tech', name: 'Virginia Tech Hokies', conference: 'ACC', url: 'https://hokiesports.com/sports/baseball/roster' },
  
  // Big 12 (5 missing) - CORRECTED URLs  
  { slug: 'arizona-state', name: 'Arizona State Sun Devils', conference: 'Big 12', url: 'https://thesundevils.com/sports/baseball/roster' },
  { slug: 'arizona', name: 'Arizona Wildcats', conference: 'Big 12', url: 'https://arizonawildcats.com/sports/baseball/roster' },
  { slug: 'cincinnati', name: 'Cincinnati Bearcats', conference: 'Big 12', url: 'https://gobearcats.com/sports/baseball/roster' },
  { slug: 'colorado', name: 'Colorado Buffaloes', conference: 'Big 12', url: 'https://cubuffs.com/sports/baseball/roster' },
  { slug: 'ucf', name: 'UCF Knights', conference: 'Big 12', url: 'https://ucfknights.com/sports/baseball/roster' },
  
  // Big Ten (6 missing) - CORRECTED URLs
  { slug: 'iowa', name: 'Iowa Hawkeyes', conference: 'Big Ten', url: 'https://hawkeyesports.com/sports/baseball/roster' },
  { slug: 'nebraska', name: 'Nebraska Cornhuskers', conference: 'Big Ten', url: 'https://huskers.com/sports/baseball/roster' },
  { slug: 'oregon', name: 'Oregon Ducks', conference: 'Big Ten', url: 'https://goducks.com/sports/baseball/roster' },
  { slug: 'penn-state', name: 'Penn State Nittany Lions', conference: 'Big Ten', url: 'https://gopsusports.com/sports/baseball/roster' },
  { slug: 'purdue', name: 'Purdue Boilermakers', conference: 'Big Ten', url: 'https://purduesports.com/sports/baseball/roster' },
  { slug: 'wisconsin', name: 'Wisconsin Badgers', conference: 'Big Ten', url: 'https://uwbadgers.com/sports/baseball/roster' },
];

const OUTPUT_FILE = './data/missing_power5_pitchers.json';
const DEBUG_DIR = './debug_html';
const DELAY_MS = 2500;

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}


/**
 * Extract pitchers - improved to filter by position
 */
async function extractPitchers(page, teamSlug) {
  return await page.evaluate((slug) => {
    const results = [];
    const seen = new Set();
    
    // Helper to check if position indicates pitcher
    const isPitcher = (pos) => {
      if (!pos) return false;
      const p = pos.toUpperCase();
      return p.includes('RHP') || p.includes('LHP') || 
             (p === 'P') || p.includes('PITCHER') ||
             p.includes('INV') || // sometimes listed as INV for pitchers
             (p.includes('/P') && !p.includes('OF'));
    };
    
    // Strategy 1: SIDEARM cards with position data
    const cards = document.querySelectorAll('.s-person-card, [class*="roster-player"], [class*="sidearm-roster"]');
    cards.forEach(card => {
      const posEl = card.querySelector('[class*="position"], .s-person-card__content__person__position, [class*="pos"]');
      const pos = posEl?.textContent?.trim() || '';
      
      if (isPitcher(pos)) {
        const nameEl = card.querySelector('.s-person-card__content__person__name a, [class*="name"] a, h3 a, .s-person-details__personal-single-line a, a[href*="/roster/"]');
        const numEl = card.querySelector('[class*="number"], .s-stamp__text');
        const yearEl = card.querySelector('[class*="year"], [class*="academic"]');
        const imgEl = card.querySelector('img[src*="headshot"], img[src*="roster"], img[data-src]');
        
        const name = nameEl?.textContent?.trim() || card.querySelector('[class*="name"]')?.textContent?.trim() || '';
        if (name && !seen.has(name)) {
          seen.add(name);
          results.push({
            name,
            number: numEl?.textContent?.trim()?.replace(/[#\s]/g, '') || '',
            position: pos,
            year: yearEl?.textContent?.trim() || '',
            headshot: imgEl?.src || imgEl?.dataset?.src || ''
          });
        }
      }
    });
    
    // Strategy 2: Table rows
    if (results.length === 0) {
      const rows = document.querySelectorAll('table tbody tr, .roster-list tr');
      rows.forEach(row => {
        const cells = Array.from(row.querySelectorAll('td'));
        const text = row.textContent || '';
        
        // Look for position cell with RHP/LHP
        let pos = '';
        let name = '';
        let number = '';
        
        cells.forEach(cell => {
          const cellText = cell.textContent.trim();
          if (isPitcher(cellText) && cellText.length < 10) {
            pos = cellText;
          } else if (cellText.match(/^#?\d{1,2}$/)) {
            number = cellText.replace('#', '');
          } else if (cellText.length > 2 && cellText.length < 40 && !cellText.match(/^\d/) && cellText.match(/^[A-Z]/)) {
            if (!name) name = cellText;
          }
        });
        
        if (pos && name && !seen.has(name)) {
          seen.add(name);
          const imgEl = row.querySelector('img');
          results.push({
            name,
            number,
            position: pos,
            headshot: imgEl?.src || ''
          });
        }
      });
    }
    
    // Strategy 3: Generic list items with position text
    if (results.length === 0) {
      const items = document.querySelectorAll('[class*="roster"] li, [class*="player"] article');
      items.forEach(item => {
        const text = item.textContent || '';
        if (text.match(/\b(RHP|LHP)\b/)) {
          const nameMatch = text.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/);
          const posMatch = text.match(/\b(RHP|LHP)\b/);
          if (nameMatch && posMatch && !seen.has(nameMatch[1])) {
            seen.add(nameMatch[1]);
            results.push({
              name: nameMatch[1],
              position: posMatch[1],
              headshot: item.querySelector('img')?.src || ''
            });
          }
        }
      });
    }
    
    return results;
  }, teamSlug);
}


async function scrapeTeam(browser, team) {
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
  
  try {
    console.log(`\n📥 Scraping ${team.name}...`);
    console.log(`   URL: ${team.url}`);
    
    await page.goto(team.url, { 
      waitUntil: 'networkidle2', 
      timeout: 45000 
    });
    
    // Wait for roster content
    await delay(3000);
    
    // Scroll to load lazy content
    await page.evaluate(async () => {
      for (let i = 0; i < 3; i++) {
        window.scrollBy(0, 500);
        await new Promise(r => setTimeout(r, 500));
      }
      window.scrollTo(0, 0);
    });
    await delay(1500);
    
    // Save debug HTML
    const html = await page.content();
    fs.writeFileSync(path.join(DEBUG_DIR, `${team.slug}_roster_v2.html`), html);
    
    // Extract pitchers
    let pitchers = await extractPitchers(page, team.slug);
    
    // Clean up extracted data
    pitchers = pitchers.filter(p => p.name && p.name.length > 2);
    
    console.log(`   ✅ Found ${pitchers.length} pitchers`);
    if (pitchers.length > 0) {
      console.log(`   Sample: ${pitchers.slice(0, 3).map(p => p.name).join(', ')}`);
    }
    
    // Assign IDs
    pitchers.forEach((p, i) => {
      p.id = `${team.slug}-P${i + 1}`;
    });
    
    return {
      slug: team.slug,
      team: team.name,
      conference: team.conference,
      url: team.url,
      pitchers,
      scrapedAt: new Date().toISOString()
    };
    
  } catch (err) {
    console.log(`   ❌ Error: ${err.message}`);
    try {
      const html = await page.content();
      fs.writeFileSync(path.join(DEBUG_DIR, `${team.slug}_error_v2.html`), html);
    } catch {}
    
    return {
      slug: team.slug,
      team: team.name,
      conference: team.conference,
      url: team.url,
      pitchers: [],
      error: err.message,
      scrapedAt: new Date().toISOString()
    };
  } finally {
    await page.close();
  }
}


async function main() {
  console.log('🏈 Missing Power 5 Teams Scraper v2');
  console.log('===================================\n');
  console.log(`Teams to scrape: ${MISSING_TEAMS.length}`);
  
  if (!fs.existsSync(DEBUG_DIR)) {
    fs.mkdirSync(DEBUG_DIR, { recursive: true });
  }
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });
  
  const results = [];
  
  for (const team of MISSING_TEAMS) {
    const result = await scrapeTeam(browser, team);
    results.push(result);
    await delay(DELAY_MS);
  }
  
  await browser.close();
  
  // Save results
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));
  
  // Summary
  console.log('\n===================================');
  console.log('📊 SCRAPE SUMMARY');
  console.log('===================================');
  
  let totalPitchers = 0;
  const byConf = {};
  const failed = [];
  
  results.forEach(r => {
    const count = r.pitchers?.length || 0;
    totalPitchers += count;
    byConf[r.conference] = (byConf[r.conference] || 0) + count;
    
    const status = count > 0 ? '✅' : '❌';
    console.log(`${status} ${r.team}: ${count} pitchers`);
    if (count === 0) failed.push(r.team);
  });
  
  console.log(`\n📈 Total: ${totalPitchers} pitchers from ${results.length - failed.length}/${results.length} teams`);
  console.log(`By conference: ${JSON.stringify(byConf)}`);
  
  if (failed.length > 0) {
    console.log(`\n⚠️ Failed teams (${failed.length}): ${failed.join(', ')}`);
  }
  
  console.log(`\n💾 Saved to: ${OUTPUT_FILE}`);
}

main().catch(console.error);
