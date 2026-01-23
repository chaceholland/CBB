#!/usr/bin/env node

/**
 * SEC Headshot Scraper - FINAL VERSION
 * Scrapes headshots AND updates pitchers.json in one pass
 * Run: node scrape-sec-headshots-final.mjs [--team=name]
 */

import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';

const DATA_DIR = './data';
const HEADSHOTS_DIR = path.join(DATA_DIR, 'headshots');
const PITCHERS_FILE = path.join(DATA_DIR, 'pitchers.json');

// SEC teams configuration
const SEC_TEAMS = {
  'Alabama':          { id: '333',  slug: 'alabama',          url: 'https://rolltide.com/sports/baseball/roster' },
  'Arkansas':         { id: '8',    slug: 'arkansas',         url: 'https://arkansasrazorbacks.com/sports/baseball/roster' },
  'Auburn':           { id: '2',    slug: 'auburn',           url: 'https://auburntigers.com/sports/baseball/roster' },
  'Florida':          { id: '57',   slug: 'florida',          url: 'https://floridagators.com/sports/baseball/roster' },
  'Georgia':          { id: '61',   slug: 'georgia',          url: 'https://georgiadogs.com/sports/baseball/roster' },
  'Kentucky':         { id: '96',   slug: 'kentucky',         url: 'https://ukathletics.com/sports/baseball/roster' },
  'LSU':              { id: '99',   slug: 'lsu',              url: 'https://lsusports.net/sports/baseball/roster' },
  'Mississippi State':{ id: '344',  slug: 'mississippi-state',url: 'https://hailstate.com/sports/baseball/roster' },
  'Missouri':         { id: '142',  slug: 'missouri',         url: 'https://mutigers.com/sports/baseball/roster' },
  'Oklahoma':         { id: '201',  slug: 'oklahoma',         url: 'https://soonersports.com/sports/baseball/roster' },
  'Ole Miss':         { id: '145',  slug: 'ole-miss',         url: 'https://olemisssports.com/sports/baseball/roster' },
  'South Carolina':   { id: '2579', slug: 'south-carolina',   url: 'https://gamecocksonline.com/sports/baseball/roster' },
  'Tennessee':        { id: '2633', slug: 'tennessee',        url: 'https://utsports.com/sports/baseball/roster' },
  'Texas A&M':        { id: '245',  slug: 'texas-am',         url: 'https://12thman.com/sports/baseball/roster' },
  'Texas':            { id: '251',  slug: 'texas',            url: 'https://texassports.com/sports/baseball/roster' },
  'Vanderbilt':       { id: '238',  slug: 'vanderbilt',       url: 'https://vucommodores.com/sports/baseball/roster' }
};

// Ensure directories exist
if (!fs.existsSync(HEADSHOTS_DIR)) {
  fs.mkdirSync(HEADSHOTS_DIR, { recursive: true });
}

// Download image helper
function downloadImage(url, filepath) {
  return new Promise((resolve) => {
    if (!url || url.includes('placeholder') || url.includes('no_headshot') || url.startsWith('data:')) {
      resolve(null);
      return;
    }
    
    if (url.startsWith('//')) url = 'https:' + url;
    
    const client = url.startsWith('https') ? https : http;
    const timeout = setTimeout(() => resolve(null), 15000);
    
    client.get(url, {
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8'
      }
    }, (res) => {
      clearTimeout(timeout);
      
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        downloadImage(res.headers.location, filepath).then(resolve);
        return;
      }
      
      if (res.statusCode !== 200) {
        resolve(null);
        return;
      }
      
      const fileStream = fs.createWriteStream(filepath);
      res.pipe(fileStream);
      fileStream.on('finish', () => { fileStream.close(); resolve(filepath); });
      fileStream.on('error', () => resolve(null));
    }).on('error', () => { clearTimeout(timeout); resolve(null); });
  });
}

// Scroll page to trigger lazy loading
async function scrollPage(page) {
  await page.evaluate(async () => {
    await new Promise(resolve => {
      let totalHeight = 0;
      const distance = 400;
      const timer = setInterval(() => {
        window.scrollBy(0, distance);
        totalHeight += distance;
        if (totalHeight >= document.body.scrollHeight + 2000) {
          clearInterval(timer);
          resolve();
        }
      }, 100);
    });
  });
  await new Promise(r => setTimeout(r, 4000));
}

// Normalize name for matching
function normalizeName(name) {
  return name.toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}


