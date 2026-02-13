#!/usr/bin/env node

/**
 * Missing Headshots Scraper
 * Scrapes headshots for teams missing pitcher photos
 * Run: node scrape-missing-headshots.mjs
 */

import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';

const DATA_DIR = './data';
const HEADSHOTS_DIR = path.join(DATA_DIR, 'headshots');
const PITCHERS_FILE = path.join(DATA_DIR, 'pitchers.json');

// Teams with missing headshots and their roster URLs
const TEAMS_TO_SCRAPE = {
  'Nebraska':                   { url: 'https://huskers.com/sports/baseball/roster', slug: 'nebraska' },
  'Iowa':                       { url: 'https://hawkeyesports.com/sports/baseball/roster', slug: 'iowa' },
  'Purdue Boilermakers':        { url: 'https://purduesports.com/sports/baseball/roster', slug: 'purdue' },
  'Penn State Nittany Lions':   { url: 'https://gopsusports.com/sports/baseball/roster', slug: 'penn-state' },
  'Clemson':                    { url: 'https://clemsontigers.com/sports/baseball/roster', slug: 'clemson' },
  'California Golden Bears':    { url: 'https://calbears.com/sports/baseball/roster', slug: 'california' },
  'Stanford Cardinal':          { url: 'https://gostanford.com/sports/baseball/roster', slug: 'stanford' },
  'Cincinnati Bearcats':        { url: 'https://gobearcats.com/sports/baseball/roster', slug: 'cincinnati' },
  'LSU':                        { url: 'https://lsusports.net/sports/baseball/roster', slug: 'lsu' },
  'Illinois':                   { url: 'https://fightingillini.com/sports/baseball/roster', slug: 'illinois' },
  'Maryland':                   { url: 'https://umterps.com/sports/baseball/roster', slug: 'maryland' },
  'UCLA':                       { url: 'https://uclabruins.com/sports/baseball/roster', slug: 'ucla' },
  'Arizona State':              { url: 'https://thesundevils.com/sports/baseball/roster', slug: 'arizona-state' },
  'Virginia Tech':              { url: 'https://hokiesports.com/sports/baseball/roster', slug: 'virginia-tech' },
  'Utah':                       { url: 'https://utahutes.com/sports/baseball/roster', slug: 'utah' },
  'Washington State':           { url: 'https://wsucougars.com/sports/baseball/roster', slug: 'washington-state' },
  'Georgia Tech Yellow Jackets':{ url: 'https://ramblinwreck.com/sports/baseball/roster', slug: 'georgia-tech' },
  'Arizona Wildcats':           { url: 'https://arizonawildcats.com/sports/baseball/roster', slug: 'arizona' },
  'Duke':                       { url: 'https://goduke.com/sports/baseball/roster', slug: 'duke' },
  'Miami':                      { url: 'https://miamihurricanes.com/sports/baseball/roster', slug: 'miami' },
  'USC':                        { url: 'https://usctrojans.com/sports/baseball/roster', slug: 'usc' },
  'Indiana':                    { url: 'https://iuhoosiers.com/sports/baseball/roster', slug: 'indiana' },
  'Notre Dame':                 { url: 'https://und.com/sports/baseball/roster', slug: 'notre-dame' },
  'Wake Forest':                { url: 'https://godeacs.com/sports/baseball/roster', slug: 'wake-forest' },
  'Oregon':                     { url: 'https://goducks.com/sports/baseball/roster', slug: 'oregon' },
  'Arkansas':                   { url: 'https://arkansasrazorbacks.com/sports/baseball/roster', slug: 'arkansas' },
  'Kentucky':                   { url: 'https://ukathletics.com/sports/baseball/roster', slug: 'kentucky' },
  'Kansas':                     { url: 'https://kuathletics.com/sports/baseball/roster', slug: 'kansas' },
  'Texas Tech':                 { url: 'https://texastech.com/sports/baseball/roster', slug: 'texas-tech' },
  'BYU':                        { url: 'https://byucougars.com/sports/baseball/roster', slug: 'byu' },
};

if (!fs.existsSync(HEADSHOTS_DIR)) {
  fs.mkdirSync(HEADSHOTS_DIR, { recursive: true });
}

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

