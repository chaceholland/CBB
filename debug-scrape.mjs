/**
 * Debug script to analyze team website structure
 */
import puppeteer from 'puppeteer';

async function debug() {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  console.log('Fetching South Carolina roster page...\n');
  await page.goto('https://gamecocksonline.com/sports/baseball/roster/', { 
    waitUntil: 'networkidle2', timeout: 30000 
  });
  await new Promise(r => setTimeout(r, 3000));
  
  const analysis = await page.evaluate(() => {
    const results = { selectors: {}, sampleHtml: '', playerLinks: [] };
    
    // Test various selectors
    const tests = [
      'table', 'tbody tr', '.roster', '[class*="roster"]', '[class*="player"]',
      'a[href*="player"]', '.s-person', '.sidearm', 'li', '.card'
    ];
    
    for (const sel of tests) {
      try {
        results.selectors[sel] = document.querySelectorAll(sel).length;
      } catch(e) {
        results.selectors[sel] = 'error';
      }
    }
    
    // Get player links
    document.querySelectorAll('a[href*="player"]').forEach(a => {
      results.playerLinks.push({ text: a.textContent.trim(), href: a.href });
    });
    
    // Get sample of page HTML
    results.sampleHtml = document.body.innerHTML.substring(0, 5000);
    
    return results;
  });
  
  console.log('Selector counts:');
  console.log(JSON.stringify(analysis.selectors, null, 2));
  console.log('\nPlayer links found:', analysis.playerLinks.length);
  analysis.playerLinks.slice(0, 10).forEach(p => console.log(`  - ${p.text}`));
  
  await browser.close();
}

debug().catch(console.error);
