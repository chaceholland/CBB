/**
 * Enhanced College Baseball 2026 Team Website Scraper
 * 
 * Scrapes rosters with full player data:
 * - Headshots (URL + local download)
 * - Height, Weight, Age
 * - Hometown, High School
 * - College Year, Position
 * - Bio/Profile URL
 * 
 * Usage: node scrape-2026-enhanced.cjs [--rosters] [--team=NAME] [--debug] [--download-headshots]
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// SEC Teams with their athletic site URLs
const SEC_TEAMS = [
  { name: 'Alabama', id: '333', slug: 'alabama', 
    base: 'https://rolltide.com', roster: '/sports/baseball/roster' },
  { name: 'Arkansas', id: '8', slug: 'arkansas',
    base: 'https://arkansasrazorbacks.com', roster: '/sport/m-basebl/roster/' },
  { name: 'Auburn', id: '2', slug: 'auburn',
    base: 'https://auburntigers.com', roster: '/sports/baseball/roster' },
  { name: 'Florida', id: '57', slug: 'florida',
    base: 'https://floridagators.com', roster: '/sports/baseball/roster' },
  { name: 'Georgia', id: '61', slug: 'georgia',
    base: 'https://georgiadogs.com', roster: '/sports/baseball/roster' },
  { name: 'Kentucky', id: '96', slug: 'kentucky',
    base: 'https://ukathletics.com', roster: '/sports/baseball/roster' },
  { name: 'LSU', id: '99', slug: 'lsu',
    base: 'https://lsusports.net', roster: '/sports/baseball/roster' },
  { name: 'Mississippi State', id: '344', slug: 'mississippi-state',
    base: 'https://hailstate.com', roster: '/sports/baseball/roster' },
  { name: 'Missouri', id: '142', slug: 'missouri',
    base: 'https://mutigers.com', roster: '/sports/baseball/roster' },
  { name: 'Oklahoma', id: '201', slug: 'oklahoma',
    base: 'https://soonersports.com', roster: '/sports/baseball/roster' },
  { name: 'Ole Miss', id: '145', slug: 'ole-miss',
    base: 'https://olemisssports.com', roster: '/sports/baseball/roster' },
  { name: 'South Carolina', id: '2579', slug: 'south-carolina',
    base: 'https://gamecocksonline.com', roster: '/sports/baseball/roster' },
  { name: 'Tennessee', id: '2633', slug: 'tennessee',
    base: 'https://utsports.com', roster: '/sports/baseball/roster' },
  { name: 'Texas', id: '251', slug: 'texas',
    base: 'https://texaslonghorns.com', roster: '/sports/baseball/roster' },
  { name: 'Texas A&M', id: '245', slug: 'texas-am',
    base: 'https://12thman.com', roster: '/sports/baseball/roster' },
  { name: 'Vanderbilt', id: '238', slug: 'vanderbilt',
    base: 'https://vucommodores.com', roster: '/sports/baseball/roster' }
];

const DATA_DIR = path.join(__dirname, 'data');
const HEADSHOTS_DIR = path.join(DATA_DIR, 'headshots');

// Parse args
const args = process.argv.slice(2);
const DOWNLOAD_HEADSHOTS = args.includes('--download-headshots');
const DEBUG = args.includes('--debug');
const PITCHERS_ONLY = args.includes('--pitchers-only');
const teamFilter = args.find(a => a.startsWith('--team='))?.split('=')[1]?.toLowerCase();

// Ensure directories
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(HEADSHOTS_DIR)) fs.mkdirSync(HEADSHOTS_DIR, { recursive: true });

const delay = ms => new Promise(r => setTimeout(r, ms));


// Download image
function downloadImage(url, filepath) {
  return new Promise((resolve) => {
    if (!url || url.includes('placeholder') || url.includes('no_headshot')) {
      resolve(null);
      return;
    }
    
    // Skip data URIs and invalid URLs
    if (url.startsWith('data:')) {
      resolve(null);
      return;
    }
    
    // Make URL absolute if needed
    let fullUrl = url;
    if (url.startsWith('//')) fullUrl = 'https:' + url;
    else if (url.startsWith('/')) return resolve(null); // Relative URL without base
    
    const client = fullUrl.startsWith('https') ? https : http;
    const timeout = setTimeout(() => resolve(null), 30000);
    
    client.get(fullUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' }
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
      fileStream.on('error', () => { fs.unlink(filepath, () => {}); resolve(null); });
    }).on('error', () => { clearTimeout(timeout); resolve(null); });
  });
}

// Check if position is pitcher
function isPitcher(position) {
  if (!position) return false;
  const pos = position.trim().toUpperCase();
  const pitcherCodes = ['P', 'RHP', 'LHP', 'RHSP', 'LHSP', 'RHRP', 'LHRP', 'SP', 'RP', 'CL'];
  const pitcherNames = ['PITCHER', 'RIGHT HANDED PITCHER', 'LEFT HANDED PITCHER', 
                        'RIGHT-HANDED PITCHER', 'LEFT-HANDED PITCHER'];
  
  if (pitcherCodes.some(code => pos === code || pos.startsWith(code + '/') || pos.endsWith('/' + code))) {
    return true;
  }
  if (pitcherNames.some(name => pos === name || pos.includes(name))) {
    return true;
  }
  return false;
}


// Retry wrapper
async function withRetry(fn, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === retries) throw err;
      console.log(`   ⏳ Retry ${i + 1}/${retries}...`);
      await delay(Math.pow(2, i) * 2000);
    }
  }
}

/**
 * Fetch headshot from individual player bio page
 */
