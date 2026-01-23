#!/usr/bin/env node

/**
 * Fetch Pitcher Rosters
 * 
 * Fetches pitcher rosters for all teams in teams.json
 * Creates data/pitchers.json with pitcher info
 * 
 * Usage: node fetch-pitcher-rosters.cjs
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// Configuration
const DATA_DIR = './data';
const TEAMS_FILE = path.join(DATA_DIR, 'teams.json');
const OUTPUT_FILE = path.join(DATA_DIR, 'pitchers.json');
const BACKUP_FILE = path.join(DATA_DIR, 'pitchers_backup.json');
const THROTTLE_MS = 350; // Delay between API calls

// Utility: Make HTTPS request
function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Failed to parse JSON from ${url}: ${e.message}`));
        }
      });
    }).on('error', reject);
  });
}

// Fetch roster for a team
async function fetchTeamRoster(teamId) {
  try {
    const url = `https://site.web.api.espn.com/apis/common/v3/sports/baseball/college-baseball/teams/${teamId}/roster`;
    const data = await httpsGet(url);
    
    return data.athletes || [];
  } catch (err) {
    console.log(`  ⚠️  Failed to fetch roster for team ${teamId}: ${err.message}`);
    return [];
  }
}

// Extract pitcher information from athlete data
function extractPitcherInfo(athlete) {
  try {
    const position = athlete.position?.abbreviation || athlete.position?.name || '';
    const isPitcher = position.includes('P') || position.includes('RHP') || position.includes('LHP');
    
    if (!isPitcher) return null;
    
    // Determine role (Starter or Reliever)
    // This is a heuristic - ESPN doesn't always specify
    const displayName = athlete.displayName || '';
    const role = displayName.toLowerCase().includes('starter') || displayName.toLowerCase().includes('sp') ? 'Starter' : 'Reliever';
    
    return {
      id: String(athlete.id || ''),
      espn_id: String(athlete.id || ''),
      name: athlete.displayName || athlete.fullName || '',
      jersey_number: athlete.jersey || '',
      height: athlete.height || '',
      weight: athlete.weight || '',
      year: athlete.experience?.abbreviation || athlete.experience?.displayValue || '',
      hometown: athlete.birthPlace?.city && athlete.birthPlace?.state
        ? `${athlete.birthPlace.city}, ${athlete.birthPlace.state}`
        : (athlete.birthPlace?.city || athlete.birthPlace?.state || ''),
      role: role,
      position: position,
      headshot: athlete.headshot?.href || `https://a.espncdn.com/i/headshots/college-baseball/players/full/${athlete.id}.png`,
      espn: `https://www.espn.com/college-baseball/player/_/id/${athlete.id}`
    };
  } catch (err) {
    console.log(`  ⚠️  Failed to parse athlete: ${err.message}`);
    return null;
  }
}

// Main function
async function main() {
  console.log('⚾ Fetch Pitcher Rosters');
  console.log('========================\n');
  
  // Check if teams.json exists
  if (!fs.existsSync(TEAMS_FILE)) {
    console.error('❌ teams.json not found. Run espn-api-fetcher.cjs first.');
    process.exit(1);
  }
  
  // Load teams
  console.log('📂 Loading teams...');
  const teamsData = JSON.parse(fs.readFileSync(TEAMS_FILE, 'utf8'));
  const teams = teamsData.teams || [];
  
  if (teams.length === 0) {
    console.error('❌ No teams found in teams.json');
    process.exit(1);
  }
  
  console.log(`   Found ${teams.length} teams\n`);
  
  // Backup existing pitchers.json if it exists
  if (fs.existsSync(OUTPUT_FILE)) {
    console.log('📦 Backing up existing pitchers.json...');
    fs.copyFileSync(OUTPUT_FILE, BACKUP_FILE);
    console.log(`   Saved to: ${BACKUP_FILE}\n`);
  }
  
  console.log('🔍 Fetching pitcher rosters from ESPN...');
  console.log('⚠️  NOTE: Rosters may not be available in preseason!');
  console.log('   If no pitchers are found, rosters aren\'t published yet.');
  console.log(`   This will take approximately ${Math.ceil(teams.length * THROTTLE_MS / 1000 / 60)} minutes\n`);
  
  const pitchersByTeam = [];
  let processed = 0;
  let totalPitchers = 0;
  let teamsWithPitchers = 0;
  let teamsWithoutRosters = 0;
  
  for (const team of teams) {
    const teamId = team.id || team.team_id;
    if (!teamId) {
      console.log(`  ⚠️  Skipping team with no ID: ${team.displayName}`);
      continue;
    }
    
    console.log(`   [${processed + 1}/${teams.length}] ${team.displayName}...`);
    
    const roster = await fetchTeamRoster(teamId);
    
    if (roster.length === 0) {
      teamsWithoutRosters++;
    }
    
    const pitchers = roster
      .map(athlete => extractPitcherInfo(athlete))
      .filter(p => p !== null);
    
    if (pitchers.length > 0) {
      pitchersByTeam.push({
        team_id: String(teamId),
        team: team.team || team.displayName,
        displayName: team.displayName,
        logo: team.logo,
        pitchers: pitchers
      });
      
      totalPitchers += pitchers.length;
      teamsWithPitchers++;
      console.log(`     ✅ ${pitchers.length} pitchers`);
    } else {
      console.log(`     ⚠️  No pitchers found (roster not published yet)`);
    }
    
    processed++;
    
    // Progress update every 25 teams
    if (processed % 25 === 0) {
      console.log(`\n   Progress: ${processed}/${teams.length} teams processed`);
      console.log(`   Total pitchers so far: ${totalPitchers}\n`);
    }
    
    // Throttle to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, THROTTLE_MS));
  }
  
  console.log(`\n✅ Processed ${processed} teams`);
  console.log(`   Teams with pitchers: ${teamsWithPitchers}`);
  console.log(`   Teams without rosters: ${teamsWithoutRosters}`);
  console.log(`   Total pitchers: ${totalPitchers}\n`);
  
  if (teamsWithoutRosters === processed) {
    console.log('⚠️  NO ROSTERS AVAILABLE YET');
    console.log('   ESPN has not published 2025 rosters yet (preseason).');
    console.log('   Rosters typically become available closer to season start.');
    console.log('   Run this script again once the season begins.\n');
  }
  
  // Sort teams by display name
  pitchersByTeam.sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''));
  
  // Save to file
  const output = {
    teams: pitchersByTeam,
    metadata: {
      fetchedAt: new Date().toISOString(),
      source: 'ESPN API',
      teamsCount: teamsWithPitchers,
      pitchersCount: totalPitchers
    }
  };
  
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
  
  console.log('💾 Saved to:', OUTPUT_FILE);
  console.log(`   Teams: ${teamsWithPitchers}`);
  console.log(`   Pitchers: ${totalPitchers}`);
  
  // Show role breakdown
  let starters = 0;
  let relievers = 0;
  
  for (const team of pitchersByTeam) {
    for (const pitcher of team.pitchers) {
      if (pitcher.role === 'Starter') starters++;
      else relievers++;
    }
  }
  
  console.log('\n📈 Pitcher Role Breakdown:');
  console.log(`   Starters: ${starters}`);
  console.log(`   Relievers: ${relievers}`);
  
  // Show average pitchers per team
  const avgPitchers = teamsWithPitchers > 0 ? (totalPitchers / teamsWithPitchers).toFixed(1) : 0;
  console.log(`\n📊 Average pitchers per team: ${avgPitchers}`);
  
  console.log('\n✅ Done!');
}

main().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
