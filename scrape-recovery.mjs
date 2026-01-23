#!/usr/bin/env node

/**
 * Power Five Recovery Scraper
 * Re-attempts failed teams with debug mode and alternate selectors
 */

import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';

const DATA_DIR = './data';
const HEADSHOTS_DIR = path.join(DATA_DIR, 'headshots');
const PITCHERS_FILE = path.join(DATA_DIR, 'pitchers.json');
const STATUS_FILE = './scrape_recovery_status.json';
const LOG_FILE = './scrape_recovery.log';
const DEBUG_DIR = './debug_html';

// Create debug directory
if (!fs.existsSync(DEBUG_DIR)) fs.mkdirSync(DEBUG_DIR, { recursive: true });
if (!fs.existsSync(HEADSHOTS_DIR)) fs.mkdirSync(HEADSHOTS_DIR, { recursive: true });

// Status tracking
function updateStatus(data) {
  const status = fs.existsSync(STATUS_FILE) ? JSON.parse(fs.readFileSync(STATUS_FILE, 'utf8')) : {};
  Object.assign(status, data, { lastUpdate: new Date().toISOString() });
  fs.writeFileSync(STATUS_FILE, JSON.stringify(status, null, 2));
}

function log(msg) {
  const timestamp = new Date().toISOString().slice(11, 19);
  const line = `[${timestamp}] ${msg}`;
  console.log(line);
  fs.appendFileSync(LOG_FILE, line + '\n');
}

// Teams that completely failed - need different URLs or selectors
const MISSING_TEAMS = {
  'Duke':          { id: '93',  slug: 'duke',          conference: 'ACC',     url: 'https://goduke.com/sports/baseball/roster' },
  'Miami':         { id: '176', slug: 'miami',         conference: 'ACC',     url: 'https://miamihurricanes.com/sports/baseball/roster' },
  'Notre Dame':    { id: '81',  slug: 'notre-dame',    conference: 'ACC',     url: 'https://und.com/sports/baseball/roster' },
  'SMU':           { id: '433', slug: 'smu',           conference: 'ACC',     url: 'https://smumustangs.com/sports/baseball/roster' },
  'Stanford':      { id: '64',  slug: 'stanford',      conference: 'ACC',     url: 'https://gostanford.com/sports/baseball/roster' },
  'Arizona':       { id: '60',  slug: 'arizona',       conference: 'Big 12',  url: 'https://arizonawildcats.com/sports/baseball/roster' },
  'Arizona State': { id: '59',  slug: 'arizona-state', conference: 'Big 12',  url: 'https://thesundevils.com/sports/baseball/roster' },
  'BYU':           { id: '127', slug: 'byu',           conference: 'Big 12',  url: 'https://byucougars.com/sports/baseball/roster' },
  'Colorado':      { id: '334', slug: 'colorado',      conference: 'Big 12',  url: 'https://cubuffs.com/sports/baseball/roster' },
  'UCF':           { id: '160', slug: 'ucf',           conference: 'Big 12',  url: 'https://ucfknights.com/sports/baseball/roster' },
  'Iowa':          { id: '167', slug: 'iowa',          conference: 'Big Ten', url: 'https://hawkeyesports.com/sports/baseball/roster' },
  'Nebraska':      { id: '99',  slug: 'nebraska',      conference: 'Big Ten', url: 'https://huskers.com/sports/baseball/roster' },
  'Penn State':    { id: '414', slug: 'penn-state',    conference: 'Big Ten', url: 'https://gopsusports.com/sports/baseball/roster' },
  'Purdue':        { id: '189', slug: 'purdue',        conference: 'Big Ten', url: 'https://purduesports.com/sports/baseball/roster' },
  'Wisconsin':     { id: '464', slug: 'wisconsin',     conference: 'Big Ten', url: 'https://uwbadgers.com/sports/baseball/roster' },
};

// Teams with pitchers but no headshots - need alternate headshot selectors
const NO_HEADSHOT_TEAMS = {
  'Clemson':         { id: '117', slug: 'clemson',         conference: 'ACC',    url: 'https://clemsontigers.com/sports/baseball/roster' },
  'Virginia':        { id: '131', slug: 'virginia',        conference: 'ACC',    url: 'https://virginiasports.com/sports/baseball/roster' },
  'Washington State':{ id: '134', slug: 'washington-state',conference: 'Pac-12', url: 'https://wsucougars.com/sports/baseball/roster' },
};


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
      if (res.statusCode !== 200) { resolve(null); return; }
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

