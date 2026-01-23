/**
 * College Baseball 2026 Team Website Scraper
 * Scrapes rosters and schedules from individual team athletic sites
 * 
 * Usage: node scrape-2026-team-sites.cjs [--rosters] [--schedules] [--team=NAME] [--debug]
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// SEC Teams with their athletic site URLs
const SEC_TEAMS = [
  { name: 'Alabama', id: '333', slug: 'alabama', 
    base: 'https://rolltide.com', 
    roster: '/sports/baseball/roster/2026', 
    schedule: '/sports/baseball/schedule' },
  { name: 'Arkansas', id: '8', slug: 'arkansas',
    base: 'https://arkansasrazorbacks.com',
    roster: '/sport/m-basebl/roster/',
    schedule: '/sport/m-basebl/schedule/' },
  { name: 'Auburn', id: '2', slug: 'auburn',
    base: 'https://auburntigers.com',
    roster: '/sports/baseball/roster/2026',
    schedule: '/sports/baseball/schedule' },
  { name: 'Florida', id: '57', slug: 'florida',
    base: 'https://floridagators.com',
    roster: '/sports/baseball/roster/2026',
    schedule: '/sports/baseball/schedule' },
  { name: 'Georgia', id: '61', slug: 'georgia',
    base: 'https://georgiadogs.com',
    roster: '/sports/baseball/roster/2026',
    schedule: '/sports/baseball/schedule' },
  { name: 'Kentucky', id: '96', slug: 'kentucky',
    base: 'https://ukathletics.com',
    roster: '/sports/baseball/roster/2026',
    schedule: '/sports/baseball/schedule' },
  { name: 'LSU', id: '99', slug: 'lsu',
    base: 'https://lsusports.net',
    roster: '/sports/baseball/roster/2026',
    schedule: '/sports/baseball/schedule' },
  { name: 'Mississippi State', id: '344', slug: 'mississippi-state',
    base: 'https://hailstate.com',
    roster: '/sports/baseball/roster/2026',
    schedule: '/sports/baseball/schedule' },
  { name: 'Missouri', id: '142', slug: 'missouri',
    base: 'https://mutigers.com',
    roster: '/sports/baseball/roster/2026',
    schedule: '/sports/baseball/schedule' },
  { name: 'Oklahoma', id: '201', slug: 'oklahoma',
    base: 'https://soonersports.com',
    roster: '/sports/baseball/roster/2026',
    schedule: '/sports/baseball/schedule' },
  { name: 'Ole Miss', id: '145', slug: 'ole-miss',
    base: 'https://olemisssports.com',
    roster: '/sports/baseball/roster/2026',
    schedule: '/sports/baseball/schedule' },
  { name: 'South Carolina', id: '2579', slug: 'south-carolina',
    base: 'https://gamecocksonline.com',
    roster: '/sports/baseball/roster/2026',
    schedule: '/sports/baseball/schedule' },
  { name: 'Tennessee', id: '2633', slug: 'tennessee',
    base: 'https://utsports.com',
    roster: '/sports/baseball/roster/2026',
    schedule: '/sports/baseball/schedule' },
  { name: 'Texas', id: '251', slug: 'texas',
    base: 'https://texaslonghorns.com',
    roster: '/sports/baseball/roster/2026',
    schedule: '/sports/baseball/schedule' },
  { name: 'Texas A&M', id: '245', slug: 'texas-am',
    base: 'https://12thman.com',
    roster: '/sports/baseball/roster/2026',
    schedule: '/sports/baseball/schedule' },
  { name: 'Vanderbilt', id: '238', slug: 'vanderbilt',
    base: 'https://vucommodores.com',
    roster: '/sports/baseball/roster/2026',
    schedule: '/sports/baseball/schedule' }
];

const DATA_DIR = path.join(__dirname, 'data');
let DEBUG = false;

// Delay helper
const delay = ms => new Promise(r => setTimeout(r, ms));

// Detect if position is a pitcher
function isPitcher(position) {
  if (!position) return false;
  const pos = position.trim().toUpperCase();
  // Standard pitcher position codes
  const pitcherCodes = ['P', 'RHP', 'LHP', 'RHSP', 'LHSP', 'RHRP', 'LHRP', 'SP', 'RP', 'CL'];
  // Full position names that indicate pitcher
  const pitcherNames = ['PITCHER', 'RIGHT HANDED PITCHER', 'LEFT HANDED PITCHER', 'RIGHT-HANDED PITCHER', 'LEFT-HANDED PITCHER'];
  
  // Check for exact code match or combined position (e.g., "RHP/1B", "P/INF")
  if (pitcherCodes.some(code => pos === code || pos.startsWith(code + '/') || pos.endsWith('/' + code))) {
    return true;
  }
  // Check for full name match or combined with other position
  if (pitcherNames.some(name => pos === name || pos.includes(name))) {
    return true;
  }
  return false;
}

/**
 * Retry wrapper with exponential backoff
 */
