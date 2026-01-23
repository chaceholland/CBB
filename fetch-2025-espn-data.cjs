#!/usr/bin/env node
/**
 * fetch-2025-espn-data.cjs
 * Fetches all D1 college baseball teams, schedules, and pitcher rosters for 2025 from ESPN API
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const YEAR = 2025;

// ESPN API endpoints
const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/baseball/college-baseball';
const TEAMS_URL = `${ESPN_BASE}/teams?limit=500`;
const SCOREBOARD_URL = `${ESPN_BASE}/scoreboard`;

// Rate limiting
const delay = ms => new Promise(r => setTimeout(r, ms));

// Conference mappings for D1 baseball
const CONFERENCE_MAP = {
  // Power conferences
  '1': 'SEC', '8': 'Big 12', '4': 'ACC', '5': 'Big Ten', '9': 'Pac-12',
  // Other D1 conferences  
  '46': 'American', '18': 'Atlantic 10', '3': 'Big East', '44': 'Big West',
  '10': 'Colonial', '45': 'Conference USA', '20': 'Horizon', 
  '43': 'Ivy League', '16': 'MAAC', '11': 'MAC', '21': 'Missouri Valley',
  '17': 'Mountain West', '19': 'Northeast', '47': 'Ohio Valley', 
  '12': 'Patriot League', '13': 'Southern', '14': 'Southland', 
  '29': 'Sun Belt', '30': 'SWAC', '31': 'WAC', '24': 'WCC',
  '48': 'America East', '49': 'ASUN', '50': 'Big South', '51': 'CAA',
  '52': 'MEAC', '53': 'Summit League', '54': 'Independent'
};

async function fetchJSON(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
  return response.json();
}

async function fetchAllTeams() {
  console.log('📋 Fetching all D1 baseball teams...');
  
  try {
    const data = await fetchJSON(TEAMS_URL);
    const teams = [];
    
    for (const team of data.sports?.[0]?.leagues?.[0]?.teams || []) {
      const t = team.team;
      teams.push({
        id: t.id,
        name: t.displayName || t.name,
        abbrev: t.abbreviation,
        shortName: t.shortDisplayName || t.name,
        logo: t.logos?.[0]?.href || '',
        color: t.color || '002f66',
        conference: t.groups?.parent?.name || 'Unknown',
        conferenceId: t.groups?.parent?.id || '',
        location: t.location || '',
        slug: t.slug || t.abbreviation?.toLowerCase() || ''
      });
    }
    
    console.log(`   Found ${teams.length} teams`);
    return teams;
  } catch (err) {
    console.error('Error fetching teams:', err.message);
    return [];
  }
}

async function fetchTeamSchedule(teamId, teamName) {
  const url = `${ESPN_BASE}/teams/${teamId}/schedule?season=${YEAR}`;
  
  try {
    const data = await fetchJSON(url);
    const events = data.events || [];
    const games = [];
    
    for (const ev of events) {
      const comp = ev.competitions?.[0];
      if (!comp) continue;
      
      const homeTeam = comp.competitors?.find(c => c.homeAway === 'home');
      const awayTeam = comp.competitors?.find(c => c.homeAway === 'away');
      
      games.push({
        id: ev.id,
        date: ev.date,
        name: ev.name || ev.shortName,
        shortName: ev.shortName,
        week: ev.week?.number || 0,
        seasonType: ev.seasonType?.type || 2,
        homeTeam: {
          id: homeTeam?.team?.id || '',
          name: homeTeam?.team?.displayName || homeTeam?.team?.name || '',
          abbrev: homeTeam?.team?.abbreviation || '',
          score: homeTeam?.score || ''
        },
        awayTeam: {
          id: awayTeam?.team?.id || '',
          name: awayTeam?.team?.displayName || awayTeam?.team?.name || '',
          abbrev: awayTeam?.team?.abbreviation || '',
          score: awayTeam?.score || ''
        },
        status: comp.status?.type?.name || 'scheduled',
        completed: comp.status?.type?.completed || false,
        venue: comp.venue?.fullName || ''
      });
    }
    
    return games;
  } catch (err) {
    console.error(`   Error fetching schedule for ${teamName}:`, err.message);
    return [];
  }
}

async function fetchTeamRoster(teamId, teamName) {
  const url = `${ESPN_BASE}/teams/${teamId}/roster?season=${YEAR}`;
  
  try {
    const data = await fetchJSON(url);
    const pitchers = [];
    
    // ESPN groups athletes by position
    for (const group of data.athletes || []) {
      for (const athlete of group.items || []) {
        const pos = athlete.position?.abbreviation || '';
        // Filter for pitchers (P, SP, RP, LHP, RHP, etc.)
        if (pos.includes('P') || pos === 'LHP' || pos === 'RHP') {
          pitchers.push({
            id: athlete.id,
            name: athlete.displayName || athlete.fullName,
            firstName: athlete.firstName || '',
            lastName: athlete.lastName || '',
            jersey: athlete.jersey || '',
            position: pos,
            height: athlete.displayHeight || '',
            weight: athlete.displayWeight || '',
            year: athlete.experience?.displayValue || '',
            birthplace: athlete.birthPlace?.city || '',
            headshot: athlete.headshot?.href || '',
            teamId: teamId,
            teamName: teamName
          });
        }
      }
    }
    
    return pitchers;
  } catch (err) {
    // Rosters often empty during offseason
    return [];
  }
}


async function fetchWeeklyScoreboard(weekNum) {
  const url = `${SCOREBOARD_URL}?dates=${YEAR}&week=${weekNum}&groups=50&limit=500`;
  
  try {
    const data = await fetchJSON(url);
    return data.events || [];
  } catch (err) {
    return [];
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log(`   CBB Pitcher Tracker - Fetching ${YEAR} ESPN Data`);
  console.log('═══════════════════════════════════════════════════════\n');
  
  // Ensure data directory exists
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  
  // 1. Fetch all teams
  const teams = await fetchAllTeams();
  if (teams.length === 0) {
    console.error('❌ No teams found. Exiting.');
    process.exit(1);
  }
  
  // Save teams
  fs.writeFileSync(
    path.join(DATA_DIR, 'teams.json'),
    JSON.stringify(teams, null, 2)
  );
  console.log(`✅ Saved ${teams.length} teams to data/teams.json\n`);
  
  // Build divisions map
  const divisionsMap = {};
  const divisionsMeta = {};
  
  for (const team of teams) {
    const conf = team.conference || 'Unknown';
    if (!divisionsMap[conf]) {
      divisionsMap[conf] = [];
      divisionsMeta[conf] = { name: conf, teams: 0 };
    }
    divisionsMap[conf].push(team.id);
    divisionsMeta[conf].teams++;
  }
  
  fs.writeFileSync(
    path.join(DATA_DIR, 'divisions_map.json'),
    JSON.stringify(divisionsMap, null, 2)
  );
  fs.writeFileSync(
    path.join(DATA_DIR, 'divisions_meta.json'),
    JSON.stringify(divisionsMeta, null, 2)
  );
  console.log(`✅ Saved divisions map (${Object.keys(divisionsMap).length} conferences)\n`);
  
  // 2. Fetch schedules for all teams
  console.log('📅 Fetching team schedules...');
  const allGames = new Map(); // Use Map to dedupe by game ID
  let scheduleCount = 0;
  
  for (let i = 0; i < teams.length; i++) {
    const team = teams[i];
    process.stdout.write(`   [${i + 1}/${teams.length}] ${team.name}...`);
    
    const games = await fetchTeamSchedule(team.id, team.name);
    for (const game of games) {
      if (!allGames.has(game.id)) {
        allGames.set(game.id, game);
      }
    }
    
    console.log(` ${games.length} games`);
    scheduleCount++;
    
    // Rate limit
    if (i % 10 === 0 && i > 0) {
      await delay(500);
    }
  }
  
  // Convert to array and sort by date
  const gamesArray = Array.from(allGames.values())
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  
  // Group games by week
  const gamesByWeek = {};
  for (const game of gamesArray) {
    const weekNum = game.week || 1;
    const weekKey = `week_${String(weekNum).padStart(2, '0')}`;
    if (!gamesByWeek[weekKey]) {
      gamesByWeek[weekKey] = [];
    }
    gamesByWeek[weekKey].push(game);
  }
  
  // Save main schedule
  fs.writeFileSync(
    path.join(DATA_DIR, 'schedule.json'),
    JSON.stringify(gamesArray, null, 2)
  );
  console.log(`\n✅ Saved ${gamesArray.length} total games to data/schedule.json`);
  
  // Save weekly schedules
  for (const [weekKey, games] of Object.entries(gamesByWeek)) {
    fs.writeFileSync(
      path.join(DATA_DIR, `schedule_${weekKey}.json`),
      JSON.stringify(games, null, 2)
    );
  }
  console.log(`✅ Saved ${Object.keys(gamesByWeek).length} weekly schedule files\n`);
  
  // 3. Fetch pitcher rosters
  console.log('🎯 Fetching pitcher rosters...');
  const allPitchers = [];
  let rosterSuccess = 0;
  
  for (let i = 0; i < teams.length; i++) {
    const team = teams[i];
    process.stdout.write(`   [${i + 1}/${teams.length}] ${team.name}...`);
    
    const pitchers = await fetchTeamRoster(team.id, team.name);
    if (pitchers.length > 0) {
      allPitchers.push(...pitchers);
      rosterSuccess++;
      console.log(` ${pitchers.length} pitchers`);
    } else {
      console.log(' (no roster data)');
    }
    
    // Rate limit
    if (i % 10 === 0 && i > 0) {
      await delay(500);
    }
  }
  
  // Save pitchers
  fs.writeFileSync(
    path.join(DATA_DIR, 'pitchers.json'),
    JSON.stringify(allPitchers, null, 2)
  );
  console.log(`\n✅ Saved ${allPitchers.length} pitchers from ${rosterSuccess} teams to data/pitchers.json`);
  
  // Create empty participation index
  fs.writeFileSync(
    path.join(DATA_DIR, 'pitchers_played_index.json'),
    JSON.stringify({}, null, 2)
  );
  
  // Create empty favorites/watch files if they don't exist
  const emptyFiles = ['favorites.json', 'watch_history.json', 'watch_priority.json'];
  for (const file of emptyFiles) {
    const filePath = path.join(DATA_DIR, file);
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, file.includes('favorites') ? 
        JSON.stringify({ teams: [], pitchers: [], games: [] }) : 
        JSON.stringify(file.includes('history') ? [] : {})
      );
    }
  }
  
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('   ✅ DATA FETCH COMPLETE');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`   Teams:     ${teams.length}`);
  console.log(`   Games:     ${gamesArray.length}`);
  console.log(`   Pitchers:  ${allPitchers.length}`);
  console.log(`   Weeks:     ${Object.keys(gamesByWeek).length}`);
  console.log('═══════════════════════════════════════════════════════\n');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
