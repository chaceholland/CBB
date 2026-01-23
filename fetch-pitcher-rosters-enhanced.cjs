#!/usr/bin/env node

/**
 * Enhanced Fetch Pitcher Rosters
 * 
 * Fetches pitcher rosters with full player data including:
 * - Headshots (URL + local download)
 * - Height, Weight, Age
 * - Hometown, High School
 * - College Year, Position
 * - Bio URL
 * 
 * Usage: node fetch-pitcher-rosters-enhanced.cjs [--download-headshots] [--team=ID]
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Configuration
const DATA_DIR = './data';
const HEADSHOTS_DIR = path.join(DATA_DIR, 'headshots');
const TEAMS_FILE = path.join(DATA_DIR, 'teams.json');
const OUTPUT_FILE = path.join(DATA_DIR, 'pitchers_enhanced.json');
const BACKUP_FILE = path.join(DATA_DIR, 'pitchers_enhanced_backup.json');
const THROTTLE_MS = 400;

// Parse command line args
const args = process.argv.slice(2);
const DOWNLOAD_HEADSHOTS = args.includes('--download-headshots');
const TEAM_FILTER = args.find(a => a.startsWith('--team='))?.split('=')[1];

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(HEADSHOTS_DIR)) fs.mkdirSync(HEADSHOTS_DIR, { recursive: true });


// Utility: Make HTTPS request
function httpsGet(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const timeout = setTimeout(() => reject(new Error('Timeout')), 15000);
    
    client.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    }, (res) => {
      clearTimeout(timeout);
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Failed to parse JSON from ${url}: ${e.message}`));
        }
      });
    }).on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

// Download image to local file
function downloadImage(url, filepath) {
  return new Promise((resolve, reject) => {
    if (!url || url.includes('no_headshot') || url.includes('placeholder')) {
      resolve(null);
      return;
    }
    
    const client = url.startsWith('https') ? https : http;
    const timeout = setTimeout(() => {
      reject(new Error('Download timeout'));
    }, 30000);
    
    client.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    }, (res) => {
      clearTimeout(timeout);
      
      // Handle redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        downloadImage(res.headers.location, filepath).then(resolve).catch(reject);
        return;
      }
      
      if (res.statusCode !== 200) {
        resolve(null); // Don't fail on 404s
        return;
      }
      
      const fileStream = fs.createWriteStream(filepath);
      res.pipe(fileStream);
      
      fileStream.on('finish', () => {
        fileStream.close();
        resolve(filepath);
      });
      
      fileStream.on('error', (err) => {
        fs.unlink(filepath, () => {}); // Clean up partial file
        resolve(null);
      });
    }).on('error', (err) => {
      clearTimeout(timeout);
      resolve(null);
    });
  });
}


// Fetch roster for a team from ESPN API
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

// Fetch individual player details (for additional data)
async function fetchPlayerDetails(playerId) {
  try {
    const url = `https://site.web.api.espn.com/apis/common/v3/sports/baseball/college-baseball/athletes/${playerId}`;
    const data = await httpsGet(url);
    return data.athlete || null;
  } catch (err) {
    return null;
  }
}

// Extract full player information from athlete data
function extractPlayerInfo(athlete, teamId, teamSlug) {
  try {
    const position = athlete.position?.abbreviation || athlete.position?.name || '';
    const isPitcher = /^(P|RHP|LHP|RHSP|LHSP|RHRP|LHRP|SP|RP|CL)$/i.test(position) ||
                      position.toLowerCase().includes('pitcher');
    
    // Build headshot URL - ESPN pattern
    const headshotUrl = athlete.headshot?.href || 
                        `https://a.espncdn.com/i/headshots/college-baseball/players/full/${athlete.id}.png`;
    
    // Extract birthplace info
    const birthCity = athlete.birthPlace?.city || '';
    const birthState = athlete.birthPlace?.state || '';
    const birthCountry = athlete.birthPlace?.country || '';
    let hometown = '';
    if (birthCity && birthState) {
      hometown = `${birthCity}, ${birthState}`;
    } else if (birthCity) {
      hometown = birthCity;
    } else if (birthState) {
      hometown = birthState;
    }
    if (birthCountry && birthCountry !== 'USA' && birthCountry !== 'United States') {
      hometown = hometown ? `${hometown}, ${birthCountry}` : birthCountry;
    }


    // Calculate age from DOB if available
    let age = athlete.age || '';
    if (!age && athlete.dateOfBirth) {
      const dob = new Date(athlete.dateOfBirth);
      const today = new Date();
      age = Math.floor((today - dob) / (365.25 * 24 * 60 * 60 * 1000));
    }

    // College year / class
    const year = athlete.experience?.abbreviation || 
                 athlete.experience?.displayValue || 
                 athlete.experience?.name || '';

    // High school info (if available in collegeAthlete data)
    const highSchool = athlete.college?.name || '';

    return {
      id: String(athlete.id || ''),
      espn_id: String(athlete.id || ''),
      name: athlete.displayName || athlete.fullName || '',
      firstName: athlete.firstName || '',
      lastName: athlete.lastName || '',
      number: athlete.jersey || '',
      position: position,
      isPitcher: isPitcher,
      year: year,
      age: age ? String(age) : '',
      height: athlete.height || '',
      weight: athlete.weight ? `${athlete.weight} lbs` : '',
      hometown: hometown,
      highSchool: highSchool,
      batsThrows: athlete.hand?.abbreviation || '',
      headshot: headshotUrl,
      localHeadshot: '', // Will be filled if downloaded
      bioUrl: `https://www.espn.com/college-baseball/player/_/id/${athlete.id}`,
      teamId: String(teamId),
      teamSlug: teamSlug
    };
  } catch (err) {
    console.log(`  ⚠️  Failed to parse athlete: ${err.message}`);
    return null;
  }
}


// Main function
async function main() {
  console.log('⚾ Enhanced Pitcher Roster Fetcher');
  console.log('==================================\n');
  
  if (DOWNLOAD_HEADSHOTS) {
    console.log('📸 Headshot download ENABLED\n');
  }
  
  // Check if teams.json exists
  if (!fs.existsSync(TEAMS_FILE)) {
    console.error('❌ teams.json not found. Run espn-api-fetcher.cjs first.');
    process.exit(1);
  }
  
  // Load teams
  console.log('📂 Loading teams...');
  const teamsData = JSON.parse(fs.readFileSync(TEAMS_FILE, 'utf8'));
  let teams = teamsData.teams || [];
  
  // Filter by team if specified
  if (TEAM_FILTER) {
    teams = teams.filter(t => String(t.id) === TEAM_FILTER || 
                              t.slug?.toLowerCase().includes(TEAM_FILTER.toLowerCase()) ||
                              t.displayName?.toLowerCase().includes(TEAM_FILTER.toLowerCase()));
    console.log(`   Filtering to: ${teams.map(t => t.displayName).join(', ')}`);
  }
  
  if (teams.length === 0) {
    console.error('❌ No teams found');
    process.exit(1);
  }
  
  console.log(`   Found ${teams.length} teams\n`);
  
  // Backup existing file
  if (fs.existsSync(OUTPUT_FILE)) {
    console.log('📦 Backing up existing file...');
    fs.copyFileSync(OUTPUT_FILE, BACKUP_FILE);
  }
  
  console.log('🔍 Fetching rosters from ESPN...\n');
  
  const results = [];
  let processed = 0;
  let totalPitchers = 0;
  let totalPlayers = 0;
  let headshosDownloaded = 0;


  for (const team of teams) {
    const teamId = team.id || team.team_id;
    const teamSlug = team.slug || team.abbreviation?.toLowerCase() || '';
    
    if (!teamId) {
      console.log(`  ⚠️  Skipping team with no ID: ${team.displayName}`);
      continue;
    }
    
    console.log(`[${processed + 1}/${teams.length}] ${team.displayName}...`);
    
    const roster = await fetchTeamRoster(teamId);
    
    if (roster.length === 0) {
      console.log(`   ⚠️  No roster data (preseason)`);
      processed++;
      continue;
    }
    
    const players = [];
    const pitchers = [];
    
    for (const athlete of roster) {
      const playerInfo = extractPlayerInfo(athlete, teamId, teamSlug);
      if (!playerInfo) continue;
      
      players.push(playerInfo);
      totalPlayers++;
      
      if (playerInfo.isPitcher) {
        pitchers.push(playerInfo);
        totalPitchers++;
      }
      
      // Download headshot if enabled
      if (DOWNLOAD_HEADSHOTS && playerInfo.headshot) {
        const ext = playerInfo.headshot.includes('.png') ? 'png' : 'jpg';
        const filename = `${teamSlug}_${playerInfo.id}.${ext}`;
        const filepath = path.join(HEADSHOTS_DIR, filename);
        
        if (!fs.existsSync(filepath)) {
          const downloaded = await downloadImage(playerInfo.headshot, filepath);
          if (downloaded) {
            playerInfo.localHeadshot = filepath;
            headshosDownloaded++;
          }
        } else {
          playerInfo.localHeadshot = filepath;
        }
      }
    }


    results.push({
      team_id: String(teamId),
      team: team.team || team.displayName,
      displayName: team.displayName,
      slug: teamSlug,
      logo: team.logo,
      conference: team.conference || '',
      totalPlayers: players.length,
      pitcherCount: pitchers.length,
      players: players,
      pitchers: pitchers
    });
    
    console.log(`   ✅ ${players.length} players, ${pitchers.length} pitchers`);
    processed++;
    
    // Progress update
    if (processed % 25 === 0) {
      console.log(`\n   Progress: ${processed}/${teams.length} | Pitchers: ${totalPitchers}\n`);
    }
    
    await new Promise(r => setTimeout(r, THROTTLE_MS));
  }
  
  // Sort by team name
  results.sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''));
  
  // Save output
  const output = {
    teams: results,
    totalPitchers: totalPitchers,
    totalPlayers: totalPlayers,
    metadata: {
      fetchedAt: new Date().toISOString(),
      source: 'ESPN API',
      teamsCount: results.length,
      headshotsDownloaded: headshosDownloaded
    }
  };
  
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
  
  console.log('\n' + '='.repeat(50));
  console.log('📊 Summary:');
  console.log(`   Teams processed: ${processed}`);
  console.log(`   Total players: ${totalPlayers}`);
  console.log(`   Total pitchers: ${totalPitchers}`);
  if (DOWNLOAD_HEADSHOTS) {
    console.log(`   Headshots downloaded: ${headshosDownloaded}`);
  }
  console.log(`\n💾 Saved to: ${OUTPUT_FILE}`);
  console.log('✅ Done!\n');
}

main().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
