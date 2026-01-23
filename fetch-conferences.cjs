#!/usr/bin/env node

/**
 * ESPN College Baseball Conference Mapper
 * ========================================
 * Builds a comprehensive map of conference IDs to names
 * by fetching conference standings and team data
 * 
 * Usage: node fetch-conferences.cjs
 * 
 * Output: data/conferences_map.json
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const DATA_DIR = path.join(__dirname, 'data');
const OUTPUT_FILE = path.join(DATA_DIR, 'conferences_map.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
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
 * Fetch conference groups from standings
 */
async function fetchConferenceGroups() {
  console.log('🔍 Fetching conference groups from ESPN...\n');
  
  const url = 'https://site.web.api.espn.com/apis/v2/sports/baseball/college-baseball/standings?season=2025';
  
  try {
    const response = await fetchJSON(url);
    const conferenceMap = {};
    
    // NCAA Baseball has nested structure
    if (response.children && Array.isArray(response.children)) {
      for (const division of response.children) {
        console.log(`📋 Processing ${division.name || 'Division'}...`);
        
        // Division I usually has conferences as children
        if (division.children && Array.isArray(division.children)) {
          for (const conference of division.children) {
            if (conference.id && conference.name) {
              conferenceMap[conference.id] = conference.name;
              console.log(`  ✓ ${conference.id}: ${conference.name}`);
            }
          }
        }
      }
    }
    
    return conferenceMap;
  } catch (error) {
    console.error('❌ Error fetching conference groups:', error.message);
    return {};
  }
}

/**
 * Fetch individual team details to build conference map
 */
