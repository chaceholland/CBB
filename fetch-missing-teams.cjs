#!/usr/bin/env node

/**
 * Fetch Missing Teams Script
 * ============================
 * Scans schedule.json for team IDs not in teams.json
 * and fetches their data from ESPN API.
 * 
 * Usage: node fetch-missing-teams.cjs
 * 
 * Input: data/schedule.json, data/teams.json
 * Output: Updated data/teams.json
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const DATA_DIR = path.join(__dirname, 'data');
const TEAMS_FILE = path.join(DATA_DIR, 'teams.json');
const SCHEDULE_FILE = path.join(DATA_DIR, 'schedule.json');

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
 * Fetch team data from ESPN
 */
async function fetchTeamFromESPN(teamId) {
  const url = `https://site.api.espn.com/apis/site/v2/sports/baseball/college-baseball/teams/${teamId}`;
  
  try {
    const response = await fetchJSON(url);
    const team = response.team;
    
    if (!team) return null;
    
    return {
      id: String(team.id || teamId),
      team_id: String(team.id || teamId),
      team: team.name || team.displayName || '',
      displayName: team.displayName || team.name || '',
      abbr: team.abbreviation || team.shortDisplayName || '',
      logo: team.logos?.[0]?.href || `https://a.espncdn.com/i/teamlogos/ncaa/500/${teamId}.png`,
      logo_dark: team.logos?.[1]?.href || `https://a.espncdn.com/i/teamlogos/ncaa/500-dark/${teamId}.png`,
      conference: team.groups?.conference?.name || 'Unknown',
      conferenceId: String(team.groups?.conference?.id || ''),
      color: team.color || '',
      alternateColor: team.alternateColor || '',
      location: team.location || '',
      nickname: team.nickname || ''
    };
  } catch (error) {
    console.error(`  ⚠️  Error fetching team ${teamId}:`, error.message);
    return null;
  }
}

/**
 * Main function
 */
async function fetchMissingTeams() {
  console.log('🔍 Scanning for Missing Teams');
  console.log('==============================\n');
  
  // Load existing teams
  let teamsData = { teams: [] };
  if (fs.existsSync(TEAMS_FILE)) {
    teamsData = JSON.parse(fs.readFileSync(TEAMS_FILE, 'utf8'));
  }
  
  const existingTeamIds = new Set(teamsData.teams.map(t => String(t.id)));
  console.log(`📋 Existing teams: ${existingTeamIds.size}`);
  
  // Load schedule
  if (!fs.existsSync(SCHEDULE_FILE)) {
    console.error('❌ Schedule file not found:', SCHEDULE_FILE);
    console.error('   Run: node tools/fetch_schedule.js first');
    process.exit(1);
  }
  
  const scheduleData = JSON.parse(fs.readFileSync(SCHEDULE_FILE, 'utf8'));
  const games = scheduleData.games || [];
  
  // Collect all team IDs from schedule
  const scheduleTeamIds = new Set();
  games.forEach(game => {
    if (game.home_team_id) scheduleTeamIds.add(String(game.home_team_id));
    if (game.away_team_id) scheduleTeamIds.add(String(game.away_team_id));
  });
  
  console.log(`📅 Teams in schedule: ${scheduleTeamIds.size}`);
  
  // Find missing teams
  const missingTeamIds = [...scheduleTeamIds].filter(id => !existingTeamIds.has(id));
  
  if (missingTeamIds.length === 0) {
    console.log('\n✅ No missing teams! All teams in schedule are already in database.');
    return;
  }
  
  console.log(`\n🔎 Found ${missingTeamIds.length} missing teams:`);
  missingTeamIds.forEach(id => console.log(`  - Team ID: ${id}`));
  
  console.log('\n📥 Fetching missing teams from ESPN...\n');
  
  let fetchedCount = 0;
  let errorCount = 0;
  
  for (const teamId of missingTeamIds) {
    console.log(`  Fetching team ${teamId}...`);
    
    const teamData = await fetchTeamFromESPN(teamId);
    
    if (teamData) {
      teamsData.teams.push(teamData);
      console.log(`    ✓ ${teamData.displayName} (${teamData.conference})`);
      fetchedCount++;
    } else {
      console.log(`    ❌ Failed to fetch`);
      errorCount++;
    }
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  // Sort teams by name
  teamsData.teams.sort((a, b) => a.displayName.localeCompare(b.displayName));
  
  // Update meta
  teamsData._meta = {
    ...(teamsData._meta || {}),
    lastUpdate: new Date().toISOString(),
    totalTeams: teamsData.teams.length
  };
  
  // Save updated teams file
  fs.writeFileSync(TEAMS_FILE, JSON.stringify(teamsData, null, 2));
  
  console.log('\n' + '='.repeat(50));
  console.log('✅ Update complete!');
  console.log(`📁 Saved to: ${TEAMS_FILE}`);
  console.log(`\n📊 Summary:`);
  console.log(`   Previously existing: ${existingTeamIds.size}`);
  console.log(`   Successfully added: ${fetchedCount}`);
  console.log(`   Errors: ${errorCount}`);
  console.log(`   Total teams now: ${teamsData.teams.length}`);
}

// Run
fetchMissingTeams().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
