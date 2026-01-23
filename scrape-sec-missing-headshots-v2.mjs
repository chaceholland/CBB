#!/usr/bin/env node

/**
 * SEC Missing Headshots Scraper v2
 * Adds support for individual player pages (Arkansas & Vanderbilt)
 * Run: node scrape-sec-missing-headshots-v2.mjs
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
  '8':    { 
    name: 'Arkansas', 
    slug: 'arkansas', 
    url: 'https://arkansasrazorbacks.com/sports/baseball/roster',
    needsIndividualPages: true 
  },
  '238':  { 
    name: 'Vanderbilt', 
    slug: 'vanderbilt', 
    url: 'https://vucommodores.com/sports/baseball/roster',
    needsIndividualPages: true
  }
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

// Scrape individual player bio page for headshot
async function scrapePlayerBioPage(page, playerUrl, playerName) {
  console.log(`     → Visiting bio page: ${playerUrl}`);
  
  try {
    await page.goto(playerUrl, { 
      waitUntil: 'networkidle2', 
      timeout: 30000 
    });
    
    await new Promise(r => setTimeout(r, 2000));
    
    const headshot = await page.evaluate(() => {
      // Multiple selector strategies for player bio pages
      const imgSelectors = [
        '.sidearm-roster-player-image img',
        '.s-person-card__photo img',
        '.s-person-gallery__photo img',
        '.player-photo img',
        '.bio-photo img',
        'img[class*="headshot"]',
        'img[class*="player-image"]',
        'img[class*="bio"]',
        '.sidearm-roster-player-headshot img',
        '[class*="hero"] img',
        '[class*="profile"] img'
      ];
      
      for (const sel of imgSelectors) {
        const img = document.querySelector(sel);
        if (img) {
          const src = img.src || img.dataset?.src || img.getAttribute('data-src') || '';
          if (src && !src.includes('placeholder') && !src.startsWith('data:')) {
            return src;
          }
        }
      }
      
      // Check for background images
      const bgElements = document.querySelectorAll('[style*="background-image"]');
      for (const el of bgElements) {
        const match = el.style.backgroundImage?.match(/url\(['"]?([^'")\s]+)['"]?\)/);
        if (match && !match[1].includes('placeholder')) {
          return match[1];
        }
      }
      
      // Last resort: any img with "roster" or reasonable size
      const allImgs = document.querySelectorAll('img');
      for (const img of allImgs) {
        const src = img.src || '';
        if (src && 
            (src.includes('roster') || src.includes('player') || src.includes('bio')) &&
            !src.includes('placeholder') &&
            !src.includes('logo') &&
            !src.includes('icon')) {
          return src;
        }
      }
      
      return '';
    });
    
    if (headshot) {
      console.log(`     ✅ Found headshot: ${headshot.substring(0, 60)}...`);
      return headshot;
    } else {
      console.log(`     ❌ No headshot found on bio page`);
      return '';
    }
    
  } catch (err) {
    console.log(`     ❌ Error loading bio page: ${err.message}`);
    return '';
  }
}

// Scrape roster page - extracts player profile links
async function scrapeRosterForLinks(page, teamInfo) {
  console.log(`\n📸 Scraping ${teamInfo.name}...`);
  console.log(`   URL: ${teamInfo.url}`);
  
  try {
    await page.goto(teamInfo.url, { 
      waitUntil: 'networkidle2', 
      timeout: 60000 
    });
    
    await new Promise(r => setTimeout(r, 3000));
    await scrollPage(page);
    
    // Extract player links and basic info
    const playerLinks = await page.evaluate((baseUrl) => {
      const results = [];
      
      // Find all roster links
      const rosterLinks = document.querySelectorAll('a[href*="/roster/"]');
      
      rosterLinks.forEach(link => {
        const href = link.href;
        if (!href) return;
        
        // Find parent card/row
        const parent = link.closest('li, tr, div[class*="player"], div[class*="roster"], .s-person-card') || 
                      link.parentElement?.parentElement;
        
        if (!parent) return;
        
        // Get name from link text
        const name = link.textContent?.trim() || '';
        if (!name) return;
        
        // Check if pitcher by looking at parent card
        const cardText = parent.textContent || '';
        const isPitcher = /\b(P|RHP|LHP|RHSP|LHSP|SP|RP|Pitcher)\b/i.test(cardText);
        
        if (!isPitcher) return;
        
        // Get jersey number if available
        let number = '';
        const numSelectors = [
          '.sidearm-roster-player-jersey-number',
          '.s-person-card__number',
          '[class*="number"]',
          '[class*="jersey"]'
        ];
        for (const sel of numSelectors) {
          const el = parent.querySelector(sel);
          const text = el?.textContent?.trim().replace(/[#\s]/g, '') || '';
          if (/^\d+$/.test(text)) {
            number = text;
            break;
          }
        }
        
        // Extract position more carefully
        let position = '';
        const posSelectors = [
          '.sidearm-roster-player-position',
          '.s-person-details__bio-container span',
          '[class*="position"]',
          '.player-position'
        ];
        for (const sel of posSelectors) {
          const el = parent.querySelector(sel);
          const text = el?.textContent?.trim() || '';
          if (/\b(P|RHP|LHP|RHSP|LHSP|Pitcher|SP|RP)\b/i.test(text)) {
            position = text;
            break;
          }
        }
        if (!position) {
          const posMatch = cardText.match(/\b(RHP|LHP|RHSP|LHSP|P|Pitcher)\b/i);
          if (posMatch) position = posMatch[1];
        }
        
        results.push({ name, number, position, profileUrl: href });
      });
      
      // Remove duplicates based on profileUrl
      const unique = [];
      const seen = new Set();
      results.forEach(p => {
        if (!seen.has(p.profileUrl)) {
          seen.add(p.profileUrl);
          unique.push(p);
        }
      });
      
      return unique;
    }, teamInfo.url);
    
    console.log(`   Found ${playerLinks.length} pitcher profile links`);
    if (playerLinks.length > 0) {
      console.log(`   Sample:`);
      playerLinks.slice(0, 3).forEach(p => {
        console.log(`     - ${p.name} #${p.number || '??'} (${p.position})`);
      });
    }
    
    return playerLinks;
    
  } catch (err) {
    console.log(`   ❌ Error: ${err.message}`);
    try {
      const html = await page.content();
      fs.writeFileSync(`debug_${teamInfo.slug}_roster_v2.html`, html);
      console.log(`   Saved debug HTML to debug_${teamInfo.slug}_roster_v2.html`);
    } catch (e) {}
    return [];
  }
}

// Scrape team with individual player page visits
async function scrapeTeamWithBioPages(page, teamId, teamInfo) {
  // First get all pitcher profile links
  const playerLinks = await scrapeRosterForLinks(page, teamInfo);
  
  if (playerLinks.length === 0) {
    return [];
  }
  
  console.log(`\n   Visiting individual bio pages...`);
  const players = [];
  
  for (const player of playerLinks) {
    // Visit player bio page to get headshot
    const headshot = await scrapePlayerBioPage(page, player.profileUrl, player.name);
    
    players.push({
      name: player.name,
      number: player.number,
      position: player.position,
      headshot: headshot
    });
    
    // Small delay between requests
    await new Promise(r => setTimeout(r, 1000));
  }
  
  const withHeadshots = players.filter(p => p.headshot).length;
  console.log(`\n   ✅ Got headshots for ${withHeadshots}/${players.length} pitchers`);
  
  return players;
}

// Match scraped pitchers to pitchers.json
function matchPitchers(scrapedPlayers, existingPitchers, teamId) {
  const matches = [];
  
  for (const scraped of scrapedPlayers) {
    if (!scraped.headshot) continue;
    
    let match = null;
    
    // Match by number first
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
    } else {
      console.log(`   ⚠️  No match for: ${scraped.name} #${scraped.number}`);
    }
  }
  
  return matches;
}

// Main function
async function main() {
  console.log('🏀 SEC Missing Headshots Scraper v2');
  console.log('====================================\n');
  console.log('✨ Now with individual player page support!\n');
  
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
      console.log(`\n${'='.repeat(60)}`);
      
      // Scrape team - use bio page method for teams that need it
      const scrapedPlayers = await scrapeTeamWithBioPages(page, teamId, teamInfo);
      
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
        const pitcherNum = match.number || match.pitcher.id.split('-P')[1];
        const filename = `${teamInfo.slug}_${teamId}-P${pitcherNum}.${match.headshot.endsWith('.png') ? 'png' : 'jpg'}`;
        const filepath = path.join(HEADSHOTS_DIR, filename);
        
        console.log(`   Downloading: ${match.pitcher.name} → ${filename}`);
        const result = await downloadImage(match.headshot, filepath);
        
        if (result) {
          // Update pitcher data
          match.pitcher.headshot = `data/headshots/${filename}`;
          match.pitcher.headshotUrl = match.headshot;
          downloaded++;
        } else {
          console.log(`     ❌ Download failed`);
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
