#!/usr/bin/env node
/**
 * Fetch 2025 CBB Season Data from ESPN API
 * Creates MLB-compatible data structures for schedule.html and roster.html
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');

// SEC Teams with ESPN IDs
const SEC_TEAMS = {
  '333': { name: 'Alabama', abbr: 'ALA', slug: 'alabama' },
  '8': { name: 'Arkansas', abbr: 'ARK', slug: 'arkansas' },
  '2': { name: 'Auburn', abbr: 'AUB', slug: 'auburn' },
  '57': { name: 'Florida', abbr: 'FLA', slug: 'florida' },
  '61': { name: 'Georgia', abbr: 'UGA', slug: 'georgia' },
  '96': { name: 'Kentucky', abbr: 'UK', slug: 'kentucky' },
  '99': { name: 'LSU', abbr: 'LSU', slug: 'lsu' },
  '344': { name: 'Mississippi State', abbr: 'MSST', slug: 'mississippi-state' },
  '142': { name: 'Missouri', abbr: 'MIZ', slug: 'missouri' },
  '201': { name: 'Oklahoma', abbr: 'OU', slug: 'oklahoma' },
  '145': { name: 'Ole Miss', abbr: 'MISS', slug: 'ole-miss' },
  '2579': { name: 'South Carolina', abbr: 'SC', slug: 'south-carolina' },
  '2633': { name: 'Tennessee', abbr: 'TENN', slug: 'tennessee' },
  '251': { name: 'Texas', abbr: 'TEX', slug: 'texas' },
  '245': { name: 'Texas A&M', abbr: 'TAMU', slug: 'texas-am' },
  '238': { name: 'Vanderbilt', abbr: 'VAN', slug: 'vanderbilt' }
};

// Also map by location name for matching
const SEC_BY_LOCATION = {
  'Alabama': '333', 'Arkansas': '8', 'Auburn': '2', 'Florida': '57',
  'Georgia': '61', 'Kentucky': '96', 'LSU': '99', 'Mississippi State': '344',
  'Missouri': '142', 'Oklahoma': '201', 'Ole Miss': '145', 'South Carolina': '2579',
  'Tennessee': '2633', 'Texas': '251', 'Texas A&M': '245', 'Vanderbilt': '238'
};

async function fetchJSON(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
  return response.json();
}

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Fetch all teams from ESPN
async function fetchTeams() {
  console.log('Fetching CBB teams...');
  const url = 'https://site.api.espn.com/apis/site/v2/sports/baseball/college-baseball/teams?limit=400';
  const data = await fetchJSON(url);
  
  const teams = [];
  for (const t of data.sports?.[0]?.leagues?.[0]?.teams || []) {
    const team = t.team;
    teams.push({
      id: team.id,
      team_id: team.id,
      team: team.displayName,
      displayName: team.displayName,
      abbr: team.abbreviation,
      logo: team.logos?.[0]?.href || `https://a.espncdn.com/i/teamlogos/ncaa/500/${team.id}.png`,
      logo_dark: team.logos?.[1]?.href || '',
      conference: SEC_TEAMS[team.id] ? 'SEC' : (team.groups?.parent?.abbreviation || 'Unknown'),
      color: team.color || '',
      location: team.location,
      nickname: team.shortDisplayName
    });
  }
  
  console.log(`  Found ${teams.length} teams`);
  return { teams };
}

// Fetch schedule for a date range
async function fetchScheduleForDate(dateStr) {
  const url = `https://site.api.espn.com/apis/site/v2/sports/baseball/college-baseball/scoreboard?dates=${dateStr}&limit=100`;
  const data = await fetchJSON(url);
  return data.events || [];
}

// Fetch full 2025 season schedule
async function fetchSchedule() {
  console.log('Fetching 2025 CBB schedule...');
  const games = [];
  
  // CBB season: Feb 14 - June 22, 2025
  const startDate = new Date('2025-02-14');
  const endDate = new Date('2025-06-22');
  
  let currentDate = new Date(startDate);
  let weekNum = 1;
  let lastWeekStart = new Date(startDate);
  
  while (currentDate <= endDate) {
    const dateStr = currentDate.toISOString().slice(0, 10).replace(/-/g, '');
    
    // Calculate week number (new week every 7 days from start)
    const daysSinceStart = Math.floor((currentDate - startDate) / (1000 * 60 * 60 * 24));
    weekNum = Math.floor(daysSinceStart / 7) + 1;
    
    try {
      const events = await fetchScheduleForDate(dateStr);
      
      for (const event of events) {
        const comp = event.competitions?.[0];
        if (!comp) continue;
        
        const home = comp.competitors?.find(c => c.homeAway === 'home');
        const away = comp.competitors?.find(c => c.homeAway === 'away');
        
        if (!home || !away) continue;
        
        games.push({
          id: event.id,
          espn_game_id: event.id,
          date: comp.date || event.date,
          week: weekNum,
          season: 2025,
          season_type: 2,
          home_team_id: home.team?.id,
          away_team_id: away.team?.id,
          home_team_name: home.team?.displayName,
          away_team_name: away.team?.displayName,
          venue: comp.venue?.fullName || '',
          city: comp.venue?.address?.city || '',
          state: comp.venue?.address?.state || '',
          status: comp.status?.type?.name?.toLowerCase() || 'scheduled',
          home_score: home.score || '0',
          away_score: away.score || '0',
          broadcast: comp.broadcast || '',
          home: home.team?.id,
          away: away.team?.id
        });
      }
      
      if (events.length > 0) {
        process.stdout.write(`\r  ${dateStr}: ${events.length} games (${games.length} total)`);
      }
    } catch (e) {
      // Skip errors for dates with no games
    }
    
    currentDate.setDate(currentDate.getDate() + 1);
    await delay(100); // Rate limit
  }
  
  console.log(`\n  Total: ${games.length} games`);
  return { games };
}

// Fetch roster for a team
async function fetchRoster(teamId) {
  try {
    const url = `https://site.api.espn.com/apis/site/v2/sports/baseball/college-baseball/teams/${teamId}/roster`;
    const data = await fetchJSON(url);
    
    const athletes = data.athletes || [];
    const pitchers = [];
    const allPlayers = [];
    
    for (const group of athletes) {
      for (const athlete of group.items || []) {
        const player = {
          id: athlete.id,
          player_id: athlete.id,
          name: athlete.fullName || athlete.displayName,
          firstName: athlete.firstName || '',
          lastName: athlete.lastName || '',
          displayName: athlete.displayName || athlete.fullName,
          number: athlete.jersey || '',
          position: athlete.position?.abbreviation || '',
          team_id: teamId,
          height: athlete.displayHeight || '',
          weight: athlete.displayWeight || '',
          year: athlete.experience?.abbreviation || '',
          headshot: athlete.headshot?.href || `https://a.espncdn.com/i/headshots/college-baseball/players/full/${athlete.id}.png`,
          espn_link: `https://www.espn.com/college-baseball/player/_/id/${athlete.id}`
        };
        
        allPlayers.push(player);
        
        // Check if pitcher
        const pos = (athlete.position?.abbreviation || '').toUpperCase();
        if (pos.includes('P') || pos === 'LHP' || pos === 'RHP') {
          pitchers.push(player);
        }
      }
    }
    
    return { pitchers, allPlayers };
  } catch (e) {
    return { pitchers: [], allPlayers: [] };
  }
}

// Fetch rosters for SEC teams
async function fetchPitchersEnhanced(teamsData) {
  console.log('Fetching SEC team rosters...');
  
  const teams = [];
  const secTeamIds = Object.keys(SEC_TEAMS);
  
  for (const teamId of secTeamIds) {
    const teamInfo = SEC_TEAMS[teamId];
    const teamData = teamsData.teams?.find(t => t.id === teamId || t.team_id === teamId);
    
    console.log(`  Fetching ${teamInfo.name}...`);
    const { pitchers, allPlayers } = await fetchRoster(teamId);
    
    teams.push({
      team_id: teamId,
      id: teamId,
      team: teamInfo.name,
      team_abbr: teamInfo.abbr,
      displayName: teamData?.displayName || teamInfo.name,
      conference: 'SEC',
      logo: teamData?.logo || `https://a.espncdn.com/i/teamlogos/ncaa/500/${teamId}.png`,
      pitchers: pitchers.map(p => ({
        ...p,
        team: teamInfo.name,
        team_abbr: teamInfo.abbr,
        role: p.position?.includes('LHP') ? 'LHP' : (p.position?.includes('RHP') ? 'RHP' : 'Pitcher')
      }))
    });
    
    await delay(200);
  }
  
  const totalPitchers = teams.reduce((sum, t) => sum + t.pitchers.length, 0);
  console.log(`  Found ${totalPitchers} pitchers across ${teams.length} SEC teams`);
  
  return {
    lastUpdated: new Date().toISOString(),
    totalPitchers,
    totalTeams: teams.length,
    teams
  };
}

// Create divisions map (conference mapping)
function createDivisionsMap(teamsData) {
  const map = {};
  for (const team of teamsData.teams || []) {
    map[team.id] = team.conference || 'Unknown';
  }
  return map;
}

// Main function
async function main() {
  console.log('=== CBB 2025 Data Fetcher ===\n');
  
  // Ensure data directory exists
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  
  try {
    // 1. Fetch teams
    const teamsData = await fetchTeams();
    fs.writeFileSync(
      path.join(DATA_DIR, 'teams.json'),
      JSON.stringify(teamsData, null, 2)
    );
    console.log('✓ Saved teams.json\n');
    
    // 2. Fetch schedule (this takes a while)
    console.log('Note: Schedule fetch will take several minutes...');
    const scheduleData = await fetchSchedule();
    fs.writeFileSync(
      path.join(DATA_DIR, 'schedule.json'),
      JSON.stringify(scheduleData, null, 2)
    );
    console.log('✓ Saved schedule.json\n');
    
    // 3. Create weekly schedule files
    const weeks = {};
    for (const game of scheduleData.games) {
      const weekNum = game.week || 1;
      const key = `schedule_week_${String(weekNum).padStart(2, '0')}.json`;
      if (!weeks[key]) weeks[key] = { games: [] };
      weeks[key].games.push(game);
    }
    
    for (const [filename, data] of Object.entries(weeks)) {
      fs.writeFileSync(path.join(DATA_DIR, filename), JSON.stringify(data, null, 2));
    }
    console.log(`✓ Created ${Object.keys(weeks).length} weekly schedule files\n`);
    
    // 4. Fetch pitchers/rosters for SEC teams
    const pitchersData = await fetchPitchersEnhanced(teamsData);
    fs.writeFileSync(
      path.join(DATA_DIR, 'pitchers_enhanced.json'),
      JSON.stringify(pitchersData, null, 2)
    );
    console.log('✓ Saved pitchers_enhanced.json\n');
    
    // 5. Create divisions map
    const divisionsMap = createDivisionsMap(teamsData);
    fs.writeFileSync(
      path.join(DATA_DIR, 'divisions_map.json'),
      JSON.stringify(divisionsMap, null, 2)
    );
    console.log('✓ Saved divisions_map.json\n');
    
    // 6. Initialize empty favorites if not exists
    const favoritesPath = path.join(DATA_DIR, 'favorites.json');
    if (!fs.existsSync(favoritesPath)) {
      fs.writeFileSync(favoritesPath, JSON.stringify({ pitchers: [], teams: [], games: [] }, null, 2));
      console.log('✓ Created favorites.json\n');
    }
    
    console.log('=== Done! ===');
    console.log(`Teams: ${teamsData.teams.length}`);
    console.log(`Games: ${scheduleData.games.length}`);
    console.log(`SEC Pitchers: ${pitchersData.totalPitchers}`);
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