async function buildConferenceMapFromTeams() {
  console.log('\n🔍 Building conference map from team data...\n');
  
  // Read existing teams
  const teamsFile = path.join(DATA_DIR, 'teams.json');
  if (!fs.existsSync(teamsFile)) {
    console.error('❌ teams.json not found. Run espn-api-fetcher.cjs first.');
    return {};
  }
  
  const teamsData = JSON.parse(fs.readFileSync(teamsFile, 'utf8'));
  const teams = teamsData.teams || [];
  
  const conferenceMap = {};
  const teamGroups = new Map(); // group ID -> list of team names
  
  console.log(`📋 Fetching details for ${teams.length} teams...`);
  console.log('   (This will take a few minutes)\n');
  
  for (let i = 0; i < teams.length; i++) {
    const team = teams[i];
    const teamId = team.id || team.team_id;
    
    if (!teamId) continue;
    
    if (i % 50 === 0) {
      console.log(`   Progress: ${i}/${teams.length} teams processed...`);
    }
    
    try {
      const url = `https://site.api.espn.com/apis/site/v2/sports/baseball/college-baseball/teams/${teamId}`;
      const teamDetail = await fetchJSON(url);
      
      if (teamDetail.team && teamDetail.team.groups && teamDetail.team.groups.id) {
        const groupId = String(teamDetail.team.groups.id);
        
        // Track teams in each group to help identify conference names
        if (!teamGroups.has(groupId)) {
          teamGroups.set(groupId, []);
        }
        teamGroups.get(groupId).push(team.displayName || team.team);
      }
      
      // Throttle to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 150));
      
    } catch (error) {
      // Silently continue on error
    }
  }
  
  console.log(`\n✅ Processed ${teams.length} teams`);
  console.log(`   Found ${teamGroups.size} unique groups\n`);
  
  // Infer conference names from known teams
  const knownConferences = {
    'SEC': ['Tennessee', 'Alabama', 'Auburn', 'LSU', 'Mississippi State', 'Arkansas', 'Florida', 'Georgia', 'Kentucky', 'Ole Miss', 'South Carolina', 'Vanderbilt', 'Missouri', 'Texas A&M'],
    'ACC': ['Clemson', 'Duke', 'Florida State', 'Georgia Tech', 'Louisville', 'Miami', 'NC State', 'North Carolina', 'Notre Dame', 'Pitt', 'Virginia', 'Virginia Tech', 'Wake Forest', 'Boston College'],
    'Big 12': ['Baylor', 'Kansas', 'Kansas State', 'Oklahoma State', 'TCU', 'Texas', 'Texas Tech', 'West Virginia', 'Oklahoma', 'BYU', 'Cincinnati', 'Houston', 'UCF'],
    'Big Ten': ['Illinois', 'Indiana', 'Iowa', 'Maryland', 'Michigan', 'Michigan State', 'Minnesota', 'Nebraska', 'Northwestern', 'Ohio State', 'Penn State', 'Purdue', 'Rutgers', 'Wisconsin'],
    'Pac-12': ['Arizona', 'Arizona State', 'Cal', 'Oregon', 'Oregon State', 'Stanford', 'UCLA', 'USC', 'Utah', 'Washington', 'Washington State'],
    'American': ['East Carolina', 'Memphis', 'South Florida', 'Tulane', 'Wichita State', 'Charlotte', 'FAU', 'North Texas', 'Rice', 'UAB', 'UTSA'],
    'Conference USA': ['FIU', 'Jacksonville State', 'Louisiana Tech', 'Middle Tennessee', 'New Mexico State', 'Sam Houston', 'UTEP', 'Western Kentucky'],
    'Sun Belt': ['Coastal Carolina', 'Georgia Southern', 'Georgia State', 'James Madison', 'Marshall', 'Old Dominion', 'Southern Miss', 'App State', 'Arkansas State', 'Louisiana', 'South Alabama', 'Texas State', 'Troy', 'ULM'],
    'Atlantic 10': ['Dayton', 'Fordham', 'George Mason', 'George Washington', 'La Salle', 'Massachusetts', 'Rhode Island', 'Richmond', 'Saint Joseph\'s', 'Saint Louis', 'St. Bonaventure', 'VCU', 'Davidson', 'Duquesne'],
    'Big East': ['Butler', 'Creighton', 'Georgetown', 'Marquette', 'Providence', 'Seton Hall', 'St. John\'s', 'UConn', 'Villanova', 'Xavier'],
    'Big West': ['Cal Poly', 'Cal State Fullerton', 'Cal State Northridge', 'Hawai\'i', 'Long Beach State', 'UC Davis', 'UC Irvine', 'UC Riverside', 'UC San Diego', 'UC Santa Barbara'],
    'Colonial': ['Charleston', 'Delaware', 'Drexel', 'Elon', 'Hampton', 'Hofstra', 'Monmouth', 'Northeastern', 'Stony Brook', 'Towson', 'UNC Wilmington', 'William & Mary'],
    'Ivy League': ['Brown', 'Columbia', 'Cornell', 'Dartmouth', 'Harvard', 'Penn', 'Princeton', 'Yale'],
    'MAAC': ['Canisius', 'Fairfield', 'Iona', 'Manhattan', 'Marist', 'Niagara', 'Quinnipiac', 'Rider', 'Siena', 'St. Peter\'s'],
    'Mountain West': ['Air Force', 'Fresno State', 'Nevada', 'New Mexico', 'San Diego State', 'San Jose State', 'UNLV'],
    'Southern': ['The Citadel', 'East Tennessee State', 'Furman', 'Mercer', 'Samford', 'UNC Greensboro', 'VMI', 'Western Carolina', 'Wofford'],
    'Southland': ['Houston Christian', 'Incarnate Word', 'Lamar', 'McNeese', 'Nicholls', 'Northwestern State', 'SE Louisiana', 'Texas A&M-CC']
  };
  
  // Match groups to conferences
  for (const [groupId, teamNames] of teamGroups.entries()) {
    let matchedConference = null;
    let maxMatches = 0;
    
    for (const [confName, confTeams] of Object.entries(knownConferences)) {
      let matches = 0;
      for (const teamName of teamNames) {
        for (const confTeam of confTeams) {
          if (teamName.includes(confTeam) || confTeam.includes(teamName.split(' ')[0])) {
            matches++;
            break;
          }
        }
      }
      
      if (matches > maxMatches) {
        maxMatches = matches;
        matchedConference = confName;
      }
    }
    
    if (matchedConference && maxMatches >= 3) {
      conferenceMap[groupId] = matchedConference;
      console.log(`✓ Group ${groupId}: ${matchedConference} (${maxMatches} matches)`);
    } else if (teamNames.length > 0) {
      console.log(`? Group ${groupId}: Unknown (${teamNames.length} teams: ${teamNames.slice(0, 3).join(', ')}...)`);
    }
  }
  
  return conferenceMap;
}

/**
 * Main function
 */
async function main() {
  console.log('⚾ ESPN Conference Mapper');
  console.log('========================\n');
  
  // Try fetching from standings first
  let conferenceMap = await fetchConferenceGroups();
  
  // Build from individual teams
  const teamConferences = await buildConferenceMapFromTeams();
  
  // Merge the maps
  conferenceMap = { ...conferenceMap, ...teamConferences };
  
  // Save to file
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(conferenceMap, null, 2));
  
  console.log(`\n✅ Conference map saved to: ${OUTPUT_FILE}`);
  console.log(`   Total conferences mapped: ${Object.keys(conferenceMap).length}`);
  
  console.log('\n📊 Conference Breakdown:');
  const confCounts = {};
  Object.values(conferenceMap).forEach(conf => {
    confCounts[conf] = (confCounts[conf] || 0) + 1;
  });
  Object.entries(confCounts)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .forEach(([conf, count]) => {
      console.log(`  ${conf}: ${count} group(s)`);
    });
}

main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
