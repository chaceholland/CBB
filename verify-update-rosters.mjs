#!/usr/bin/env node

/**
 * ESPN Roster Verification & Update System
 *
 * Phase 1: Verify rosters against ESPN data
 * Phase 2: Update pitcher data automatically
 *
 * Usage:
 *   node verify-update-rosters.mjs
 *   node verify-update-rosters.mjs --verify-only
 *   node verify-update-rosters.mjs --skip-verification
 */

import fs from 'fs/promises';
import path from 'path';
import { fetchAllRosters } from './lib/espn-scraper.mjs';
import { compareAllRosters } from './lib/roster-comparison.mjs';
import { createDataSnapshot } from './lib/backup.mjs';
import { applyRosterUpdates, regeneratePitchers, saveUpdatedData, validateUpdates } from './lib/roster-updater.mjs';
import { printConsoleSummary, printDetailedChanges, saveJsonReport, saveFailedTeams } from './lib/report-generator.mjs';

const DATA_DIR = path.join(process.cwd(), 'data');

// Parse command line args
const args = process.argv.slice(2);
const verifyOnly = args.includes('--verify-only');
const skipVerification = args.includes('--skip-verification');

/**
 * Load JSON file
 */
async function loadJson(filename) {
  const filepath = path.join(DATA_DIR, filename);
  const content = await fs.readFile(filepath, 'utf-8');
  return JSON.parse(content);
}

/**
 * Main execution
 */
async function main() {
  console.log('\n🏈 ESPN Roster Verification & Update System\n');

  // Load existing data
  console.log('📂 Loading existing data...\n');
  const teams = await loadJson('teams.json');
  const existingRosters = await loadJson('rosters_2026.json');
  const existingPitchers = await loadJson('pitchers_2026.json');

  console.log(`  ✓ Loaded ${teams.teams.length} teams`);
  console.log(`  ✓ Loaded ${existingRosters.length} rosters`);
  console.log(`  ✓ Loaded ${existingPitchers.length} pitchers\n`);

  // PHASE 1: VERIFICATION
  let comparisonReport;
  let espnRosters;
  let failedTeams = [];

  if (!skipVerification) {
    console.log('='.repeat(60));
    console.log('PHASE 1: ROSTER VERIFICATION');
    console.log('='.repeat(60) + '\n');

    // Fetch rosters from ESPN
    const scrapeResult = await fetchAllRosters(teams.teams);
    espnRosters = scrapeResult.rosters;
    failedTeams = scrapeResult.failed;

    // Compare with existing data
    console.log('\n🔍 Comparing rosters with existing data...\n');
    comparisonReport = compareAllRosters(espnRosters, existingRosters);

    // Generate reports
    printConsoleSummary(comparisonReport, failedTeams);
    printDetailedChanges(comparisonReport);

    await saveJsonReport(comparisonReport, failedTeams);

    if (failedTeams.length > 0) {
      await saveFailedTeams(failedTeams);
    }

    if (verifyOnly) {
      console.log('✅ Verification complete. (--verify-only mode, skipping updates)\n');
      return;
    }

    // Ask user to confirm proceeding to Phase 2
    if (comparisonReport.summary.teamsWithChanges === 0) {
      console.log('✅ No changes detected. No updates needed.\n');
      return;
    }
  }

  // PHASE 2: UPDATE
  console.log('='.repeat(60));
  console.log('PHASE 2: ROSTER UPDATE');
  console.log('='.repeat(60) + '\n');

  // Create backup
  await createDataSnapshot('pre-roster-update');

  // Apply updates
  const updatedRosters = applyRosterUpdates(espnRosters, existingRosters, comparisonReport);

  // Regenerate pitchers
  const updatedPitchers = regeneratePitchers(updatedRosters, existingPitchers, teams.teams);

  // Validate
  validateUpdates(existingRosters, updatedRosters, existingPitchers, updatedPitchers);

  // Save
  await saveUpdatedData(updatedRosters, updatedPitchers);

  console.log('='.repeat(60));
  console.log('✅ ROSTER UPDATE COMPLETE');
  console.log('='.repeat(60) + '\n');

  console.log('Updated files:');
  console.log('  - data/rosters_2026.json');
  console.log('  - data/pitchers_2026.json\n');
}

// Run
main().catch(error => {
  console.error('\n❌ Error:', error.message);
  console.error(error.stack);
  process.exit(1);
});
