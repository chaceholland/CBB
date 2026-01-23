/**
 * College Baseball Team Website Scraper
 * Scrapes rosters and schedules from team athletic sites for 2026 season
 */

import puppeteer from 'puppeteer';
import fs from 'fs';

const SEC_TEAMS = {
  'south-carolina': { name: 'South Carolina', abbrev: 'SC', espnId: '2579', rosterUrl: 'https://gamecocksonline.com/sports/baseball/roster/', scheduleUrl: 'https://gamecocksonline.com/sports/baseball/schedule/' },
  'texas': { name: 'Texas', abbrev: 'TEX', espnId: '251', rosterUrl: 'https://texaslonghorns.com/sports/baseball/roster', scheduleUrl: 'https://texaslonghorns.com/sports/baseball/schedule' },
  'georgia': { name: 'Georgia', abbrev: 'UGA', espnId: '61', rosterUrl: 'https://georgiadogs.com/sports/baseball/roster', scheduleUrl: 'https://georgiadogs.com/sports/baseball/schedule' },
  'florida': { name: 'Florida', abbrev: 'FLA', espnId: '57', rosterUrl: 'https://floridagators.com/sports/baseball/roster', scheduleUrl: 'https://floridagators.com/sports/baseball/schedule' },
  'lsu': { name: 'LSU', abbrev: 'LSU', espnId: '99', rosterUrl: 'https://lsusports.net/sports/baseball/roster', scheduleUrl: 'https://lsusports.net/sports/baseball/schedule' },
  'tennessee': { name: 'Tennessee', abbrev: 'TENN', espnId: '2633', rosterUrl: 'https://utsports.com/sports/baseball/roster', scheduleUrl: 'https://utsports.com/sports/baseball/schedule' },
  'vanderbilt': { name: 'Vanderbilt', abbrev: 'VAN', espnId: '238', rosterUrl: 'https://vucommodores.com/sports/baseball/roster', scheduleUrl: 'https://vucommodores.com/sports/baseball/schedule' },
  'arkansas': { name: 'Arkansas', abbrev: 'ARK', espnId: '8', rosterUrl: 'https://arkansasrazorbacks.com/sports/baseball/roster/', scheduleUrl: 'https://arkansasrazorbacks.com/sports/baseball/schedule/' },
  'ole-miss': { name: 'Ole Miss', abbrev: 'MISS', espnId: '145', rosterUrl: 'https://olemisssports.com/sports/baseball/roster', scheduleUrl: 'https://olemisssports.com/sports/baseball/schedule' },
  'mississippi-state': { name: 'Mississippi State', abbrev: 'MSST', espnId: '344', rosterUrl: 'https://hailstate.com/sports/baseball/roster', scheduleUrl: 'https://hailstate.com/sports/baseball/schedule' },
  'alabama': { name: 'Alabama', abbrev: 'ALA', espnId: '333', rosterUrl: 'https://rolltide.com/sports/baseball/roster', scheduleUrl: 'https://rolltide.com/sports/baseball/schedule' },
  'auburn': { name: 'Auburn', abbrev: 'AUB', espnId: '2', rosterUrl: 'https://auburntigers.com/sports/baseball/roster', scheduleUrl: 'https://auburntigers.com/sports/baseball/schedule' },
  'kentucky': { name: 'Kentucky', abbrev: 'UK', espnId: '96', rosterUrl: 'https://ukathletics.com/sports/baseball/roster', scheduleUrl: 'https://ukathletics.com/sports/baseball/schedule' },
  'missouri': { name: 'Missouri', abbrev: 'MIZ', espnId: '142', rosterUrl: 'https://mutigers.com/sports/baseball/roster', scheduleUrl: 'https://mutigers.com/sports/baseball/schedule' },
  'texas-am': { name: 'Texas A&M', abbrev: 'TAMU', espnId: '245', rosterUrl: 'https://12thman.com/sports/baseball/roster', scheduleUrl: 'https://12thman.com/sports/baseball/schedule' },
  'oklahoma': { name: 'Oklahoma', abbrev: 'OU', espnId: '201', rosterUrl: 'https://soonersports.com/sports/baseball/roster', scheduleUrl: 'https://soonersports.com/sports/baseball/schedule' }
};

const PITCHER_POSITIONS = ['P', 'RHP', 'LHP', 'LHRP', 'RHRP', 'SP', 'RP', 'CL'];

