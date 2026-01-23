const fs = require('fs');
const path = require('path');

// Read the flat pitchers file
const pitchersFile = path.join(__dirname, 'data', 'pitchers_enhanced.json');
const data = JSON.parse(fs.readFileSync(pitchersFile, 'utf8'));

// Group pitchers by team
const teamMap = new Map();

if (data.pitchers && Array.isArray(data.pitchers)) {
  for (const pitcher of data.pitchers) {
    const teamId = String(pitcher.team_id || '');
    if (!teamId) continue;
    
    if (!teamMap.has(teamId)) {
      teamMap.set(teamId, {
        team_id: teamId,
        id: teamId,
        team: pitcher.team || '',
        team_abbr: pitcher.team_abbr || '',
        displayName: pitcher.team || '',
        pitchers: []
      });
    }
    
    teamMap.get(teamId).pitchers.push(pitcher);
  }
}

// Create the new structure
const output = {
  lastUpdated: data.lastUpdated || new Date().toISOString(),
  totalPitchers: data.totalPitchers || data.pitchers.length,
  totalTeams: teamMap.size,
  teams: Array.from(teamMap.values())
};

// Write the restructured file
const outputFile = path.join(__dirname, 'data', 'pitcher_rosters_enhanced.json');
fs.writeFileSync(outputFile, JSON.stringify(output, null, 2));

console.log(`✅ Created pitcher_rosters_enhanced.json`);
console.log(`   Teams: ${output.totalTeams}`);
console.log(`   Pitchers: ${output.totalPitchers}`);
