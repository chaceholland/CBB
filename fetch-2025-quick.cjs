#!/usr/bin/env node
/**
 * Quick fetch of 2025 CBB data - just SEC teams and sample games
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');

// SEC Teams with ESPN IDs  
const SEC_TEAMS = {
  '333': { name: 'Alabama', abbr: 'ALA' },
  '8': { name: 'Arkansas', abbr: 'ARK' },
  '2': { name: 'Auburn', abbr: 'AUB' },
  '57': { name: 'Florida', abbr: 'FLA' },
  '61': { name: 'Georgia', abbr: 'UGA' },
  '96': { name: 'Kentucky', abbr: 'UK' },
  '99': { name: 'LSU', abbr: 'LSU' },
  '344': { name: 'Mississippi State', abbr: 'MSST' },
  '142': { name: 'Missouri', abbr: 'MIZ' },
  '201': { name: 'Oklahoma', abbr: 'OU' },
  '145': { name: 'Ole Miss', abbr: 'MISS' },
  '2579': { name: 'South Carolina', abbr: 'SC' },
  '2633': { name: 'Tennessee', abbr: 'TENN' },
  '251': { name: 'Texas', abbr: 'TEX' },
  '245': { name: 'Texas A&M', abbr: 'TAMU' },
  '238': { name: 'Vanderbilt', abbr: 'VAN' }
};

async function fetchJSON(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

async function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log('=== Quick CBB 2025 Data Fetch ===\n');
  
  // 1. Fetch all teams
  console.log('Fetching teams...');
  const teamsUrl = 'https://site.api.espn.com/apis/site/v2/sports/baseball/college-baseball/teams?limit=400';
  const teamsResp = await fetchJSON(teamsUrl);
  
  const teams = { teams: [] };
  for (const t of teamsResp.sports?.[0]?.leagues?.[0]?.teams || []) {
    const team = t.team;
    teams.teams.push({
      id: team.id, team_id: team.id,
      team: team.displayName, displayName: team.displayName,
      abbr: team.abbreviation,
      logo: team.logos?.[0]?.href || `https://a.espncdn.com/i/teamlogos/ncaa/500/${team.id}.png`,
      conference: SEC_TEAMS[team.id] ? 'SEC' : 'Other',
      color: team.color || '', location: team.location, nickname: team.shortDisplayName
    });
  }
  fs.writeFileSync(path.join(DATA_DIR, 'teams.json'), JSON.stringify(teams, null, 2));
  console.log(`  ✓ ${teams.teams.length} teams saved\n`);

  // 2. Fetch sample schedule (March 1-7 only for speed)
  console.log('Fetching sample schedule (March 1-7)...');
  const games = [];
  for (let day = 1; day <= 7; day++) {
    const dateStr = `202503${String(day).padStart(2, '0')}`;
    try {
      const url = `https://site.api.espn.com/apis/site/v2/sports/baseball/college-baseball/scoreboard?dates=${dateStr}&limit=100`;
      const data = await fetchJSON(url);
      for (const event of data.events || []) {
        const comp = event.competitions?.[0];
        const home = comp?.competitors?.find(c => c.homeAway === 'home');
        const away = comp?.competitors?.find(c => c.homeAway === 'away');
        if (home && away) {
          games.push({
            id: event.id, espn_game_id: event.id, date: comp.date,
            week: 3, season: 2025, season_type: 2,
            home_team_id: home.team?.id, away_team_id: away.team?.id,
            home_team_name: home.team?.displayName, away_team_name: away.team?.displayName,
            venue: comp.venue?.fullName || '', city: comp.venue?.address?.city || '',
            state: comp.venue?.address?.state || '',
            status: comp.status?.type?.name?.toLowerCase() || 'scheduled',
            home_score: home.score || '0', away_score: away.score || '0',
            broadcast: comp.broadcast || '', home: home.team?.id, away: away.team?.id
          });
        }
      }
      process.stdout.write(`\r  Day ${day}: ${games.length} games total`);
    } catch (e) {}
    await delay(100);
  }
  console.log(`\n  ✓ ${games.length} games saved\n`);
  
  fs.writeFileSync(path.join(DATA_DIR, 'schedule.json'), JSON.stringify({ games }, null, 2));
  fs.writeFileSync(path.join(DATA_DIR, 'schedule_week_03.json'), JSON.stringify({ games }, null, 2));

  // 3. Fetch SEC rosters
  console.log('Fetching SEC team rosters...');
  const pitcherTeams = [];
  
  for (const [teamId, info] of Object.entries(SEC_TEAMS)) {
    process.stdout.write(`\r  ${info.name}...`);
    const teamData = teams.teams.find(t => t.id === teamId);
    
    try {
      const url = `https://site.api.espn.com/apis/site/v2/sports/baseball/college-baseball/teams/${teamId}/roster`;
      const data = await fetchJSON(url);
      
      const pitchers = [];
      for (const group of data.athletes || []) {
        for (const a of group.items || []) {
          const pos = (a.position?.abbreviation || '').toUpperCase();
          if (pos.includes('P') || pos === 'LHP' || pos === 'RHP') {
            pitchers.push({
              id: a.id, player_id: a.id, name: a.fullName || a.displayName,
              firstName: a.firstName || '', lastName: a.lastName || '',
              displayName: a.displayName, number: a.jersey || '', position: pos,
              team_id: teamId, team: info.name, team_abbr: info.abbr,
              height: a.displayHeight || '', weight: a.displayWeight || '',
              year: a.experience?.abbreviation || '',
              headshot: a.headshot?.href || `https://a.espncdn.com/i/headshots/college-baseball/players/full/${a.id}.png`,
              espn_link: `https://www.espn.com/college-baseball/player/_/id/${a.id}`,
              role: pos.includes('LHP') ? 'LHP' : (pos.includes('RHP') ? 'RHP' : 'Pitcher')
            });
          }
        }
      }
      
      pitcherTeams.push({
        team_id: teamId, id: teamId, team: info.name, team_abbr: info.abbr,
        displayName: teamData?.displayName || info.name, conference: 'SEC',
        logo: teamData?.logo, pitchers
      });
    } catch (e) {
      pitcherTeams.push({ team_id: teamId, id: teamId, team: info.name, team_abbr: info.abbr,
        displayName: info.name, conference: 'SEC', logo: `https://a.espncdn.com/i/teamlogos/ncaa/500/${teamId}.png`, pitchers: [] });
    }
    await delay(200);
  }
  
  const totalP = pitcherTeams.reduce((s, t) => s + t.pitchers.length, 0);
  console.log(`\n  ✓ ${totalP} pitchers across ${pitcherTeams.length} SEC teams\n`);
  
  fs.writeFileSync(path.join(DATA_DIR, 'pitchers_enhanced.json'), JSON.stringify({
    lastUpdated: new Date().toISOString(), totalPitchers: totalP, totalTeams: 16, teams: pitcherTeams
  }, null, 2));
  
  // 4. Create divisions map
  const divMap = {};
  for (const t of teams.teams) divMap[t.id] = SEC_TEAMS[t.id] ? 'SEC' : 'Other';
  fs.writeFileSync(path.join(DATA_DIR, 'divisions_map.json'), JSON.stringify(divMap, null, 2));
  
  // 5. Create favorites if missing
  const favPath = path.join(DATA_DIR, 'favorites.json');
  if (!fs.existsSync(favPath)) {
    fs.writeFileSync(favPath, JSON.stringify({ pitchers: [], teams: [], games: [] }, null, 2));
  }
  
  console.log('=== Done! ===');
}

main().catch(e => { console.error(e); process.exit(1); });
