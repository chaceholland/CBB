#!/usr/bin/env node
/**
 * Extract pitchers from rosters_2026_enhanced.json
 * for ACC, Big 12, Big Ten, and Pac-12 conferences
 */

const fs = require('fs');
const path = require('path');

const INPUT_FILE = './data/rosters_2026_enhanced.json';
const OUTPUT_FILE = './data/pitchers.json';
const TARGET_CONFERENCES = ['ACC', 'Big 12', 'Big Ten', 'Pac-12'];

function isPitcher(position) {
  if (!position) return false;
  const pos = position.trim().toUpperCase();
  return pos.includes('RHP') || pos.includes('LHP') || pos.includes('PITCHER') || 
         pos === 'P' || pos === 'SP' || pos === 'RP' || pos === 'CL';
}

console.log('⚾ Extracting Pitchers from Major Conferences\n');
console.log('═══════════════════════════════════════════════\n');

// Load existing data (SEC teams)
const existingData = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf8'));
const existingCount = Object.keys(existingData).length;
const existingPitchers = Object.values(existingData).reduce((sum, t) => 
  sum + (t.pitchers?.length || 0), 0);

console.log('📂 Current data:');
console.log(`   Teams: ${existingCount}`);
console.log(`   Pitchers: ${existingPitchers}\n`);

// Load enhanced rosters
const rosters = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf8'));
const allTeams = rosters.teams;

console.log('🔍 Filtering teams by conference...\n');

const targetTeams = allTeams.filter(t => 
  TARGET_CONFERENCES.includes(t.conference)
);

console.log(`Found ${targetTeams.length} teams in target conferences:\n`);
TARGET_CONFERENCES.forEach(conf => {
  const count = targetTeams.filter(t => t.conference === conf).length;
  console.log(`   ${conf}: ${count} teams`);
});

console.log('\n⚾ Extracting pitchers...\n');

let newTeams = 0;
let updatedTeams = 0;
let totalNewPitchers = 0;

targetTeams.forEach(team => {
  const pitchers = team.players.filter(p => isPitcher(p.position));
  
  if (pitchers.length > 0) {
    const enrichedPitchers = pitchers.map((p, idx) => ({
      id: `${team.team_id}-P${idx + 1}`,
      name: p.name,
      number: p.number || '',
      position: p.position || '',
      year: p.year || '',
      height: p.height || '',
      weight: p.weight || '',
      batsThrows: p.batsThrows || '',
      hometown: p.hometown || '',
      headshot: p.headshot || '',
      bioUrl: p.bioUrl || ''
    }));
    
    // Check if team already exists
    if (existingData[team.team_id]) {
      updatedTeams++;
    } else {
      newTeams++;
    }
    
    existingData[team.team_id] = {
      team: team.team,
      teamId: team.team_id,
      slug: team.slug,
      pitchers: enrichedPitchers
    };
    
    totalNewPitchers += pitchers.length;
    console.log(`   [${team.conference}] ${team.team}: ${pitchers.length} pitchers`);
  }
});

// Save merged data
fs.writeFileSync(OUTPUT_FILE, JSON.stringify(existingData, null, 2));

const finalTeamCount = Object.keys(existingData).length;
const finalPitcherCount = Object.values(existingData).reduce((sum, t) => 
  sum + t.pitchers.length, 0);

console.log('\n' + '═'.repeat(50));
console.log('✅ Complete!\n');
console.log('📊 Summary:');
console.log(`   🆕 New teams added: ${newTeams}`);
console.log(`   🔄 Teams updated: ${updatedTeams}`);
console.log(`   ⚾ New pitchers added: ${totalNewPitchers}`);
console.log('\n📦 Final totals:');
console.log(`   Total teams: ${finalTeamCount}`);
console.log(`   Total pitchers: ${finalPitcherCount}`);
console.log(`\n💾 Saved to: ${OUTPUT_FILE}\n`);
