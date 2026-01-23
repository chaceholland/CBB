/**
 * Transform rosters_2026.json to pitchers.json with bio URLs
 * Adds team website profile links and matches existing headshots
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const ROSTERS_FILE = path.join(DATA_DIR, 'rosters_2026.json');
const HEADSHOTS_DIR = path.join(DATA_DIR, 'headshots');
const OUTPUT_FILE = path.join(DATA_DIR, 'pitchers.json');

// SEC team base URLs for bio links
const TEAM_BASES = {
  '333': { base: 'https://rolltide.com', roster: '/sports/baseball/roster' },
  '8': { base: 'https://arkansasrazorbacks.com', roster: '/sport/m-basebl/roster' },
  '2': { base: 'https://auburntigers.com', roster: '/sports/baseball/roster' },
  '57': { base: 'https://floridagators.com', roster: '/sports/baseball/roster' },
  '61': { base: 'https://georgiadogs.com', roster: '/sports/baseball/roster' },
  '96': { base: 'https://ukathletics.com', roster: '/sports/baseball/roster' },
  '99': { base: 'https://lsusports.net', roster: '/sports/baseball/roster' },
  '344': { base: 'https://hailstate.com', roster: '/sports/baseball/roster' },
  '142': { base: 'https://mutigers.com', roster: '/sports/baseball/roster' },
  '201': { base: 'https://soonersports.com', roster: '/sports/baseball/roster' },
  '145': { base: 'https://olemisssports.com', roster: '/sports/baseball/roster' },
  '2579': { base: 'https://gamecocksonline.com', roster: '/sports/baseball/roster' },
  '2633': { base: 'https://utsports.com', roster: '/sports/baseball/roster' },
  '251': { base: 'https://texaslonghorns.com', roster: '/sports/baseball/roster' },
  '245': { base: 'https://12thman.com', roster: '/sports/baseball/roster' },
  '238': { base: 'https://vucommodores.com', roster: '/sports/baseball/roster' }
};

// Check if position is pitcher
function isPitcher(position) {
  if (!position) return false;
  const pos = position.trim().toUpperCase();
  const pitcherCodes = ['P', 'RHP', 'LHP', 'RHSP', 'LHSP', 'RHRP', 'LHRP', 'SP', 'RP', 'CL'];
  return pitcherCodes.some(code => 
    pos === code || pos.startsWith(code + '/') || pos.endsWith('/' + code)
  );
}

// Generate bio URL from team and player name
function generateBioUrl(teamId, playerName, slug) {
  const teamInfo = TEAM_BASES[String(teamId)];
  if (!teamInfo) return '';
  
  // Create URL-safe name slug
  const nameSlug = playerName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  
  return `${teamInfo.base}${teamInfo.roster}/${nameSlug}`;
}

// Find matching headshot file
function findHeadshot(teamId, playerIndex, slug) {
  // Check for existing headshot patterns
  const patterns = [
    `${slug}_${teamId}-P${playerIndex + 1}.jpg`,
    `${slug}_${teamId}-P${playerIndex + 1}.png`,
  ];
  
  for (const pattern of patterns) {
    const filepath = path.join(HEADSHOTS_DIR, pattern);
    if (fs.existsSync(filepath)) {
      return `data/headshots/${pattern}`;
    }
  }
  
  return '';
}

async function main() {
  console.log('⚾ Transform Rosters to Pitchers');
  console.log('================================\n');
  
  // Load rosters
  const rosters = JSON.parse(fs.readFileSync(ROSTERS_FILE, 'utf8'));
  console.log(`📖 Loaded ${rosters.length} teams\n`);
  
  const pitchersData = {};
  let totalPitchers = 0;
  
  for (const team of rosters) {
    const { team: teamName, teamId, slug, allPlayers = [] } = team;
    
    // Filter pitchers
    const pitchers = allPlayers
      .filter(p => isPitcher(p.position))
      .map((p, idx) => {
        const bioUrl = generateBioUrl(teamId, p.name, slug);
        const headshot = findHeadshot(teamId, idx, slug);
        
        return {
          id: `${teamId}-P${idx + 1}`,
          name: p.name,
          number: p.number || '',
          position: p.position,
          year: p.year || '',
          height: p.height || '',
          weight: p.weight || '',
          batsThrows: p.batsThrows || '',
          hometown: p.hometown || '',
          headshot: headshot,
          bioUrl: bioUrl
        };
      });
    
    if (pitchers.length > 0) {
      pitchersData[teamId] = {
        team: teamName,
        teamId: teamId,
        slug: slug,
        pitchers: pitchers
      };
      
      totalPitchers += pitchers.length;
      console.log(`✅ ${teamName}: ${pitchers.length} pitchers`);
    }
  }
  
  // Save output
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(pitchersData, null, 2));
  
  console.log('\n' + '='.repeat(50));
  console.log(`📊 Summary:`);
  console.log(`   Teams with pitchers: ${Object.keys(pitchersData).length}`);
  console.log(`   Total pitchers: ${totalPitchers}`);
  console.log(`\n💾 Saved to: data/pitchers.json`);
  console.log('✅ Done!\n');
}

main().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