// Scrape roster page for pitchers with headshots
async function scrapeTeamHeadshots(page, teamName, teamInfo) {
  console.log(`\n📸 Scraping ${teamName}...`);
  console.log(`   URL: ${teamInfo.url}`);
  
  try {
    await page.goto(teamInfo.url, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(r => setTimeout(r, 3000));
    await scrollPage(page);
    
    const players = await page.evaluate((baseUrl) => {
      const results = [];
      
      // Card selectors for various athletic sites
      const cardSelectors = [
        '.sidearm-roster-player',
        '.s-person-card',
        '.roster-player',
        '.player-card',
        '[class*="roster"][class*="player"]',
        '.roster__item',
        '.roster-item'
      ];
      
      let playerCards = [];
      for (const sel of cardSelectors) {
        const cards = document.querySelectorAll(sel);
        if (cards.length > 0) { playerCards = [...cards]; break; }
      }
      
      // Fallback: find player links
      if (playerCards.length === 0) {
        const allLinks = document.querySelectorAll('a[href*="/roster/"]');
        const uniqueLinks = new Map();
        allLinks.forEach(link => {
          const parent = link.closest('li, tr, div[class*="player"], div[class*="roster"]') || link.parentElement?.parentElement;
          if (parent && !uniqueLinks.has(parent)) {
            uniqueLinks.set(parent, true);
            playerCards.push(parent);
          }
        });
      }

      playerCards.forEach(card => {
        // Get name
        let name = '';
        const nameSelectors = ['a[href*="/roster/"]', '.sidearm-roster-player-name a', '.s-person-details__personal-single-line a', '[class*="name"] a', '.player-name', 'h3 a', 'h4 a'];
        for (const sel of nameSelectors) {
          const el = card.querySelector(sel);
          if (el?.textContent?.trim()) { name = el.textContent.trim(); break; }
        }
        if (!name) return;
        
        // Get position
        let position = '';
        const posSelectors = ['.sidearm-roster-player-position', '.s-person-details__bio-container span', '[class*="position"]'];
        for (const sel of posSelectors) {
          const el = card.querySelector(sel);
          const text = el?.textContent?.trim() || '';
          if (/\b(P|RHP|LHP|RHSP|LHSP|Pitcher|SP|RP)\b/i.test(text)) { position = text; break; }
        }
        if (!position) {
          const posMatch = (card.textContent || '').match(/\b(RHP|LHP|RHSP|LHSP)\b/i);
          if (posMatch) position = posMatch[1];
        }
        
        const isPitcher = /\b(P|RHP|LHP|RHSP|LHSP|SP|RP|Pitcher)\b/i.test(position);
        if (!isPitcher) return;
        
        // Get number
        let number = '';
        const numSelectors = ['.sidearm-roster-player-jersey-number', '.s-person-card__number', '[class*="number"]', '[class*="jersey"]'];
        for (const sel of numSelectors) {
          const el = card.querySelector(sel);
          const text = el?.textContent?.trim().replace(/[#\s]/g, '') || '';
          if (/^\d+$/.test(text)) { number = text; break; }
        }

        // Get headshot URL
        let headshot = '';
        const imgSelectors = ['.sidearm-roster-player-image img', '.s-person-card__header img', '.player-image img', 'img[class*="headshot"]', 'img[class*="photo"]', 'img'];
        for (const sel of imgSelectors) {
          const img = card.querySelector(sel);
          if (img) {
            headshot = img.src || img.dataset?.src || img.getAttribute('data-src') || '';
            if (headshot && !headshot.includes('placeholder') && !headshot.startsWith('data:')) break;
            headshot = '';
          }
        }
        
        // Try background image
        if (!headshot) {
          const bgEls = card.querySelectorAll('[style*="background"]');
          for (const el of bgEls) {
            const match = el.style.backgroundImage?.match(/url\(['"]?([^'")\s]+)['"]?\)/);
            if (match && !match[1].includes('placeholder')) { headshot = match[1]; break; }
          }
        }
        
        // Make absolute URL
        if (headshot && !headshot.startsWith('http')) {
          if (headshot.startsWith('//')) headshot = 'https:' + headshot;
          else if (headshot.startsWith('/')) {
            const urlObj = new URL(baseUrl);
            headshot = urlObj.origin + headshot;
          }
        }
        
        // Filter placeholders
        const badPatterns = ['placeholder', 'no-photo', 'blank', 'default', 'silhouette', 'avatar', 'generic'];
        if (headshot && badPatterns.some(p => headshot.toLowerCase().includes(p))) headshot = '';
        
        results.push({ name, number, position, headshot });
      });
      
      return results;
    }, teamInfo.url);
    
    console.log(`   Found ${players.length} pitchers`);
    return players;
    
  } catch (err) {
    console.log(`   ❌ Error: ${err.message}`);
    return [];
  }
}


// Main function
async function main() {
  console.log('⚾ SEC Headshot Scraper - FINAL VERSION');
  console.log('═══════════════════════════════════════\n');
  
  // Parse command line args
  const args = process.argv.slice(2);
  const teamArg = args.find(a => a.startsWith('--team='));
  const targetTeam = teamArg ? teamArg.split('=')[1] : null;
  
  // Load existing pitchers data
  let pitchersData;
  try {
    pitchersData = JSON.parse(fs.readFileSync(PITCHERS_FILE, 'utf8'));
  } catch (err) {
    console.log('❌ Could not load pitchers.json');
    return;
  }
  
  // Create backup
  const backupFile = `pitchers-${Date.now()}.bak.json`;
  fs.writeFileSync(backupFile, JSON.stringify(pitchersData, null, 2));
  console.log(`📦 Backup created: ${backupFile}\n`);
  
  // Launch browser
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  
  let totalDownloaded = 0;
  let totalLinked = 0;
  
  // Process each team
  const teamsToProcess = targetTeam 
    ? [[targetTeam, SEC_TEAMS[targetTeam]]].filter(([n, t]) => t)
    : Object.entries(SEC_TEAMS);
  
  for (const [teamName, teamInfo] of teamsToProcess) {
    const scrapedPlayers = await scrapeTeamHeadshots(page, teamName, teamInfo);
    
    if (scrapedPlayers.length === 0) {
      console.log(`   ⚠️ No pitchers found, skipping ${teamName}`);
      continue;
    }

    // Find team in pitchers.json
    const teamIdx = pitchersData.teams.findIndex(t => 
      t.team === teamName || t.team_id === teamInfo.id || t.teamId === teamInfo.id
    );
    
    if (teamIdx === -1) {
      console.log(`   ⚠️ Team "${teamName}" not found in pitchers.json`);
      continue;
    }
    
    const teamData = pitchersData.teams[teamIdx];
    console.log(`   📋 Matching against ${teamData.pitchers?.length || 0} existing pitchers...`);
    
    // Match scraped players to existing pitchers
    for (const scraped of scrapedPlayers) {
      if (!scraped.headshot) continue;
      
      const normalizedScrapedName = normalizeName(scraped.name);
      
      // Find matching pitcher in data
      const pitcherIdx = teamData.pitchers?.findIndex(p => {
        const normalizedPitcherName = normalizeName(p.name);
        // Match by name or by name + number
        return normalizedPitcherName === normalizedScrapedName ||
               (p.number && p.number === scraped.number && normalizedPitcherName.includes(normalizedScrapedName.split(' ')[1]));
      });
      
      if (pitcherIdx === -1 || pitcherIdx === undefined) continue;
      
      const pitcher = teamData.pitchers[pitcherIdx];
      const filename = `${teamInfo.slug}_${teamInfo.id}-${pitcher.id || 'P' + (pitcherIdx + 1)}.jpg`;
      const filepath = path.join(HEADSHOTS_DIR, filename);
      
      // Download headshot
      console.log(`     ⬇️ Downloading: ${scraped.name}...`);
      const result = await downloadImage(scraped.headshot, filepath);
      
      if (result) {
        // Update pitcher with headshot path
        pitcher.headshot = `data/headshots/${filename}`;
        totalDownloaded++;
        totalLinked++;
        console.log(`     ✅ ${scraped.name} → ${filename}`);
      } else {
        console.log(`     ❌ Failed: ${scraped.name}`);
      }
    }
    
    // Brief pause between teams
    await new Promise(r => setTimeout(r, 2000));
  }

  
  await browser.close();
  
  // Save updated pitchers.json
  fs.writeFileSync(PITCHERS_FILE, JSON.stringify(pitchersData, null, 2));
  
  console.log('\n═══════════════════════════════════════');
  console.log('📊 SUMMARY');
  console.log('═══════════════════════════════════════');
  console.log(`   Downloaded: ${totalDownloaded} headshots`);
  console.log(`   Linked:     ${totalLinked} pitchers`);
  console.log(`   Saved:      ${PITCHERS_FILE}`);
  console.log('\n✅ Complete!');
}

main().catch(console.error);
