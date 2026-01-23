#!/usr/bin/env node

/**
 * ESPN College Baseball Schedule Fetcher
 * =======================================
 * Fetches game schedules from ESPN College Baseball API
 * 
 * Usage Examples:
 *   node tools/fetch_schedule.js --year=2026 --weeks=current
 *   node tools/fetch_schedule.js --year=2026 --weeks=1-10
 *   node tools/fetch_schedule.js --year=2026 --weeks=1,3,5
 *   node tools/fetch_schedule.js --year=2026 --weeks=all
 * 
 * Options:
 *   --year=YYYY    Season year (default: current year)
 *   --weeks=W      Week(s) to fetch:
 *                  - Single: --weeks=5
 *                  - Range: --weeks=5-8
 *                  - List: --weeks=5,7,9
 *                  - Current: --weeks=current
 *                  - All: --weeks=all (1-19)
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration - College Baseball Season
const SEASON_START = { month: 2, day: 14 }; // Mid-February
const SEASON_WEEKS = 19; // February-June (CWS ends early June)
const DATA_DIR = path.join(__dirname, '..', 'data');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {
    year: new Date().getFullYear(),
    weeks: 'current'
  };
  
  for (const arg of args) {
    if (arg.startsWith('--year=')) {
      parsed.year = parseInt(arg.split('=')[1]);
    } else if (arg.startsWith('--weeks=')) {
      parsed.weeks = arg.split('=')[1];
    }
  }
  
  return parsed;
}

/**
 * Get week numbers from weeks argument
 */
function getWeekNumbers(weeksArg, year) {
  if (weeksArg === 'all') {
    return Array.from({ length: SEASON_WEEKS }, (_, i) => i + 1);
  }
  
  if (weeksArg === 'current') {
    return [getCurrentWeek(year)];
  }
  
  if (weeksArg === 'next') {
    return [getCurrentWeek(year) + 1];
  }
  
  // Range: 5-8
  if (weeksArg.includes('-')) {
    const [start, end] = weeksArg.split('-').map(Number);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }
  
  // List: 5,7,9
  if (weeksArg.includes(',')) {
    return weeksArg.split(',').map(s => parseInt(s.trim()));
  }
  
  // Single: 5
  return [parseInt(weeksArg)];
}

/**
 * Get current week of College Baseball season
 */
function getCurrentWeek(year) {
  const now = new Date();
  const seasonStart = new Date(year, SEASON_START.month - 1, SEASON_START.day);
  
  if (now < seasonStart) {
    return 1;
  }
  
  const daysSinceStart = Math.floor((now - seasonStart) / (1000 * 60 * 60 * 24));
  const week = Math.floor(daysSinceStart / 7) + 1;
  
  return Math.min(week, SEASON_WEEKS);
}

/**
 * Get date range for a specific week
 */
function getWeekDateRange(year, week) {
  const seasonStart = new Date(year, SEASON_START.month - 1, SEASON_START.day);
  const weekStart = new Date(seasonStart);
  weekStart.setDate(seasonStart.getDate() + ((week - 1) * 7));
  
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  
  return {
    start: weekStart,
    end: weekEnd,
    startStr: formatDateForESPN(weekStart),
    endStr: formatDateForESPN(weekEnd)
  };
}

/**
 * Format date for ESPN API (YYYYMMDD)
 */
