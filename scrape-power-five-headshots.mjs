#!/usr/bin/env node

/**
 * Power Five Headshot Scraper
 * Scrapes pitchers and headshots for all Power Five conference teams
 * Run: node scrape-power-five-headshots.mjs [--team=name] [--conference=name]
 */

import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';

const DATA_DIR = './data';
const HEADSHOTS_DIR = path.join(DATA_DIR, 'headshots');
const PITCHERS_FILE = path.join(DATA_DIR, 'pitchers.json');
const STATUS_FILE = './scrape_status.json';
const LOG_FILE = './scrape_power_five.log';

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

// All Power Five teams with roster URLs
const POWER_FIVE_TEAMS = {
  // SEC (16 teams)
  'Alabama':          { id: '148', slug: 'alabama',           conference: 'SEC', url: 'https://rolltide.com/sports/baseball/roster/2025' },
  'Arkansas':         { id: '58',  slug: 'arkansas',          conference: 'SEC', url: 'https://arkansasrazorbacks.com/sport/m-basebl/roster/' },
  'Auburn':           { id: '55',  slug: 'auburn',            conference: 'SEC', url: 'https://auburntigers.com/sports/baseball/roster' },
  'Florida':          { id: '75',  slug: 'florida',           conference: 'SEC', url: 'https://floridagators.com/sports/baseball/roster' },
  'Georgia':          { id: '78',  slug: 'georgia',           conference: 'SEC', url: 'https://georgiadogs.com/sports/baseball/roster' },
  'Kentucky':         { id: '82',  slug: 'kentucky',          conference: 'SEC', url: 'https://ukathletics.com/sports/baseball/roster' },
  'LSU':              { id: '85',  slug: 'lsu',               conference: 'SEC', url: 'https://lsusports.net/sports/baseball/roster/2025' },
  'Mississippi State':{ id: '150', slug: 'mississippi-state', conference: 'SEC', url: 'https://hailstate.com/sports/baseball/roster' },
  'Missouri':         { id: '91',  slug: 'missouri',          conference: 'SEC', url: 'https://mutigers.com/sports/baseball/roster' },
  'Oklahoma':         { id: '112', slug: 'oklahoma',          conference: 'SEC', url: 'https://soonersports.com/sports/baseball/roster' },
  'Ole Miss':         { id: '92',  slug: 'ole-miss',          conference: 'SEC', url: 'https://olemisssports.com/sports/baseball/roster' },
  'South Carolina':   { id: '193', slug: 'south-carolina',    conference: 'SEC', url: 'https://gamecocksonline.com/sports/baseball/roster/2025' },
  'Tennessee':        { id: '199', slug: 'tennessee',         conference: 'SEC', url: 'https://utsports.com/sports/baseball/roster' },
  'Texas':            { id: '126', slug: 'texas',             conference: 'SEC', url: 'https://texassports.com/sports/baseball/roster' },
  'Texas A&M':        { id: '123', slug: 'texas-am',          conference: 'SEC', url: 'https://12thman.com/sports/baseball/roster/2025' },
  'Vanderbilt':       { id: '120', slug: 'vanderbilt',        conference: 'SEC', url: 'https://vucommodores.com/sports/baseball/roster' },

  // ACC (17 teams)
  'Boston College':   { id: '86',  slug: 'boston-college',    conference: 'ACC', url: 'https://bceagles.com/sports/baseball/roster' },
  'California':       { id: '65',  slug: 'california',        conference: 'ACC', url: 'https://calbears.com/sports/baseball/roster' },
  'Clemson':          { id: '117', slug: 'clemson',           conference: 'ACC', url: 'https://clemsontigers.com/sports/baseball/roster' },
  'Duke':             { id: '93',  slug: 'duke',              conference: 'ACC', url: 'https://goduke.com/sports/baseball/roster' },
  'Florida State':    { id: '72',  slug: 'florida-state',     conference: 'ACC', url: 'https://seminoles.com/sports/baseball/roster' },
  'Georgia Tech':     { id: '77',  slug: 'georgia-tech',      conference: 'ACC', url: 'https://ramblinwreck.com/sports/baseball/roster' },
  'Louisville':       { id: '83',  slug: 'louisville',        conference: 'ACC', url: 'https://gocards.com/sports/baseball/roster' },
  'Miami':            { id: '176', slug: 'miami',             conference: 'ACC', url: 'https://miamihurricanes.com/sports/baseball/roster' },
  'NC State':         { id: '95',  slug: 'nc-state',          conference: 'ACC', url: 'https://gopack.com/sports/baseball/roster' },
  'North Carolina':   { id: '96',  slug: 'north-carolina',    conference: 'ACC', url: 'https://goheels.com/sports/baseball/roster' },
  'Notre Dame':       { id: '81',  slug: 'notre-dame',        conference: 'ACC', url: 'https://und.com/sports/baseball/roster' },
  'Pittsburgh':       { id: '115', slug: 'pittsburgh',        conference: 'ACC', url: 'https://pittsburghpanthers.com/sports/baseball/roster' },
  'SMU':              { id: '433', slug: 'smu',               conference: 'ACC', url: 'https://smumustangs.com/sports/baseball/roster' },
  'Stanford':         { id: '64',  slug: 'stanford',          conference: 'ACC', url: 'https://gostanford.com/sports/baseball/roster' },
  'Virginia':         { id: '131', slug: 'virginia',          conference: 'ACC', url: 'https://virginiasports.com/sports/baseball/roster' },
  'Virginia Tech':    { id: '132', slug: 'virginia-tech',     conference: 'ACC', url: 'https://hokiesports.com/sports/baseball/roster' },
  'Wake Forest':      { id: '97',  slug: 'wake-forest',       conference: 'ACC', url: 'https://godeacs.com/sports/baseball/roster' },

  // Big 12 (16 teams)
  'Arizona':          { id: '60',  slug: 'arizona',           conference: 'Big 12', url: 'https://arizonawildcats.com/sports/baseball/roster' },
  'Arizona State':    { id: '59',  slug: 'arizona-state',     conference: 'Big 12', url: 'https://thesundevils.com/sports/baseball/roster' },
  'Baylor':           { id: '121', slug: 'baylor',            conference: 'Big 12', url: 'https://baylorbears.com/sports/baseball/roster' },
  'BYU':              { id: '127', slug: 'byu',               conference: 'Big 12', url: 'https://byucougars.com/sports/baseball/roster' },
  'Cincinnati':       { id: '161', slug: 'cincinnati',        conference: 'Big 12', url: 'https://gobearcats.com/sports/baseball/roster' },
  'Colorado':         { id: '334', slug: 'colorado',          conference: 'Big 12', url: 'https://cubuffs.com/sports/baseball/roster' },
  'Houston':          { id: '124', slug: 'houston',           conference: 'Big 12', url: 'https://uhcougars.com/sports/baseball/roster' },
  'Kansas':           { id: '168', slug: 'kansas',            conference: 'Big 12', url: 'https://kuathletics.com/sports/baseball/roster' },
  'Kansas State':     { id: '264', slug: 'kansas-state',      conference: 'Big 12', url: 'https://kstatesports.com/sports/baseball/roster' },
  'Oklahoma State':   { id: '110', slug: 'oklahoma-state',    conference: 'Big 12', url: 'https://okstate.com/sports/baseball/roster' },
  'TCU':              { id: '198', slug: 'tcu',               conference: 'Big 12', url: 'https://gofrogs.com/sports/baseball/roster' },
  'Texas Tech':       { id: '201', slug: 'texas-tech',        conference: 'Big 12', url: 'https://texastech.com/sports/baseball/roster' },
  'UCF':              { id: '160', slug: 'ucf',               conference: 'Big 12', url: 'https://ucfknights.com/sports/baseball/roster' },
  'Utah':             { id: '128', slug: 'utah',              conference: 'Big 12', url: 'https://utahutes.com/sports/baseball/roster' },
  'West Virginia':    { id: '136', slug: 'west-virginia',     conference: 'Big 12', url: 'https://wvusports.com/sports/baseball/roster' },

  // Big Ten (18 teams)
  'Illinois':         { id: '153', slug: 'illinois',          conference: 'Big Ten', url: 'https://fightingillini.com/sports/baseball/roster' },
  'Indiana':          { id: '294', slug: 'indiana',           conference: 'Big Ten', url: 'https://iuhoosiers.com/sports/baseball/roster' },
  'Iowa':             { id: '167', slug: 'iowa',              conference: 'Big Ten', url: 'https://hawkeyesports.com/sports/baseball/roster' },
  'Maryland':         { id: '87',  slug: 'maryland',          conference: 'Big Ten', url: 'https://umterps.com/sports/baseball/roster' },
  'Michigan':         { id: '89',  slug: 'michigan',          conference: 'Big Ten', url: 'https://mgoblue.com/sports/baseball/roster' },
  'Michigan State':   { id: '88',  slug: 'michigan-state',    conference: 'Big Ten', url: 'https://msuspartans.com/sports/baseball/roster' },
  'Minnesota':        { id: '90',  slug: 'minnesota',         conference: 'Big Ten', url: 'https://gophersports.com/sports/baseball/roster' },
  'Nebraska':         { id: '99',  slug: 'nebraska',          conference: 'Big Ten', url: 'https://huskers.com/sports/baseball/roster' },
  'Northwestern':     { id: '411', slug: 'northwestern',      conference: 'Big Ten', url: 'https://nusports.com/sports/baseball/roster' },
  'Ohio State':       { id: '108', slug: 'ohio-state',        conference: 'Big Ten', url: 'https://ohiostatebuckeyes.com/sports/baseball/roster' },
  'Oregon':           { id: '273', slug: 'oregon',            conference: 'Big Ten', url: 'https://goducks.com/sports/baseball/roster' },
  'Penn State':       { id: '414', slug: 'penn-state',        conference: 'Big Ten', url: 'https://gopsusports.com/sports/baseball/roster' },
  'Purdue':           { id: '189', slug: 'purdue',            conference: 'Big Ten', url: 'https://purduesports.com/sports/baseball/roster' },
  'Rutgers':          { id: '102', slug: 'rutgers',           conference: 'Big Ten', url: 'https://scarletknights.com/sports/baseball/roster' },
  'UCLA':             { id: '66',  slug: 'ucla',              conference: 'Big Ten', url: 'https://uclabruins.com/sports/baseball/roster' },
  'USC':              { id: '68',  slug: 'usc',               conference: 'Big Ten', url: 'https://usctrojans.com/sports/baseball/roster' },
  'Washington':       { id: '133', slug: 'washington',        conference: 'Big Ten', url: 'https://gohuskies.com/sports/baseball/roster' },
  'Wisconsin':        { id: '464', slug: 'wisconsin',         conference: 'Big Ten', url: 'https://uwbadgers.com/sports/baseball/roster' },

  // Pac-12 (2 teams)
  'Oregon State':     { id: '113', slug: 'oregon-state',      conference: 'Pac-12', url: 'https://osubeavers.com/sports/baseball/roster' },
  'Washington State': { id: '134', slug: 'washington-state',  conference: 'Pac-12', url: 'https://wsucougars.com/sports/baseball/roster' }
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

// Get high-res headshot URL
function getHighResUrl(url) {
  if (!url) return url;
  if (url.includes('images.sidearmdev.com')) {
    return url.replace(/&width=\d+/, '&width=400').replace(/&height=\d+/, '&height=400');
  }
  return url;
}


// Scrape roster page for pitchers and headshots
async function scrapeTeamHeadshots(page, teamName, teamInfo) {
  log(`📸 Scraping ${teamName} (${teamInfo.conference})...`);
  
  try {
    await page.goto(teamInfo.url, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(r => setTimeout(r, 3000));
    await scrollPage(page);
    
    const baseUrl = new URL(teamInfo.url).origin;
    
    const players = await page.evaluate((baseUrl) => {
      const results = [];
      
      // Multiple selector strategies for different site architectures
      const cardSelectors = [
        '.s-person-card',
        '.roster-card-item', 
        '[data-test-id="s-person-card-list__root"]',
        '.sidearm-roster-player',
        '.roster-player',
        '.player-card',
        '[class*="roster"][class*="player"]',
        '.roster__item',
        'tr[class*="roster"]',
        '.roster-list-item'
      ];
      
      let playerCards = [];
      for (const sel of cardSelectors) {
        const cards = document.querySelectorAll(sel);
        if (cards.length > 0) {
          playerCards = Array.from(cards);
          break;
        }
      }
      
      // Fallback: table rows
      if (playerCards.length === 0) {
        const rows = document.querySelectorAll('table tbody tr, .roster-table tr');
        if (rows.length > 0) playerCards = Array.from(rows);
      }
      
      playerCards.forEach(card => {
        // Get name
        let name = '';
        const nameSelectors = [
          '.s-person-details__personal-single-line a',
          '.s-person-card__content a',
          'a[href*="/roster/"] h3',
          'a[href*="/roster/"]',
          '.sidearm-roster-player-name a',
          '[class*="name"] a',
          '.player-name',
          'td:nth-child(2) a',
          '.roster-player-name'
        ];
        for (const sel of nameSelectors) {
          const el = card.querySelector(sel);
          if (el?.textContent?.trim()) { 
            name = el.textContent.trim(); 
            break; 
          }
        }
        if (!name) return;
        
        // Get position - check for pitcher indicators
        let position = '';
        const posSelectors = [
          '[data-test-id="s-person-details__bio-stats-person-position-short"]',
          '.s-person-details__bio-stats-item',
          '.sidearm-roster-player-position',
          '[class*="position"]',
          'td:nth-child(3)',
          '.roster-player-position'
        ];
        for (const sel of posSelectors) {
          const el = card.querySelector(sel);
          const text = el?.textContent?.trim() || '';
          if (/\b(RHP|LHP|RHSP|LHSP|P)\b/i.test(text)) { 
            position = text.match(/\b(RHP|LHP|RHSP|LHSP|P)\b/i)?.[0] || text; 
            break; 
          }
        }
        // Check full card text
        if (!position) {
          const cardText = card.textContent || '';
          const posMatch = cardText.match(/\b(RHP|LHP|RHSP|LHSP)\b/i);
          if (posMatch) position = posMatch[1];
        }
        
        const isPitcher = /\b(P|RHP|LHP|RHSP|LHSP|SP|RP|Pitcher)\b/i.test(position);
        if (!isPitcher) return;
        
        // Get jersey number
        let number = '';
        const numSelectors = [
          '[data-test-id="s-person-thumbnail__stamp-sr-only-text"]',
          '.s-stamp__text',
          '.s-person-card__number',
          '.sidearm-roster-player-jersey-number',
          '[class*="number"]',
          '[class*="jersey"]',
          'td:first-child'
        ];
        for (const sel of numSelectors) {
          const el = card.querySelector(sel);
          const text = el?.textContent?.trim() || '';
          const numMatch = text.match(/^#?(\d{1,2})$/);
          if (numMatch) { number = numMatch[1]; break; }
        }
        
        // Get headshot URL
        let headshot = '';
        const imgSelectors = [
          '.s-person-card__thumbnail img',
          '.s-person-thumbnail img',
          'img[data-test-id="s-person-card__thumbnail"]',
          '.sidearm-roster-player-image img',
          '.player-image img',
          '[class*="headshot"] img',
          'img[src*="headshot"]',
          'img[src*="roster"]'
        ];
        for (const sel of imgSelectors) {
          const img = card.querySelector(sel);
          if (img) {
            headshot = img.getAttribute('data-src') || img.src || '';
            if (headshot && !headshot.includes('placeholder') && !headshot.startsWith('data:')) {
              if (headshot.startsWith('//')) headshot = 'https:' + headshot;
              else if (headshot.startsWith('/')) headshot = baseUrl + headshot;
              break;
            }
            headshot = '';
          }
        }
        
        // Get year/class
        let year = '';
        const yearSelectors = ['.s-person-details__bio-stats-item', '[class*="class"]', '[class*="year"]'];
        for (const sel of yearSelectors) {
          const el = card.querySelector(sel);
          const text = el?.textContent?.trim() || '';
          const yearMatch = text.match(/\b(Fr\.|So\.|Jr\.|Sr\.|Freshman|Sophomore|Junior|Senior|RS\s*\w+|Graduate)\b/i);
          if (yearMatch) { year = yearMatch[0]; break; }
        }
        
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


// Main execution
async function main() {
  const args = process.argv.slice(2);
  const teamArg = args.find(a => a.startsWith('--team='))?.split('=')[1];
  const confArg = args.find(a => a.startsWith('--conference='))?.split('=')[1];
  
  // Load existing pitchers data
  let pitchersData = { teams: [] };
  if (fs.existsSync(PITCHERS_FILE)) {
    pitchersData = JSON.parse(fs.readFileSync(PITCHERS_FILE, 'utf8'));
  }
  
  // Determine which teams to scrape
  let teamsToScrape = Object.entries(POWER_FIVE_TEAMS);
  
  if (teamArg) {
    const teamKey = Object.keys(POWER_FIVE_TEAMS).find(k => 
      k.toLowerCase().includes(teamArg.toLowerCase())
    );
    if (teamKey) {
      teamsToScrape = [[teamKey, POWER_FIVE_TEAMS[teamKey]]];
    } else {
      log(`Team "${teamArg}" not found`);
      return;
    }
  } else if (confArg) {
    teamsToScrape = teamsToScrape.filter(([_, info]) => 
      info.conference.toLowerCase() === confArg.toLowerCase()
    );
    if (teamsToScrape.length === 0) {
      log(`Conference "${confArg}" not found. Available: SEC, ACC, Big 12, Big Ten, Pac-12`);
      return;
    }
  }
  
  // Clear log file and initialize status
  fs.writeFileSync(LOG_FILE, '');
  updateStatus({
    status: 'running',
    startTime: new Date().toISOString(),
    totalTeams: teamsToScrape.length,
    completed: 0,
    currentTeam: '',
    totalPitchers: 0,
    totalHeadshots: 0,
    errors: []
  });
  
  log(`🏈 Power Five Headshot Scraper`);
  log(`📋 Scraping ${teamsToScrape.length} teams...`);
  
  const browser = await puppeteer.launch({ 
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
  await page.setViewport({ width: 1920, height: 1080 });
  
  let totalPitchers = 0;
  let totalHeadshots = 0;
  let completed = 0;
  let errors = [];
  
  for (const [teamName, teamInfo] of teamsToScrape) {
    updateStatus({
      currentTeam: teamName,
      currentConference: teamInfo.conference,
      completed,
      progress: `${completed}/${teamsToScrape.length} (${Math.round(completed/teamsToScrape.length*100)}%)`
    });
    
    const players = await scrapeTeamHeadshots(page, teamName, teamInfo);
    
    if (players.length === 0) {
      log(`   ⚠️  No pitchers found for ${teamName}`);
      errors.push(teamName);
      updateStatus({ errors });
      completed++;
      continue;
    }
    
    // Find or create team entry
    let teamEntry = pitchersData.teams.find(t => 
      t.team === teamName || t.slug === teamInfo.slug
    );
    
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
    
    // Process each pitcher
    for (let i = 0; i < players.length; i++) {
      const p = players[i];
      const pitcherId = `${teamInfo.id}-P${i + 1}`;
      
      // Download headshot if available
      let localHeadshot = '';
      if (p.headshot) {
        const ext = p.headshot.includes('.png') ? 'png' : 'jpg';
        const filename = `${teamInfo.slug}_${pitcherId}.${ext}`;
        const filepath = path.join(HEADSHOTS_DIR, filename);
        
        const hsUrl = getHighResUrl(p.headshot);
        const downloaded = await downloadImage(hsUrl, filepath);
        if (downloaded) {
          localHeadshot = `data/headshots/${filename}`;
          totalHeadshots++;
        }
      }
      
      // Find existing pitcher or create new
      const existingIdx = teamEntry.pitchers.findIndex(ep => 
        ep.name.toLowerCase() === p.name.toLowerCase()
      );
      
      const pitcherData = {
        id: pitcherId,
        name: p.name,
        number: p.number || '',
        position: p.position || 'P',
        year: p.year || '',
        height: '',
        weight: '',
        batsThrows: '',
        hometown: '',
        headshot: localHeadshot
      };
      
      if (existingIdx >= 0) {
        // Update existing, preserve headshot if new one failed
        if (!localHeadshot && teamEntry.pitchers[existingIdx].headshot) {
          pitcherData.headshot = teamEntry.pitchers[existingIdx].headshot;
        }
        teamEntry.pitchers[existingIdx] = pitcherData;
      } else {
        teamEntry.pitchers.push(pitcherData);
      }
      
      totalPitchers++;
    }
    
    log(`   ✅ ${players.length} pitchers processed`);
    completed++;
    
    updateStatus({
      completed,
      totalPitchers,
      totalHeadshots,
      progress: `${completed}/${teamsToScrape.length} (${Math.round(completed/teamsToScrape.length*100)}%)`
    });
    
    // Rate limiting between teams
    await new Promise(r => setTimeout(r, 2000));
  }
  
  await browser.close();
  
  // Save updated pitchers file
  fs.writeFileSync(PITCHERS_FILE, JSON.stringify(pitchersData, null, 2));
  
  updateStatus({
    status: 'complete',
    endTime: new Date().toISOString(),
    completed,
    totalPitchers,
    totalHeadshots,
    progress: '100%'
  });
  
  log(`✨ Complete!`);
  log(`   Total pitchers: ${totalPitchers}`);
  log(`   Headshots downloaded: ${totalHeadshots}`);
  log(`   Errors: ${errors.length} teams`);
  if (errors.length > 0) log(`   Failed: ${errors.join(', ')}`);
}

main().catch(console.error);