async function withRetry(fn, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === retries) throw err;
      const waitTime = Math.pow(2, i) * 2000;
      console.log(`   ⏳ Retry ${i + 1}/${retries} after ${waitTime}ms...`);
      await delay(waitTime);
    }
  }
}

/**
 * Scrape roster from a team's athletic website
 */
async function scrapeRoster(browser, team) {
  const url = team.base + team.roster;
  console.log(`\n📋 Scraping roster for ${team.name}: ${url}`);
  
  return withRetry(async () => {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
    
    try {
      // Use domcontentloaded for more reliability, increase timeout
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await delay(3000); // Let JS render - increased from 2s
      
      // Scroll to trigger lazy loading of images
      await page.evaluate(async () => {
        await new Promise(resolve => {
          let totalHeight = 0;
          const distance = 400;
          const timer = setInterval(() => {
            window.scrollBy(0, distance);
            totalHeight += distance;
            if (totalHeight >= document.body.scrollHeight) {
              clearInterval(timer);
              resolve();
            }
          }, 80);
        });
      });
      await delay(1500); // Wait for images to load after scroll
      
      // Debug: Save page HTML if debug mode
      if (DEBUG) {
        const html = await page.content();
        fs.writeFileSync(`debug_${team.slug}_roster.html`, html);
        console.log(`   🔍 Debug: Saved HTML to debug_${team.slug}_roster.html`);
      }
      
      // Try multiple selectors for roster data
      const roster = await page.evaluate(() => {
        const players = [];
        
        // Strategy 1: SIDEARM-specific classes (most SEC teams)
        const sidearmPlayers = document.querySelectorAll('.sidearm-roster-players-container .sidearm-roster-player');
        if (sidearmPlayers.length > 0) {
          sidearmPlayers.forEach(player => {
            const name = player.querySelector('.sidearm-roster-player-name a')?.textContent?.trim() || '';
            const number = player.querySelector('.sidearm-roster-player-jersey-number')?.textContent?.trim() || '';
            const position = player.querySelector('.sidearm-roster-player-position abbr, .sidearm-roster-player-position')?.textContent?.trim() || '';
            const year = player.querySelector('.sidearm-roster-player-academic-year')?.textContent?.trim() || '';
            const height = player.querySelector('.sidearm-roster-player-height')?.textContent?.trim() || '';
            const weight = player.querySelector('.sidearm-roster-player-weight')?.textContent?.trim() || '';
            const hometown = player.querySelector('.sidearm-roster-player-hometown')?.textContent?.trim() || '';
            
            if (name && name.length > 1) {
              players.push({ name, number, position, year, height, weight, batsThrows: '', hometown });
            }
          });
        }
        
        // Strategy 2: Standard table rows
        if (players.length === 0) {
          document.querySelectorAll('table.sidearm-table tbody tr, table.roster-table tbody tr').forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length >= 3) {
              const nameEl = row.querySelector('a[href*="roster/"]') || cells[1]?.querySelector('a');
              const name = nameEl?.textContent?.trim() || cells[1]?.textContent?.trim() || '';
              const number = cells[0]?.textContent?.trim() || '';
              const position = cells[2]?.textContent?.trim() || '';
              const year = cells[3]?.textContent?.trim() || '';
              const height = cells[4]?.textContent?.trim() || '';
              const weight = cells[5]?.textContent?.trim() || '';
              const batsThrows = cells[6]?.textContent?.trim() || '';
              const hometown = cells[7]?.textContent?.trim() || '';
              
              if (name && name.length > 1) {
                players.push({ name, number, position, year, height, weight, batsThrows, hometown });
              }
            }
          });
        }
        
        // Strategy 3: Any table with roster data (auto-detect column order)
        if (players.length === 0) {
          // Patterns to identify position vs year columns (includes abbreviations AND full names)
          const positionPattern = /^(RHP|LHP|P|C|1B|2B|3B|SS|OF|INF|IF|DH|UT|UTIL|INF\/OF|C\/INF|C\/OF|IF\/OF|P\/INF|RHP\/1B|LHP\/OF|Pitcher|Catcher|Infield|Infielder|Outfield|Outfielder|First Base|Second Base|Third Base|Shortstop|Right[- ]?Handed Pitcher|Left[- ]?Handed Pitcher|Outfielder\/Left Handed Pitcher|Outfielder\/Right Handed Pitcher)$/i;
          const yearPattern = /^(Fr\.|So\.|Jr\.|Sr\.|R-Fr\.|R-So\.|R-Jr\.|R-Sr\.|Freshman|Sophomore|Junior|Senior|Fifth Year|Graduate|Grad|GS|RS|RF|RS-Fr|RS-So|RS-Jr|RS-Sr)\.?$/i;
          
          document.querySelectorAll('table tbody tr').forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length >= 3) {
              // Look for a name cell (usually has a link)
              let name = '';
              let nameCell = null;
              
              for (let i = 0; i < Math.min(3, cells.length); i++) {
                const link = cells[i].querySelector('a');
                if (link && link.href && link.href.includes('roster')) {
                  name = link.textContent.trim();
                  nameCell = i;
                  break;
                }
              }
              
              if (!name && cells[1]) {
                name = cells[1].textContent.trim();
                nameCell = 1;
              }
              
              if (name && name.length > 1 && !name.match(/^(name|player|roster)/i)) {
                const number = cells[0]?.textContent?.trim() || '';
                
                // Auto-detect position and year by content pattern
                let position = '';
                let year = '';
                
                for (let i = 0; i < cells.length; i++) {
                  const cellText = cells[i].textContent.trim();
                  if (!position && positionPattern.test(cellText)) {
                    position = cellText;
                  } else if (!year && yearPattern.test(cellText)) {
                    year = cellText;
                  }
                }
                
                // Fallback to index-based if patterns didn't match
                if (!position && !year) {
                  const posIdx = nameCell !== null ? nameCell + 1 : 2;
                  position = cells[posIdx]?.textContent?.trim() || '';
                  year = cells[posIdx + 1]?.textContent?.trim() || '';
                }
                
                players.push({ 
                  name, 
                  number, 
                  position, 
                  year, 
                  height: '', 
                  weight: '', 
                  batsThrows: '', 
                  hometown: '' 
                });
              }
            }
          });
        }
        
        // Strategy 4: Auburn-style roster-card-item layout (check BEFORE generic card selector)
        if (players.length === 0) {
          document.querySelectorAll('.roster-card-item').forEach(card => {
            const nameLink = card.querySelector('.roster-card-item__title-link, a[href*="roster/player"]');
            const nameImg = card.querySelector('img[alt]');
            const name = nameLink?.textContent?.trim() || nameImg?.alt?.trim() || '';
            const number = card.querySelector('.roster-card-item__jersey-number, [class*="number"]')?.textContent?.trim()?.replace('#', '') || '';
            const position = card.querySelector('.roster-card-item__position, [class*="position"]')?.textContent?.trim() || '';
            
            // Get headshot image (after lazy load triggered)
            const img = card.querySelector('.roster-card-item__image, img');
            let headshot = img?.src || '';
            if (headshot.includes('data:image')) headshot = ''; // Still placeholder
            
            // Get basic stats from profile fields
            const basicStats = card.querySelectorAll('.roster-player-card-profile-field__value--basic');
            const height = basicStats[0]?.textContent?.trim() || '';
            const weight = basicStats[1]?.textContent?.trim() || '';
            let year = basicStats[2]?.textContent?.trim() || '';
            
            // Fallback: extract year from full text
            if (!year) {
              const fullText = card.textContent || '';
              const yearMatch = fullText.match(/(Freshman|Sophomore|Junior|Senior|Fifth Year|Graduate)/i);
              year = yearMatch ? yearMatch[1] : '';
            }
            
            const hometown = card.querySelector('.roster-player-card-profile-field__value--hometown')?.textContent?.trim() || '';
            
            if (name && name.length > 1) {
              players.push({ name, number, position, year, height, weight, batsThrows: '', hometown, headshot });
            }
          });
        }
        
        // Strategy 5: Generic Card/Grid layout (more permissive, run last)
        if (players.length === 0) {
          document.querySelectorAll('.roster-card, .player-card').forEach(card => {
            const name = card.querySelector('[class*="name"], h3, h4')?.textContent?.trim() || '';
            const number = card.querySelector('[class*="number"], [class*="jersey"]')?.textContent?.trim() || '';
            const position = card.querySelector('[class*="position"]')?.textContent?.trim() || '';
            const year = card.querySelector('[class*="year"], [class*="class"]')?.textContent?.trim() || '';
            
            if (name && name.length > 1) {
              players.push({ name, number, position, year, height: '', weight: '', batsThrows: '', hometown: '' });
            }
          });
        }
        
        return players;
      });
      
      await page.close();
      
      // Check if we only got coaching staff (no real players with standard positions)
      const hasRealPlayers = roster.some(p => {
        const pos = (p.position || '').toUpperCase();
        // Real baseball positions
        return /^(RHP|LHP|P|C|1B|2B|3B|SS|OF|INF|IF|DH|UT|UTIL|INF\/OF|C\/INF)$/i.test(pos);
      });
      
      // If only staff found, try previous year roster
      if (!hasRealPlayers && roster.length > 0 && roster.length < 15) {
        console.log(`   ⚠️  Only coaching staff found, trying 2025 roster...`);
        const fallbackUrl = team.base + team.roster + '/2025';
        const fallbackPage = await browser.newPage();
        await fallbackPage.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
        
        try {
          await fallbackPage.goto(fallbackUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
          await delay(3000);
          
          const fallbackRoster = await fallbackPage.evaluate(() => {
            const players = [];
            // Try table strategy for 2025 roster
            document.querySelectorAll('table tbody tr').forEach(row => {
              const cells = row.querySelectorAll('td');
              if (cells.length >= 3) {
                const positionPattern = /^(RHP|LHP|P|C|1B|2B|3B|SS|OF|INF|IF|DH|UT|UTIL|INF\/OF|C\/INF|C\/OF|P\/INF|RHP\/1B|LHP\/OF)$/i;
                const yearPattern = /^(Fr\.|So\.|Jr\.|Sr\.|R-Fr\.|R-So\.|R-Jr\.|R-Sr\.|Freshman|Sophomore|Junior|Senior|Graduate|Grad|GS|RS|RF|RS-Fr|RS-So|RS-Jr|RS-Sr)\.?$/i;
                
                let name = '';
                let nameCell = null;
                for (let i = 0; i < Math.min(3, cells.length); i++) {
                  const link = cells[i].querySelector('a');
                  if (link && link.href && link.href.includes('roster')) {
                    name = link.textContent.trim();
                    nameCell = i;
                    break;
                  }
                }
                if (!name && cells[1]) {
                  name = cells[1].textContent.trim();
                  nameCell = 1;
                }
                
                if (name && name.length > 1 && !name.match(/^(name|player|roster)/i)) {
                  const number = cells[0]?.textContent?.trim() || '';
                  let position = '', year = '';
                  for (let i = 0; i < cells.length; i++) {
                    const cellText = cells[i].textContent.trim();
                    if (!position && positionPattern.test(cellText)) position = cellText;
                    else if (!year && yearPattern.test(cellText)) year = cellText;
                  }
                  players.push({ name, number, position, year, height: '', weight: '', batsThrows: '', hometown: '' });
                }
              }
            });
            return players;
          });
          
          await fallbackPage.close();
          
          if (fallbackRoster.length > roster.length) {
            console.log(`   ✅ Found ${fallbackRoster.length} players in 2025 roster`);
            const pitchers = fallbackRoster.filter(p => isPitcher(p.position));
            console.log(`   Found ${fallbackRoster.length} players, ${pitchers.length} pitchers`);
            return {
              team: team.name,
              teamId: team.id,
              slug: team.slug,
              totalPlayers: fallbackRoster.length,
              allPlayers: fallbackRoster,
              pitchers: pitchers,
              scrapedAt: new Date().toISOString(),
              note: '2025 roster (2026 not yet available)'
            };
          }
        } catch (fallbackErr) {
          console.log(`   ⚠️  Fallback failed: ${fallbackErr.message}`);
          await fallbackPage.close();
        }
      }
      
      // Filter for pitchers only
      const pitchers = roster.filter(p => isPitcher(p.position));
      console.log(`   Found ${roster.length} players, ${pitchers.length} pitchers`);
      
      if (DEBUG && roster.length > 0) {
        console.log(`   🔍 Debug: Sample players:`, roster.slice(0, 3));
      }
      
      return {
        team: team.name,
        teamId: team.id,
        slug: team.slug,
        totalPlayers: roster.length,
        allPlayers: roster,
        pitchers: pitchers,
        scrapedAt: new Date().toISOString()
      };
      
    } catch (err) {
      await page.close();
      throw err;
    }
  });
}

