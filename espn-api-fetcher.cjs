#!/usr/bin/env node

/**
 * ESPN D1 Baseball Teams Fetcher
 * ================================
 * Fetches all D1 college baseball teams from ESPN API
 * 
 * Usage: node espn-api-fetcher.cjs
 * 
 * Output: data/teams.json
 * 
 * What it fetches:
 * - Team ID, name, display name, abbreviation
 * - Team logos (light and dark variants)
 * - Conference information
 * - Team colors
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
const confMapFile = path.join(dataDir, 'conferences_map.json');

// ESPN Baseball API endpoint
const BASEBALL_TEAMS_URL = 'https://site.api.espn.com/apis/site/v2/sports/baseball/college-baseball/teams?limit=400';

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
 * Extract team data from ESPN response
 */
function extractTeamData(espnTeam, conferenceMap) {
  const team = espnTeam.team || {};
  const teamId = String(team.id || '');
  
  // Get conference from team ID map
  const conference = conferenceMap[teamId] || 'Independent';
  
  return {
    id: teamId,
    team_id: teamId,
    team: team.name || team.displayName || '',
    displayName: team.displayName || team.name || '',
    abbr: team.abbreviation || team.shortDisplayName || '',
    logo: team.logos?.[0]?.href || `https://a.espncdn.com/i/teamlogos/ncaa/500/${team.id}.png`,
    logo_dark: team.logos?.[1]?.href || `https://a.espncdn.com/i/teamlogos/ncaa/500-dark/${team.id}.png`,
    conference: conference,
    conferenceId: '',
    color: team.color || '',
    alternateColor: team.alternateColor || '',
    location: team.location || '',
    nickname: team.nickname || ''
  };
}

/**
 * Main fetch function
 */
async function fetchTeams() {
  console.log('🔍 Fetching D1 Baseball teams from ESPN...\n');
  
  // Load conference map if it exists
  let conferenceMap = {};
  if (fs.existsSync(confMapFile)) {
    try {
      conferenceMap = JSON.parse(fs.readFileSync(confMapFile, 'utf8'));
      console.log(`✓ Loaded conference map with ${Object.keys(conferenceMap).length} teams mapped\n`);
    } catch (e) {
      console.log('⚠️  Could not load conference map, conferences will show as Independent\n');
    }
  } else {
    console.log('⚠️  Conference map not found. Run build-static-conference-map.cjs first.\n');
  }
  
  try {
    const response = await fetchJSON(BASEBALL_TEAMS_URL);
    
    if (!response.sports || !response.sports[0] || !response.sports[0].leagues) {
      throw new Error('Invalid response structure from ESPN');
    }
    
    const leagues = response.sports[0].leagues;
    const allTeams = [];
    
    // Collect all teams
    for (const league of leagues) {
      if (league.teams && Array.isArray(league.teams)) {
        console.log(`📋 Processing ${league.name || 'Division'}...`);
        
        for (const espnTeam of league.teams) {
          const teamData = extractTeamData(espnTeam, conferenceMap);
          if (teamData.id) {
            allTeams.push(teamData);
            console.log(`  ✓ ${teamData.displayName} (${teamData.conference})`);
          }
        }
      }
    }
    
    // Sort teams by name
    allTeams.sort((a, b) => a.displayName.localeCompare(b.displayName));
    
    // Create output object
    const output = {
      teams: allTeams,
      _meta: {
        fetchDate: new Date().toISOString(),
        source: 'ESPN API',
        sport: 'college-baseball',
        count: allTeams.length
      }
    };
    
    // Write to file
    fs.writeFileSync(teamsFile, JSON.stringify(output, null, 2));
    
    console.log(`\n✅ Successfully fetched ${allTeams.length} teams`);
    console.log(`📁 Saved to: ${teamsFile}`);
    
    // Show conference breakdown
    const confCounts = {};
    allTeams.forEach(t => {
      confCounts[t.conference] = (confCounts[t.conference] || 0) + 1;
    });
    
    console.log('\n📊 Conference breakdown:');
    Object.entries(confCounts)
      .sort((a, b) => b[1] - a[1])
      .forEach(([conf, count]) => {
        console.log(`  ${conf}: ${count} teams`);
      });
    
  } catch (error) {
    console.error('❌ Error fetching teams:', error.message);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  fetchTeams();
}

module.exports = { fetchTeams, extractTeamData };
