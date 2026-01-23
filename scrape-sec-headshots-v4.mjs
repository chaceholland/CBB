#!/usr/bin/env node

/**
 * SEC Headshot Scraper v4 - COMPREHENSIVE VERSION
 * Handles new SIDEARM Vue/Nuxt sites + visits bio pages for better headshots
 * Run: node scrape-sec-headshots-v4.mjs [--team=name]
 */

import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';

const DATA_DIR = './data';
const HEADSHOTS_DIR = path.join(DATA_DIR, 'headshots');
const PITCHERS_FILE = path.join(DATA_DIR, 'pitchers.json');

// SEC teams configuration - includes 2025 fallback URLs for teams defaulting to 2026
const SEC_TEAMS = {
  'Alabama':          { id: '333',  slug: 'alabama',          url: 'https://rolltide.com/sports/baseball/roster/2025' },
  'Arkansas':         { id: '8',    slug: 'arkansas',         url: 'https://arkansasrazorbacks.com/sport/m-basebl/roster/' },
  'Auburn':           { id: '2',    slug: 'auburn',           url: 'https://auburntigers.com/sports/baseball/roster' },
  'Florida':          { id: '57',   slug: 'florida',          url: 'https://floridagators.com/sports/baseball/roster' },
  'Georgia':          { id: '61',   slug: 'georgia',          url: 'https://georgiadogs.com/sports/baseball/roster' },
  'Kentucky':         { id: '96',   slug: 'kentucky',         url: 'https://ukathletics.com/sports/baseball/roster' },
  'LSU':              { id: '99',   slug: 'lsu',              url: 'https://lsusports.net/sports/baseball/roster/2025' },
  'Mississippi State':{ id: '344',  slug: 'mississippi-state',url: 'https://hailstate.com/sports/baseball/roster' },
  'Missouri':         { id: '142',  slug: 'missouri',         url: 'https://mutigers.com/sports/baseball/roster' },
  'Oklahoma':         { id: '201',  slug: 'oklahoma',         url: 'https://soonersports.com/sports/baseball/roster' },
  'Ole Miss':         { id: '145',  slug: 'ole-miss',         url: 'https://olemisssports.com/sports/baseball/roster' },
  'South Carolina':   { id: '2579', slug: 'south-carolina',   url: 'https://gamecocksonline.com/sports/baseball/roster/2025' },
  'Tennessee':        { id: '2633', slug: 'tennessee',        url: 'https://utsports.com/sports/baseball/roster' },
  'Texas A&M':        { id: '245',  slug: 'texas-am',         url: 'https://12thman.com/sports/baseball/roster/2025' },
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
  await new Promise(r => setTimeout(r, 3000));
}

