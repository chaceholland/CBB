#!/usr/bin/env node

/**
 * Test ESPN Roster Update - Fetches just SEC teams
 */

import fs from 'fs/promises';
import path from 'path';
import { fetchAllRosters } from './lib/espn-scraper.mjs';
import { compareAllRosters } from './lib/roster-comparison.mjs';
import { printConsoleSummary, printDetailedChanges, saveJsonReport } from './lib/report-generator.mjs';

const DATA_DIR = path.join(process.cwd(), 'data');

async function loadJson(filename) {
  const filepath = path.join(DATA_DIR, filename);
  const content = await fs.readFile(filepath, 'utf-8');
  return JSON.parse(content);
}

async function main() {
  console.log('\n🏈 ESPN Roster Test Update (SEC Teams Only)\n');

  // Load existing data
  console.log('📂 Loading existing data...\n');
  const teams = await loadJson('teams.json');
  const existingRosters = await loadJson('rosters_2026.json');

  // Filter to just SEC teams for testing
  const secTeams = teams.teams.filter(t => t.conference === 'SEC').slice(0, 5); // Just first 5 SEC teams

  console.log(`  ✓ Loaded ${secTeams.length} SEC teams for testing`);
  console.log(`  ✓ Loaded ${existingRosters.length} existing rosters\n`);

  // Fetch rosters from ESPN
  console.log('🔍 Fetching SEC team rosters from ESPN...\n');
  const scrapeResult = await fetchAllRosters(secTeams);
  const espnRosters = scrapeResult.rosters;
  const failedTeams = scrapeResult.failed;

  // Compare with existing data
  console.log('\n🔍 Comparing rosters with existing data...\n');
  const comparisonReport = compareAllRosters(espnRosters, existingRosters);

  // Generate reports
  printConsoleSummary(comparisonReport, failedTeams);
  printDetailedChanges(comparisonReport);

  await saveJsonReport(comparisonReport, failedTeams);

  console.log('\n✅ Test complete!\n');
}

main().catch(error => {
  console.error('\n❌ Error:', error.message);
  console.error(error.stack);
  process.exit(1);
});
