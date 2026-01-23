#!/usr/bin/env node

/**
 * Roster Helper Tool
 * ==================
 * Helps you gather roster data from various sources
 * and generates CSV files for import
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const DATA_DIR = './data';
const TEAMS_FILE = path.join(DATA_DIR, 'teams.json');

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timeout')), 10000);
    
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    }, (res) => {
      clearTimeout(timeout);
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    }).on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

async function findTeamRosterUrls(teamName) {
  const urls = [];
  const searchName = encodeURIComponent(teamName + ' baseball roster 2024');
  
  // Generate potential URLs
  const baseName = teamName
    .toLowerCase()
    .replace(/ (crimson tide|razorbacks|tigers|gators|bulldogs|wildcats|rebels|gamecocks|volunteers|commodores|aggies|longhorns|sooners|cardinals|eagles|sun devils|trojans|bruins|ducks|beavers|huskies|seminoles|blue devils|tar heels|cavaliers|hokies|demon deacons|yellow jackets|wolfpack|panthers|hurricanes)$/i, '')
    .trim();
  
  const slug = baseName
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-');
  
  // Common roster URL patterns
  urls.push({
    source: 'Google Search',
    url: `https://www.google.com/search?q=${searchName}`
  });
  
  // Try to find athletics website
  const domain = baseName.toLowerCase().replace(/\s/g, '');
  urls.push({
    source: 'University Athletics (guess)',
    url: `https://${domain}sports.com/sports/baseball/roster`
  });
  
  urls.push({
    source: 'University Athletics (alt)',
    url: `https://www.go${domain}.com/sports/baseball/roster`
  });
  
  return urls;
}

async function generateRosterCSV(teams, outputFile = 'collect-rosters.csv') {
  console.log('📝 Generating CSV template...\n');
  
  const csvLines = ['team_name,player_name,position,jersey_number,year,hometown'];
  
  // Add example rows for first few teams
  for (let i = 0; i < Math.min(3, teams.length); i++) {
    const team = teams[i];
    csvLines.push(`${team.displayName},Example Player ${i+1},RHP,${i+1},,`);
  }
  
  csvLines.push('');
  csvLines.push('# INSTRUCTIONS:');
  csvLines.push('# 1. Delete the example rows above');
  csvLines.push('# 2. Add your pitcher data below');
  csvLines.push('# 3. Format: team_name,player_name,position,jersey_number,year,hometown');
  csvLines.push('# 4. Position must be: P, RHP, LHP, SP, or RP');
  csvLines.push('# 5. Save and run: node import-roster-csv.cjs ' + outputFile);
  csvLines.push('#');
  csvLines.push('# Team names to use:');
  
  teams.slice(0, 20).forEach(team => {
    csvLines.push(`# - ${team.displayName}`);
  });
  
  fs.writeFileSync(outputFile, csvLines.join('\n'));
  console.log(`✅ Template saved: ${outputFile}\n`);
}

async function listTopTeams(conference = null) {
  const teamsData = JSON.parse(fs.readFileSync(TEAMS_FILE, 'utf8'));
  const teams = teamsData.teams || [];
  
  let filtered = teams;
  if (conference) {
    filtered = teams.filter(t => 
      t.conference.toLowerCase().includes(conference.toLowerCase())
    );
  }
  
  console.log(`\n📋 ${conference ? conference.toUpperCase() : 'All'} Teams:\n`);
  
  filtered.slice(0, 50).forEach((team, i) => {
    console.log(`${String(i + 1).padStart(3)}. ${team.displayName.padEnd(40)} (${team.conference})`);
  });
  
  console.log(`\nShowing ${Math.min(50, filtered.length)} of ${filtered.length} teams\n`);
}

async function main() {
  console.log('🏟️  Roster Helper Tool');
  console.log('=====================\n');
  
  if (!fs.existsSync(TEAMS_FILE)) {
    console.error('❌ teams.json not found');
    process.exit(1);
  }
  
  const teamsData = JSON.parse(fs.readFileSync(TEAMS_FILE, 'utf8'));
  const teams = teamsData.teams || [];
  
  const args = process.argv.slice(2);
  const command = args[0];
  
  switch (command) {
    case 'list':
      await listTopTeams(args[1]);
      break;
      
    case 'generate':
      await generateRosterCSV(teams, args[1] || 'my-rosters.csv');
      break;
      
    case 'search':
      if (!args[1]) {
        console.error('Usage: node roster-helper.cjs search "Team Name"');
        process.exit(1);
      }
      const teamName = args.slice(1).join(' ');
      const urls = await findTeamRosterUrls(teamName);
      console.log(`🔍 Roster URLs for "${teamName}":\n`);
      urls.forEach(u => {
        console.log(`${u.source}:`);
        console.log(`  ${u.url}\n`);
      });
      break;
      
    default:
      console.log('Available commands:\n');
      console.log('  list [conference]       List teams (optionally by conference)');
      console.log('  generate [filename]     Generate CSV template');
      console.log('  search "Team Name"      Find roster URLs for a team\n');
      console.log('Examples:');
      console.log('  node roster-helper.cjs list SEC');
      console.log('  node roster-helper.cjs generate sec-rosters.csv');
      console.log('  node roster-helper.cjs search "Alabama"\n');
      console.log('Quick Start:');
      console.log('  1. node roster-helper.cjs list SEC');
      console.log('  2. node roster-helper.cjs generate my-rosters.csv');
      console.log('  3. Edit my-rosters.csv with roster data');
      console.log('  4. node import-roster-csv.cjs my-rosters.csv\n');
  }
}

main().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
