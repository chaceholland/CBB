#!/usr/bin/env node

/**
 * Link existing headshot files to pitchers.json
 * Matches files by team slug and updates the headshot field
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = './data';
const HEADSHOTS_DIR = path.join(DATA_DIR, 'headshots');
const PITCHERS_FILE = path.join(DATA_DIR, 'pitchers.json');

// Team slug to name mapping
const SLUG_TO_TEAM = {
  'alabama': 'Alabama',
  'arkansas': 'Arkansas', 
  'auburn': 'Auburn',
  'florida': 'Florida',
  'georgia': 'Georgia',
  'kentucky': 'Kentucky',
  'lsu': 'LSU',
  'mississippi-state': 'Mississippi State',
  'missouri': 'Missouri',
  'oklahoma': 'Oklahoma',
  'ole-miss': 'Ole Miss',
  'south-carolina': 'South Carolina',
  'tennessee': 'Tennessee',
  'texas-am': 'Texas A&M',
  'texas': 'Texas',
  'vanderbilt': 'Vanderbilt'
};

console.log('🔗 Linking existing headshots to pitchers.json');
console.log('═══════════════════════════════════════════════\n');

// Load pitchers data
const pitchersData = JSON.parse(fs.readFileSync(PITCHERS_FILE, 'utf8'));

// Get all headshot files
const headshotFiles = fs.readdirSync(HEADSHOTS_DIR).filter(f => f.endsWith('.jpg') || f.endsWith('.png'));
console.log(`📁 Found ${headshotFiles.length} headshot files\n`);

// Group files by team slug
const filesByTeam = {};
headshotFiles.forEach(file => {
  const slug = file.split('_')[0];
  if (!filesByTeam[slug]) filesByTeam[slug] = [];
  filesByTeam[slug].push(file);
});

console.log('Files by team:');
Object.entries(filesByTeam).forEach(([slug, files]) => {
  console.log(`  ${slug}: ${files.length} files`);
});
console.log('');

let totalLinked = 0;

// Process each team
Object.entries(filesByTeam).forEach(([slug, files]) => {
  const teamName = SLUG_TO_TEAM[slug];
  if (!teamName) {
    console.log(`⚠️ Unknown slug: ${slug}`);
    return;
  }
  
  // Find team in pitchers data
  const team = pitchersData.teams.find(t => t.team === teamName);
  if (!team) {
    console.log(`⚠️ Team not found in data: ${teamName}`);
    return;
  }
  
  // Sort files by pitcher index (P1, P2, etc.)
  files.sort((a, b) => {
    const numA = parseInt(a.match(/-P(\d+)\./)?.[1] || '0');
    const numB = parseInt(b.match(/-P(\d+)\./)?.[1] || '0');
    return numA - numB;
  });
  
  let linked = 0;
  
  files.forEach(file => {
    // Extract pitcher index from filename (e.g., "florida_57-P1.jpg" -> 1)
    const match = file.match(/-P(\d+)\./);
    if (!match) return;
    
    const pitcherIdx = parseInt(match[1]) - 1; // Convert to 0-based
    
    if (team.pitchers && team.pitchers[pitcherIdx]) {
      team.pitchers[pitcherIdx].headshot = `data/headshots/${file}`;
      linked++;
      totalLinked++;
    }
  });
  
  console.log(`✅ ${teamName}: linked ${linked}/${files.length} headshots`);
});

// Save updated data
fs.writeFileSync(PITCHERS_FILE, JSON.stringify(pitchersData, null, 2));

console.log('\n═══════════════════════════════════════════════');
console.log(`📊 Total linked: ${totalLinked}`);
console.log(`💾 Saved: ${PITCHERS_FILE}`);
console.log('✅ Complete!');