function formatDateForESPN(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

/**
 * Fetch JSON from URL
 */
function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

/**
 * Fetch games for a specific date
 */
async function fetchGamesForDate(dateStr) {
  const url = `https://site.api.espn.com/apis/site/v2/sports/baseball/college-baseball/scoreboard?dates=${dateStr}`;
  
  try {
    const response = await fetchJSON(url);
    return response.events || [];
  } catch (error) {
    console.error(`  ⚠️  Error fetching ${dateStr}:`, error.message);
    return [];
  }
}

/**
 * Process ESPN game data
 */
function processGame(espnGame, week) {
  const competition = espnGame.competitions?.[0];
  if (!competition) return null;
  
  const homeTeam = competition.competitors?.find(c => c.homeAway === 'home');
  const awayTeam = competition.competitors?.find(c => c.homeAway === 'away');
  
  if (!homeTeam || !awayTeam) return null;
  
  return {
    id: String(espnGame.id || ''),
    espn_game_id: String(espnGame.id || ''),
    date: espnGame.date || competition.date || '',
    week: week,
    season: espnGame.season?.year || new Date().getFullYear(),
    season_type: espnGame.season?.type || 2,
    home_team_id: String(homeTeam.team?.id || ''),
    away_team_id: String(awayTeam.team?.id || ''),
    home_team_name: homeTeam.team?.displayName || homeTeam.team?.name || '',
    away_team_name: awayTeam.team?.displayName || awayTeam.team?.name || '',
    venue: competition.venue?.fullName || '',
    city: competition.venue?.address?.city || '',
    state: competition.venue?.address?.state || '',
    status: espnGame.status?.type?.name?.toLowerCase() || 'scheduled',
    home_score: homeTeam.score || null,
    away_score: awayTeam.score || null,
    broadcast: competition.broadcasts?.[0]?.names?.[0] || '',
    notes: espnGame.note || '',
    // Simplified game info
    home: String(homeTeam.team?.id || ''),
    away: String(awayTeam.team?.id || '')
  };
}

/**
 * Fetch games for a specific week
 */
async function fetchWeekGames(year, week) {
  console.log(`\n📅 Fetching Week ${week}...`);
  
  const { start, end, startStr, endStr } = getWeekDateRange(year, week);
  console.log(`   ${start.toLocaleDateString()} - ${end.toLocaleDateString()}`);
  
  const allGames = [];
  const currentDate = new Date(start);
  
  while (currentDate <= end) {
    const dateStr = formatDateForESPN(currentDate);
    const games = await fetchGamesForDate(dateStr);
    
    if (games.length > 0) {
      console.log(`   ${currentDate.toLocaleDateString()}: ${games.length} games`);
      
      for (const game of games) {
        const processed = processGame(game, week);
        if (processed) {
          allGames.push(processed);
        }
      }
    }
    
    currentDate.setDate(currentDate.getDate() + 1);
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log(`   ✓ Found ${allGames.length} games for Week ${week}`);
  return allGames;
}

/**
 * Main fetch function
 */
async function fetchSchedule() {
  const args = parseArgs();
  const weeks = getWeekNumbers(args.weeks, args.year);
  
  console.log('⚾ College Baseball Schedule Fetcher');
  console.log('====================================');
  console.log(`Year: ${args.year}`);
  console.log(`Weeks: ${weeks.join(', ')}`);
  console.log('');
  
  const allGames = [];
  
  for (const week of weeks) {
    const games = await fetchWeekGames(args.year, week);
    allGames.push(...games);
  }
  
  // Sort by date
  allGames.sort((a, b) => new Date(a.date) - new Date(b.date));
  
  // Create output object
  const output = {
    games: allGames,
    _meta: {
      fetchDate: new Date().toISOString(),
      season: args.year,
      weeks: weeks,
      totalGames: allGames.length
    }
  };
  
  // Save full schedule
  const scheduleFile = path.join(DATA_DIR, 'schedule.json');
  fs.writeFileSync(scheduleFile, JSON.stringify(output, null, 2));
  console.log(`\n✅ Saved full schedule: ${scheduleFile}`);
  
  // Save week-specific file if single week
  if (weeks.length === 1) {
    const weekFile = path.join(DATA_DIR, 'schedule_week.json');
    fs.writeFileSync(weekFile, JSON.stringify(output, null, 2));
    console.log(`✅ Saved week schedule: ${weekFile}`);
  }
  
  // Save individual week files
  const weekGroups = {};
  allGames.forEach(game => {
    if (!weekGroups[game.week]) {
      weekGroups[game.week] = [];
    }
    weekGroups[game.week].push(game);
  });
  
  for (const [week, games] of Object.entries(weekGroups)) {
    const weekNum = String(week).padStart(2, '0');
    const weekFile = path.join(DATA_DIR, `schedule_week_${weekNum}.json`);
    const weekOutput = {
      games: games,
      _meta: {
        fetchDate: new Date().toISOString(),
        season: args.year,
        week: parseInt(week),
        totalGames: games.length
      }
    };
    fs.writeFileSync(weekFile, JSON.stringify(weekOutput, null, 2));
  }
  
  console.log(`\n📊 Summary:`);
  console.log(`   Total games: ${allGames.length}`);
  console.log(`   Weeks covered: ${Object.keys(weekGroups).length}`);
  console.log(`   Teams involved: ${new Set([...allGames.map(g => g.home_team_id), ...allGames.map(g => g.away_team_id)]).size}`);
  
  console.log('\n🎉 Schedule fetch complete!');
}

// Run
fetchSchedule().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
