#!/usr/bin/env node

/**
 * Retry Failed Teams Scraper
 * Enhanced selectors + debug HTML output for failed teams
 */

import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';

const DATA_DIR = './data';
const HEADSHOTS_DIR = path.join(DATA_DIR, 'headshots');
const PITCHERS_FILE = path.join(DATA_DIR, 'pitchers.json');
const STATUS_FILE = './scrape_retry_status.json';
const LOG_FILE = './scrape_retry.log';

// Failed teams to retry
const RETRY_TEAMS = {
  // Completely missing (15)
  'Duke':             { id: '93',  slug: 'duke',              conference: 'ACC', url: 'https://goduke.com/sports/baseball/roster' },
  'Georgia Tech':     { id: '77',  slug: 'georgia-tech',      conference: 'ACC', url: 'https://ramblinwreck.com/sports/baseball/roster' },
  'Miami':            { id: '176', slug: 'miami',             conference: 'ACC', url: 'https://miamihurricanes.com/sports/baseball/roster' },
  'Notre Dame':       { id: '81',  slug: 'notre-dame',        conference: 'ACC', url: 'https://und.com/sports/baseball/roster' },
  'SMU':              { id: '433', slug: 'smu',               conference: 'ACC', url: 'https://smumustangs.com/sports/baseball/roster' },
  'Stanford':         { id: '64',  slug: 'stanford',          conference: 'ACC', url: 'https://gostanford.com/sports/baseball/roster' },
  'Virginia Tech':    { id: '132', slug: 'virginia-tech',     conference: 'ACC', url: 'https://hokiesports.com/sports/baseball/roster' },
  'Arizona':          { id: '60',  slug: 'arizona',           conference: 'Big 12', url: 'https://arizonawildcats.com/sports/baseball/roster' },
  'Arizona State':    { id: '59',  slug: 'arizona-state',     conference: 'Big 12', url: 'https://thesundevils.com/sports/baseball/roster' },
  'BYU':              { id: '127', slug: 'byu',               conference: 'Big 12', url: 'https://byucougars.com/sports/baseball/roster' },
  'Cincinnati':       { id: '161', slug: 'cincinnati',        conference: 'Big 12', url: 'https://gobearcats.com/sports/baseball/roster' },
  'Colorado':         { id: '334', slug: 'colorado',          conference: 'Big 12', url: 'https://cubuffs.com/sports/baseball/roster' },
  'UCF':              { id: '160', slug: 'ucf',               conference: 'Big 12', url: 'https://ucfknights.com/sports/baseball/roster' },
  'Iowa':             { id: '167', slug: 'iowa',              conference: 'Big Ten', url: 'https://hawkeyesports.com/sports/baseball/roster' },
  'Nebraska':         { id: '99',  slug: 'nebraska',          conference: 'Big Ten', url: 'https://huskers.com/sports/baseball/roster' },
  'Oregon':           { id: '273', slug: 'oregon',            conference: 'Big Ten', url: 'https://goducks.com/sports/baseball/roster' },
  'Penn State':       { id: '414', slug: 'penn-state',        conference: 'Big Ten', url: 'https://gopsusports.com/sports/baseball/roster' },
  'Purdue':           { id: '189', slug: 'purdue',            conference: 'Big Ten', url: 'https://purduesports.com/sports/baseball/roster' },
  'Wisconsin':        { id: '464', slug: 'wisconsin',         conference: 'Big Ten', url: 'https://uwbadgers.com/sports/baseball/roster' },
  // Have pitchers but no headshots (3)
  'Clemson':          { id: '117', slug: 'clemson',           conference: 'ACC', url: 'https://clemsontigers.com/sports/baseball/roster' },
  'Virginia':         { id: '131', slug: 'virginia',          conference: 'ACC', url: 'https://virginiasports.com/sports/baseball/roster' },
  'Washington State': { id: '134', slug: 'washington-state',  conference: 'Pac-12', url: 'https://wsucougars.com/sports/baseball/roster' },
};

if (!fs.existsSync(HEADSHOTS_DIR)) fs.mkdirSync(HEADSHOTS_DIR, { recursive: true });

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

