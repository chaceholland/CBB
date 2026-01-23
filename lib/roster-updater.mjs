/**
 * Roster Update Module
 *
 * Applies ESPN roster updates and regenerates pitcher lists
 * Part of the ESPN Roster Verification & Update System
 */

import fs from 'fs/promises';
import path from 'path';

/**
 * Apply roster updates from ESPN to existing rosters
 * @param {Object} espnRosters - Rosters from ESPN scraper
 * @param {Object} existingRosters - Current rosters_2026.json
 * @param {Object} comparisonReport - Report from roster-comparison
 * @returns {Object} Updated rosters
 */
export function applyRosterUpdates(espnRosters, existingRosters, comparisonReport) {
  console.log('\n=== APPLYING ROSTER UPDATES ===');

  const updatedRosters = { ...existingRosters };
  const stats = {
    updated: 0,
    preserved: 0,
    errors: []
  };

  // Process each team with changes
  for (const [teamSlug, changes] of Object.entries(comparisonReport.changes)) {
    try {
      if (!espnRosters[teamSlug]) {
        stats.errors.push(`ESPN data missing for ${teamSlug}`);
        continue;
      }

      // Update roster with ESPN data
      updatedRosters[teamSlug] = espnRosters[teamSlug];
      stats.updated++;

      console.log(`✓ Updated ${teamSlug}: ${changes.added.length} added, ${changes.removed.length} removed`);
    } catch (error) {
      stats.errors.push(`${teamSlug}: ${error.message}`);
    }
  }

  // Count preserved teams
  stats.preserved = Object.keys(updatedRosters).length - stats.updated;

  console.log(`\nUpdate Summary:`);
  console.log(`- Teams updated: ${stats.updated}`);
  console.log(`- Teams preserved: ${stats.preserved}`);
  console.log(`- Errors: ${stats.errors.length}`);

  if (stats.errors.length > 0) {
    console.log('\nErrors:');
    stats.errors.forEach(err => console.log(`  - ${err}`));
  }

  return updatedRosters;
}

/**
 * Regenerate pitchers from updated rosters
 * @param {Object} rosters - Updated rosters_2026.json
 * @param {Object} existingPitchers - Current pitchers_2026.json
 * @param {Object} teams - teams.json for team info
 * @returns {Object} Updated pitchers
 */
export function regeneratePitchers(rosters, existingPitchers, teams) {
  console.log('\n=== REGENERATING PITCHER LIST ===');

  const updatedPitchers = {};
  const stats = {
    total: 0,
    metadataPreserved: 0,
    newPitchers: 0
  };

  // Pitcher positions to extract
  const pitcherPositions = ['P', 'RHP', 'LHP'];

  // Extract pitchers from rosters
  for (const [teamSlug, roster] of Object.entries(rosters)) {
    if (!Array.isArray(roster)) {
      console.log(`⚠ Skipping ${teamSlug}: invalid roster format`);
      continue;
    }

    for (const player of roster) {
      // Check if player is a pitcher
      if (!pitcherPositions.includes(player.position)) {
        continue;
      }

      const pitcherId = `${teamSlug}-${player.name.toLowerCase().replace(/\s+/g, '-')}`;

      // Check if pitcher exists in old data
      const existingPitcher = existingPitchers[pitcherId];

      if (existingPitcher) {
        // Preserve existing metadata (role, stats, etc.)
        updatedPitchers[pitcherId] = {
          ...player,
          team: teamSlug,
          teamName: teams[teamSlug]?.name || teamSlug,
          conference: teams[teamSlug]?.conference || 'Unknown',
          // Preserve metadata fields
          ...(existingPitcher.role && { role: existingPitcher.role }),
          ...(existingPitcher.stats && { stats: existingPitcher.stats }),
          ...(existingPitcher.innings && { innings: existingPitcher.innings }),
          ...(existingPitcher.lastUpdated && { lastUpdated: existingPitcher.lastUpdated })
        };
        stats.metadataPreserved++;
      } else {
        // New pitcher
        updatedPitchers[pitcherId] = {
          ...player,
          team: teamSlug,
          teamName: teams[teamSlug]?.name || teamSlug,
          conference: teams[teamSlug]?.conference || 'Unknown'
        };
        stats.newPitchers++;
      }

      stats.total++;
    }
  }

  console.log(`\nPitcher Regeneration Summary:`);
  console.log(`- Total pitchers: ${stats.total}`);
  console.log(`- Metadata preserved: ${stats.metadataPreserved}`);
  console.log(`- New pitchers: ${stats.newPitchers}`);

  return updatedPitchers;
}

