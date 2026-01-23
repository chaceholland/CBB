#!/usr/bin/env node

/**
 * Quick Test - D1Baseball URLs
 * =============================
 * Tests if D1Baseball URLs are accessible before running full scraper
 */

const https = require('https');

function testURL(url) {
  return new Promise((resolve) => {
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    }, (res) => {
      resolve({ url, status: res.statusCode });
    }).on('error', (err) => {
      resolve({ url, status: 'ERROR', error: err.message });
    });
  });
}

async function main() {
  console.log('🧪 Testing D1Baseball URLs...\n');
  
  const testTeams = [
    { name: 'Alabama', urls: [
      'https://d1baseball.com/teams/alabama/2024/',
      'https://d1baseball.com/teams/alabama/'
    ]},
    { name: 'LSU', urls: [
      'https://d1baseball.com/teams/lsu/2024/',
      'https://d1baseball.com/teams/lsu/'
    ]},
    { name: 'Tennessee', urls: [
      'https://d1baseball.com/teams/tennessee/2024/',
      'https://d1baseball.com/teams/tennessee/'
    ]}
  ];
  
  for (const team of testTeams) {
    console.log(`Testing: ${team.name}`);
    
    for (const url of team.urls) {
      const result = await testURL(url);
      const statusEmoji = result.status === 200 ? '✅' : 
                         result.status === 301 || result.status === 302 ? '🔄' :
                         result.status === 404 ? '❌' : '⚠️';
      
      console.log(`  ${statusEmoji} ${result.status} - ${url}`);
    }
    console.log('');
  }
  
  console.log('✅ = Good (200)');
  console.log('🔄 = Redirect (301/302) - OK');
  console.log('❌ = Not Found (404)');
  console.log('⚠️ = Other issue\n');
  
  console.log('If you see ✅ or 🔄 for Alabama, LSU, or Tennessee,');
  console.log('the scraper should work!\n');
  console.log('Run: node scrape-d1baseball-rosters.cjs\n');
}

main().catch(console.error);
