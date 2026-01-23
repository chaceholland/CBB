#!/usr/bin/env node

/**
 * SEC Headshot Scraper v3
 * Fixed team IDs to match pitchers.json
 * Run: node scrape-sec-headshots-v3.mjs [team-name]
 */

import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';

const DATA_DIR = './data';
const HEADSHOTS_DIR = path.join(DATA_DIR, 'headshots');
const PITCHERS_FILE = path.join(DATA_DIR, 'pitchers.json');

// SEC teams with CORRECT IDs matching pitchers.json
const SEC_TEAMS = {
  '333':  { name: 'Alabama', slug: 'alabama', url: 'https://rolltide.com/sports/baseball/roster' },
  '8':    { name: 'Arkansas', slug: 'arkansas', url: 'https://arkansasrazorbacks.com/sports/baseball/roster' },
  '2':    { name: 'Auburn', slug: 'auburn', url: 'https://auburntigers.com/sports/baseball/roster' },
  '57':   { name: 'Florida', slug: 'florida', url: 'https://floridagators.com/sports/baseball/roster' },
  '61':   { name: 'Georgia', slug: 'georgia', url: 'https://georgiadogs.com/sports/baseball/roster' },
  '96':   { name: 'Kentucky', slug: 'kentucky', url: 'https://ukathletics.com/sports/baseball/roster' },
  '99':   { name: 'LSU', slug: 'lsu', url: 'https://lsusports.net/sports/baseball/roster' },
  '344':  { name: 'Mississippi State', slug: 'mississippi-state', url: 'https://hailstate.com/sports/baseball/roster' },
  '142':  { name: 'Missouri', slug: 'missouri', url: 'https://mutigers.com/sports/baseball/roster' },
  '201':  { name: 'Oklahoma', slug: 'oklahoma', url: 'https://soonersports.com/sports/baseball/roster' },
  '145':  { name: 'Ole Miss', slug: 'ole-miss', url: 'https://olemisssports.com/sports/baseball/roster' },
  '2579': { name: 'South Carolina', slug: 'south-carolina', url: 'https://gamecocksonline.com/sports/baseball/roster' },
  '2633': { name: 'Tennessee', slug: 'tennessee', url: 'https://utsports.com/sports/baseball/roster' },
  '245':  { name: 'Texas A&M', slug: 'texas-am', url: 'https://12thman.com/sports/baseball/roster' },
  '251':  { name: 'Texas', slug: 'texas', url: 'https://texassports.com/sports/baseball/roster' },
  '238':  { name: 'Vanderbilt', slug: 'vanderbilt', url: 'https://vucommodores.com/sports/baseball/roster' }
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
    
    // Handle relative URLs
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
  await new Promise(r => setTimeout(r, 4000)); // Wait for lazy images
}

// Scrape roster page for pitchers with headshots
async function scrapeTeamHeadshots(page, teamId, teamInfo) {
  console.log(`\n📸 Scraping ${teamInfo.name}...`);
  console.log(`   URL: ${teamInfo.url}`);
  
  try {
    await page.goto(teamInfo.url, { 
      waitUntil: 'networkidle2', 
      timeout: 60000 
    });
    
    // Wait for content and scroll
    await new Promise(r => setTimeout(r, 3000));
    await scrollPage(page);
    
    // Extract players based on site structure
    const players = await page.evaluate((baseUrl) => {
      const results = [];
      
      // Multiple selector strategies for different athletic sites
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
      
      // Fallback: find links to player profiles
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
        // Get name from various sources
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
        
        // Also check full card text for position if not found
        if (!position) {
          const cardText = card.textContent || '';
          const posMatch = cardText.match(/\b(RHP|LHP|RHSP|LHSP)\b/i);
          if (posMatch) position = posMatch[1];
        }
        
        // Check if pitcher
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
        
        // Get headshot - multiple strategies
        let headshot = '';
        
        // Strategy 1: Direct img in card
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
        
        // Strategy 3: data-background, data-src
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
    try {
      const html = await page.content();
      fs.writeFileSync(`debug_${teamInfo.slug}_roster.html`, html);
      console.log(`   Saved debug HTML to debug_${teamInfo.slug}_roster.html`);
    } catch (e) {}
    return [];
  }
}