/**
 * Save updated rosters and pitchers to disk
 * @param {Object} rosters - Updated rosters
 * @param {Object} pitchers - Updated pitchers
 * @returns {Promise<Object>} Save results
 */
export async function saveUpdatedData(rosters, pitchers) {
  console.log('\n=== SAVING UPDATED DATA ===');

  const results = {
    success: true,
    files: [],
    errors: []
  };

  try {
    // Determine base directory (assuming data/ subdirectory)
    const baseDir = process.cwd();
    const dataDir = path.join(baseDir, 'data');

    // Save rosters_2026.json
    const rostersPath = path.join(dataDir, 'rosters_2026.json');
    await fs.writeFile(rostersPath, JSON.stringify(rosters, null, 2));
    results.files.push(rostersPath);
    console.log(`✓ Saved rosters to ${rostersPath}`);

    // Save pitchers_2026.json
    const pitchersPath = path.join(dataDir, 'pitchers_2026.json');
    await fs.writeFile(pitchersPath, JSON.stringify(pitchers, null, 2));
    results.files.push(pitchersPath);
    console.log(`✓ Saved pitchers to ${pitchersPath}`);

  } catch (error) {
    results.success = false;
    results.errors.push(error.message);
    console.error(`✗ Error saving data: ${error.message}`);
  }

  return results;
}

/**
 * Validate updates before applying
 * @param {Object} oldRosters - Original rosters
 * @param {Object} newRosters - Updated rosters
 * @param {Object} oldPitchers - Original pitchers
 * @param {Object} newPitchers - Updated pitchers
 * @returns {Object} Validation results with warnings
 */
export function validateUpdates(oldRosters, newRosters, oldPitchers, newPitchers) {
  console.log('\n=== VALIDATING UPDATES ===');

  const validation = {
    passed: true,
    warnings: [],
    stats: {
      rosters: {
        before: Object.keys(oldRosters).length,
        after: Object.keys(newRosters).length,
        changePercent: 0
      },
      pitchers: {
        before: Object.keys(oldPitchers).length,
        after: Object.keys(newPitchers).length,
        changePercent: 0
      }
    }
  };

  // Calculate roster change percentage
  const rosterChange = validation.stats.rosters.after - validation.stats.rosters.before;
  validation.stats.rosters.changePercent =
    (rosterChange / validation.stats.rosters.before) * 100;

  // Calculate pitcher change percentage
  const pitcherChange = validation.stats.pitchers.after - validation.stats.pitchers.before;
  validation.stats.pitchers.changePercent =
    (pitcherChange / validation.stats.pitchers.before) * 100;

  // Warn if roster count changed by more than 10%
  if (Math.abs(validation.stats.rosters.changePercent) > 10) {
    validation.warnings.push(
      `⚠ Roster count changed by ${validation.stats.rosters.changePercent.toFixed(1)}% ` +
      `(${validation.stats.rosters.before} → ${validation.stats.rosters.after})`
    );
  }

  // Warn if pitcher count changed by more than 20%
  if (Math.abs(validation.stats.pitchers.changePercent) > 20) {
    validation.warnings.push(
      `⚠ Pitcher count changed by ${validation.stats.pitchers.changePercent.toFixed(1)}% ` +
      `(${validation.stats.pitchers.before} → ${validation.stats.pitchers.after})`
    );
  }

  // Display validation results
  console.log('\nValidation Results:');
  console.log(`Rosters: ${validation.stats.rosters.before} → ${validation.stats.rosters.after} ` +
    `(${validation.stats.rosters.changePercent > 0 ? '+' : ''}${validation.stats.rosters.changePercent.toFixed(1)}%)`);
  console.log(`Pitchers: ${validation.stats.pitchers.before} → ${validation.stats.pitchers.after} ` +
    `(${validation.stats.pitchers.changePercent > 0 ? '+' : ''}${validation.stats.pitchers.changePercent.toFixed(1)}%)`);

  if (validation.warnings.length > 0) {
    console.log('\nWarnings:');
    validation.warnings.forEach(warning => console.log(warning));
  } else {
    console.log('\n✓ All validation checks passed');
  }

  return validation;
}
