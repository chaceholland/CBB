import puppeteer from 'puppeteer';

async function scrollToLoadImages(page) {
  await page.evaluate(async () => {
    await new Promise(resolve => {
      let totalHeight = 0;
      const distance = 300;
      const timer = setInterval(() => {
        window.scrollBy(0, distance);
        totalHeight += distance;
        if (totalHeight >= document.body.scrollHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 100);
    });
  });
  await new Promise(r => setTimeout(r, 1500)); // Wait for images to load
}

async function test() {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
  
  console.log('Testing Auburn...');
  await page.goto('https://auburntigers.com/sports/baseball/roster', { waitUntil: 'networkidle2', timeout: 30000 });
  
  // Scroll to trigger lazy loading
  await scrollToLoadImages(page);
  
  const players = await page.evaluate(() => {
    const results = [];
    const cards = document.querySelectorAll('.roster-card-item');
    
    cards.forEach((card, i) => {
      if (i >= 5) return; // Just first 5 for test
      
      const img = card.querySelector('.roster-card-item__image');
      let headshot = img?.src || '';
      if (headshot.includes('data:image')) headshot = ''; // Still placeholder
      
      const name = card.querySelector('.roster-card-item__title-link')?.textContent?.trim() || '';
      const position = card.querySelector('.roster-card-item__position')?.textContent?.trim() || '';
      const number = card.querySelector('.roster-card-item__jersey-number')?.textContent?.trim() || '';
      
      // Get basic stats (height, weight, year)
      const basicStats = card.querySelectorAll('.roster-player-card-profile-field__value--basic');
      const height = basicStats[0]?.textContent?.trim() || '';
      const weight = basicStats[1]?.textContent?.trim() || '';
      const year = basicStats[2]?.textContent?.trim() || '';
      
      const hometown = card.querySelector('.roster-player-card-profile-field__value--hometown')?.textContent?.trim() || '';
      
      results.push({ name, number, position, height, weight, year, hometown, headshot });
    });
    return results;
  });
  
  console.log('Found', players.length, 'players:');
  players.forEach(p => {
    console.log(`  ${p.number} ${p.name} - ${p.position} (${p.year})`);
    console.log(`    ${p.height}, ${p.weight} | ${p.hometown}`);
    console.log(`    Headshot: ${p.headshot ? p.headshot.substring(0, 60) + '...' : 'NONE'}`);
  });
  
  await browser.close();
}

test().catch(console.error);