/**
 * Scrape schedule from a team's athletic website
 */
async function scrapeSchedule(browser, team) {
  const url = team.base + team.schedule;
  console.log(`\n📅 Scraping schedule for ${team.name}: ${url}`);
  
  return withRetry(async () => {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
    
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await delay(3000);
      
      if (DEBUG) {
        const html = await page.content();
        fs.writeFileSync(`debug_${team.slug}_schedule.html`, html);
        console.log(`   🔍 Debug: Saved HTML to debug_${team.slug}_schedule.html`);
      }
      
      const schedule = await page.evaluate(() => {
        const games = [];
        
        // Strategy 1: SIDEARM schedule games
        document.querySelectorAll('.sidearm-schedule-game').forEach(game => {
          const dateEl = game.querySelector('.sidearm-schedule-game-opponent-date');
          const opponentEl = game.querySelector('.sidearm-schedule-game-opponent-name a, .sidearm-schedule-game-opponent-name');
          const locationEl = game.querySelector('.sidearm-schedule-game-location');
          const timeEl = game.querySelector('.sidearm-schedule-game-opponent-time');
          const resultEl = game.querySelector('.sidearm-schedule-game-result');
          
          const date = dateEl?.textContent?.trim() || '';
          const opponent = opponentEl?.textContent?.trim() || '';
          const location = locationEl?.textContent?.trim() || '';
          const time = timeEl?.textContent?.trim() || '';
          const result = resultEl?.textContent?.trim() || '';
          
          // Determine home/away
          let homeAway = '';
          if (location.toLowerCase().includes('home') || game.classList.contains('home')) {
            homeAway = 'vs';
          } else if (location.toLowerCase().includes('away') || game.classList.contains('away')) {
            homeAway = '@';
          }
          
          if (date && opponent) {
            games.push({ date, opponent, location, time, homeAway, result });
          }
        });
        
        // Strategy 2: Table-based schedules
        if (games.length === 0) {
          document.querySelectorAll('table.sidearm-table tbody tr, .schedule-table tbody tr').forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length >= 2) {
              const date = cells[0]?.textContent?.trim() || '';
              const opponent = cells[1]?.textContent?.trim() || '';
              const location = cells[2]?.textContent?.trim() || '';
              const time = cells[3]?.textContent?.trim() || '';
              const result = cells[4]?.textContent?.trim() || '';
              
              if (date && opponent && !opponent.match(/^(opponent|date)/i)) {
                games.push({ date, opponent, location, time, homeAway: '', result });
              }
            }
          });
        }
        
        // Strategy 3: Generic schedule items
        if (games.length === 0) {
          document.querySelectorAll('[class*="schedule-game"], [class*="schedule"] li').forEach(item => {
            const text = item.textContent;
            const dateMatch = text.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s+\d{1,2}/i);
            const opponentMatch = text.match(/(?:vs\.?|@)\s+([A-Z][^,\n]+)/);
            
            if (dateMatch && opponentMatch) {
              games.push({
                date: dateMatch[0],
                opponent: opponentMatch[1].trim(),
                location: '',
                time: '',
                homeAway: text.includes('@') ? '@' : 'vs',
                result: ''
              });
            }
          });
        }
        
        return games;
      });
      
      await page.close();
      console.log(`   Found ${schedule.length} games`);
      
      return {
        team: team.name,
        teamId: team.id,
        slug: team.slug,
        season: '2026',
        games: schedule,
        scrapedAt: new Date().toISOString()
      };
      
    } catch (err) {
      await page.close();
      throw err;
    }
  });
}