async function fetchHeadshotFromBio(browser, bioUrl, baseUrl) {
  if (!bioUrl) return '';
  
  let page;
  try {
    page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
    await page.goto(bioUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
    
    // Wait for lazy-loaded images - scroll to trigger lazy load
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await delay(2000); // Give more time for lazy images
    
    const headshot = await page.evaluate((baseUrl) => {
      // Common selectors for player bio headshots
      const selectors = [
        '.bio__aside img',  // South Carolina style
        '.s-person-details__image img',
        '.sidearm-roster-player-image img',
        '.player-bio__image img',
        '.roster-player__photo img',
        '.person-details__image img',
        '.player-image img',
        '.bio-image img',
        '.bio__image img',
        '[class*="player"] [class*="image"] img',
        '[class*="bio"] [class*="photo"] img',
        '[class*="bio"] img',
        'article img[src*="roster"]',
        'article img[src*="player"]',
        '.c-person-details__image img'
      ];
      
      for (const sel of selectors) {
        const img = document.querySelector(sel);
        if (img) {
          let src = img.getAttribute('data-src') || img.getAttribute('src') || '';
          // Skip placeholders
          if (src && !src.startsWith('data:') && !src.includes('placeholder')) {
            if (src.startsWith('/')) src = baseUrl + src;
            return src;
          }
        }
      }
      
      // Fallback: find any large image that looks like a headshot
      const imgs = document.querySelectorAll('img');
      for (const img of imgs) {
        const src = img.getAttribute('data-src') || img.getAttribute('src') || '';
        if (src && !src.startsWith('data:') && 
            (src.includes('headshot') || src.includes('roster') || src.includes('player')) &&
            !src.includes('logo') && !src.includes('icon')) {
          return src.startsWith('/') ? baseUrl + src : src;
        }
      }
      
      return '';
    }, baseUrl);
    
    await page.close();
    return headshot;
  } catch (err) {
    if (page) await page.close().catch(() => {});
    return '';
  }
}

/**
 * Check if a URL returns 200 OK
 */
async function checkUrl(browser, url) {
  let page;
  try {
    page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    const status = response.status();
    await page.close();
    return status === 200;
  } catch (err) {
    if (page) await page.close().catch(() => {});
    return false;
  }
}

/**
 * Enhanced roster scraper - extracts all player fields
 * Hybrid approach: tries /roster/2026 first, falls back to /roster
 */
async function scrapeRoster(browser, team) {
  // Try 2026 roster first, fall back to current roster
  const url2026 = team.base + team.roster + '/2026';
  const urlCurrent = team.base + team.roster;
  
  console.log(`\n📋 Scraping roster: ${team.name}`);
  
  // Check if 2026 roster exists
  let url = urlCurrent;
  let using2026 = false;
  
  console.log(`   🔍 Checking for 2026 roster...`);
  if (await checkUrl(browser, url2026)) {
    url = url2026;
    using2026 = true;
    console.log(`   ✅ Using 2026 roster`);
  } else {
    console.log(`   ⚠️  2026 roster not found, using current roster`);
  }
  
  console.log(`   URL: ${url}`);
  
  return withRetry(async () => {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
    
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await delay(3000);
      
      if (DEBUG) {
        const html = await page.content();
        fs.writeFileSync(`debug_${team.slug}_roster.html`, html);
        console.log(`   🔍 Debug HTML saved`);
      }
      
      // Extract roster with enhanced data
      const baseUrl = team.base;
      const roster = await page.evaluate((baseUrl) => {
        const players = [];
        

        // Helper to get text content safely
        const getText = (el, selectors) => {
          if (!el) return '';
          for (const sel of selectors) {
            const found = el.querySelector(sel);
            if (found) return found.textContent?.trim() || '';
          }
          return '';
        };
        
        // Helper to get attribute
        const getAttr = (el, selectors, attr) => {
          if (!el) return '';
          for (const sel of selectors) {
            const found = el.querySelector(sel);
            if (found) {
              const val = found.getAttribute(attr);
              if (val) return val;
            }
          }
          return '';
        };
        
        // Strategy 1: SIDEARM roster cards (most common for SEC)
        const sidearmPlayers = document.querySelectorAll('.sidearm-roster-player');
        if (sidearmPlayers.length > 0) {
          sidearmPlayers.forEach(player => {
            // Get headshot - Enhanced extraction for multiple formats including Ole Miss
            let headshot = '';
            
            // Try srcset first (for 2026 roster pages like Ole Miss with imgproxy URLs)
            const srcset = getAttr(player, [
              '.sidearm-roster-player-image img',
              '.sidearm-roster-player-image picture source',
              'img'
            ], 'srcset');
            if (srcset) {
              // Extract URL from srcset - handles both simple and complex formats
              // Ole Miss format: "https://images.sidearmdev.com/crop?url=... 1x, ..."
              const match = srcset.match(/(https?:\/\/[^\s,]+)/);
              if (match) headshot = match[1];
            }
            
            // Try data-src (lazy loaded images on older roster pages)
            if (!headshot) {
              headshot = getAttr(player, [
                '.sidearm-roster-player-image img',
                '.sidearm-roster-player-image picture source',
                'img.lazyload',
                'img'
              ], 'data-src');
            }
            
            // Try regular src (fallback)
            if (!headshot) {
              headshot = getAttr(player, [
                '.sidearm-roster-player-image img',
                'img'
              ], 'src');
            }
            
            // Clean and validate headshot URL
            if (headshot) {
              // Make absolute
              if (headshot.startsWith('/')) {
                headshot = baseUrl + headshot;
              }
              // Filter out placeholder/logo images (various formats across schools)
              const placeholderPatterns = [
                'headshot_logo',
                'om_headshot_logo',
                'placeholder',
                'no-photo',
                'default_player',
                'generic_player',
                'avatar',
                'silhouette'
              ];
              if (placeholderPatterns.some(pattern => headshot.toLowerCase().includes(pattern))) {
                headshot = '';
              }
            }
            

            // Get bio/profile URL
            let bioUrl = getAttr(player, [
              '.sidearm-roster-player-name a',
              'a.sidearm-roster-player-name',
              '.sidearm-roster-player-image a',
              'a[href*="roster"]'
            ], 'href') || '';
            if (bioUrl && bioUrl.startsWith('/')) {
              bioUrl = baseUrl + bioUrl;
            }
            
            // Extract all fields
            const name = getText(player, [
              '.sidearm-roster-player-name a',
              '.sidearm-roster-player-name span',
              '.sidearm-roster-player-name'
            ]);
            
            const number = getText(player, [
              '.sidearm-roster-player-jersey-number',
              '.sidearm-roster-player-other span:first-child'
            ]);
            
            const position = getText(player, [
              '.sidearm-roster-player-position',
              '.sidearm-roster-player-position-long-short'
            ]);
            
            const height = getText(player, [
              '.sidearm-roster-player-height',
              '[class*="height"]'
            ]);
            
            const weight = getText(player, [
              '.sidearm-roster-player-weight',
              '[class*="weight"]'
            ]);
            
            const year = getText(player, [
              '.sidearm-roster-player-academic-year',
              '.sidearm-roster-player-class',
              '[class*="academic"]',
              '[class*="class"]'
            ]);


            const hometown = getText(player, [
              '.sidearm-roster-player-hometown',
              '.sidearm-roster-player-home',
              '[class*="hometown"]'
            ]);
            
            const highSchool = getText(player, [
              '.sidearm-roster-player-highschool',
              '.sidearm-roster-player-previous-school',
              '[class*="highschool"]',
              '[class*="high-school"]'
            ]);
            
            const batsThrows = getText(player, [
              '.sidearm-roster-player-custom1',
              '.sidearm-roster-player-bats-throws',
              '[class*="bats"]'
            ]);
            
            if (name) {
              players.push({
                name, number, position, year, height, weight,
                hometown, highSchool, batsThrows, headshot, bioUrl
              });
            }
          });
        }
        
        // Strategy 1.5: Vue/Nuxt roster-card-item format (Auburn, etc.)
        if (players.length === 0) {
          const vueCards = document.querySelectorAll('.roster-card-item');
          vueCards.forEach(card => {
            const name = card.querySelector('.roster-card-item__title-link')?.textContent?.trim() || 
                         card.querySelector('.roster-card-item__title')?.textContent?.trim() || '';
            if (!name) return;
            
            const number = card.querySelector('.roster-card-item__jersey-number')?.textContent?.replace('#', '')?.trim() || '';
            const position = card.querySelector('.roster-card-item__position')?.textContent?.trim() || '';
            
            // Bio URL
            let bioUrl = card.querySelector('.roster-card-item__title-link')?.getAttribute('href') ||
                         card.querySelector('.roster-card-item__image-wrapper')?.getAttribute('href') || '';
            if (bioUrl && bioUrl.startsWith('/')) bioUrl = baseUrl + bioUrl;
            
            // Get basic fields (height, weight, year) - they're in order
            const basicValues = card.querySelectorAll('.roster-player-card-profile-field__value--basic');
            const height = basicValues[0]?.textContent?.trim() || '';
            const weight = basicValues[1]?.textContent?.trim() || '';
            const year = basicValues[2]?.textContent?.trim() || '';
            
            // Get additional fields
            const hometown = card.querySelector('.roster-player-card-profile-field__value--hometown')?.textContent?.trim() || '';
            const highSchool = card.querySelector('.roster-player-card-profile-field__value--school')?.textContent?.trim() ||
                              card.querySelector('.roster-player-card-profile-field__value--previous-school')?.textContent?.trim() || '';
            
            // Headshot - Vue lazy loads these, so check for real src or data attrs
            let headshot = '';
            const img = card.querySelector('.roster-card-item__image');
            if (img) {
              const src = img.getAttribute('src') || '';
              // Skip data URIs (placeholders)
              if (!src.startsWith('data:')) {
                headshot = src.startsWith('/') ? baseUrl + src : src;
              }
            }
            
            players.push({
              name, number, position, year, height, weight,
              hometown, highSchool, batsThrows: '', headshot, bioUrl
            });
          });
        }
        
        // Strategy 2: Table-based roster (backup)
        if (players.length === 0) {
          const rows = document.querySelectorAll('table.sidearm-table tbody tr, .roster-table tr');
          rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length < 3) return;
            
            // Try to find headshot in row
            let headshot = '';
            const img = row.querySelector('img');
            if (img) {
              headshot = img.getAttribute('data-src') || img.getAttribute('src') || '';
              if (headshot.startsWith('/')) headshot = baseUrl + headshot;
            }


            // Try to find bio link
            let bioUrl = '';
            const link = row.querySelector('a[href*="roster"], a[href*="bio"]');
            if (link) {
              bioUrl = link.getAttribute('href') || '';
              if (bioUrl.startsWith('/')) bioUrl = baseUrl + bioUrl;
            }
            
            const name = cells[1]?.textContent?.trim() || cells[0]?.textContent?.trim() || '';
            const number = cells[0]?.textContent?.trim() || '';
            const position = cells[2]?.textContent?.trim() || '';
            const year = cells[3]?.textContent?.trim() || '';
            const height = cells[4]?.textContent?.trim() || '';
            const weight = cells[5]?.textContent?.trim() || '';
            const hometown = cells[6]?.textContent?.trim() || '';
            const highSchool = cells[7]?.textContent?.trim() || '';
            
            if (name && name !== number) {
              players.push({
                name, number, position, year, height, weight,
                hometown, highSchool, batsThrows: '', headshot, bioUrl
              });
            }
          });
        }
        
        // Strategy 3: Generic card layout
        if (players.length === 0) {
          const cards = document.querySelectorAll('[class*="roster"] [class*="card"], [class*="player-card"]');
          cards.forEach(card => {
            const name = card.querySelector('[class*="name"], h3, h4')?.textContent?.trim() || '';
            const img = card.querySelector('img');
            let headshot = img ? (img.getAttribute('data-src') || img.getAttribute('src') || '') : '';
            if (headshot.startsWith('/')) headshot = baseUrl + headshot;
            
            if (name) {
              players.push({
                name, number: '', position: '', year: '', height: '', weight: '',
                hometown: '', highSchool: '', batsThrows: '', headshot, bioUrl: ''
              });
            }
          });
        }
        
        return players;
      }, baseUrl);


      console.log(`   📊 Found ${roster.length} players`);
      
      // Filter pitchers and add team info
      const pitchers = [];
      let headshotsFetched = 0;
      
      for (let i = 0; i < roster.length; i++) {
        const player = roster[i];
        player.teamId = team.id;
        player.teamSlug = team.slug;
        player.teamName = team.name;
        player.localHeadshot = '';
        
        // If no headshot from roster page, try fetching from bio page
        // If --pitchers-only, only fetch for pitchers
        const shouldFetchBio = !player.headshot && player.bioUrl && 
                               (!PITCHERS_ONLY || isPitcher(player.position));
        if (shouldFetchBio) {
          if (headshotsFetched === 0) console.log(`   🔍 Fetching headshots from bio pages...`);
          const bioHeadshot = await fetchHeadshotFromBio(browser, player.bioUrl, team.base);
          if (bioHeadshot) {
            player.headshot = bioHeadshot;
            headshotsFetched++;
          }
          // Small delay between bio page fetches
          if (i < roster.length - 1) await delay(500);
        }
        
        // Download headshot if enabled and we have one
        if (DOWNLOAD_HEADSHOTS && player.headshot) {
          const ext = player.headshot.includes('.png') ? 'png' : 'jpg';
          const safeName = player.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
          const filename = `${team.slug}_${safeName}.${ext}`;
          const filepath = path.join(HEADSHOTS_DIR, filename);
          
          if (!fs.existsSync(filepath)) {
            const downloaded = await downloadImage(player.headshot, filepath);
            if (downloaded) {
              player.localHeadshot = filepath;
            }
          } else {
            player.localHeadshot = filepath;
          }
        }
        
        if (isPitcher(player.position)) {
          pitchers.push(player);
        }
      }
      
      if (headshotsFetched > 0) {
        console.log(`   📸 Fetched ${headshotsFetched} headshots from bio pages`);
      }
      console.log(`   ⚾ ${pitchers.length} pitchers identified`);
      
      await page.close();
      return { roster, pitchers };
      
    } catch (err) {
      console.log(`   ❌ Error: ${err.message}`);
      await page.close();
      throw err;
    }
  });
}