async function scrapeTeamHeadshots(page, teamName, teamInfo) {
  console.log(`\n📋 ${teamName}`);
  console.log(`   URL: ${teamInfo.url}`);

  try {
    await page.goto(teamInfo.url, { waitUntil: 'networkidle2', timeout: 45000 });
    await scrollPage(page);

    const players = await page.evaluate((baseUrl) => {
      const results = [];

      // Strategy 1: Sidearm roster format (most common)
      let cards = document.querySelectorAll(
        '.sidearm-roster-player, .roster-player, [class*="roster"][class*="player"], ' +
        '.s-person-card, .roster__player, .roster-card, tr.roster_row, ' +
        '[class*="roster-"] .person, [data-bind*="roster"]'
      );

      // Strategy 2: If no cards found, try table rows
      if (cards.length === 0) {
        cards = document.querySelectorAll('table.roster tbody tr, .roster-table tr');
      }

      // Strategy 3: Generic player cards
      if (cards.length === 0) {
        cards = document.querySelectorAll('[class*="player-card"], [class*="playerCard"], .card');
      }

      cards.forEach(card => {
        // Find name
        const nameEl = card.querySelector(
          '.sidearm-roster-player-name a, .sidearm-roster-player-name, ' +
          '.player-name, [class*="name"] a, [class*="player-name"], ' +
          'td.name a, .s-person-details__personal-single-line a, ' +
          '.roster__player-name a, h3 a, .card-title a'
        );

        // Find number
        const numberEl = card.querySelector(
          '.sidearm-roster-player-jersey-number, .jersey, [class*="jersey"], ' +
          '.sidearm-roster-player-other span:first-child, td.jersey, .s-stamp, ' +
          '.roster__player-number'
        );

        // Find position
        const posEl = card.querySelector(
          '.sidearm-roster-player-position, .position, [class*="position"], ' +
          'td.position, .s-person-details__bio-stats-item:first-child, ' +
          '.roster__player-position, .roster-position'
        );

        let name = nameEl?.textContent?.trim() || '';
        const number = numberEl?.textContent?.trim().replace('#', '') || '';
        let position = posEl?.textContent?.trim() || '';

        // If position is in the card text, try to extract it
        if (!position) {
          const allText = card.textContent || '';
          const posMatch = allText.match(/\b(RHP|LHP|P|PITCHER)\b/i);
          if (posMatch) position = posMatch[1].toUpperCase();
        }

        if (!name) return;

        // Clean up name (sometimes "Last, First" format)
        name = name.replace(/\s+/g, ' ').trim();

        // Only pitchers
        const posUpper = position.toUpperCase().trim();
        const isPitcher = ['P', 'RHP', 'LHP', 'PITCHER', 'SP', 'RP', 'CL'].some(p =>
          posUpper === p || posUpper.includes('RHP') || posUpper.includes('LHP')
        );
        if (!isPitcher && position) return;
        // If no position found, skip (we can't identify pitchers)
        if (!position) return;

        let headshot = '';

        // Strategy 1: img tag
        const img = card.querySelector(
          'img.sidearm-roster-player-image, img[class*="player"], img[class*="roster"], ' +
          'img[class*="headshot"], .lazyload, img.s-person-card__header__image__img, ' +
          '.roster__player-photo img, img'
        );
        if (img) {
          headshot = img.src || img.dataset?.src || img.dataset?.lazySrc || img.getAttribute('data-src') || '';
          const badPatterns = ['placeholder', 'no-photo', 'blank', 'default', 'silhouette', 'avatar', 'generic', 'no_headshot', 'nophoto'];
          if (headshot && badPatterns.some(p => headshot.toLowerCase().includes(p))) headshot = '';
          if (headshot && headshot.startsWith('data:')) headshot = '';
        }

        // Strategy 2: background-image
        if (!headshot) {
          const elements = card.querySelectorAll('*');
          for (const el of elements) {
            const bg = window.getComputedStyle(el).backgroundImage;
            if (bg && bg !== 'none' && !bg.includes('gradient')) {
              const match = bg.match(/url\(["']?([^"')]+)["']?\)/);
              if (match && !match[1].includes('placeholder') && !match[1].includes('data:')) {
                headshot = match[1];
                break;
              }
            }
          }
        }

        // Strategy 3: data attributes
        if (!headshot) {
          const lazyEls = card.querySelectorAll('[data-background], [data-bg], [data-src], [data-lazy-src]');
          for (const el of lazyEls) {
            headshot = el.dataset?.background || el.dataset?.bg || el.dataset?.src || el.dataset?.lazySrc || '';
            if (headshot && !headshot.includes('placeholder')) break;
            headshot = '';
          }
        }

        // Make absolute URL
        if (headshot && !headshot.startsWith('http')) {
          if (headshot.startsWith('//')) {
            headshot = 'https:' + headshot;
          } else if (headshot.startsWith('/')) {
            try {
              const urlObj = new URL(baseUrl);
              headshot = urlObj.origin + headshot;
            } catch(e) {}
          }
        }

        results.push({ name, number, position: posUpper, headshot });
      });

      return results;
    }, teamInfo.url);

    console.log(`   Found ${players.length} pitchers`);
    const withPhotos = players.filter(p => p.headshot).length;
    console.log(`   With photos: ${withPhotos}/${players.length}`);
    players.slice(0, 3).forEach(p => {
      console.log(`     - ${p.name} #${p.number} (${p.position}): ${p.headshot ? '✅' : '❌'}`);
    });

    return players;
  } catch (err) {
    console.log(`   ❌ Error: ${err.message}`);
    return [];
  }
}

