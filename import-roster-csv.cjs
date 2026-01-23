#!/usr/bin/env node

/**
 * CSV Roster Importer
 * ===================
 * Imports pitcher roster data from a CSV file
 * 
 * CSV Format:
 *   team_name,player_name,position,jersey_number,year,hometown
 * 
 * Example:
 *   Alabama,John Smith,RHP,25,Jr,Birmingham AL
 *   Alabama,Bob Jones,LHP,12,So,Mobile AL
 * 
 * Usage: node import-roster-csv.cjs <csv-file>
 * Example: node import-roster-csv.cjs rosters.csv
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = './data';
const TEAMS_FILE = path.join(DATA_DIR, 'teams.json');
const OUTPUT_FILE = path.join(DATA_DIR, 'pitchers.json');
const BACKUP_FILE = path.join(DATA_DIR, 'pitchers_backup.json');

function parseCSV(content) {
  const lines = content.split('\n').filter(line => line.trim());
  const pitchersByTeam = new Map();
  
  // Skip header row
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Parse CSV (handles quoted fields)
    const fields = [];
    let current = '';
    let inQuotes = false;
    
    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        fields.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    fields.push(current.trim());
    
    if (fields.length < 3) continue; // Need at least team, name, position
    
    const [teamName, playerName, position, jerseyNumber = '', year = '', hometown = ''] = fields;
    
    // Only import pitchers
    if (!position.match(/^(P|RHP|LHP|SP|RP)$/i)) {
      continue;
    }
    
    if (!pitchersByTeam.has(teamName)) {
      pitchersByTeam.set(teamName, []);
    }
    
    pitchersByTeam.get(teamName).push({
      id: `manual_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      espn_id: '',
      name: playerName,
      jersey_number: jerseyNumber,
      height: '',
      weight: '',
      year: year,
      hometown: hometown,
      role: position.includes('SP') ? 'Starter' : 'Reliever',
      position: position,
      headshot: '',
      espn: ''
    });
  }
  
  return pitchersByTeam;
}

function matchTeamToId(teamName, teams) {
  const normalized = teamName.toLowerCase().trim();
  
  for (const team of teams) {
    const teamDisplay = team.displayName.toLowerCase();
    const teamBasic = team.team.toLowerCase();
    
    if (teamDisplay.includes(normalized) || normalized.includes(teamDisplay.split(' ')[0])) {
      return team;
    }
    
    if (teamBasic.includes(normalized) || normalized.includes(teamBasic)) {
      return team;
    }
  }
  
  return null;
}

async function main() {
  console.log('⚾ CSV Roster Importer');
  console.log('=====================\n');
  
  // Check arguments
  if (process.argv.length < 3) {
    console.error('❌ No CSV file specified\n');
    console.error('Usage: node import-roster-csv.cjs <csv-file>\n');
    console.error('CSV Format:');
    console.error('  team_name,player_name,position,jersey_number,year,hometown\n');
    console.error('Example:');
    console.error('  Alabama,John Smith,RHP,25,Jr,Birmingham AL');
    console.error('  Alabama,Bob Jones,LHP,12,So,Mobile AL\n');
    process.exit(1);
  }
  
  const csvFile = process.argv[2];
  
  if (!fs.existsSync(csvFile)) {
    console.error(`❌ File not found: ${csvFile}`);
    process.exit(1);
  }
  
  // Load teams
  if (!fs.existsSync(TEAMS_FILE)) {
    console.error('❌ teams.json not found. Run espn-api-fetcher.cjs first.');
    process.exit(1);
  }
  
  const teamsData = JSON.parse(fs.readFileSync(TEAMS_FILE, 'utf8'));
  const teams = teamsData.teams || [];
  
  console.log(`📂 Loading CSV: ${csvFile}`);
  const csvContent = fs.readFileSync(csvFile, 'utf8');
  
  console.log('📊 Parsing CSV...\n');
  const pitchersByTeamName = parseCSV(csvContent);
  
  // Match team names to team IDs
  const pitchersByTeam = [];
  let totalPitchers = 0;
  let matchedTeams = 0;
  let unmatchedTeams = [];
  
  for (const [teamName, pitchers] of pitchersByTeamName.entries()) {
    const team = matchTeamToId(teamName, teams);
    
    if (team) {
      pitchersByTeam.push({
        team_id: String(team.id),
        team: team.team,
        displayName: team.displayName,
        logo: team.logo,
        pitchers: pitchers
      });
      
      totalPitchers += pitchers.length;
      matchedTeams++;
      console.log(`  ✅ ${teamName} → ${team.displayName} (${pitchers.length} pitchers)`);
    } else {
      unmatchedTeams.push(teamName);
      console.log(`  ⚠️  ${teamName} → No match found`);
    }
  }
  
  if (unmatchedTeams.length > 0) {
    console.log(`\n⚠️  Unmatched teams: ${unmatchedTeams.join(', ')}`);
    console.log('   These teams will not be imported.\n');
  }
  
  // Backup existing file
  if (fs.existsSync(OUTPUT_FILE)) {
    console.log('\n📦 Backing up existing pitchers.json...');
    fs.copyFileSync(OUTPUT_FILE, BACKUP_FILE);
  }
  
  // Save results
  const output = {
    teams: pitchersByTeam,
    metadata: {
      fetchedAt: new Date().toISOString(),
      source: 'CSV Import',
      sourceFile: csvFile,
      note: 'Imported from CSV file',
      teamsCount: matchedTeams,
      pitchersCount: totalPitchers
    }
  };
  
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
  
  console.log(`\n✅ Import complete!`);
  console.log(`  Teams imported: ${matchedTeams}`);
  console.log(`  Total pitchers: ${totalPitchers}`);
  console.log(`  Saved to: ${OUTPUT_FILE}\n`);
}

main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
