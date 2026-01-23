#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';

const TEAMS = [
  { id: 'alabama', name: 'Alabama Crimson Tide', url: 'https://rolltide.com/sports/baseball/roster' },
  { id: 'arkansas', name: 'Arkansas Razorbacks', url: 'https://arkansasrazorbacks.com/sports/baseball/roster' },
  { id: 'auburn', name: 'Auburn Tigers', url: 'https://auburntigers.com/sports/baseball/roster' },
  { id: 'florida', name: 'Florida Gators', url: 'https://floridagators.com/sports/baseball/roster' },
  { id: 'georgia', name: 'Georgia Bulldogs', url: 'https://georgiadogs.com/sports/baseball/roster' },
  { id: 'kentucky', name: 'Kentucky Wildcats', url: 'https://ukathletics.com/sports/baseball/roster' },
  { id: 'lsu', name: 'LSU Tigers', url: 'https://lsusports.net/sports/baseball/roster' },
  { id: 'mississippi‑state', name: 'Mississippi State Bulldogs', url: 'https://hailstate.com/sports/baseball/roster' },
  { id: 'ole‑miss', name: 'Ole Miss Rebels', url: 'https://olemisssports.com/sports/baseball/roster' },
  { id: 'south‑carolina', name: 'South Carolina Gamecocks', url: 'https://gamecocksonline.com/sports/baseball/roster' },
  { id: 'tennessee', name: 'Tennessee Volunteers', url: 'https://utsports.com/sports/baseball/roster' },
  { id: 'vanderbilt', name: 'Vanderbilt Commodores', url: 'https://vucommodores.com/sports/baseball/roster' },
  { id: 'texas‑a&m', name: 'Texas A&M Aggies', url: 'https://12thman.com/sports/baseball/roster' },
  { id: 'missouri', name: 'Missouri Tigers', url: 'https://mutigers.com/sports/baseball/roster' }
];

const OUTPUT_FILE = path.join('./data', 'sec_pitchers.json');
const DELAY_MS = 3000;

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function scrapeTeam(page, teamName, url) {
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
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