function normalizeName(name) {
  return name.toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function main() {
  console.log('🚀 Scraping headshots for teams with missing photos\n');

  // Load pitcher data
  const pitchersData = JSON.parse(fs.readFileSync(PITCHERS_FILE, 'utf8'));

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  let totalUpdated = 0;
  let totalDownloaded = 0;
  const teamResults = [];

  for (const [teamName, teamInfo] of Object.entries(TEAMS_TO_SCRAPE)) {
    const scrapedPlayers = await scrapeTeamHeadshots(page, teamName, teamInfo);

    // Find this team in pitchers data
    const pitcherTeam = pitchersData.teams.find(t => t.team === teamName);
    if (!pitcherTeam) {
      console.log(`   ⚠️  Team "${teamName}" not found in pitchers.json, skipping`);
      teamResults.push({ team: teamName, scraped: scrapedPlayers.length, matched: 0, downloaded: 0 });
      continue;
    }

    let matched = 0;
    let downloaded = 0;

    // Match scraped players to pitchers by name
    for (const pitcher of pitcherTeam.pitchers) {
      // Skip if already has a valid headshot file
      if (pitcher.headshot && pitcher.headshot.trim()) {
        const filename = pitcher.headshot.replace('data/headshots/', '');
        if (fs.existsSync(path.join(HEADSHOTS_DIR, filename))) continue;
      }

      const pName = normalizeName(pitcher.name);

      // Try to find matching scraped player
      const match = scrapedPlayers.find(sp => {
        const spName = normalizeName(sp.name);
        // Exact match
        if (spName === pName) return true;
        // Last name match with first initial
        const pParts = pName.split(' ');
        const spParts = spName.split(' ');
        if (pParts.length >= 2 && spParts.length >= 2) {
          // Same last name and first initial
          if (pParts[pParts.length-1] === spParts[spParts.length-1] && pParts[0][0] === spParts[0][0]) return true;
        }
        return false;
      });

      if (match && match.headshot) {
        matched++;
        // Download the headshot
        const safeSlug = teamInfo.slug.replace(/[^a-z0-9-]/g, '');
        const filename = `${safeSlug}_${pitcher.id}.jpg`;
        const filepath = path.join(HEADSHOTS_DIR, filename);

        const result = await downloadImage(match.headshot, filepath);
        if (result) {
          pitcher.headshot = `data/headshots/${filename}`;
          downloaded++;
          totalDownloaded++;
          totalUpdated++;
        }
      }
    }

    teamResults.push({ team: teamName, scraped: scrapedPlayers.length, matched, downloaded });
    console.log(`   Matched: ${matched}, Downloaded: ${downloaded}`);

    // Rate limit
    await new Promise(r => setTimeout(r, 2000));
  }

  await browser.close();

  // Save updated pitchers data
  fs.writeFileSync(PITCHERS_FILE, JSON.stringify(pitchersData, null, 2));

  console.log('\n\n========================================');
  console.log('📊 RESULTS SUMMARY');
  console.log('========================================');
  console.log(`Total headshots downloaded: ${totalDownloaded}`);
  console.log(`Total pitcher records updated: ${totalUpdated}`);
  console.log('');
  console.log('Team breakdown:');
  for (const r of teamResults) {
    const status = r.downloaded > 0 ? '✅' : (r.scraped > 0 ? '⚠️' : '❌');
    console.log(`  ${status} ${r.team}: scraped=${r.scraped} matched=${r.matched} downloaded=${r.downloaded}`);
  }
  console.log('\n✅ Done! Saved to pitchers.json');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