// Save debug HTML
async function saveDebugHtml(page, teamSlug) {
  const html = await page.content();
  fs.writeFileSync(path.join(DEBUG_DIR, `${teamSlug}_roster.html`), html);
  log(`   💾 Saved debug HTML: ${teamSlug}_roster.html`);
}

// Enhanced scraper with multiple selector strategies
async function scrapeTeamEnhanced(page, teamName, teamInfo, saveDebug = true) {
  log(`📸 Scraping ${teamName} (${teamInfo.conference})...`);
  
  try {
    await page.goto(teamInfo.url, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(r => setTimeout(r, 4000));
    await scrollPage(page);
    
    if (saveDebug) await saveDebugHtml(page, teamInfo.slug);
    
    const baseUrl = new URL(teamInfo.url).origin;
    
    const players = await page.evaluate((baseUrl) => {
      const results = [];
      
      // EXPANDED selector strategies
      const cardSelectors = [
        // Vue/Nuxt SIDEARM
        '.s-person-card',
        '[data-test-id="s-person-card"]',
        // Traditional SIDEARM
        '.sidearm-roster-player',
        '.sidearm-roster-player-container',
        // Generic roster
        '.roster-player',
        '.roster-card',
        '.roster-card-item',
        '.roster__item',
        '.roster-list-item',
        '.player-card',
        '.player',
        // Table rows
        'table.sidearm-table tbody tr',
        '.roster-table tbody tr',
        'table tbody tr',
        // Grid items
        '[class*="roster"] [class*="card"]',
        '[class*="roster"] [class*="player"]',
        '[class*="roster"] li',
        '.grid-item',
        // BYU specific
        '.roster-grid-item',
        '.athlete-card'
      ];
      
      let playerCards = [];
      for (const sel of cardSelectors) {
        const cards = document.querySelectorAll(sel);
        if (cards.length > 5) {  // Need at least a few results
          playerCards = Array.from(cards);
          console.log('Found cards with:', sel, cards.length);
          break;
        }
      }
      
      if (playerCards.length === 0) {
        // Last resort: find all links to player pages
        const playerLinks = document.querySelectorAll('a[href*="/roster/"], a[href*="/player/"], a[href*="sports/baseball/roster/"]');
        if (playerLinks.length > 0) {
          playerCards = Array.from(playerLinks).map(a => a.closest('div, li, tr') || a.parentElement);
        }
      }

      
      playerCards.forEach(card => {
        if (!card) return;
        const cardText = card.textContent || '';
        
        // Check if this is a pitcher FIRST
        const isPitcher = /\b(RHP|LHP|RHSP|LHSP|P\b|Pitcher)\b/i.test(cardText);
        if (!isPitcher) return;
        
        // Get name - expanded selectors
        let name = '';
        const nameSelectors = [
          'h3', 'h4', 'h2',
          '.s-person-details__personal-single-line a',
          '.s-person-card__content a',
          'a[href*="/roster/"]',
          'a[href*="/player/"]',
          '.sidearm-roster-player-name a',
          '.sidearm-roster-player-name',
          '[class*="name"] a',
          '[class*="name"]',
          '.player-name',
          'td:nth-child(2) a',
          'td:nth-child(2)',
          'td:nth-child(1) a',
          '.roster-player-name',
          'a'
        ];
        for (const sel of nameSelectors) {
          const el = card.querySelector(sel);
          const text = el?.textContent?.trim() || '';
          // Filter out non-name text
          if (text && text.length > 2 && text.length < 50 && !/^(RHP|LHP|P|#?\d+)$/i.test(text)) {
            name = text.replace(/^#\d+\s*/, '').trim();
            break;
          }
        }
        if (!name) return;
        
        // Get position
        let position = '';
        const posMatch = cardText.match(/\b(RHP|LHP|RHSP|LHSP)\b/i);
        if (posMatch) position = posMatch[1].toUpperCase();
        else position = 'P';
        
        // Get jersey number
        let number = '';
        const numMatch = cardText.match(/(?:^|\s)#?(\d{1,2})(?:\s|$)/);
        if (numMatch) number = numMatch[1];
        
        // Get headshot - EXPANDED selectors
        let headshot = '';
        const imgSelectors = [
          'img[src*="headshot"]',
          'img[src*="roster"]',
          'img[src*="player"]',
          'img[data-src]',
          '.s-person-card__thumbnail img',
          '.s-person-thumbnail img',
          '.sidearm-roster-player-image img',
          '.player-image img',
          '.player-headshot img',
          '[class*="headshot"] img',
          '[class*="photo"] img',
          '[class*="image"] img',
          'picture img',
          'img'
        ];
        for (const sel of imgSelectors) {
          const img = card.querySelector(sel);
          if (img) {
            let src = img.getAttribute('data-src') || img.getAttribute('src') || '';
            // Skip tiny icons, placeholders, logos
            if (src && !src.includes('placeholder') && !src.includes('logo') && 
                !src.includes('icon') && !src.startsWith('data:') && 
                !src.includes('1x1') && !src.includes('spacer')) {
              if (src.startsWith('//')) src = 'https:' + src;
              else if (src.startsWith('/')) src = baseUrl + src;
              headshot = src;
              break;
            }
          }
        }
        
        // Get year
        let year = '';
        const yearMatch = cardText.match(/\b(Fr\.|So\.|Jr\.|Sr\.|Freshman|Sophomore|Junior|Senior|Graduate|RS\s*\w+)\b/i);
        if (yearMatch) year = yearMatch[0];
        
        results.push({ name, number, position, year, headshot });
      });
      
      return results;
    }, baseUrl);
    
    log(`   Found ${players.length} pitchers`);
    return players;
    
  } catch (err) {
    log(`   ❌ Error: ${err.message}`);
    return [];
  }
}


// Try to get headshots from individual bio pages
async function scrapeHeadshotsFromBioPages(page, teamName, teamInfo, existingPitchers) {
  log(`🔍 Attempting bio page scrape for ${teamName}...`);
  
  try {
    await page.goto(teamInfo.url, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(r => setTimeout(r, 3000));
    await scrollPage(page);
    
    const baseUrl = new URL(teamInfo.url).origin;
    
    // Get all player links
    const playerLinks = await page.evaluate((baseUrl) => {
      const links = [];
      const anchors = document.querySelectorAll('a[href*="/roster/"], a[href*="sports/baseball/roster/"]');
      anchors.forEach(a => {
        const href = a.href || a.getAttribute('href');
        if (href && href.includes('/roster/') && !href.endsWith('/roster') && !href.endsWith('/roster/')) {
          const name = a.textContent?.trim() || '';
          if (name && name.length > 2 && name.length < 50) {
            let fullUrl = href;
            if (href.startsWith('/')) fullUrl = baseUrl + href;
            links.push({ name, url: fullUrl });
          }
        }
      });
      return links;
    }, baseUrl);
    
    log(`   Found ${playerLinks.length} player links`);
    
    const results = [];
    for (const link of playerLinks) {
      // Check if this player is in our existing pitchers list
      const matchingPitcher = existingPitchers.find(p => 
        p.name.toLowerCase() === link.name.toLowerCase() ||
        link.name.toLowerCase().includes(p.name.split(' ')[1]?.toLowerCase() || '---')
      );
      
      if (!matchingPitcher) continue;
      
      try {
        await page.goto(link.url, { waitUntil: 'networkidle2', timeout: 30000 });
        await new Promise(r => setTimeout(r, 1500));
        
        const headshot = await page.evaluate((baseUrl) => {
          const imgSelectors = [
            '.s-person-header__thumbnail img',
            '.s-person__header-image img',
            '.player-bio-image img',
            '.bio-image img',
            '[class*="headshot"] img',
            '[class*="player-image"] img',
            'article img',
            '.main-content img',
            'img[src*="headshot"]',
            'img[src*="roster"]'
          ];
          
          for (const sel of imgSelectors) {
            const img = document.querySelector(sel);
            if (img) {
              let src = img.getAttribute('data-src') || img.src || '';
              if (src && !src.includes('placeholder') && !src.includes('logo') && !src.startsWith('data:')) {
                if (src.startsWith('//')) src = 'https:' + src;
                else if (src.startsWith('/')) src = baseUrl + src;
                return src;
              }
            }
          }
          return '';
        }, baseUrl);
        
        if (headshot) {
          results.push({ name: matchingPitcher.name, headshot });
          log(`   ✅ Found headshot for ${matchingPitcher.name}`);
        }
      } catch (e) {
        // Skip failed bio pages
      }
      
      await new Promise(r => setTimeout(r, 500)); // Rate limit
    }
    
    return results;
  } catch (err) {
    log(`   ❌ Bio page error: ${err.message}`);
    return [];
  }
}


// Main execution
async function main() {
  // Load existing pitchers data
  let pitchersData = { teams: [] };
  if (fs.existsSync(PITCHERS_FILE)) {
    pitchersData = JSON.parse(fs.readFileSync(PITCHERS_FILE, 'utf8'));
  }
  
  const missingTeams = Object.entries(MISSING_TEAMS);
  const noHeadshotTeams = Object.entries(NO_HEADSHOT_TEAMS);
  const totalTasks = missingTeams.length + noHeadshotTeams.length;
  
  // Initialize status
  fs.writeFileSync(LOG_FILE, '');
  updateStatus({
    status: 'running',
    startTime: new Date().toISOString(),
    phase: 'Starting',
    totalTasks,
    completed: 0,
    missingTeamsTotal: missingTeams.length,
    missingTeamsCompleted: 0,
    noHeadshotTeamsTotal: noHeadshotTeams.length,
    noHeadshotTeamsCompleted: 0,
    newPitchers: 0,
    newHeadshots: 0,
    errors: []
  });
  
  log(`🔧 Power Five Recovery Scraper`);
  log(`📋 Phase 1: Re-attempt ${missingTeams.length} missing teams`);
  log(`📋 Phase 2: Get headshots for ${noHeadshotTeams.length} teams`);
  
  const browser = await puppeteer.launch({ 
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
  await page.setViewport({ width: 1920, height: 1080 });
  
  let completed = 0;
  let newPitchers = 0;
  let newHeadshots = 0;
  let errors = [];
  
  // PHASE 1: Re-attempt missing teams
  log(`\n========== PHASE 1: MISSING TEAMS ==========`);
  updateStatus({ phase: 'Phase 1: Missing Teams' });
  
  for (const [teamName, teamInfo] of missingTeams) {
    updateStatus({ 
      currentTeam: teamName,
      progress: `${completed}/${totalTasks}`
    });
    
    const players = await scrapeTeamEnhanced(page, teamName, teamInfo, true);
    
    if (players.length === 0) {
      log(`   ⚠️ Still no pitchers for ${teamName}`);
      errors.push({ team: teamName, issue: 'No pitchers found' });
    } else {
      // Add team to pitchers data
      let teamEntry = pitchersData.teams.find(t => t.slug === teamInfo.slug);
      if (!teamEntry) {
        teamEntry = {
          teamId: teamInfo.id,
          team_id: teamInfo.id,
          team: teamName,
          slug: teamInfo.slug,
          conference: teamInfo.conference,
          pitchers: []
        };
        pitchersData.teams.push(teamEntry);
      }
      
      // Process pitchers
      for (let i = 0; i < players.length; i++) {
        const p = players[i];
        const pitcherId = `${teamInfo.id}-P${i + 1}`;
        
        let localHeadshot = '';
        if (p.headshot) {
          const ext = p.headshot.includes('.png') ? 'png' : 'jpg';
          const filename = `${teamInfo.slug}_${pitcherId}.${ext}`;
          const filepath = path.join(HEADSHOTS_DIR, filename);
          
          const downloaded = await downloadImage(p.headshot, filepath);
          if (downloaded) {
            localHeadshot = `data/headshots/${filename}`;
            newHeadshots++;
          }
        }
        
        teamEntry.pitchers.push({
          id: pitcherId,
          name: p.name,
          number: p.number || '',
          position: p.position || 'P',
          year: p.year || '',
          headshot: localHeadshot
        });
        newPitchers++;
      }
      
      log(`   ✅ Added ${players.length} pitchers`);
    }
    
    completed++;
    updateStatus({ 
      completed, 
      missingTeamsCompleted: completed,
      newPitchers, 
      newHeadshots,
      errors 
    });
    
    await new Promise(r => setTimeout(r, 2000));
  }

  
  // PHASE 2: Get headshots for teams that have pitchers but no headshots
  log(`\n========== PHASE 2: HEADSHOT RECOVERY ==========`);
  updateStatus({ phase: 'Phase 2: Headshot Recovery' });
  
  for (const [teamName, teamInfo] of noHeadshotTeams) {
    updateStatus({ 
      currentTeam: teamName,
      progress: `${completed}/${totalTasks}`
    });
    
    // Find existing team entry
    const teamEntry = pitchersData.teams.find(t => 
      t.team === teamName || t.slug === teamInfo.slug ||
      t.team.toLowerCase().includes(teamName.toLowerCase().split(' ')[0])
    );
    
    if (!teamEntry || teamEntry.pitchers.length === 0) {
      log(`   ⚠️ No existing pitcher data for ${teamName}`);
      completed++;
      continue;
    }
    
    log(`📸 Recovering headshots for ${teamName} (${teamEntry.pitchers.length} pitchers)...`);
    
    // First try: re-scrape the roster page with enhanced selectors
    const players = await scrapeTeamEnhanced(page, teamName, teamInfo, true);
    
    let headshotsFound = 0;
    
    // Match scraped headshots to existing pitchers
    for (const p of players) {
      if (!p.headshot) continue;
      
      const matchingPitcher = teamEntry.pitchers.find(ep => 
        ep.name.toLowerCase() === p.name.toLowerCase()
      );
      
      if (matchingPitcher && !matchingPitcher.headshot) {
        const ext = p.headshot.includes('.png') ? 'png' : 'jpg';
        const filename = `${teamInfo.slug}_${matchingPitcher.id}.${ext}`;
        const filepath = path.join(HEADSHOTS_DIR, filename);
        
        const downloaded = await downloadImage(p.headshot, filepath);
        if (downloaded) {
          matchingPitcher.headshot = `data/headshots/${filename}`;
          newHeadshots++;
          headshotsFound++;
        }
      }
    }
    
    // Second try: visit individual bio pages
    if (headshotsFound < teamEntry.pitchers.length / 2) {
      log(`   🔍 Trying bio pages for more headshots...`);
      const bioHeadshots = await scrapeHeadshotsFromBioPages(page, teamName, teamInfo, teamEntry.pitchers);
      
      for (const bh of bioHeadshots) {
        const matchingPitcher = teamEntry.pitchers.find(ep => 
          ep.name.toLowerCase() === bh.name.toLowerCase()
        );
        
        if (matchingPitcher && !matchingPitcher.headshot) {
          const ext = bh.headshot.includes('.png') ? 'png' : 'jpg';
          const filename = `${teamInfo.slug}_${matchingPitcher.id}.${ext}`;
          const filepath = path.join(HEADSHOTS_DIR, filename);
          
          const downloaded = await downloadImage(bh.headshot, filepath);
          if (downloaded) {
            matchingPitcher.headshot = `data/headshots/${filename}`;
            newHeadshots++;
            headshotsFound++;
          }
        }
      }
    }
    
    log(`   ✅ Recovered ${headshotsFound} headshots for ${teamName}`);
    
    if (headshotsFound === 0) {
      errors.push({ team: teamName, issue: 'No headshots recovered' });
    }
    
    completed++;
    updateStatus({ 
      completed,
      noHeadshotTeamsCompleted: completed - missingTeams.length,
      newPitchers, 
      newHeadshots,
      errors 
    });
    
    await new Promise(r => setTimeout(r, 2000));
  }
  
  await browser.close();
  
  // Save updated pitchers file
  fs.writeFileSync(PITCHERS_FILE, JSON.stringify(pitchersData, null, 2));
  
  updateStatus({
    status: 'complete',
    endTime: new Date().toISOString(),
    phase: 'Complete',
    completed,
    newPitchers,
    newHeadshots,
    errors,
    progress: '100%'
  });
  
  log(`\n✨ Recovery Complete!`);
  log(`   New pitchers added: ${newPitchers}`);
  log(`   New headshots downloaded: ${newHeadshots}`);
  log(`   Teams with issues: ${errors.length}`);
  if (errors.length > 0) {
    errors.forEach(e => log(`   ❌ ${e.team}: ${e.issue}`));
  }
}

main().catch(err => {
  log(`❌ Fatal error: ${err.message}`);
  updateStatus({ status: 'error', error: err.message });
});
