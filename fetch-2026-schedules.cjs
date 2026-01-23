#!/usr/bin/env node

/**
 * ESPN 2026 College Baseball Schedule Fetcher
 * ============================================
 * Fetches all 2026 D1 college baseball games from ESPN API
 * 
 * Usage: node fetch-2026-schedules.cjs
 * 
 * Output: 
 * - data/schedule.json (all games)
 * - data/schedule_week_01.json through schedule_week_19.json
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const SEASON = 2026;
const SEASON_TYPE = 2; // Regular season
const WEEKS = 19; // College baseball season weeks

/**
 * Fetch JSON from URL with retry
 */
function fetchJSON(url, retries = 3) {
  return new Promise((resolve, reject) => {
    const attempt = (retriesLeft) => {
      https.get(url, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            if (retriesLeft > 0) {
              console.log(`  ⚠️  Parse error, retrying... (${retriesLeft} left)`);
              setTimeout(() => attempt(retriesLeft - 1), 1000);
            } else {
              reject(e);
            }
          }
        });
      }).on('error', (e) => {
        if (retriesLeft > 0) {
          console.log(`  ⚠️  Network error, retrying... (${retriesLeft} left)`);
          setTimeout(() => attempt(retriesLeft - 1), 1000);
        } else {
          reject(e);
        }
      });
    };
    attempt(retries);
  });
}

/**
 * Fetch scoreboard for a specific week
 */
async function fetchWeek(week) {
  const url = `https://site.api.espn.com/apis/site/v2/sports/baseball/college-baseball/scoreboard?seasontype=${SEASON_TYPE}&week=${week}&limit=500`;
  
  console.log(`📅 Fetching Week ${week}...`);
  
  try {
    const data = await fetchJSON(url);
    const events = data.events || [];
    
    const games = events.map(event => ({
      id: String(event.id || ''),
      espn_game_id: String(event.id || ''),
      date: event.date || '',
      week: week,
      season: SEASON,
      season_type: SEASON_TYPE,
      name: event.name || '',
      shortName: event.shortName || '',
      competitions: event.competitions || [],
      status: event.status?.type?.name || '',
      venue: event.competitions?.[0]?.venue?.fullName || '',
      city: event.competitions?.[0]?.venue?.address?.city || '',
      state: event.competitions?.[0]?.venue?.address?.state || ''
    }));
    
    console.log(`  ✓ Found ${games.length} games`);
    
    return games;
    
  } catch (error) {
    console.error(`  ❌ Error fetching week ${week}:`, error.message);
    return [];
  }
}

/**
 * Main fetch function
 */
async function fetchAllSchedules() {
  console.log(`🏈 Fetching 2026 College Baseball Schedules\n`);
  console.log(`Season: ${SEASON}`);
  console.log(`Weeks: 1-${WEEKS}\n`);
  
  const allGames = [];
  
  // Fetch each week
  for (let week = 1; week <= WEEKS; week++) {
    const weekGames = await fetchWeek(week);
    allGames.push(...weekGames);
    
    // Save individual week file
    const weekFile = path.join(dataDir, `schedule_week_${String(week).padStart(2, '0')}.json`);
    fs.writeFileSync(weekFile, JSON.stringify({ games: weekGames }, null, 2));
    console.log(`  💾 Saved ${weekFile}\n`);
    
    // Rate limit - wait 500ms between requests
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Save combined schedule
  const scheduleFile = path.join(dataDir, 'schedule.json');
  fs.writeFileSync(scheduleFile, JSON.stringify({ games: allGames }, null, 2));
  
  console.log(`\n✅ Schedule fetch complete!`);
  console.log(`📁 Main file: ${scheduleFile}`);
  console.log(`📊 Total games: ${allGames.length}`);
  console.log(`📅 Weeks: 1-${WEEKS}\n`);
  
  // Show week breakdown
  const weekCounts = {};
  allGames.forEach(g => {
    weekCounts[g.week] = (weekCounts[g.week] || 0) + 1;
  });
  
  console.log('📈 Games by week:');
  Object.keys(weekCounts).sort((a, b) => Number(a) - Number(b)).forEach(week => {
    console.log(`  Week ${String(week).padStart(2, '0')}: ${weekCounts[week]} games`);
  });
}

// Run if executed directly
if (require.main === module) {
  fetchAllSchedules()
    .then(() => {
      console.log('\n🎉 Done!');
      process.exit(0);
    })
    .catch(err => {
      console.error('\n❌ Fatal error:', err);
      process.exit(1);
    });
}

module.exports = { fetchAllSchedules, fetchWeek };
