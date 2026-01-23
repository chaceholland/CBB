#!/usr/bin/env node

/**
 * All Teams Headshot Scraper
 * Scrapes headshots for all teams in pitchers.json
 * Run: node scrape-all-headshots.mjs
 */

import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';

const DATA_DIR = './data';
const HEADSHOTS_DIR = path.join(DATA_DIR, 'headshots');
const PITCHERS_FILE = path.join(DATA_DIR, 'pitchers.json');

// All teams with their roster URLs
const TEAMS = {
  '148':  { name: 'Alabama', slug: 'alabama', url: 'https://rolltide.com/sports/baseball/roster' },
  '58':   { name: 'Arkansas', slug: 'arkansas', url: 'https://arkansasrazorbacks.com/sports/baseball/roster' },
  '55':   { name: 'Auburn', slug: 'auburn', url: 'https://auburntigers.com/sports/baseball/roster' },
  '65':   { name: 'California Golden Bears', slug: 'california', url: 'https://calbears.com/sports/baseball/roster' },
  '75':   { name: 'Florida', slug: 'florida', url: 'https://floridagators.com/sports/baseball/roster' },
  '78':   { name: 'Georgia', slug: 'georgia', url: 'https://georgiadogs.com/sports/baseball/roster' },
  '82':   { name: 'Kentucky', slug: 'kentucky', url: 'https://ukathletics.com/sports/baseball/roster' },
  '85':   { name: 'LSU', slug: 'lsu', url: 'https://lsusports.net/sports/baseball/roster' },
  '150':  { name: 'Mississippi State', slug: 'mississippi-state', url: 'https://hailstate.com/sports/baseball/roster' },
  '91':   { name: 'Missouri', slug: 'missouri', url: 'https://mutigers.com/sports/baseball/roster' },
  '112':  { name: 'Oklahoma', slug: 'oklahoma', url: 'https://soonersports.com/sports/baseball/roster' },
  '92':   { name: 'Ole Miss', slug: 'ole-miss', url: 'https://olemisssports.com/sports/baseball/roster' },
  '193':  { name: 'South Carolina', slug: 'south-carolina', url: 'https://gamecocksonline.com/sports/baseball/roster' },
  '199':  { name: 'Tennessee', slug: 'tennessee', url: 'https://utsports.com/sports/baseball/roster' },
  '126':  { name: 'Texas', slug: 'texas', url: 'https://texassports.com/sports/baseball/roster' },
  '123':  { name: 'Texas A&M', slug: 'texas-am', url: 'https://12thman.com/sports/baseball/roster' },
  '120':  { name: 'Vanderbilt', slug: 'vanderbilt', url: 'https://vucommodores.com/sports/baseball/roster' }
};

// Ensure directories exist
if (!fs.existsSync(HEADSHOTS_DIR)) {
  fs.mkdirSync(HEADSHOTS_DIR, { recursive: true });
}

// Download image helper with retry
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
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
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

