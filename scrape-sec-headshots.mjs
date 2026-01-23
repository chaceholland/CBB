#!/usr/bin/env node

/**
 * SEC Headshot Scraper v2
 * More robust version with longer timeouts and better selectors
 */

import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';

const DATA_DIR = './data';
const HEADSHOTS_DIR = path.join(DATA_DIR, 'headshots');
const PITCHERS_FILE = path.join(DATA_DIR, 'pitchers.json');

// SEC team roster URLs
const SEC_TEAMS = {
  '148': { name: 'Alabama', url: 'https://rolltide.com/sports/baseball/roster' },
  '58':  { name: 'Arkansas', url: 'https://arkansasrazorbacks.com/sports/baseball/roster' },
  '55':  { name: 'Auburn', url: 'https://auburntigers.com/sports/baseball/roster' },
  '75':  { name: 'Florida', url: 'https://floridagators.com/sports/baseball/roster' },
  '78':  { name: 'Georgia', url: 'https://georgiadogs.com/sports/baseball/roster' },
  '82':  { name: 'Kentucky', url: 'https://ukathletics.com/sports/baseball/roster' },
  '85':  { name: 'LSU', url: 'https://lsusports.net/sports/baseball/roster' },
  '150': { name: 'Mississippi State', url: 'https://hailstate.com/sports/baseball/roster' },
  '91':  { name: 'Missouri', url: 'https://mutigers.com/sports/baseball/roster' },
  '112': { name: 'Oklahoma', url: 'https://soonersports.com/sports/baseball/roster' },
  '92':  { name: 'Ole Miss', url: 'https://olemisssports.com/sports/baseball/roster' },
  '193': { name: 'South Carolina', url: 'https://gamecocksonline.com/sports/baseball/roster' },
  '199': { name: 'Tennessee', url: 'https://utsports.com/sports/baseball/roster' },
  '123': { name: 'Texas A&M', url: 'https://12thman.com/sports/baseball/roster' },
  '126': { name: 'Texas', url: 'https://texassports.com/sports/baseball/roster' },
  '120': { name: 'Vanderbilt', url: 'https://vucommodores.com/sports/baseball/roster' }
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
    
    // Handle relative URLs
    if (url.startsWith('//')) url = 'https:' + url;
    
    const client = url.startsWith('https') ? https : http;
    const timeout = setTimeout(() => resolve(null), 10000);
    
    client.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' }
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
      const distance = 500;
      const timer = setInterval(() => {
        window.scrollBy(0, distance);
        totalHeight += distance;
        if (totalHeight >= document.body.scrollHeight + 1000) {
          clearInterval(timer);
          resolve();
        }
      }, 150);
    });
  });
  await new Promise(r => setTimeout(r, 3000)); // Wait for lazy images
}

// Scrape roster page for ALL players with headshots
async function scrapeTeamHeadshots(page, teamId, teamInfo) {
  console.log(`\n📸 ${teamInfo.name}...`);
  
  try {
    await page.goto(teamInfo.url, { 
      waitUntil: 'domcontentloaded', 
      timeout: 60000 
    });
    
    // Wait for content
    await new Promise(r => setTimeout(r, 3000));
    await scrollPage(page);
    
    // Extract all players with headshots
    const players = await page.evaluate((baseUrl) => {
      const results = [];
      
      // Find all image elements that could be headshots
      const allImages = document.querySelectorAll('img');
      const playerCards = document.querySelectorAll(
        '.sidearm-roster-player, .roster-card-item, .s-person-card, ' +
        '.roster-player, [class*="roster"][class*="player"], ' +
        '.player-card, .athlete-card'
      );
      
      playerCards.forEach(card => {
        // Get name
        const nameEl = card.querySelector('a[href*="/roster/"], .player-name, [class*="name"] a, h3 a, h4 a');
        let name = nameEl?.textContent?.trim() || '';
        
        // Try data attributes
        if (!name) {
          name = card.dataset?.name || card.getAttribute('data-player-name') || '';
        }
        
        if (!name) return;
        
        // Get position
        let position = '';
        const posEl = card.querySelector('[class*="position"], .player-position');
        position = posEl?.textContent?.trim() || '';
        
        // Check if pitcher
        const isPitcher = /\b(P|RHP|LHP|RHSP|LHSP|SP|RP|Pitcher)\b/i.test(position);
        
        // Get number
        const numEl = card.querySelector('[class*="number"], [class*="jersey"], .player-number');
        const number = numEl?.textContent?.trim().replace('#', '') || '';
        
        // Get headshot - multiple strategies
        let headshot = '';
        
        // Strategy 1: Direct img in card
        const img = card.querySelector('img');
        if (img) {
          headshot = img.src || img.dataset?.src || img.getAttribute('data-src') || '';
        }
        
        // Strategy 2: Background image
        if (!headshot || headshot.includes('data:image')) {
          const bgEls = card.querySelectorAll('[style*="background"]');
          for (const el of bgEls) {
            const match = el.style.backgroundImage?.match(/url\(['"]?([^'")\s]+)['"]?\)/);
            if (match && !match[1].includes('data:image')) {
              headshot = match[1];
              break;
            }
          }
        }
        
        // Strategy 3: data-background
        if (!headshot || headshot.includes('data:image')) {
          const lazyEl = card.querySelector('[data-background], [data-bg]');
          if (lazyEl) {
            headshot = lazyEl.dataset?.background || lazyEl.dataset?.bg || '';
          }
        }
        
        // Make absolute URL
        if (headshot && !headshot.startsWith('http') && !headshot.startsWith('data:')) {
          if (headshot.startsWith('//')) {
            headshot = 'https:' + headshot;
          } else if (headshot.startsWith('/')) {
            headshot = baseUrl + headshot;
          }
        }
        
        // Filter out placeholders
        if (headshot && (
          headshot.includes('placeholder') || 
          headshot.includes('no-photo') ||
          headshot.includes('blank') ||
          headshot.includes('default') ||
          headshot.startsWith('data:image')
        )) {
          headshot = '';
        }
        
        if (isPitcher) {
          results.push({ name, number, position, headshot, isPitcher: true });
        }
      });
      
      return results;
    }, teamInfo.url.replace(/\/sports\/.*/, ''));
    
    console.log(`   Found ${players.length} pitchers`);
    
    // Debug: show first few
    players.slice(0, 3).forEach(p => {
      console.log(`   - ${p.name} (${p.position}): ${p.headshot ? '✅' : '❌'}`);
    });
    
    return players;
    
  } catch (err) {
    console.log(`   ❌ ${err.message}`);
    // Save debug HTML
    try {
      const html = await page.content();
      const slug = teamInfo.name.toLowerCase().replace(/\s+/g, '-');
      fs.writeFileSync(`debug_${slug}_headshot.html`, html);
      console.log(`   Saved debug HTML`);
    } catch (e) {}
    return [];
  }
}

