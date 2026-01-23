#!/usr/bin/env node

/**
 * Static Conference Map Builder
 * ==============================
 * Creates a conference mapping based on known 2025 team-conference relationships
 * Since ESPN's API doesn't expose conference info reliably, we use a manual mapping
 * 
 * Usage: node build-static-conference-map.cjs
 * Output: data/conferences_map.json
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const TEAMS_FILE = path.join(DATA_DIR, 'teams.json');
const OUTPUT_FILE = path.join(DATA_DIR, 'conferences_map.json');

// 2025 Conference Alignments - Using full team names to avoid partial matches
const CONFERENCE_TEAMS = {
  'SEC': [
    'Alabama Crimson Tide', 'Arkansas Razorbacks', 'Auburn Tigers', 
    'Florida Gators', 'Georgia Bulldogs', 'Kentucky Wildcats',
    'LSU Tigers', 'Mississippi State Bulldogs', 'Ole Miss Rebels', 
    'South Carolina Gamecocks', 'Tennessee Volunteers',
    'Vanderbilt Commodores', 'Texas A&M Aggies', 'Missouri Tigers', 
    'Texas Longhorns', 'Oklahoma Sooners'
  ],
  'ACC': [
    'Boston College Eagles', 'Clemson Tigers', 'Duke Blue Devils', 
    'Florida State Seminoles', 'Georgia Tech Yellow Jackets',
    'Louisville Cardinals', 'Miami Hurricanes', 'NC State Wolfpack', 
    'North Carolina Tar Heels', 'Notre Dame Fighting Irish',
    'Pittsburgh Panthers', 'Virginia Cavaliers', 'Virginia Tech Hokies', 
    'Wake Forest Demon Deacons', 'California Golden Bears',
    'Stanford Cardinal', 'SMU Mustangs'
  ],
  'Big 12': [
    'Baylor Bears', 'Kansas Jayhawks', 'Kansas State Wildcats', 
    'Oklahoma State Cowboys', 'TCU Horned Frogs',
    'Texas Tech Red Raiders', 'West Virginia Mountaineers', 'BYU Cougars', 
    'Cincinnati Bearcats', 'Houston Cougars',
    'UCF Knights', 'Arizona Wildcats', 'Arizona State Sun Devils', 
    'Colorado Buffaloes', 'Utah Utes'
  ],
  'Big Ten': [
    'Illinois Fighting Illini', 'Indiana Hoosiers', 'Iowa Hawkeyes', 
    'Maryland Terrapins', 'Michigan Wolverines',
    'Michigan State Spartans', 'Minnesota Golden Gophers', 'Nebraska Cornhuskers', 
    'Northwestern Wildcats',
    'Ohio State Buckeyes', 'Penn State Nittany Lions', 'Purdue Boilermakers', 
    'Rutgers Scarlet Knights', 'Wisconsin Badgers',
    'UCLA Bruins', 'USC Trojans', 'Oregon Ducks', 'Washington Huskies'
  ],
  'Pac-12': [
    'Oregon State Beavers', 'Washington State Cougars'
  ],
  'American': [
    'Charlotte 49ers', 'East Carolina Pirates', 'FAU Owls', 'Memphis Tigers', 
    'North Texas Mean Green',
    'Rice Owls', 'South Florida Bulls', 'Temple Owls', 'Tulane Green Wave', 
    'UAB Blazers', 'UTSA Roadrunners', 'Wichita State Shockers'
  ],
  'Atlantic 10': [
    'Davidson Wildcats', 'Dayton Flyers', 'Duquesne Dukes', 'Fordham Rams', 
    'George Mason Patriots',
    'George Washington Colonials', 'La Salle Explorers', 'Loyola Chicago Ramblers', 
    'Massachusetts Minutemen',
    'Rhode Island Rams', 'Richmond Spiders', 'Saint Joseph\'s Hawks', 
    'Saint Louis Billikens',
    'St. Bonaventure Bonnies', 'VCU Rams'
  ],
  'Big East': [
    'Butler Bulldogs', 'Creighton Bluejays', 'Georgetown Hoyas', 
    'Marquette Golden Eagles', 'Providence Friars',
    'Seton Hall Pirates', 'St. John\'s Red Storm', 'UConn Huskies', 
    'Villanova Wildcats', 'Xavier Musketeers'
  ],
  'Big West': [
    'Cal Poly Mustangs', 'Cal State Fullerton Titans', 'Cal State Northridge Matadors',
    'Hawai\'i Rainbow Warriors', 'Long Beach State Beach', 'UC Davis Aggies', 
    'UC Irvine Anteaters',
    'UC Riverside Highlanders', 'UC San Diego Tritons', 'UC Santa Barbara Gauchos'
  ],
  'C-USA': [
    'FIU Panthers', 'Jacksonville State Gamecocks', 'Liberty Flames', 
    'Louisiana Tech Bulldogs',
    'Middle Tennessee Blue Raiders', 'New Mexico State Aggies', 'Sam Houston Bearkats', 
    'UTEP Miners',
    'Western Kentucky Hilltoppers', 'Kennesaw State Owls'
  ],
  'Colonial': [
    'Campbell Fighting Camels', 'Charleston Cougars', 'Delaware Fightin\' Blue Hens', 
    'Drexel Dragons', 'Elon Phoenix',
    'Hampton Pirates', 'Hofstra Pride', 'Monmouth Hawks', 'Northeastern Huskies', 
    'Stony Brook Seawolves',
    'Towson Tigers', 'UNC Wilmington Seahawks', 'William & Mary Tribe'
  ],
  'Ivy League': [
    'Brown Bears', 'Columbia Lions', 'Cornell Big Red', 'Dartmouth Big Green', 
    'Harvard Crimson',
    'Penn Quakers', 'Princeton Tigers', 'Yale Bulldogs'
  ],
  'MAAC': [
    'Canisius Golden Griffins', 'Fairfield Stags', 'Iona Gaels', 'Manhattan Jaspers', 
    'Marist Red Foxes',
    'Niagara Purple Eagles', 'Quinnipiac Bobcats', 'Rider Broncs', 'Siena Saints', 
    'St. Peter\'s Peacocks'
  ],
  'Mountain West': [
    'Air Force Falcons', 'Fresno State Bulldogs', 'Nevada Wolf Pack', 'New Mexico Lobos',
    'San Diego State Aztecs', 'San Jose State Spartans', 'UNLV Rebels'
  ],
  'Sun Belt': [
    'App State Mountaineers', 'Arkansas State Red Wolves', 'Coastal Carolina Chanticleers', 
    'Georgia Southern Eagles',
    'Georgia State Panthers', 'James Madison Dukes', 'Louisiana Ragin\' Cajuns', 
    'Marshall Thundering Herd',
    'Old Dominion Monarchs', 'South Alabama Jaguars', 'Southern Miss Golden Eagles', 
    'Texas State Bobcats',
    'Troy Trojans', 'ULM Warhawks'
  ],
  'Southern': [
    'The Citadel Bulldogs', 'East Tennessee State Buccaneers', 'Furman Paladins', 
    'Mercer Bears',
    'Samford Bulldogs', 'UNC Greensboro Spartans', 'VMI Keydets', 
    'Western Carolina Catamounts', 'Wofford Terriers'
  ],
  'Southland': [
    'Houston Christian Huskies', 'Incarnate Word Cardinals', 'Lamar Cardinals', 
    'McNeese Cowboys',
    'Nicholls Colonels', 'Northwestern State Demons', 'SE Louisiana Lions', 
    'Texas A&M-CC Islanders'
  ],
  'SWAC': [
    'Alabama A&M Bulldogs', 'Alabama State Hornets', 'Alcorn State Braves', 
    'Arkansas-Pine Bluff Golden Lions',
    'Bethune-Cookman Wildcats', 'Florida A&M Rattlers', 'Grambling Tigers', 
    'Jackson State Tigers',
    'Mississippi Valley State Delta Devils', 'Prairie View A&M Panthers', 
    'Southern Jaguars', 'Texas Southern Tigers'
  ],
  'WAC': [
    'Abilene Christian Wildcats', 'California Baptist Lancers', 'Grand Canyon Antelopes',
    'Seattle U Redhawks', 'Southern Utah Thunderbirds', 'Stephen F. Austin Lumberjacks', 
    'Tarleton State Texans',
    'UT Arlington Mavericks', 'Utah Tech Trailblazers', 'Utah Valley Wolverines'
  ]
};

function normalizeTeamName(name) {
  return name.toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function findConference(teamName) {
  const normalized = normalizeTeamName(teamName);
  
  for (const [conference, teams] of Object.entries(CONFERENCE_TEAMS)) {
    for (const confTeam of teams) {
      const normConfTeam = normalizeTeamName(confTeam);
      
      // Exact match
      if (normalized === normConfTeam) {
        return conference;
      }
      
      // Check if team name ends with the conf team (e.g., "Alabama Crimson Tide" ends with pattern)
      // Split normalized name and check if it starts with the conf team
      const teamWords = normalized.split(' ');
      const confWords = normConfTeam.split(' ');
      
      // Must match from the beginning with same number of words
      if (confWords.length <= teamWords.length) {
        let match = true;
        for (let i = 0; i < confWords.length; i++) {
          if (teamWords[i] !== confWords[i]) {
            match = false;
            break;
          }
        }
        if (match) {
          return conference;
        }
      }
    }
  }
  
  return 'Independent';
}

async function main() {
  console.log('⚾ Static Conference Map Builder');
  console.log('================================\n');
  
  // Load teams
  if (!fs.existsSync(TEAMS_FILE)) {
    console.error('❌ teams.json not found. Run espn-api-fetcher.cjs first.');
    process.exit(1);
  }
  
  const teamsData = JSON.parse(fs.readFileSync(TEAMS_FILE, 'utf8'));
  const teams = teamsData.teams || [];
  
  console.log(`📋 Loaded ${teams.length} teams\n`);
  
  // Build team ID -> conference map
  const teamConferenceMap = {};
  const stats = {};
  
  for (const team of teams) {
    const teamName = team.name || team.displayName || team.team;
    if (!teamName) {
      console.log(`⚠️ Skipping team with no name:`, team.id);
      continue;
    }
    const conference = findConference(teamName);
    teamConferenceMap[team.id || team.team_id] = conference;
    
    stats[conference] = (stats[conference] || 0) + 1;
  }
  
  // Save map
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(teamConferenceMap, null, 2));
  
  console.log(`✅ Conference map saved to: ${OUTPUT_FILE}`);
  console.log(`   Total teams mapped: ${Object.keys(teamConferenceMap).length}\n`);
  
  console.log('📊 Conference Distribution:');
  Object.entries(stats)
    .sort((a, b) => b[1] - a[1])
    .forEach(([conf, count]) => {
      console.log(`  ${conf.padEnd(20)} ${count} teams`);
    });
  
  console.log('\n✨ Done! Now run espn-api-fetcher.cjs to update teams with conferences.');
}

main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
