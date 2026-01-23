const teams = [
  { name: "Alabama Crimson Tide", url: "https://rolltide.com/sports/baseball/roster" },
  { name: "Arkansas Razorbacks", url: "https://arkansasrazorbacks.com/sports/baseball/roster" },
  { name: "Auburn Tigers", url: "https://auburntigers.com/sports/baseball/roster" },
  { name: "Florida Gators", url: "https://floridagators.com/sports/baseball/roster" },
  { name: "Georgia Bulldogs", url: "https://georgiadogs.com/sports/baseball/roster" },
  { name: "Kentucky Wildcats", url: "https://ukathletics.com/sports/baseball/roster" },
  { name: "LSU Tigers", url: "https://lsusports.net/sports/baseball/roster" },
  { name: "Mississippi State Bulldogs", url: "https://hailstate.com/sports/baseball/roster" },
  { name: "Ole Miss Rebels", url: "https://olemisssports.com/sports/baseball/roster" },
  { name: "South Carolina Gamecocks", url: "https://gamecocksonline.com/sports/baseball/roster" },
  { name: "Tennessee Volunteers", url: "https://utsports.com/sports/baseball/roster" },
  { name: "Vanderbilt Commodores", url: "https://vucommodores.com/sports/baseball/roster" },
  { name: "Texas A&M Aggies", url: "https://12thman.com/sports/baseball/roster" },
  { name: "Missouri Tigers", url: "https://mutigers.com/sports/baseball/roster" }
];
#!/usr/bin/env node
  { name: "Alabama Crimson Tide", url: "https://rolltide.com/sports/baseball/roster" },
  { name: "Arkansas Razorbacks", url: "https://arkansasrazorbacks.com/sport/m-basebl/roster/" },
  { name: "Auburn Tigers", url: "https://auburntigers.com/sports/baseball/roster" },
  { name: "Florida Gators", url: "https://floridagators.com/sports/baseball/roster" },
  { name: "Georgia Bulldogs", url: "https://georgiadogs.com/sports/baseball/roster" },
  { name: "Kentucky Wildcats", url: "https://ukathletics.com/sports/baseball/roster" },
  { name: "LSU Tigers", url: "https://lsusports.net/sports/baseball/roster" },
  { name: "Mississippi State Bulldogs", url: "https://hailstate.com/sports/baseball/roster" },
  { name: "Ole Miss Rebels", url: "https://olemisssports.com/sports/baseball/roster" },
  { name: "South Carolina Gamecocks", url: "https://gamecocksonline.com/sports/baseball/roster" },
  { name: "Tennessee Volunteers", url: "https://utsports.com/sports/baseball/roster" },
  { name: "Vanderbilt Commodores", url: "https://vucommodores.com/sports/baseball/roster" },
  { name: "Texas A&M Aggies", url: "https://12thman.com/sports/baseball/roster" },
  { name: "Missouri Tigers", url: "https://mutigers.com/sports/baseball/roster" }
import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';

const TEAMS = [
  { id: 'alabama',       name: 'Alabama Crimson Tide',             url: 'https://rolltide.com/sports/baseball/roster',             selector: null },
  { id: 'arkansas',      name: 'Arkansas Razorbacks',              url: 'https://arkansasrazorbacks.com/sport/m-basebl/roster/',   selector: null },
  { id: 'auburn',        name: 'Auburn Tigers',                    url: 'https://auburntigers.com/sports/baseball/roster',         selector: null },
  { id: 'florida',       name: 'Florida Gators',                   url: 'https://floridagators.com/sports/baseball/roster',        selector: null },
  { id: 'georgia',       name: 'Georgia Bulldogs',                 url: 'https://georgiadogs.com/sports/baseball/roster',          selector: null },
  { id: 'kentucky',      name: 'Kentucky Wildcats',                url: 'https://ukathletics.com/sports/baseball/roster',          selector: null },
  { id: 'lsu',           name: 'LSU Tigers',                       url: 'https://lsusports.net/sports/baseball/roster',            selector: null },
  { id: 'mississippi-state', name: 'Mississippi State Bulldogs',  url: 'https://hailstate.com/sports/baseball/roster',            selector: null },
  { id: 'ole-miss',      name: 'Ole Miss Rebels',                  url: 'https://olemisssports.com/sports/baseball/roster',        selector: null },
  { id: 'south-carolina',name: 'South Carolina Gamecocks',        url: 'https://gamecocksonline.com/sports/baseball/roster',      selector: null },
  { id: 'tennessee',     name: 'Tennessee Volunteers',             url: 'https://utsports.com/sports/baseball/roster',             selector: null },
  { id: 'vanderbilt',    name: 'Vanderbilt Commodores',            url: 'https://vucommodores.com/sports/baseball/roster',         selector: null },
  { id: 'texas-a&m',     name: 'Texas A&M Aggies',                 url: 'https://12thman.com/sports/baseball/roster',              selector: null },
  { id: 'missouri',      name: 'Missouri Tigers',                  url: 'https://mutigers.com/sports/baseball/roster',             selector: null },

const OUTPUT_FILE = path.join('./data', 'sec_pitchers_all.json');
const DELAY_MS = 3000;

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function scrapeTeam(page, teamName, url) {
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    const pitchers = await page.evaluate(() => {
      const results = [];
      const elems = Array.from(document.querySelectorAll("[data-test-id=\"s-person-details__bio-stats-person-position-short\"]"));
      elems.forEach(el => {
        const pos = el.textContent.trim();
        if (pos.includes("RHP") || pos.includes("LHP")) {
          const block = el.closest("[class*=\"s-person-details\"]");
          const name = block?.querySelector(".s-person-details__name")?.textContent.trim() || "";
          results.push({ name, position: pos });
        }
      });
      return results;
    });
    return pitchers;
  } catch (err) {
    console.warn(`  ⚠️ Error scraping ${teamName}: ${err.message}`);
    return [];
  }
}


main().catch(err => {
  console.error('\\n❌ Fatal error:', err);
  process.exit(1);
});

async function main() {
  console.log("\n🚀 SEC Pitcher Scraper (All Teams)");
  console.log("==================================");

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  const allResults = [];

  for (const team of teams) {
    const { name, url } = team;
    console.log(`\n[Team: ${name}] URL: ${url}`);
    try {
      const pitchers = await scrapeTeam(page, name, url);
      if (pitchers.length) {
        console.log(`  ✅ Found ${pitchers.length} pitcher entries`);
      } else {
        console.log(`  ⚠️ No pitchers found`);
      }
      allResults.push({ team: name, url, pitchers });
    } catch (err) {
      console.warn(`  ⚠️ Error scraping ${name}: ${err.message}`);
    }
  }

  await browser.close();

  fs.mkdirSync("data", { recursive: true });
  fs.writeFileSync("data/sec_pitchers_all.json", JSON.stringify(allResults, null, 2));
  console.log("\n💾 Saved output to data/sec_pitchers_all.json");
}

main().catch(err => {
  console.error("❌ Fatal error:", err);
  process.exit(1);
});
