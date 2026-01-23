#!/usr/bin/env node

/**
 * SEC Missing Headshots Scraper
 * Scrapes headshots for SEC teams missing from data/headshots/
 * Run: node scrape-sec-missing-headshots.mjs
 */

import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';

const DATA_DIR = './data';
const HEADSHOTS_DIR = path.join(DATA_DIR, 'headshots');
const PITCHERS_FILE = path.join(DATA_DIR, 'pitchers.json');

// SEC teams MISSING headshots
const MISSING_TEAMS = {
  '333':  { name: 'Alabama', slug: 'alabama', url: 'https://rolltide.com/sports/baseball/roster' },
  '8':    { name: 'Arkansas', slug: 'arkansas', url: 'https://arkansasrazorbacks.com/sports/baseball/roster' },
  '96':   { name: 'Kentucky', slug: 'kentucky', url: 'https://ukathletics.com/sports/baseball/roster' },
  '2579': { name: 'South Carolina', slug: 'south-carolina', url: 'https://gamecocksonline.com/sports/baseball/roster' },
  '245':  { name: 'Texas A&M', slug: 'texas-am', url: 'https://12thman.com/sports/baseball/roster' },
  '238':  { name: 'Vanderbilt', slug: 'vanderbilt', url: 'https://vucommodores.com/sports/baseball/roster' }
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

// Scrape roster page for pitchers
async function scrapeTeamHeadshots(page, teamId, teamInfo) {
  console.log(`\n📸 Scraping ${teamInfo.name} (${teamId})...`);
  console.log(`   URL: ${teamInfo.url}`);
  
  try {
    await page.goto(teamInfo.url, { 
      waitUntil: 'networkidle2', 
      timeout: 60000 
    });
    
    await new Promise(r => setTimeout(r, 3000));
    await scrollPage(page);
    
    const players = await page.evaluate((baseUrl) => {
      const results = [];
      
      // Multiple selector strategies
      const cardSelectors = [
        '.sidearm-roster-player',
        '.s-person-card',
        '.roster-player',
        '.player-card',
        '[class*="roster"][class*="player"]',
        '.roster__item',
        '.roster-item',
        '.c-roster__item'
      ];
      
      let playerCards = [];
      for (const sel of cardSelectors) {
        const cards = document.querySelectorAll(sel);
        if (cards.length > 0) {
          playerCards = [...cards];
          break;
        }
      }
      
      // Fallback
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
        const nameSelectors = [
          'a[href*="/roster/"]',
          '.sidearm-roster-player-name a',
          '.s-person-details__personal-single-line a',
          '[class*="name"] a',
          '.player-name',
          'h3 a', 'h4 a', 'h5 a'
        ];
        for (const sel of nameSelectors) {
          const el = card.querySelector(sel);
          if (el?.textContent?.trim()) {
            name = el.textContent.trim();
            break;
          }
        }
        if (!name) return;
        
        // Get position
        let position = '';
        const posSelectors = [
          '.sidearm-roster-player-position',
          '.s-person-details__bio-container span',
          '[class*="position"]',
          '.player-position'
        ];
        for (const sel of posSelectors) {
          const el = card.querySelector(sel);
          const text = el?.textContent?.trim() || '';
          if (/\b(P|RHP|LHP|RHSP|LHSP|Pitcher|SP|RP)\b/i.test(text)) {
            position = text;
            break;
          }
        }
        
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
          '.sidearm-roster-player-jersey-number',
          '.s-person-card__number',
          '[class*="number"]',
          '[class*="jersey"]'
        ];
        for (const sel of numSelectors) {
          const el = card.querySelector(sel);
          const text = el?.textContent?.trim().replace(/[#\s]/g, '') || '';
          if (/^\d+$/.test(text)) {
            number = text;
            break;
          }
        }
        
        // Get headshot
        let headshot = '';
        
        // Strategy 1: Direct img
        const imgSelectors = [
          '.sidearm-roster-player-image img',
          '.s-person-card__header img',
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
        
        // Strategy 2: Background image
        if (!headshot) {
          const bgEls = card.querySelectorAll('[style*="background"]');
          for (const el of bgEls) {
            const match = el.style.backgroundImage?.match(/url\(['"]?([^'")\s]+)['"]?\)/);
            if (match && !match[1].includes('placeholder') && !match[1].startsWith('data:')) {
              headshot = match[1];
              break;
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
        
        // Filter placeholders
        const badPatterns = ['placeholder', 'no-photo', 'blank', 'default', 'silhouette', 'avatar', 'generic'];
        if (headshot && badPatterns.some(p => headshot.toLowerCase().includes(p))) {
          headshot = '';
        }
        
        results.push({ name, number, position, headshot });
      });
      
      return results;
    }, teamInfo.url);
    
    console.log(`   Found ${players.length} pitchers`);
    if (players.length > 0) {
      console.log(`   Sample:`);
      players.slice(0, 3).forEach(p => {
        console.log(`     - ${p.name} #${p.number} (${p.position}): ${p.headshot ? '✅' : '❌'}`);
      });
    }
    
    return players;
    
  } catch (err) {
    console.log(`   ❌ Error: ${err.message}`);
    try {
      const html = await page.content();
      fs.writeFileSync(`debug_${teamInfo.slug}_roster.html`, html);
      console.log(`   Saved debug HTML to debug_${teamInfo.slug}_roster.html`);
    } catch (e) {}
    return [];
  }
}

// Match scraped pitchers to pitchers.json
function matchPitchers(scrapedPlayers, existingPitchers, teamId) {
  const matches = [];
  
  for (const scraped of scrapedPlayers) {
    if (!scraped.headshot) continue;
    
    // Try to find matching pitcher in pitchers.json
    let match = null;
    
    // Match by number first (most reliable)
    if (scraped.number) {
      match = existingPitchers.find(p => p.number === scraped.number);
    }
    
    // If no match, try by name
    if (!match && scraped.name) {
      const scrapedName = scraped.name.toLowerCase().replace(/[^a-z]/g, '');
      match = existingPitchers.find(p => {
        const existingName = p.name.toLowerCase().replace(/[^a-z]/g, '');
        return existingName === scrapedName || 
               existingName.includes(scrapedName) ||
               scrapedName.includes(existingName);
      });
    }
    
    if (match) {
      matches.push({
        pitcher: match,
        headshot: scraped.headshot,
        number: scraped.number
      });
    }
  }
  
  return matches;
}

// Main function
async function main() {
  console.log('🏀 SEC Missing Headshots Scraper');
  console.log('================================\n');
  
  // Load pitchers.json
  let pitchersData = {};
  try {
    pitchersData = JSON.parse(fs.readFileSync(PITCHERS_FILE, 'utf8'));
  } catch (err) {
    console.log('❌ Could not load pitchers.json');
    process.exit(1);
  }
  
  const browser = await puppeteer.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  
  let totalDownloaded = 0;
  let totalMatched = 0;
  
  for (const [teamId, teamInfo] of Object.entries(MISSING_TEAMS)) {
    try {
      // Scrape team roster page
      const scrapedPlayers = await scrapeTeamHeadshots(page, teamId, teamInfo);
      
      if (scrapedPlayers.length === 0) {
        console.log(`   ⚠️  No pitchers found\n`);
        continue;
      }
      
      // Get existing pitchers for this team
      const teamData = pitchersData[teamId];
      if (!teamData || !teamData.pitchers) {
        console.log(`   ⚠️  No team data in pitchers.json\n`);
        continue;
      }
      
      // Match scraped players to existing pitchers
      const matches = matchPitchers(scrapedPlayers, teamData.pitchers, teamId);
      console.log(`   Matched ${matches.length} pitchers with headshots`);
      
      // Download headshots
      let downloaded = 0;
      for (const match of matches) {
        const filename = `${teamInfo.slug}_${teamId}-P${match.number || match.pitcher.id.split('-P')[1]}.${match.headshot.endsWith('.png') ? 'png' : 'jpg'}`;
        const filepath = path.join(HEADSHOTS_DIR, filename);
        
        console.log(`   Downloading: ${match.pitcher.name} → ${filename}`);
        const result = await downloadImage(match.headshot, filepath);
        
        if (result) {
          // Update pitcher data
          match.pitcher.headshot = `data/headshots/${filename}`;
          match.pitcher.headshotUrl = match.headshot;
          downloaded++;
        }
      }
      
      console.log(`   ✅ Downloaded ${downloaded} headshots\n`);
      totalDownloaded += downloaded;
      totalMatched += matches.length;
      
    } catch (err) {
      console.log(`   ❌ Failed: ${err.message}\n`);
    }
  }
  
  await browser.close();
  
  // Save updated pitchers.json
  if (totalDownloaded > 0) {
    fs.writeFileSync(PITCHERS_FILE, JSON.stringify(pitchersData, null, 2));
    console.log(`\n✅ Updated pitchers.json with ${totalDownloaded} new headshots`);
  }
  
  console.log(`\n📊 Summary:`);
  console.log(`   Teams processed: ${Object.keys(MISSING_TEAMS).length}`);
  console.log(`   Pitchers matched: ${totalMatched}`);
  console.log(`   Headshots downloaded: ${totalDownloaded}`);
}

main().catch(console.error);