// Main
async function main() {
  console.log('⚾ SEC Headshot Scraper v2');
  console.log('='.repeat(40));
  
  // Get team filter from args
  const teamFilter = process.argv[2];
  
  // Load pitchers data
  let pitchersData = {};
  if (fs.existsSync(PITCHERS_FILE)) {
    pitchersData = JSON.parse(fs.readFileSync(PITCHERS_FILE, 'utf8'));
  }
  
  const browser = await puppeteer.launch({ 
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });
  
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  await page.setViewport({ width: 1440, height: 900 });
  
  let totalDownloaded = 0;
  let totalPitchers = 0;
  
  // Filter teams if specified
  let teamsToProcess = Object.entries(SEC_TEAMS);
  if (teamFilter) {
    teamsToProcess = teamsToProcess.filter(([id, info]) => 
      info.name.toLowerCase().includes(teamFilter.toLowerCase()) ||
      id === teamFilter
    );
  }
  
  for (const [teamId, teamInfo] of teamsToProcess) {
    const scrapedPlayers = await scrapeTeamHeadshots(page, teamId, teamInfo);
    
    // Match and download headshots
    if (pitchersData[teamId]?.pitchers) {
      for (const pitcher of pitchersData[teamId].pitchers) {
        totalPitchers++;
        
        // Find match by name or number
        const match = scrapedPlayers.find(p => {
          const nameMatch = p.name.toLowerCase().includes(pitcher.name.split(' ').pop().toLowerCase()) ||
                           pitcher.name.toLowerCase().includes(p.name.split(' ').pop().toLowerCase());
          const numMatch = p.number === pitcher.number;
          return nameMatch || numMatch;
        });
        
        if (match?.headshot) {
          const ext = match.headshot.match(/\.(png|jpg|jpeg|webp)/i)?.[1] || 'jpg';
          const safeId = pitcher.id.replace(/[^a-zA-Z0-9-]/g, '_');
          const filename = `${teamId}_${safeId}.${ext}`;
          const filepath = path.join(HEADSHOTS_DIR, filename);
          
          if (!fs.existsSync(filepath)) {
            const downloaded = await downloadImage(match.headshot, filepath);
            if (downloaded) {
              console.log(`   ✅ Downloaded: ${pitcher.name}`);
              totalDownloaded++;
              pitcher.headshot = `data/headshots/${filename}`;
            }
          } else {
            pitcher.headshot = `data/headshots/${filename}`;
            totalDownloaded++;
          }
        }
      }
    }
    
    await new Promise(r => setTimeout(r, 2000));
  }
  
  await browser.close();
  
  // Save updated pitchers
  fs.writeFileSync(PITCHERS_FILE, JSON.stringify(pitchersData, null, 2));
  
  console.log('\n' + '='.repeat(40));
  console.log(`📊 Pitchers: ${totalPitchers} | Headshots: ${totalDownloaded}`);
  console.log('✅ Done!');
}

main().catch(console.error);
