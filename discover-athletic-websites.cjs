/**
 * Auto-discover Athletic Website URLs for D1 Baseball Teams
 * 
 * Automatically finds and validates athletic website URLs for major conferences
 * Uses common patterns + verification
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const TEAMS_FILE = path.join(DATA_DIR, 'teams.json');
const OUTPUT_FILE = path.join(DATA_DIR, 'team_websites.json');

// Target conferences
const TARGET_CONFERENCES = ['ACC', 'Big 12', 'Big Ten', 'Pac-12', 'SEC'];

// Common athletic website patterns
const URL_PATTERNS = [
  (slug) => `https://${slug}athletics.com`,
  (slug) => `https://go${slug}.com`,
  (slug) => `https://${slug}sports.com`,
  (slug) => `https://${slug}.com`,
  (slug, location) => `https://${location.toLowerCase().replace(/\s+/g, '')}athletics.com`,
  (slug, location) => `https://go${location.toLowerCase().replace(/\s+/g, '')}.com`,
];

const delay = ms => new Promise(r => setTimeout(r, ms));

// Try to find athletic website
async function findAthleticWebsite(browser, team) {
  // Extract clean slug from team name
  const cleanSlug = team.slug
    .replace(/-wildcats|-tigers|-bulldogs|-bears|-cardinals|-aggies|-huskies|-seminoles|-hurricanes|-tar-heels|-blue-devils|-wolfpack|-pirates|-cavaliers|-yellow-jackets|-demon-deacons|-orange|-eagles|-terrapins|-nittany-lions|-wolverines|-buckeyes|-spartans|-hawkeyes|-badgers|-gophers|-illini|-hoosiers|-cornhuskers|-wildcats|-boilermakers|-scarlet-knights|-razorbacks|-rebels|-gamecocks|-volunteers|-commodores|-sooners|-longhorns|-red-raiders|-jayhawks|-cyclones|-mountaineers|-cowboys|-horned-frogs|-golden-bears|-bruins|-trojans|-ducks|-beavers|-cougars|-huskies|-sun-devils|-utes|-wildcats|-buffaloes/g, '')
    .replace(/\s+/g, '');
  
  const location = team.location || team.name.split(' ')[0];
  
  // Generate candidate URLs
  const candidateUrls = [];
  for (const pattern of URL_PATTERNS) {
    try {
      const url = pattern(cleanSlug, location);
      if (url) candidateUrls.push(url);
    } catch (e) {
      // Skip invalid patterns
    }
  }
  
  // Try each candidate URL
  for (const baseUrl of candidateUrls) {
    const rosterUrl = `${baseUrl}/sports/baseball/roster`;
    
    try {
      const page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
      
      const response = await page.goto(rosterUrl, { 
        waitUntil: 'domcontentloaded', 
        timeout: 15000 
      });
      
      if (response && response.status() === 200) {
        // Check if it's actually a roster page
        const hasRoster = await page.evaluate(() => {
          const hasPlayers = document.querySelectorAll('.sidearm-roster-player, .roster-card-item, table.roster').length > 0;
          const hasRosterText = document.body.textContent.toLowerCase().includes('roster');
          return hasPlayers || hasRosterText;
        });
        
        await page.close();
        
        if (hasRoster) {
          return {
            base: baseUrl,
            roster: '/sports/baseball/roster',
            verified: true
          };
        }
      }
      
      await page.close();
    } catch (err) {
      // URL didn't work, try next
    }
    
    await delay(500);
  }
  
  return null;
}

// Progress bar
function drawProgressBar(current, total, teamName, found, notFound) {
  const barWidth = 40;
  const percentage = Math.floor((current / total) * 100);
  const filled = Math.floor((current / total) * barWidth);
  const empty = barWidth - filled;
  
  const bar = '█'.repeat(filled) + '░'.repeat(empty);
  const stats = `✓${found} ✗${notFound}`;
  
  process.stdout.write(`\r[${bar}] ${percentage}% (${current}/${total}) ${stats} | ${teamName.padEnd(35).substring(0, 35)}`);
}

async function main() {
  console.log('🔍 Athletic Website URL Discovery');
  console.log('=================================\n');
  
  // Load teams
  const teamsData = JSON.parse(fs.readFileSync(TEAMS_FILE, 'utf8'));
  const allTeams = teamsData.teams;
  
  // Filter to target conferences
  const targetTeams = allTeams.filter(t => TARGET_CONFERENCES.includes(t.conference));
  
  console.log(`📊 Teams to process: ${targetTeams.length}`);
  console.log(`   Conferences: ${TARGET_CONFERENCES.join(', ')}\n`);
  console.log('Starting discovery... This will take 15-30 minutes.\n');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const results = {};
  let foundCount = 0;
  let notFoundCount = 0;
  
  try {
    for (let i = 0; i < targetTeams.length; i++) {
      const team = targetTeams[i];
      
      drawProgressBar(i + 1, targetTeams.length, team.name, foundCount, notFoundCount);
      
      const websiteInfo = await findAthleticWebsite(browser, team);
      
      if (websiteInfo) {
        results[team.id] = {
          teamName: team.name,
          teamId: team.id,
          slug: team.slug,
          conference: team.conference,
          ...websiteInfo
        };
        foundCount++;
      } else {
        notFoundCount++;
      }
      
      // Save progress every 10 teams
      if ((i + 1) % 10 === 0) {
        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));
      }
      
      await delay(1000);
    }
    
    // Save final results
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));
    
    console.log('\n\n' + '='.repeat(60));
    console.log('📊 Discovery Summary:');
    console.log(`   ✓ Websites found: ${foundCount}`);
    console.log(`   ✗ Not found: ${notFoundCount}`);
    console.log(`\n💾 Saved to: ${OUTPUT_FILE}`);
    
    // Show breakdown by conference
    console.log('\n📋 By Conference:');
    const byConf = {};
    Object.values(results).forEach(r => {
      byConf[r.conference] = (byConf[r.conference] || 0) + 1;
    });
    Object.entries(byConf).sort((a,b) => b[1] - a[1]).forEach(([conf, count]) => {
      console.log(`   ${conf}: ${count} teams`);
    });
    
    console.log('\n✅ Done!\n');
    
  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error('\n❌ Fatal error:', err);
  process.exit(1);
});