function downloadImage(url, filepath) {
  return new Promise((resolve) => {
    if (!url || url.includes('placeholder') || url.includes('no_headshot') || url.startsWith('data:')) {
      resolve(null); return;
    }
    if (url.startsWith('//')) url = 'https:' + url;
    const client = url.startsWith('https') ? https : http;
    const timeout = setTimeout(() => resolve(null), 15000);
    client.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36', 'Accept': 'image/*' }
    }, (res) => {
      clearTimeout(timeout);
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        downloadImage(res.headers.location, filepath).then(resolve); return;
      }
      if (res.statusCode !== 200) { resolve(null); return; }
      const fileStream = fs.createWriteStream(filepath);
      res.pipe(fileStream);
      fileStream.on('finish', () => { fileStream.close(); resolve(filepath); });
      fileStream.on('error', () => resolve(null));
    }).on('error', () => { clearTimeout(timeout); resolve(null); });
  });
}

async function scrollPage(page) {
  await page.evaluate(async () => {
    await new Promise(resolve => {
      let totalHeight = 0;
      const timer = setInterval(() => {
        window.scrollBy(0, 400);
        totalHeight += 400;
        if (totalHeight >= document.body.scrollHeight + 2000) { clearInterval(timer); resolve(); }
      }, 100);
    });
  });
  await new Promise(r => setTimeout(r, 4000));
}


async function scrapeTeam(page, teamName, teamInfo) {
  log(`📸 Scraping ${teamName}...`);
  
  try {
    await page.goto(teamInfo.url, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(r => setTimeout(r, 4000));
    await scrollPage(page);
    
    // Save debug HTML
    const html = await page.content();
    fs.writeFileSync(`debug_${teamInfo.slug}_retry.html`, html);
    
    const baseUrl = new URL(teamInfo.url).origin;
    
    const players = await page.evaluate((baseUrl) => {
      const results = [];
      
      // ENHANCED: More comprehensive selectors
      const cardSelectors = [
        // Vue/Nuxt SIDEARM
        '.s-person-card',
        '[data-test-id="s-person-card"]',
        // Traditional SIDEARM
        '.sidearm-roster-player',
        '.sidearm-roster-player-container',
        // Generic roster patterns
        '.roster-player',
        '.roster__player',
        '.roster-card',
        '.roster-card-item',
        '.player-card',
        '.player',
        // Table rows
        'table.sidearm-table tbody tr',
        '.roster-table tbody tr',
        'table tbody tr',
        // List items
        '.roster-list li',
        '.roster ul li',
        '[class*="roster"] li',
        // Flex/grid items
        '[class*="roster"] > div',
        '.roster-grid > div',
        // Links to player pages
        'a[href*="/roster/"]'
      ];
      
      let playerCards = [];
      for (const sel of cardSelectors) {
        const cards = document.querySelectorAll(sel);
        if (cards.length >= 5) { // Need at least 5 to be a roster
          playerCards = Array.from(cards);
          console.log('Found cards with:', sel, cards.length);
          break;
        }
      }
      
      // If still nothing, try getting all links to player pages
      if (playerCards.length < 5) {
        const links = document.querySelectorAll('a[href*="/roster/"], a[href*="/player/"], a[href*="bio"]');
        if (links.length > 0) playerCards = Array.from(links);
      }
      
      playerCards.forEach(card => {
        // Get all text content for analysis
        const fullText = card.textContent || '';
        
        // Check if this is a pitcher
        const isPitcherText = /\b(RHP|LHP|RHSP|LHSP|P)\b/i.test(fullText);
        if (!isPitcherText) return;
        
        // Extract name - multiple strategies
        let name = '';
        const nameSelectors = [
          'h3', 'h4', 'h2',
          '.s-person-details__personal-single-line',
          '.sidearm-roster-player-name',
          '[class*="name"]',
          'a[href*="/roster/"]',
          'a[href*="/player/"]',
          'td:nth-child(2)',
          'span'
        ];
        for (const sel of nameSelectors) {
          const el = card.querySelector(sel);
          const text = (el?.textContent || '').trim();
          // Name should be 2+ words, not just a number or position
          if (text && text.split(/\s+/).length >= 2 && !/^\d+$/.test(text) && !/^(RHP|LHP|P)$/i.test(text)) {
            name = text.split('\n')[0].trim();
            break;
          }
        }
        
        // Try card's own text if still no name
        if (!name) {
          const lines = fullText.split('\n').map(l => l.trim()).filter(l => l);
          for (const line of lines) {
            if (line.split(/\s+/).length >= 2 && !/^\d+$/.test(line) && !/^(RHP|LHP|P|Fr\.|So\.|Jr\.|Sr\.)$/i.test(line)) {
              name = line;
              break;
            }
          }
        }
        
        if (!name) return;
        
        // Extract position
        let position = '';
        const posMatch = fullText.match(/\b(RHP|LHP|RHSP|LHSP)\b/i);
        if (posMatch) position = posMatch[1].toUpperCase();
        
        // Extract number
        let number = '';
        const numMatch = fullText.match(/(?:^|\s|#)(\d{1,2})(?:\s|$)/);
        if (numMatch) number = numMatch[1];
        
        // Extract year
        let year = '';
        const yearMatch = fullText.match(/\b(Fr\.|So\.|Jr\.|Sr\.|Freshman|Sophomore|Junior|Senior|R-Fr\.|R-So\.|R-Jr\.|R-Sr\.|Graduate)\b/i);
        if (yearMatch) year = yearMatch[0];
        
        // Extract headshot
        let headshot = '';
        const imgs = card.querySelectorAll('img');
        for (const img of imgs) {
          let src = img.getAttribute('data-src') || img.getAttribute('src') || '';
          if (src && !src.includes('logo') && !src.includes('placeholder') && !src.startsWith('data:')) {
            if (src.startsWith('//')) src = 'https:' + src;
            else if (src.startsWith('/')) src = baseUrl + src;
            headshot = src;
            break;
          }
        }
        
        // Also check background images
        if (!headshot) {
          const bgEl = card.querySelector('[style*="background"]');
          if (bgEl) {
            const bgMatch = bgEl.style.backgroundImage?.match(/url\(['"]?([^'"]+)['"]?\)/);
            if (bgMatch) {
              let src = bgMatch[1];
              if (src.startsWith('//')) src = 'https:' + src;
              else if (src.startsWith('/')) src = baseUrl + src;
              headshot = src;
            }
          }
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


async function main() {
  let pitchersData = JSON.parse(fs.readFileSync(PITCHERS_FILE, 'utf8'));
  const teamsToScrape = Object.entries(RETRY_TEAMS);
  
  fs.writeFileSync(LOG_FILE, '');
  updateStatus({
    status: 'running',
    startTime: new Date().toISOString(),
    totalTeams: teamsToScrape.length,
    completed: 0,
    currentTeam: '',
    totalPitchers: 0,
    totalHeadshots: 0,
    errors: [],
    successes: []
  });
  
  log(`🔄 Retry Scraper - ${teamsToScrape.length} failed teams`);
  
  const browser = await puppeteer.launch({ 
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
  await page.setViewport({ width: 1920, height: 1080 });
  
  let totalPitchers = 0, totalHeadshots = 0, completed = 0;
  let errors = [], successes = [];
  
  for (const [teamName, teamInfo] of teamsToScrape) {
    updateStatus({ currentTeam: teamName, completed, progress: `${completed}/${teamsToScrape.length}` });
    
    const players = await scrapeTeam(page, teamName, teamInfo);
    
    if (players.length === 0) {
      errors.push(teamName);
      updateStatus({ errors });
      completed++;
      await new Promise(r => setTimeout(r, 2000));
      continue;
    }
    
    successes.push(teamName);
    
    // Find or create team entry
    let teamEntry = pitchersData.teams.find(t => t.team === teamName || t.slug === teamInfo.slug);
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
          totalHeadshots++;
        }
      }
      
      const existingIdx = teamEntry.pitchers.findIndex(ep => ep.name.toLowerCase() === p.name.toLowerCase());
      const pitcherData = {
        id: pitcherId,
        name: p.name,
        number: p.number || '',
        position: p.position || 'P',
        year: p.year || '',
        headshot: localHeadshot
      };
      
      if (existingIdx >= 0) {
        if (!localHeadshot && teamEntry.pitchers[existingIdx].headshot) {
          pitcherData.headshot = teamEntry.pitchers[existingIdx].headshot;
        }
        teamEntry.pitchers[existingIdx] = pitcherData;
      } else {
        teamEntry.pitchers.push(pitcherData);
      }
      totalPitchers++;
    }
    
    log(`   ✅ ${players.length} pitchers, ${totalHeadshots} headshots`);
    completed++;
    updateStatus({ completed, totalPitchers, totalHeadshots, successes, progress: `${completed}/${teamsToScrape.length}` });
    
    await new Promise(r => setTimeout(r, 2000));
  }
  
  await browser.close();
  fs.writeFileSync(PITCHERS_FILE, JSON.stringify(pitchersData, null, 2));
  
  updateStatus({
    status: 'complete',
    endTime: new Date().toISOString(),
    completed,
    totalPitchers,
    totalHeadshots,
    progress: '100%',
    successes,
    errors
  });
  
  log(`✨ Complete! Pitchers: ${totalPitchers}, Headshots: ${totalHeadshots}`);
  log(`   Successes: ${successes.length} | Errors: ${errors.length}`);
  if (errors.length > 0) log(`   Still failed: ${errors.join(', ')}`);
}

main().catch(console.error);