/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  const doRosters = args.includes('--rosters') || args.length === 0;
  const doSchedules = args.includes('--schedules') || args.length === 0;
  const teamFilter = args.find(a => a.startsWith('--team='))?.split('=')[1]?.toLowerCase();
  DEBUG = args.includes('--debug');
  
  // Filter teams if specified
  let teams = SEC_TEAMS;
  if (teamFilter) {
    teams = SEC_TEAMS.filter(t => 
      t.name.toLowerCase().includes(teamFilter) || 
      t.slug.toLowerCase().includes(teamFilter)
    );
    if (teams.length === 0) {
      console.error(`No teams found matching: ${teamFilter}`);
      process.exit(1);
    }
  }
  
  console.log('🏟️  College Baseball 2026 Team Website Scraper');
  console.log('=' .repeat(50));
  console.log(`Teams to scrape: ${teams.map(t => t.name).join(', ')}`);
  console.log(`Scraping: ${doRosters ? 'Rosters ' : ''}${doSchedules ? 'Schedules' : ''}`);
  if (DEBUG) console.log('🔍 Debug mode enabled');
  
  const browser = await puppeteer.launch({ 
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const results = {
    rosters: [],
    schedules: [],
    scrapedAt: new Date().toISOString()
  };
  
  try {
    for (const team of teams) {
      if (doRosters) {
        try {
          const roster = await scrapeRoster(browser, team);
          results.rosters.push(roster);
        } catch (err) {
          console.error(`   ❌ Error scraping ${team.name} roster:`, err.message);
          results.rosters.push({ 
            team: team.name, 
            teamId: team.id, 
            error: err.message, 
            pitchers: [] 
          });
        }
        await delay(2000); // Rate limiting between teams
      }
      
      if (doSchedules) {
        try {
          const schedule = await scrapeSchedule(browser, team);
          results.schedules.push(schedule);
        } catch (err) {
          console.error(`   ❌ Error scraping ${team.name} schedule:`, err.message);
          results.schedules.push({ 
            team: team.name, 
            teamId: team.id, 
            error: err.message, 
            games: [] 
          });
        }
        await delay(2000);
      }
    }
    
    // Save results
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    
    if (doRosters) {
      // Save all rosters
      const rostersFile = path.join(DATA_DIR, 'rosters_2026.json');
      fs.writeFileSync(rostersFile, JSON.stringify(results.rosters, null, 2));
      console.log(`\n✅ Saved rosters to ${rostersFile}`);
      
      // Extract all pitchers and save to pitchers format
      const allPitchers = {};
      for (const roster of results.rosters) {
        if (roster.pitchers && roster.pitchers.length > 0) {
          allPitchers[roster.teamId] = {
            team: roster.team,
            teamId: roster.teamId,
            slug: roster.slug,
            pitchers: roster.pitchers.map((p, idx) => ({
              id: `${roster.teamId}-P${idx + 1}`,
              name: p.name,
              number: p.number,
              position: p.position,
              year: p.year,
              height: p.height,
              weight: p.weight,
              batsThrows: p.batsThrows,
              hometown: p.hometown
            }))
          };
        }
      }
      
      const pitchersFile = path.join(DATA_DIR, 'pitchers_2026.json');
      fs.writeFileSync(pitchersFile, JSON.stringify(allPitchers, null, 2));
      console.log(`✅ Saved ${Object.keys(allPitchers).length} teams' pitchers to ${pitchersFile}`);
    }
    
    if (doSchedules) {
      const schedulesFile = path.join(DATA_DIR, 'schedules_2026.json');
      fs.writeFileSync(schedulesFile, JSON.stringify(results.schedules, null, 2));
      console.log(`✅ Saved schedules to ${schedulesFile}`);
    }
    
    // Summary
    console.log('\n📊 Summary:');
    if (doRosters) {
      const totalPitchers = results.rosters.reduce((sum, r) => sum + (r.pitchers?.length || 0), 0);
      const successfulRosters = results.rosters.filter(r => !r.error).length;
      const failedRosters = results.rosters.filter(r => r.error);
      console.log(`   Rosters: ${successfulRosters}/${results.rosters.length} successful, ${totalPitchers} total pitchers`);
      if (failedRosters.length > 0) {
        console.log(`   Failed: ${failedRosters.map(r => r.team).join(', ')}`);
      }
    }
    if (doSchedules) {
      const totalGames = results.schedules.reduce((sum, s) => sum + (s.games?.length || 0), 0);
      const successfulSchedules = results.schedules.filter(s => !s.error).length;
      const failedSchedules = results.schedules.filter(s => s.error);
      console.log(`   Schedules: ${successfulSchedules}/${results.schedules.length} successful, ${totalGames} total games`);
      if (failedSchedules.length > 0) {
        console.log(`   Failed: ${failedSchedules.map(s => s.team).join(', ')}`);
      }
    }
    
  } catch (err) {
    console.error('Fatal error:', err);
  } finally {
    await browser.close();
  }
}

// Run
main().catch(console.error);
