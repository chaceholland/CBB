/**
 * College Baseball Team Website Scraper
 * Scrapes rosters and schedules from team athletic sites for 2026 season
 * 
 * Usage: node scrape-team-sites.cjs [--roster] [--schedule] [--team=TEAM_KEY]
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// SEC Teams with their athletic site URLs
const SEC_TEAMS = {
  'south-carolina': {
    name: 'South Carolina',
    abbrev: 'SC',
    espnId: '2579',
    rosterUrl: 'https://gamecocksonline.com/sports/baseball/roster/',
    scheduleUrl: 'https://gamecocksonline.com/sports/baseball/schedule/'
  },
  'texas': {
    name: 'Texas',
    abbrev: 'TEX',
    espnId: '251',
    rosterUrl: 'https://texaslonghorns.com/sports/baseball/roster',
    scheduleUrl: 'https://texaslonghorns.com/sports/baseball/schedule'
  },
  'georgia': {
    name: 'Georgia',
    abbrev: 'UGA',
    espnId: '61',
    rosterUrl: 'https://georgiadogs.com/sports/baseball/roster',
    scheduleUrl: 'https://georgiadogs.com/sports/baseball/schedule'
  },
  'florida': {
    name: 'Florida',
    abbrev: 'FLA',
    espnId: '57',
    rosterUrl: 'https://floridagators.com/sports/baseball/roster',
    scheduleUrl: 'https://floridagators.com/sports/baseball/schedule'
  },
  'lsu': {
    name: 'LSU',
    abbrev: 'LSU',
    espnId: '99',
    rosterUrl: 'https://lsusports.net/sports/baseball/roster',
    scheduleUrl: 'https://lsusports.net/sports/baseball/schedule'
  },
  'tennessee': {
    name: 'Tennessee',
    abbrev: 'TENN',
    espnId: '2633',
    rosterUrl: 'https://utsports.com/sports/baseball/roster',
    scheduleUrl: 'https://utsports.com/sports/baseball/schedule'
  },
  'vanderbilt': {
    name: 'Vanderbilt',
    abbrev: 'VAN',
    espnId: '238',
    rosterUrl: 'https://vucommodores.com/sports/baseball/roster',
    scheduleUrl: 'https://vucommodores.com/sports/baseball/schedule'
  },
  'arkansas': {
    name: 'Arkansas',
    abbrev: 'ARK',
    espnId: '8',
    rosterUrl: 'https://arkansasrazorbacks.com/sports/baseball/roster/',
    scheduleUrl: 'https://arkansasrazorbacks.com/sports/baseball/schedule/'
  },
  'ole-miss': {
    name: 'Ole Miss',
    abbrev: 'MISS',
    espnId: '145',
    rosterUrl: 'https://olemisssports.com/sports/baseball/roster',
    scheduleUrl: 'https://olemisssports.com/sports/baseball/schedule'
  },
  'mississippi-state': {
    name: 'Mississippi State',
    abbrev: 'MSST',
    espnId: '344',
    rosterUrl: 'https://hailstate.com/sports/baseball/roster',
    scheduleUrl: 'https://hailstate.com/sports/baseball/schedule'
  },
  'alabama': {
    name: 'Alabama',
    abbrev: 'ALA',
    espnId: '333',
    rosterUrl: 'https://rolltide.com/sports/baseball/roster',
    scheduleUrl: 'https://rolltide.com/sports/baseball/schedule'
  },
  'auburn': {
    name: 'Auburn',
    abbrev: 'AUB',
    espnId: '2',
    rosterUrl: 'https://auburntigers.com/sports/baseball/roster',
    scheduleUrl: 'https://auburntigers.com/sports/baseball/schedule'
  },
  'kentucky': {
    name: 'Kentucky',
    abbrev: 'UK',
    espnId: '96',
    rosterUrl: 'https://ukathletics.com/sports/baseball/roster',
    scheduleUrl: 'https://ukathletics.com/sports/baseball/schedule'
  },
  'missouri': {
    name: 'Missouri',
    abbrev: 'MIZ',
    espnId: '142',
    rosterUrl: 'https://mutigers.com/sports/baseball/roster',
    scheduleUrl: 'https://mutigers.com/sports/baseball/schedule'
  },
  'texas-am': {
    name: 'Texas A&M',
    abbrev: 'TAMU',
    espnId: '245',
    rosterUrl: 'https://12thman.com/sports/baseball/roster',
    scheduleUrl: 'https://12thman.com/sports/baseball/schedule'
  },
  'oklahoma': {
    name: 'Oklahoma',
    abbrev: 'OU',
    espnId: '201',
    rosterUrl: 'https://soonersports.com/sports/baseball/roster',
    scheduleUrl: 'https://soonersports.com/sports/baseball/schedule'
  }
};

const PITCHER_POSITIONS = ['P', 'RHP', 'LHP', 'LHRP', 'RHRP', 'SP', 'RP', 'CL'];

async function scrapeRoster(browser, teamKey, teamInfo) {
  console.log(`\n📋 Scraping roster for ${teamInfo.name}...`);
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
  
  try {
    await page.goto(teamInfo.rosterUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 2000));
    
    // First get basic player list with links
    const playerLinks = await page.evaluate(() => {
      const results = new Map(); // Use Map to dedupe by href, prefer links with text
      const links = document.querySelectorAll('a[href*="/roster/player/"]');
      
      links.forEach(link => {
        const href = link.href;
        const name = link.textContent?.trim();
        
        // Only add if we don't have this href yet, OR if this one has text and existing doesn't
        if (!results.has(href) || (name && name.length > 2 && !results.get(href).name)) {
          if (name && name.length > 2) {
            results.set(href, { name, link: href });
          } else if (!results.has(href)) {
            results.set(href, { name: '', link: href });
          }
        }
      });
      
      // Return only entries with names
      return Array.from(results.values()).filter(r => r.name && r.name.length > 2);
    });
    
    console.log(`   Found ${playerLinks.length} player links, fetching details...`);
    
    // Now visit each player page to get position
    const players = [];
    for (const pl of playerLinks) {
      try {
        await page.goto(pl.link, { waitUntil: 'networkidle2', timeout: 20000 });
        await new Promise(r => setTimeout(r, 1500)); // Wait for lazy images
        
        const details = await page.evaluate((pitcherPositions) => {
          const text = document.body.textContent || '';
          
          // Position - look for specific patterns
          let position = '';
          const posEl = document.querySelector('[class*="position"], .s-person-card__position, .roster-bio-info__position');
          if (posEl) position = posEl.textContent?.trim()?.toUpperCase() || '';
          if (!position) {
            const posMatch = text.match(/Position[:\s]*(RHP|LHP|P|C|1B|2B|3B|SS|OF|INF|UTL|DH|IF)/i);
            if (posMatch) position = posMatch[1].toUpperCase();
          }
          
          // Number
          let number = '';
          const numEl = document.querySelector('[class*="jersey-number"], [class*="number"], .s-person-card__number');
          if (numEl) number = numEl.textContent?.trim()?.replace('#', '') || '';
          if (!number) {
            const numMatch = text.match(/#(\d{1,2})\b/);
            if (numMatch) number = numMatch[1];
          }
          
          // Height/Weight  
          let height = '', weight = '';
          const hwMatch = text.match(/(\d['′']\s*\d{1,2}["″"]?)\s*[\/\|]?\s*(\d{2,3}\s*lbs?)/i);
          if (hwMatch) { height = hwMatch[1]; weight = hwMatch[2]; }
          
          // Year - improved detection
          let year = '';
          const yearPatterns = ['Freshman', 'Sophomore', 'Junior', 'Senior', 'Graduate', 'Fr.', 'So.', 'Jr.', 'Sr.', 'Gr.', 'R-Fr.', 'R-So.', 'R-Jr.', 'R-Sr.'];
          const yearEl = document.querySelector('[class*="academic-year"], [class*="class-year"], [class*="year"]');
          if (yearEl) year = yearEl.textContent?.trim() || '';
          if (!year) {
            for (const pat of yearPatterns) {
              if (text.includes(pat)) { year = pat; break; }
            }
          }
          
          // Bats/Throws
          let batsThrows = '';
          const btMatch = text.match(/([LRB])\/([LR])/);
          if (btMatch) batsThrows = btMatch[0];
          
          // Headshot - improved detection for SIDEARM sites
          let headshot = '';
          const headshotSelectors = [
            'img.roster-bio-photo__image',
            'img[class*="bio-photo"]',
            'img[class*="headshot"]',
            '.s-person-header img',
            '.roster-bio-photo img',
            'img[class*="player-photo"]'
          ];
          for (const sel of headshotSelectors) {
            const img = document.querySelector(sel);
            if (img?.src && !img.src.includes('data:image') && !img.src.includes('logo')) {
              headshot = img.src;
              break;
            }
          }
          // Fallback: find largest non-logo image
          if (!headshot) {
            const imgs = Array.from(document.querySelectorAll('img'));
            const candidate = imgs.find(img => 
              img.src && 
              !img.src.includes('data:image') && 
              !img.src.includes('logo') &&
              !img.src.includes('sponsor') &&
              (img.naturalWidth > 100 || img.width > 100)
            );
            if (candidate) headshot = candidate.src;
          }
          
          return { position, number, height, weight, year, batsThrows, headshot,
            isPitcher: pitcherPositions.some(p => position.includes(p)) };
        }, PITCHER_POSITIONS);
        
        players.push({ name: pl.name, link: pl.link, ...details });
        
        // Rate limit
        if (players.length % 10 === 0) {
          process.stdout.write(`\r   Processed ${players.length}/${playerLinks.length} players...`);
        }
      } catch (e) {
        players.push({ name: pl.name, link: pl.link, position: '', isPitcher: false });
      }
    }
    
    console.log(`\n   Found ${players.length} players (${players.filter(p => p.isPitcher).length} pitchers)`);
    await page.close();
    return players;
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
    await page.close();
    return [];
  }
}

async function scrapeSchedule(browser, teamKey, teamInfo) {
  console.log(`\n📅 Scraping schedule for ${teamInfo.name}...`);
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
  
  try {
    await page.goto(teamInfo.scheduleUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 2000));
    
    const games = await page.evaluate(() => {
      const results = [];
      
      // Look for schedule rows/cards
      const rows = document.querySelectorAll('tr, [class*="schedule-game"], [class*="sidearm-schedule"]');
      
      rows.forEach(row => {
        try {
          const text = row.textContent || '';
          
          // Find opponent link
          const oppLink = row.querySelector('a[href*="/teams/"], a[href*="opponent"]');
          let opponent = oppLink?.textContent?.trim();
          
          // If no link, look for team name pattern
          if (!opponent) {
            const imgs = row.querySelectorAll('img[alt]');
            imgs.forEach(img => {
              if (img.alt && !opponent) opponent = img.alt.trim();
            });
          }
          
          if (!opponent || opponent.length < 2) return;
          
          // Find date
          let date = '';
          const dateMatch = text.match(/(Jan|Feb|Mar|Apr|May|Jun)\w*\s+\d{1,2}/i);
          if (dateMatch) date = dateMatch[0];
          
          // Check home/away
          const isHome = text.toLowerCase().includes('home') || 
                        row.querySelector('[class*="home"]') !== null ||
                        (!text.toLowerCase().includes('away') && !text.includes('@'));
          
          // Location
          let location = '';
          const locEl = row.querySelector('[class*="location"], [class*="venue"]');
          if (locEl) location = locEl.textContent?.trim() || '';
          
          results.push({ date, opponent, isHome, location });
        } catch (e) {}
      });
      
      return results;
    });
    
    console.log(`   Found ${games.length} games`);
    await page.close();
    return games;
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
    await page.close();
    return [];
  }
}

function convertToPitchersFormat(teamKey, teamInfo, players) {
  return players.filter(p => p.isPitcher).map(p => ({
    id: `${teamInfo.espnId}-${p.number || p.name.replace(/\s+/g, '-').toLowerCase()}`,
    name: p.name, number: p.number, position: p.position,
    team: teamInfo.name, teamId: teamInfo.espnId, teamAbbrev: teamInfo.abbrev,
    conference: 'SEC', height: p.height, weight: p.weight, year: p.year,
    role: p.position.includes('SP') ? 'Starter' : 'Reliever'
  }));
}

async function main() {
  const args = process.argv.slice(2);
  const doRoster = args.includes('--roster') || (!args.includes('--schedule'));
  const doSchedule = args.includes('--schedule') || (!args.includes('--roster'));
  const teamArg = args.find(a => a.startsWith('--team='));
  const specificTeam = teamArg ? teamArg.split('=')[1] : null;
  
  console.log('🏟️  College Baseball Team Website Scraper');
  console.log('=========================================');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const teamsToScrape = specificTeam 
    ? { [specificTeam]: SEC_TEAMS[specificTeam] }
    : SEC_TEAMS;
  
  const allPitchers = [];
  const allGames = [];
  const results = { timestamp: new Date().toISOString(), season: 2026, teams: {} };
  
  for (const [teamKey, teamInfo] of Object.entries(teamsToScrape)) {
    if (!teamInfo) { console.error(`Unknown team: ${teamKey}`); continue; }
    
    results.teams[teamKey] = { name: teamInfo.name, espnId: teamInfo.espnId };
    
    if (doRoster) {
      const players = await scrapeRoster(browser, teamKey, teamInfo);
      results.teams[teamKey].roster = players;
      allPitchers.push(...convertToPitchersFormat(teamKey, teamInfo, players));
      await new Promise(r => setTimeout(r, 1500));
    }
    
    if (doSchedule) {
      const games = await scrapeSchedule(browser, teamKey, teamInfo);
      results.teams[teamKey].schedule = games;
      allGames.push(...games.map((g, i) => ({ ...g, team: teamInfo.name, teamId: teamInfo.espnId })));
      await new Promise(r => setTimeout(r, 1500));
    }
  }
  
  await browser.close();
  
  // Save results
  const dataDir = './data';
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  
  fs.writeFileSync(path.join(dataDir, 'team_sites_scrape_2026.json'), JSON.stringify(results, null, 2));
  console.log(`\n✅ Saved to data/team_sites_scrape_2026.json`);
  
  if (allPitchers.length > 0) {
    fs.writeFileSync(path.join(dataDir, 'pitchers_2026.json'), JSON.stringify(allPitchers, null, 2));
    console.log(`✅ Saved ${allPitchers.length} pitchers to data/pitchers_2026.json`);
  }
  
  console.log('\n📊 Summary:');
  for (const [k, v] of Object.entries(results.teams)) {
    console.log(`   ${v.name}: ${v.roster?.length || 0} players, ${v.schedule?.length || 0} games`);
  }
}

main().catch(console.error);