async function scrapeRoster(browser, teamKey, teamData) {
  console.log(`  Scraping roster for ${teamData.name}...`);
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
  
  try {
    await page.goto(teamData.rosterUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await page.waitForSelector('body', { timeout: 10000 });
    
    const players = await page.evaluate((pitcherPos) => {
      const results = [];
      // Try multiple selector patterns used by SIDEARM sites
      const selectors = [
        '.sidearm-roster-player',
        '.s-person-card',
        '[class*="roster"] [class*="player"]',
        'table tbody tr',
        '.roster-card',
        'li[class*="player"]'
      ];
      
      let playerElements = [];
      for (const sel of selectors) {
        const els = document.querySelectorAll(sel);
        if (els.length > 5) { playerElements = els; break; }
      }
      
      playerElements.forEach(el => {
        const getText = (selectors) => {
          for (const s of selectors) {
            const elem = el.querySelector(s);
            if (elem?.textContent?.trim()) return elem.textContent.trim();
          }
          return '';
        };
        
        // Get headshot image URL
        const getHeadshot = () => {
          const imgSelectors = [
            '.sidearm-roster-player-image img',
            '.s-person-card__image img',
            '.s-person__image img',
            '[class*="player"] img[class*="headshot"]',
            '[class*="player"] img[class*="photo"]',
            '[class*="roster"] img',
            'img[src*="headshot"]',
            'img[src*="player"]',
            'img[src*="roster"]',
            'img[data-src]',
            'picture source',
            'img'
          ];
          for (const s of imgSelectors) {
            const img = el.querySelector(s);
            if (img) {
              // Try data-src first (lazy loading), then src, then srcset
              const src = img.getAttribute('data-src') || img.getAttribute('src') || img.getAttribute('srcset')?.split(' ')[0];
              // Skip placeholder/default images
              if (src && !src.includes('placeholder') && !src.includes('default') && !src.includes('silhouette') && !src.includes('no-photo')) {
                // Make absolute URL if needed
                if (src.startsWith('//')) return 'https:' + src;
                if (src.startsWith('/')) return window.location.origin + src;
                return src;
              }
            }
          }
          return '';
        };
        
        // Get birthdate or age
        const getBirthInfo = () => {
          const birthSelectors = [
            '[class*="birthdate"]',
            '[class*="birth-date"]', 
            '[class*="dob"]',
            '[class*="age"]',
            '.sidearm-roster-player-birthdate'
          ];
          for (const s of birthSelectors) {
            const elem = el.querySelector(s);
            if (elem?.textContent?.trim()) return elem.textContent.trim();
          }
          // Also check full text for date patterns
          const text = el.textContent || '';
          const dateMatch = text.match(/(\d{1,2}\/\d{1,2}\/\d{2,4})/);
          if (dateMatch) return dateMatch[1];
          const ageMatch = text.match(/Age:\s*(\d{1,2})/i);
          if (ageMatch) return ageMatch[1];
          return '';
        };
        
        const name = getText(['.sidearm-roster-player-name a', '.s-person-details__personal-single-line-name', 'a[href*="player"]', '.name', 'td:nth-child(2)']) || el.querySelector('a')?.textContent?.trim() || '';
        const position = getText(['.sidearm-roster-player-position', '.s-person-details__bio-stat', '.position', 'td:nth-child(1)']) || '';
        const number = getText(['.sidearm-roster-player-jersey-number', '.s-stamp', '.jersey', 'td:first-child']) || '';
        const height = getText(['.sidearm-roster-player-height', '[class*="height"]']) || '';
        const weight = getText(['.sidearm-roster-player-weight', '[class*="weight"]']) || '';
        const year = getText(['.sidearm-roster-player-academic-year', '.s-person-details__bio-stat:nth-child(2)', '.year', '.class']) || '';
        const hometown = getText(['.sidearm-roster-player-hometown', '[class*="hometown"]']) || '';
        const highSchool = getText(['.sidearm-roster-player-highschool', '[class*="school"]']) || '';
        const bats = el.textContent?.match(/([LRBS])\/[LR]/)?.[1] || '';
        const throws = el.textContent?.match(/[LRB]\/([LR])/)?.[1] || '';
        const headshot = getHeadshot();
        const birthInfo = getBirthInfo();
        
        if (name && name.length > 1) {
          const isPitcher = pitcherPos.some(p => position.toUpperCase().includes(p));
          results.push({ name, number: number.replace(/[^0-9]/g, ''), position, height, weight, year, hometown, highSchool, bats, throws, isPitcher, headshot, birthInfo });
        }
      });
      return results;
    }, PITCHER_POSITIONS);
    
    await page.close();
    console.log(`    Found ${players.length} players (${players.filter(p => p.isPitcher).length} pitchers, ${players.filter(p => p.headshot).length} with headshots)`);
    return players;
  } catch (err) {
    console.log(`    Error: ${err.message}`);
    await page.close();
    return [];
  }
}

async function scrapeSchedule(browser, teamKey, teamData) {
  console.log(`  Scraping schedule for ${teamData.name}...`);
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
  
  try {
    await page.goto(teamData.scheduleUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await page.waitForSelector('body', { timeout: 10000 });
    
    const games = await page.evaluate(() => {
      const results = [];
      const gameElements = document.querySelectorAll('.sidearm-schedule-game, [class*="schedule"] [class*="game"], .s-game-card, tr[class*="game"]');
      
      gameElements.forEach(el => {
        const getText = (selectors) => {
          for (const s of selectors) {
            const elem = el.querySelector(s);
            if (elem?.textContent?.trim()) return elem.textContent.trim();
          }
          return '';
        };
        
        const dateText = getText(['.sidearm-schedule-game-opponent-date', '[class*="date"]', 'time', '.date']);
        const opponent = getText(['.sidearm-schedule-game-opponent-name', '[class*="opponent"]', '.opponent', '.team-name']);
        const location = getText(['.sidearm-schedule-game-location', '[class*="location"]', '.location']);
        const time = getText(['.sidearm-schedule-game-time', '[class*="time"]:not([class*="date"])', '.time']);
        const isHome = el.textContent?.toLowerCase().includes('home') || !el.textContent?.toLowerCase().includes('away');
        const isConference = el.textContent?.toLowerCase().includes('sec') || el.querySelector('[class*="conference"]') !== null;
        
        if (opponent && opponent.length > 1) {
          results.push({ date: dateText, opponent, location, time, isHome, isConference });
        }
      });
      return results;
    });
    
    await page.close();
    console.log(`    Found ${games.length} games`);
    return games;
  } catch (err) {
    console.log(`    Error: ${err.message}`);
    await page.close();
    return [];
  }
}

async function main() {
  console.log('=== College Baseball 2026 Team Scraper ===\n');
  
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const allRosters = {};
  const allSchedules = {};
  const allPitchers = [];
  
  const teamKeys = Object.keys(SEC_TEAMS);
  
  for (const teamKey of teamKeys) {
    const teamData = SEC_TEAMS[teamKey];
    console.log(`\n[${teamData.name}]`);
    
    // Scrape roster
    const roster = await scrapeRoster(browser, teamKey, teamData);
    allRosters[teamKey] = { team: teamData, players: roster, scrapedAt: new Date().toISOString() };
    
    // Extract pitchers for pitchers.json format
    const pitchers = roster.filter(p => p.isPitcher).map(p => {
      // Calculate age from birthInfo if it's a date
      let age = '';
      if (p.birthInfo) {
        const dateMatch = p.birthInfo.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
        if (dateMatch) {
          let year = parseInt(dateMatch[3]);
          if (year < 100) year += 2000;
          const birthDate = new Date(year, parseInt(dateMatch[1]) - 1, parseInt(dateMatch[2]));
          const today = new Date();
          age = Math.floor((today - birthDate) / (365.25 * 24 * 60 * 60 * 1000));
        } else {
          // If it's just a number, use it directly
          const numMatch = p.birthInfo.match(/(\d{1,2})/);
          if (numMatch) age = parseInt(numMatch[1]);
        }
      }
      
      return {
        id: `${teamData.espnId}-${p.number || p.name.replace(/\s+/g, '-').toLowerCase()}`,
        name: p.name,
        number: p.number,
        position: p.position,
        team: teamData.name,
        teamId: teamData.espnId,
        teamAbbrev: teamData.abbrev,
        conference: 'SEC',
        height: p.height,
        weight: p.weight,
        year: p.year,
        age: age || '',
        headshot: p.headshot || '',
        bats: p.bats,
        throws: p.throws,
        hometown: p.hometown,
        highSchool: p.highSchool
      };
    });
    allPitchers.push(...pitchers);
    
    // Scrape schedule
    const schedule = await scrapeSchedule(browser, teamKey, teamData);
    allSchedules[teamKey] = { team: teamData, games: schedule, scrapedAt: new Date().toISOString() };
    
    // Rate limiting
    await new Promise(r => setTimeout(r, 1000));
  }
  
  await browser.close();
  
  // Save all data
  console.log('\n=== Saving Data ===');
  
  fs.writeFileSync('./data/sec_rosters_2026.json', JSON.stringify(allRosters, null, 2));
  console.log(`Saved rosters to data/sec_rosters_2026.json`);
  
  fs.writeFileSync('./data/sec_schedules_2026.json', JSON.stringify(allSchedules, null, 2));
  console.log(`Saved schedules to data/sec_schedules_2026.json`);
  
  fs.writeFileSync('./data/sec_pitchers_2026.json', JSON.stringify(allPitchers, null, 2));
  console.log(`Saved ${allPitchers.length} pitchers to data/sec_pitchers_2026.json`);
  
  // Create merged pitchers.json if it doesn't exist or merge with existing
  const pitchersPath = './data/pitchers.json';
  let existingPitchers = [];
  if (fs.existsSync(pitchersPath)) {
    try { existingPitchers = JSON.parse(fs.readFileSync(pitchersPath, 'utf8')); } catch {}
  }
  
  // Merge: keep existing non-SEC pitchers, add new SEC pitchers
  const nonSecPitchers = existingPitchers.filter(p => p.conference !== 'SEC');
  const mergedPitchers = [...nonSecPitchers, ...allPitchers];
  fs.writeFileSync(pitchersPath, JSON.stringify(mergedPitchers, null, 2));
  console.log(`Merged ${mergedPitchers.length} total pitchers to data/pitchers.json`);
  
  console.log('\n=== Done! ===');
}

main().catch(console.error);