// Normalize name for matching
function normalizeName(name) {
  return name.toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Get high-res headshot URL from CDN URL
function getHighResUrl(url) {
  if (!url) return url;
  // Remove size constraints from sidearmdev CDN URLs
  if (url.includes('images.sidearmdev.com')) {
    return url.replace(/&width=\d+/, '&width=400')
              .replace(/&height=\d+/, '&height=400');
  }
  return url;
}

// Scrape roster page - UPDATED for new SIDEARM Vue/Nuxt sites
async function scrapeTeamHeadshots(page, teamName, teamInfo) {
  console.log(`\n📸 Scraping ${teamName}...`);
  console.log(`   URL: ${teamInfo.url}`);
  
  try {
    await page.goto(teamInfo.url, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(r => setTimeout(r, 3000));
    await scrollPage(page);
    
    const baseUrl = new URL(teamInfo.url).origin;
    
    const players = await page.evaluate((baseUrl) => {
      const results = [];
      
      // NEW: Vue/Nuxt SIDEARM selectors (s-person-card) + Auburn roster-card-item
      const cardSelectors = [
        '.s-person-card',
        '.roster-card-item',
        '[data-test-id="s-person-card-list__root"]',
        '.sidearm-roster-player',
        '.roster-player',
        '.player-card',
        '[class*="roster"][class*="player"]',
        '.roster__item'
      ];
      
      let playerCards = [];
      for (const sel of cardSelectors) {
        const cards = document.querySelectorAll(sel);
        if (cards.length > 0) { 
          playerCards = [...cards]; 
          console.log(`Found ${cards.length} cards with selector: ${sel}`);
          break; 
        }
      }
      
      // Fallback: table rows
      if (playerCards.length === 0) {
        const rows = document.querySelectorAll('table tbody tr');
        if (rows.length > 0) playerCards = [...rows];
      }

      playerCards.forEach(card => {
        // Get name - handle Vue/Nuxt structure + Auburn roster-card-item
        let name = '';
        const nameSelectors = [
          '[data-test-id="s-person-details__personal-single-line-person-link"] h3',
          '.s-person-details__personal-single-line a',
          '.roster-card-item__title-link',
          '.roster-card-item__title',
          '.roster-card-item__name a',
          '.roster-card-item__name',
          'a[href*="/roster/"] h3',
          'a[href*="/roster/"]',
          '.sidearm-roster-player-name a',
          '[class*="name"] a',
          '.player-name'
        ];
        for (const sel of nameSelectors) {
          const el = card.querySelector(sel);
          if (el?.textContent?.trim()) { 
            name = el.textContent.trim(); 
            break; 
          }
        }
        if (!name) return;
        
        // Get position - check for pitcher indicators (including Auburn roster-card-item)
        let position = '';
        const posSelectors = [
          '[data-test-id="s-person-details__bio-stats-person-position-short"]',
          '.s-person-details__bio-stats-item',
          '.roster-card-item__position',
          '.sidearm-roster-player-position',
          '[class*="position"]'
        ];
        for (const sel of posSelectors) {
          const el = card.querySelector(sel);
          const text = el?.textContent?.trim() || '';
          if (/\b(RHP|LHP|RHSP|LHSP|P)\b/i.test(text)) { 
            position = text; 
            break; 
          }
        }
        // Also check full card text
        if (!position) {
          const cardText = card.textContent || '';
          const posMatch = cardText.match(/\b(RHP|LHP|RHSP|LHSP)\b/i);
          if (posMatch) position = posMatch[1];
        }
        
        const isPitcher = /\b(P|RHP|LHP|RHSP|LHSP|SP|RP|Pitcher)\b/i.test(position);
        if (!isPitcher) return;
        
        // Get number
        let number = '';
        const numSelectors = [
          '[data-test-id="s-person-thumbnail__stamp-sr-only-text"]',
          '.s-stamp__text',
          '.s-person-card__number',
          '.sidearm-roster-player-jersey-number',
          '[class*="number"]',
          '[class*="jersey"]'
        ];
        for (const sel of numSelectors) {
          const el = card.querySelector(sel);
          let text = el?.textContent?.trim().replace(/[#\s]/g, '').replace('Jersey Number', '') || '';
          // Get just the number
          const numMatch = text.match(/\d+/);
          if (numMatch) { number = numMatch[0]; break; }
        }

        // Get headshot URL - NEW: handle picture/source elements
        let headshot = '';
        
        // Try picture > source srcset first (Vue/Nuxt pattern)
        const picture = card.querySelector('.s-person-thumbnail picture, [data-test-id="s-people-thumbnail__root"] picture');
        if (picture) {
          const source = picture.querySelector('source[type="image/webp"], source');
          if (source) {
            headshot = source.getAttribute('srcset') || '';
          }
          if (!headshot) {
            const img = picture.querySelector('img');
            headshot = img?.src || img?.dataset?.src || '';
          }
        }
        
        // Fallback to regular img selectors
        if (!headshot) {
          const imgSelectors = [
            '.s-person-thumbnail img',
            '.sidearm-roster-player-image img',
            '.player-image img',
            'img[class*="headshot"]',
            'img[class*="photo"]',
            'img'
          ];
          for (const sel of imgSelectors) {
            const img = card.querySelector(sel);
            if (img) {
              headshot = img.src || img.dataset?.src || img.getAttribute('data-src') || '';
              if (headshot && !headshot.includes('placeholder') && !headshot.startsWith('data:')) break;
              headshot = '';
            }
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
          else if (headshot.startsWith('/')) headshot = baseUrl + headshot;
        }
        
        // Filter placeholders
        const badPatterns = ['placeholder', 'no-photo', 'blank', 'default', 'silhouette', 'avatar', 'generic'];
        if (headshot && badPatterns.some(p => headshot.toLowerCase().includes(p))) headshot = '';
        
        // Get bio link for fallback scraping
        let bioLink = '';
        const linkEl = card.querySelector('a[href*="/roster/"]');
        if (linkEl) {
          bioLink = linkEl.href;
          if (bioLink && !bioLink.startsWith('http')) {
            bioLink = baseUrl + bioLink;
          }
        }
        
        results.push({ name, number, position, headshot, bioLink });
      });
      
      return results;
    }, baseUrl);
    
    console.log(`   Found ${players.length} pitchers`);
    return { players, baseUrl };
    
  } catch (err) {
    console.log(`   ❌ Error: ${err.message}`);
    return { players: [], baseUrl: '' };
  }
}


// Scrape individual bio page for high-res headshot
async function scrapeBioPage(page, bioUrl, playerName) {
  try {
    await page.goto(bioUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 2000));
    
    const headshot = await page.evaluate(() => {
      // Look for main bio image
      const selectors = [
        '.s-person-header__thumbnail img',
        '.s-person-header picture source',
        '.s-person-header picture img',
        '.sidearm-roster-player-image img',
        '.bio-photo img',
        '[class*="bio"][class*="photo"] img',
        '[class*="player"][class*="image"] img',
        'img[alt*="headshot"]'
      ];
      
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el) {
          let src = el.srcset || el.src || el.dataset?.src || '';
          if (src && !src.includes('placeholder') && !src.startsWith('data:')) {
            return src;
          }
        }
      }
      
      // Fallback: find largest image on page
      const images = document.querySelectorAll('img');
      let bestImg = null;
      let bestSize = 0;
      for (const img of images) {
        if (img.naturalWidth > bestSize && img.src && 
            !img.src.includes('logo') && !img.src.includes('icon') &&
            !img.src.includes('placeholder')) {
          bestSize = img.naturalWidth;
          bestImg = img.src;
        }
      }
      return bestImg || '';
    });
    
    return headshot;
  } catch (err) {
    console.log(`      ⚠️ Bio page error: ${err.message}`);
    return '';
  }
}

// Main function
async function main() {
  console.log('⚾ SEC Headshot Scraper v4 - COMPREHENSIVE');
  console.log('═══════════════════════════════════════════\n');
  
  // Parse command line args
  const args = process.argv.slice(2);
  const teamArg = args.find(a => a.startsWith('--team='));
  const targetTeam = teamArg ? teamArg.split('=')[1] : null;
  const visitBioPages = args.includes('--bio-pages');
  
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
    const { players: scrapedPlayers, baseUrl } = await scrapeTeamHeadshots(page, teamName, teamInfo);
    
    if (scrapedPlayers.length === 0) {
      console.log(`   ⚠️ No pitchers found, skipping ${teamName}`);
      continue;
    }

    // Find team in pitchers.json
    const teamIdx = pitchersData.teams.findIndex(t => 
      t.team === teamName || t.team_id === teamInfo.id || t.teamId === teamInfo.id ||
      String(t.team_id) === String(teamInfo.id) || String(t.teamId) === String(teamInfo.id)
    );
    
    if (teamIdx === -1) {
      console.log(`   ⚠️ Team "${teamName}" not found in pitchers.json`);
      continue;
    }
    
    const teamData = pitchersData.teams[teamIdx];
    console.log(`   📋 Matching against ${teamData.pitchers?.length || 0} existing pitchers...`);
    
    let teamDownloads = 0;
    
    // Match scraped players to existing pitchers
    for (const scraped of scrapedPlayers) {
      const normalizedScrapedName = normalizeName(scraped.name);
      
      // Find matching pitcher in data
      const pitcherIdx = teamData.pitchers?.findIndex(p => {
        const normalizedPitcherName = normalizeName(p.name);
        return normalizedPitcherName === normalizedScrapedName ||
               (p.number && p.number === scraped.number && 
                normalizedPitcherName.split(' ').pop() === normalizedScrapedName.split(' ').pop());
      });
      
      if (pitcherIdx === -1 || pitcherIdx === undefined) continue;
      
      const pitcher = teamData.pitchers[pitcherIdx];
      
      // Get headshot URL - try bio page if roster page didn't have it
      let headshotUrl = scraped.headshot;
      if (!headshotUrl && scraped.bioLink) {
        console.log(`     🔍 Visiting bio page for ${scraped.name}...`);
        headshotUrl = await scrapeBioPage(page, scraped.bioLink, scraped.name);
      }
      
      if (!headshotUrl) continue;
      
      // Get higher resolution version
      headshotUrl = getHighResUrl(headshotUrl);
      
      const filename = `${teamInfo.slug}_${teamInfo.id}-${pitcher.id || 'P' + (pitcherIdx + 1)}.jpg`;
      const filepath = path.join(HEADSHOTS_DIR, filename);
      
      // Download headshot
      console.log(`     ⬇️ ${scraped.name}...`);
      const result = await downloadImage(headshotUrl, filepath);
      
      if (result) {
        // Update pitcher with headshot path
        pitcher.headshot = `data/headshots/${filename}`;
        totalDownloaded++;
        totalLinked++;
        teamDownloads++;
        console.log(`     ✅ ${scraped.name}`);
      } else {
        console.log(`     ❌ Failed: ${scraped.name}`);
      }
      
      // Small delay between downloads
      await new Promise(r => setTimeout(r, 200));
    }
    
    console.log(`   📊 ${teamName}: ${teamDownloads} headshots downloaded`);
    
    // Pause between teams
    await new Promise(r => setTimeout(r, 2000));
  }

  await browser.close();
  
  // Save updated pitchers.json
  fs.writeFileSync(PITCHERS_FILE, JSON.stringify(pitchersData, null, 2));
  
  console.log('\n═══════════════════════════════════════════');
  console.log('📊 SUMMARY');
  console.log('═══════════════════════════════════════════');
  console.log(`   Downloaded: ${totalDownloaded} headshots`);
  console.log(`   Linked:     ${totalLinked} pitchers`);
  console.log(`   Saved:      ${PITCHERS_FILE}`);
  console.log('\n✅ Complete!');
}

main().catch(console.error);