async function scrapeTeamHeadshots(page, teamId, teamInfo) {
  console.log(`\n📋 ${teamInfo.name} (ID: ${teamId})`);
  console.log(`   URL: ${teamInfo.url}`);
  
  try {
    await page.goto(teamInfo.url, { 
      waitUntil: 'networkidle2', 
      timeout: 45000 
    });
    
    await scrollPage(page);
    
    const players = await page.evaluate((baseUrl) => {
      const results = [];
      const cards = document.querySelectorAll('.sidearm-roster-player, .roster-player, [class*="roster"][class*="player"]');
      
      cards.forEach(card => {
        const nameEl = card.querySelector('.sidearm-roster-player-name, .player-name, [class*="name"]');
        const numberEl = card.querySelector('.sidearm-roster-player-jersey-number, .jersey, [class*="jersey"]');
        const posEl = card.querySelector('.sidearm-roster-player-position, .position, [class*="position"]');
        
        const name = nameEl?.textContent?.trim() || '';
        const number = numberEl?.textContent?.trim() || '';
        const position = posEl?.textContent?.trim() || '';
        
        if (!name || !position) return;
        
        // Only pitchers
        if (!['P', 'RHP', 'LHP', 'Pitcher'].includes(position.trim())) return;
        
        let headshot = '';
        
        // Strategy 1: img tag
        const img = card.querySelector('img.sidearm-roster-player-image, img[class*="player"], img[class*="roster"], img[class*="headshot"], img');
        if (img) {
          headshot = img.src || img.dataset?.src || img.dataset?.lazySrc || '';
          if (headshot && headshot.includes('placeholder')) headshot = '';
        }
        
        // Strategy 2: background-image
        if (!headshot) {
          const elements = card.querySelectorAll('*');
          for (const el of elements) {
            const bg = window.getComputedStyle(el).backgroundImage;
            if (bg && bg !== 'none' && !bg.includes('gradient')) {
              const match = bg.match(/url\(["']?([^"')]+)["']?\)/);
              if (match && !match[1].includes('placeholder')) {
                headshot = match[1];
                break;
              }
            }
          }
        }
        
        // Strategy 3: data attributes
        if (!headshot) {
          const lazyEls = card.querySelectorAll('[data-background], [data-bg], [data-src]');
          for (const el of lazyEls) {
            headshot = el.dataset?.background || el.dataset?.bg || el.dataset?.src || '';
            if (headshot && !headshot.includes('placeholder')) break;
            headshot = '';
          }
        }
        
        // Make absolute URL
        if (headshot && !headshot.startsWith('http')) {
          if (headshot.startsWith('//')) {
            headshot = 'https:' + headshot;
          } else if (headshot.startsWith('/')) {
            const urlObj = new URL(baseUrl);
            headshot = urlObj.origin + headshot;
          }
        }
        
        // Filter out placeholders
        const badPatterns = ['placeholder', 'no-photo', 'blank', 'default', 'silhouette', 'avatar', 'generic'];
        if (headshot && badPatterns.some(p => headshot.toLowerCase().includes(p))) {
          headshot = '';
        }
        
        results.push({ name, number, position, headshot });
      });
      
      return results;
    }, teamInfo.url);
    
    console.log(`   Found ${players.length} pitchers`);
    players.slice(0, 5).forEach(p => {
      console.log(`     - ${p.name} #${p.number} (${p.position}): ${p.headshot ? '✅' : '❌'}`);
    });
    
    return players;
    
  } catch (err) {
    console.log(`   ❌ Error: ${err.message}`);
    return [];
  }
}

async function main() {
  console.log('🚀 Starting headshot scraper for all teams...\n');
  
  // Load existing pitcher data
  let pitchersData;
  try {
    const rawData = fs.readFileSync(PITCHERS_FILE, 'utf8');
    pitchersData = JSON.parse(rawData);
  } catch (err) {
    console.error('❌ Could not load pitchers.json');
    process.exit(1);
  }
  
  const browser = await puppeteer.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  
  let totalUpdated = 0;
  
  for (const teamId of Object.keys(TEAMS)) {
    const teamInfo = TEAMS[teamId];
    const scrapedPlayers = await scrapeTeamHeadshots(page, teamId, teamInfo);
    
    // Find team in pitchers data
    const teamData = pitchersData.teams.find(t => String(t.teamId) === teamId || String(t.team_id) === teamId);
    
    if (!teamData) {
      console.log(`   ⚠️  Team ${teamId} not found in pitchers.json`);
      continue;
    }
    
    // Update headshots
    let updated = 0;
    for (const pitcher of teamData.pitchers) {
      const match = scrapedPlayers.find(p => 
        p.name.toLowerCase().includes(pitcher.name.toLowerCase()) ||
        pitcher.name.toLowerCase().includes(p.name.toLowerCase())
      );
      
      if (match && match.headshot) {
        pitcher.headshot = match.headshot;
        updated++;
      }
    }
    
    console.log(`   ✅ Updated ${updated} headshots for ${teamInfo.name}`);
    totalUpdated += updated;
    
    await new Promise(r => setTimeout(r, 2000));
  }
  
  // Save updated data
  fs.writeFileSync(PITCHERS_FILE, JSON.stringify(pitchersData, null, 2));
  console.log(`\n✅ Complete! Updated ${totalUpdated} total headshots`);
  console.log(`   Saved to ${PITCHERS_FILE}`);
  
  await browser.close();
}

main().catch(console.error);
