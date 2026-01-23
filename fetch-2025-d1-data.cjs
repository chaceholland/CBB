#!/usr/bin/env node
/**
 * Fetch 2025 D1 College Baseball Data from ESPN API
 * - All D1 teams
 * - 2025 schedules
 * - Pitcher rosters
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const SEASON = 2025;

// ESPN API endpoints for college baseball
const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/baseball/college-baseball';

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

async function fetchJSON(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }
  return response.json();
}

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Fetch all D1 teams
async function fetchAllTeams() {
  console.log('Fetching D1 teams...');
  const teams = [];
  
  // ESPN groups endpoint - get all groups/conferences
  const groupsUrl = `${ESPN_BASE}/groups?limit=100`;
  
  try {
    const groupsData = await fetchJSON(groupsUrl);
    const conferences = groupsData.groups || [];
    
    console.log(`Found ${conferences.length} conferences`);
    
    for (const conf of conferences) {
      console.log(`  Processing ${conf.name || conf.abbreviation}...`);
      
      // Fetch teams for this conference
      const confTeamsUrl = `${ESPN_BASE}/groups/${conf.id}/teams?limit=100`;
      try {
        const confData = await fetchJSON(confTeamsUrl);
        const confTeams = confData.teams || [];
        
        for (const t of confTeams) {
          teams.push({
            id: t.id,
            team_id: t.id,
            team: t.shortDisplayName || t.displayName,
            displayName: t.displayName,
            abbr: t.abbreviation,
            logo: t.logos?.[0]?.href || '',
            logo_dark: t.logos?.[1]?.href || t.logos?.[0]?.href || '',
            division: conf.name || 'Unknown',
            conference: conf.name || 'Unknown',
            conferenceId: conf.id,
            color: t.color || '000000',
            alternateColor: t.alternateColor || '000000',
            location: t.location || t.displayName,
            nickname: t.nickname || t.displayName,
            slug: t.slug || ''
          });
        }
        
        await delay(100);
      } catch (e) {
        console.log(`    Error fetching teams for ${conf.name}: ${e.message}`);
      }
    }
  } catch (e) {
    console.log(`Error fetching groups: ${e.message}`);
  }
  
  // Also try direct teams endpoint as fallback
  try {
    const teamsUrl = `${ESPN_BASE}/teams?limit=500`;
    const teamsData = await fetchJSON(teamsUrl);
    const directTeams = teamsData.sports?.[0]?.leagues?.[0]?.teams || [];
    
    console.log(`Direct teams endpoint found ${directTeams.length} teams`);
    
    for (const item of directTeams) {
      const t = item.team || item;
      const existingIdx = teams.findIndex(x => x.id === t.id);
      
      if (existingIdx === -1) {
        teams.push({
          id: t.id,
          team_id: t.id,
          team: t.shortDisplayName || t.displayName,
          displayName: t.displayName,
          abbr: t.abbreviation,
          logo: t.logos?.[0]?.href || '',
          logo_dark: t.logos?.[1]?.href || t.logos?.[0]?.href || '',
          division: 'Unknown',
          conference: 'Unknown',
          conferenceId: '',
          color: t.color || '000000',
          alternateColor: t.alternateColor || '000000',
          location: t.location || t.displayName,
          nickname: t.nickname || t.displayName,
          slug: t.slug || ''
        });
      }
    }
  } catch (e) {
    console.log(`Error with direct teams endpoint: ${e.message}`);
  }
  
  console.log(`Total teams collected: ${teams.length}`);
  return teams;
}

// Fetch schedule for a team
async function fetchTeamSchedule(teamId, teamName) {
  const url = `${ESPN_BASE}/teams/${teamId}/schedule?season=${SEASON}`;
  
  try {
    const data = await fetchJSON(url);
    const events = data.events || [];
    
    return events.map(e => {
      const comp = e.competitions?.[0] || {};
      const homeTeam = comp.competitors?.find(c => c.homeAway === 'home');
      const awayTeam = comp.competitors?.find(c => c.homeAway === 'away');
      
      return {
        id: e.id,
        espn_game_id: e.id,
        date: e.date,
        week: e.week?.number || 1,
        season: SEASON,
        season_type: e.seasonType?.id || 2,
        home_team_id: homeTeam?.team?.id || '',
        away_team_id: awayTeam?.team?.id || '',
        home_team_name: homeTeam?.team?.displayName || '',
        away_team_name: awayTeam?.team?.displayName || '',
        venue: comp.venue?.fullName || '',
        city: comp.venue?.address?.city || '',
        state: comp.venue?.address?.state || '',
        status: e.status?.type?.name || 'scheduled',
        home_score: homeTeam?.score || '',
        away_score: awayTeam?.score || '',
        broadcast: comp.broadcasts?.[0]?.names?.join(', ') || '',
        notes: comp.notes?.[0]?.headline || '',
        home: homeTeam?.team?.id || '',
        away: awayTeam?.team?.id || ''
      };
    });
  } catch (e) {
    console.log(`  Error fetching schedule for ${teamName}: ${e.message}`);
    return [];
  }
}

// Fetch roster for a team
async function fetchTeamRoster(teamId, teamName) {
  const url = `${ESPN_BASE}/teams/${teamId}/roster?season=${SEASON}`;
  
  try {
    const data = await fetchJSON(url);
    const athletes = data.athletes || [];
    const pitchers = [];
    
    for (const group of athletes) {
      const items = group.items || [];
      for (const p of items) {
        // Check if pitcher (position P or has pitching stats)
        const pos = p.position?.abbreviation || '';
        if (pos === 'P' || pos === 'RHP' || pos === 'LHP' || pos === 'SP' || pos === 'RP') {
          pitchers.push({
            id: p.id,
            name: p.displayName || p.fullName,
            firstName: p.firstName || '',
            lastName: p.lastName || '',
            jersey: p.jersey || '',
            position: pos,
            height: p.height || '',
            weight: p.weight || '',
            birthPlace: p.birthPlace?.city || '',
            headshot: p.headshot?.href || '',
            team_id: teamId,
            team_name: teamName,
            year: p.experience?.displayValue || '',
            bats: p.bats || '',
            throws: p.throws || ''
          });
        }
      }
    }
    
    return pitchers;
  } catch (e) {
    console.log(`  Error fetching roster for ${teamName}: ${e.message}`);
    return [];
  }
}

// Alternative: Fetch from scoreboard for schedule data
async function fetchScoreboardSchedule() {
  console.log('Fetching schedule from scoreboard...');
  const allGames = [];
  const seenGameIds = new Set();
  
  // Fetch multiple date ranges to get comprehensive schedule
  const startDate = new Date('2025-02-14'); // Season start
  const endDate = new Date('2025-06-30'); // Season end
  
  let currentDate = new Date(startDate);
  let batchCount = 0;
  
  while (currentDate <= endDate) {
    const dateStr = currentDate.toISOString().split('T')[0].replace(/-/g, '');
    const url = `${ESPN_BASE}/scoreboard?dates=${dateStr}&limit=200`;
    
    try {
      const data = await fetchJSON(url);
      const events = data.events || [];
      
      for (const e of events) {
        if (seenGameIds.has(e.id)) continue;
        seenGameIds.add(e.id);
        
        const comp = e.competitions?.[0] || {};
        const homeTeam = comp.competitors?.find(c => c.homeAway === 'home');
        const awayTeam = comp.competitors?.find(c => c.homeAway === 'away');
        
        allGames.push({
          id: e.id,
          espn_game_id: e.id,
          date: e.date,
          week: calculateWeek(e.date),
          season: SEASON,
          season_type: e.season?.type || 2,
          home_team_id: homeTeam?.team?.id || '',
          away_team_id: awayTeam?.team?.id || '',
          home_team_name: homeTeam?.team?.displayName || '',
          away_team_name: awayTeam?.team?.displayName || '',
          venue: comp.venue?.fullName || '',
          city: comp.venue?.address?.city || '',
          state: comp.venue?.address?.state || '',
          status: e.status?.type?.name || 'scheduled',
          home_score: homeTeam?.score || '',
          away_score: awayTeam?.score || '',
          broadcast: comp.broadcasts?.[0]?.names?.join(', ') || '',
          notes: comp.notes?.[0]?.headline || '',
          home: homeTeam?.team?.id || '',
          away: awayTeam?.team?.id || ''
        });
      }
      
      if (events.length > 0) {
        batchCount++;
        if (batchCount % 10 === 0) {
          console.log(`  ${dateStr}: ${allGames.length} total games`);
        }
      }
    } catch (e) {
      // Silently skip dates with no games
    }
    
    currentDate.setDate(currentDate.getDate() + 1);
    await delay(50);
  }
  
  console.log(`Total games from scoreboard: ${allGames.length}`);
  return allGames;
}

function calculateWeek(dateStr) {
  const gameDate = new Date(dateStr);
  const seasonStart = new Date('2025-02-14'); // Approx season start
  const diffMs = gameDate - seasonStart;
  const diffWeeks = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000));
  return Math.max(1, diffWeeks + 1);
}

async function main() {
  console.log('='.repeat(60));
  console.log(`Fetching 2025 D1 College Baseball Data`);
  console.log('='.repeat(60));
  
  // 1. Fetch teams
  const teams = await fetchAllTeams();
  fs.writeFileSync(
    path.join(DATA_DIR, 'teams.json'),
    JSON.stringify({ teams }, null, 2)
  );
  console.log(`Saved ${teams.length} teams to data/teams.json`);
  
  // 2. Fetch schedules - try scoreboard first for comprehensive data
  let allGames = await fetchScoreboardSchedule();
  
  // If scoreboard didn't get enough, try per-team
  if (allGames.length < 500 && teams.length > 0) {
    console.log('Fetching additional schedules per team...');
    const seenGameIds = new Set(allGames.map(g => g.id));
    
    for (let i = 0; i < Math.min(teams.length, 50); i++) {
      const team = teams[i];
      const teamGames = await fetchTeamSchedule(team.id, team.displayName);
      
      for (const g of teamGames) {
        if (!seenGameIds.has(g.id)) {
          seenGameIds.add(g.id);
          allGames.push(g);
        }
      }
      
      if (i % 10 === 0) {
        console.log(`  Processed ${i + 1}/${Math.min(teams.length, 50)} teams, ${allGames.length} games`);
      }
      await delay(100);
    }
  }
  
  // Sort by date
  allGames.sort((a, b) => new Date(a.date) - new Date(b.date));
  
  fs.writeFileSync(
    path.join(DATA_DIR, 'schedule.json'),
    JSON.stringify({ games: allGames }, null, 2)
  );
  console.log(`Saved ${allGames.length} games to data/schedule.json`);
  
  // 3. Fetch pitchers from rosters
  console.log('Fetching pitchers from team rosters...');
  const allPitchers = [];
  const pitchersByTeam = {};
  
  for (let i = 0; i < teams.length; i++) {
    const team = teams[i];
    const pitchers = await fetchTeamRoster(team.id, team.displayName);
    
    if (pitchers.length > 0) {
      pitchersByTeam[team.id] = pitchers;
      allPitchers.push(...pitchers);
      console.log(`  ${team.displayName}: ${pitchers.length} pitchers`);
    }
    
    if (i % 20 === 0 && i > 0) {
      console.log(`  Processed ${i}/${teams.length} teams, ${allPitchers.length} pitchers`);
    }
    await delay(100);
  }
  
  fs.writeFileSync(
    path.join(DATA_DIR, 'pitchers.json'),
    JSON.stringify({ pitchers: allPitchers }, null, 2)
  );
  console.log(`Saved ${allPitchers.length} pitchers to data/pitchers.json`);
  
  // 4. Create weekly schedule files
  console.log('Creating weekly schedule files...');
  const gamesByWeek = {};
  for (const game of allGames) {
    const week = game.week || 1;
    if (!gamesByWeek[week]) gamesByWeek[week] = [];
    gamesByWeek[week].push(game);
  }
  
  for (const [week, games] of Object.entries(gamesByWeek)) {
    const weekNum = String(week).padStart(2, '0');
    fs.writeFileSync(
      path.join(DATA_DIR, `schedule_week_${weekNum}.json`),
      JSON.stringify({ games }, null, 2)
    );
  }
  console.log(`Created ${Object.keys(gamesByWeek).length} weekly schedule files`);
  
  // 5. Initialize empty files for compatibility
  const emptyFiles = [
    'pitchers_played_index.json',
    'favorites.json',
    'watch_history.json',
    'watch_priority.json'
  ];
  
  for (const file of emptyFiles) {
    const filePath = path.join(DATA_DIR, file);
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify({}, null, 2));
    }
  }
  
  console.log('='.repeat(60));
  console.log('Data fetch complete!');
  console.log(`  Teams: ${teams.length}`);
  console.log(`  Games: ${allGames.length}`);
  console.log(`  Pitchers: ${allPitchers.length}`);
  console.log('='.repeat(60));
}

main().catch(console.error);
