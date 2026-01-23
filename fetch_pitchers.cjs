#!/usr/bin/env node

/**
 * ESPN MLB Pitcher Roster Fetcher
 * =================================
 * Fetches all pitchers from every MLB team roster
 * 
 * Usage: node fetch_pitchers.js
 * 
 * Output: data/pitchers.json
 * 
 * What it fetches:
 * - All pitchers from 30 MLB teams
 * - Player ID, name, number, position
 * - Height, weight, experience
 * - College/birthplace info
 * - Categorizes as Starter or Reliever (if available)
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// Ensure data directory exists
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const teamsFile = path.join(dataDir, 'teams.json');
const pitchersFile = path.join(dataDir, 'pitchers.json');

/**
 * Fetch JSON from URL with retry logic
 */
function fetchJSON(url, retries = 3) {
  return new Promise((resolve, reject) => {
    const attempt = (attemptsLeft) => {
      https.get(url, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            if (attemptsLeft > 0) {
              console.log(`  ⚠️  Parse error, retrying... (${attemptsLeft} attempts left)`);
              setTimeout(() => attempt(attemptsLeft - 1), 1000);
            } else {
              reject(e);
            }
          }
        });
      }).on('error', (e) => {
        if (attemptsLeft > 0) {
          console.log(`  ⚠️  Network error, retrying... (${attemptsLeft} attempts left)`);
          setTimeout(() => attempt(attemptsLeft - 1), 1000);
        } else {
          reject(e);
        }
      });
    };
    attempt(retries);
  });
}

/**
 * Delay helper
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetch roster for a specific team
 */
async function fetchTeamRoster(teamId, teamName) {
  const url = `https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/teams/${teamId}/roster`;
  
  try {
    console.log(`  Fetching roster for ${teamName}...`);
    const data = await fetchJSON(url);
    
    // ESPN returns roster grouped by position
    let pitchers = [];
    
    if (data.athletes && Array.isArray(data.athletes)) {
      // Find the "Pitchers" group
      const pitcherGroup = data.athletes.find(group => 
        group.position === 'Pitchers' || 
        group.position === 'Pitcher' ||
        (group.position && group.position.toLowerCase().includes('pitcher'))
      );
      
      if (pitcherGroup && pitcherGroup.items) {
        pitchers = pitcherGroup.items;
      }
    }
    
    console.log(`  ✅ Found ${pitchers.length} pitchers on ${teamName}`);
    return pitchers;
    
  } catch (error) {
    console.error(`  ❌ Error fetching ${teamName}: ${error.message}`);
    return [];
  }
}

/**
 * Parse pitcher data
 */
function parsePitcher(athlete, teamId, teamName, teamAbbr) {
  // Since all are in "Pitchers" group, we can't differentiate SP/RP from this endpoint
  // Role will need to be determined from game data or stats
  const role = 'Pitcher'; // Generic since ESPN doesn't provide SP/RP in roster
  
  return {
    id: String(athlete.id),
    player_id: String(athlete.id),
    name: athlete.fullName || athlete.displayName || 'Unknown',
    firstName: athlete.firstName || '',
    lastName: athlete.lastName || '',
    displayName: athlete.displayName || athlete.fullName || '',
    shortName: athlete.shortName || '',
    number: athlete.jersey || '',
    position: 'P',
    role: role,
    team_id: String(teamId),
    team: teamName,
    team_abbr: teamAbbr,
    height: athlete.displayHeight || athlete.height || '',
    weight: athlete.displayWeight || athlete.weight || '',
    age: athlete.age || null,
    dateOfBirth: athlete.dateOfBirth || '',
    espn_link: athlete.links?.[0]?.href || `https://www.espn.com/mlb/player/_/id/${athlete.id}`,
    headshot: `https://a.espncdn.com/i/headshots/mlb/players/full/${athlete.id}.png`
  };
}

/**
 * Main function
 */
async function main() {
  console.log('🔍 MLB Pitcher Roster Fetcher');
  console.log('==============================\n');
  
  // Check if teams.json exists
  if (!fs.existsSync(teamsFile)) {
    console.error('❌ Error: teams.json not found!');
    console.error('Please run: node espn-api-fetcher.cjs first\n');
    process.exit(1);
  }
  
  // Load teams
  console.log('📂 Loading teams...');
  const teamsData = JSON.parse(fs.readFileSync(teamsFile, 'utf8'));
  const teams = teamsData.teams || [];
  console.log(`✅ Loaded ${teams.length} teams\n`);
  
  if (teams.length === 0) {
    console.error('❌ Error: No teams found in teams.json\n');
    process.exit(1);
  }
  
  // Fetch pitchers for each team
  console.log('⚾ Fetching pitchers from all teams...\n');
  
  const allPitchers = [];
  const pitchersByTeam = {};
  
  for (let i = 0; i < teams.length; i++) {
    const team = teams[i];
    const teamId = team.team_id || team.id;
    const teamName = team.displayName || team.team;
    const teamAbbr = team.abbr;
    
    console.log(`[${i + 1}/${teams.length}] ${teamName} (${teamAbbr})`);
    
    // Fetch roster
    const pitchers = await fetchTeamRoster(teamId, teamName);
    
    // Parse pitchers
    const parsedPitchers = pitchers.map(p => 
      parsePitcher(p, teamId, teamName, teamAbbr)
    );
    
    allPitchers.push(...parsedPitchers);
    pitchersByTeam[teamAbbr] = parsedPitchers;
    
    // Delay to be nice to ESPN's servers
    if (i < teams.length - 1) {
      await delay(500);
    }
  }
  
  console.log('\n📊 Summary:');
  console.log(`   Total pitchers: ${allPitchers.length}`);
  console.log(`   Teams with rosters: ${Object.keys(pitchersByTeam).filter(t => pitchersByTeam[t].length > 0).length}/30`);
  
  // Show teams with most pitchers
  const teamCounts = Object.entries(pitchersByTeam)
    .map(([abbr, pitchers]) => ({ abbr, count: pitchers.length }))
    .filter(t => t.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  
  if (teamCounts.length > 0) {
    console.log(`\n   Top teams by roster size:`);
    teamCounts.forEach(t => {
      console.log(`   - ${t.abbr}: ${t.count} pitchers`);
    });
  }
  
  // Save to file
  console.log('\n💾 Saving pitchers...');
  
  const output = {
    lastUpdated: new Date().toISOString(),
    totalPitchers: allPitchers.length,
    teams: teams.length,
    pitchers: allPitchers,
    pitchersByTeam: pitchersByTeam
  };
  
  fs.writeFileSync(pitchersFile, JSON.stringify(output, null, 2));
  console.log(`✅ Saved to: ${pitchersFile}`);
  
  console.log('\n✨ Done!\n');
}

// Run
main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