// Main function
async function main() {
  console.log('⚾ Enhanced CBB 2026 Roster Scraper');
  console.log('===================================\n');
  
  if (DOWNLOAD_HEADSHOTS) console.log('📸 Headshot download ENABLED\n');
  if (DEBUG) console.log('🔍 Debug mode ENABLED\n');
  
  // Filter teams if specified
  let teams = SEC_TEAMS;
  if (teamFilter) {
    teams = teams.filter(t => 
      t.name.toLowerCase().includes(teamFilter) || 
      t.slug.includes(teamFilter)
    );
    console.log(`   Filtering to: ${teams.map(t => t.name).join(', ')}\n`);
  }
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const results = [];
  let totalPitchers = 0;
  let totalPlayers = 0;
  
  try {
    for (let i = 0; i < teams.length; i++) {
      const team = teams[i];
      console.log(`\n[${i + 1}/${teams.length}] ${team.name}`);
      
      try {
        const { roster, pitchers } = await scrapeRoster(browser, team);
        
        results.push({
          team_id: team.id,
          team: team.name,
          slug: team.slug,
          base: team.base,
          conference: 'SEC',
          players: roster,
          pitchers: pitchers
        });
        
        totalPlayers += roster.length;
        totalPitchers += pitchers.length;
        
      } catch (err) {
        console.log(`   ❌ Failed: ${err.message}`);
        results.push({ team_id: team.id, team: team.name, slug: team.slug, players: [], pitchers: [] });
      }
      
      await delay(2000);
    }


    // Save results
    const output = {
      teams: results,
      totalPlayers,
      totalPitchers,
      metadata: {
        fetchedAt: new Date().toISOString(),
        source: 'Team websites (SIDEARM)',
        teamsCount: results.length
      }
    };
    
    fs.writeFileSync(path.join(DATA_DIR, 'rosters_2026_enhanced.json'), JSON.stringify(output, null, 2));
    
    // Also save pitchers-only file
    const pitchersOnly = {
      teams: results.map(t => ({
        team_id: t.team_id,
        team: t.team,
        slug: t.slug,
        conference: t.conference,
        pitchers: t.pitchers
      })),
      totalPitchers,
      metadata: output.metadata
    };
    fs.writeFileSync(path.join(DATA_DIR, 'pitchers_2026_enhanced.json'), JSON.stringify(pitchersOnly, null, 2));
    
    console.log('\n' + '='.repeat(50));
    console.log('📊 Summary:');
    console.log(`   Teams scraped: ${results.length}`);
    console.log(`   Total players: ${totalPlayers}`);
    console.log(`   Total pitchers: ${totalPitchers}`);
    console.log(`\n💾 Saved to:`);
    console.log(`   - data/rosters_2026_enhanced.json`);
    console.log(`   - data/pitchers_2026_enhanced.json`);
    console.log('✅ Done!\n');
    
  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
