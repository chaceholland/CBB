#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Severity constants
const SEVERITY = {
  CRITICAL: 'CRITICAL',
  WARNING: 'WARNING',
  INFO: 'INFO'
};

/**
 * Load and parse a JSON file
 * @param {string} filepath - Relative path to JSON file
 * @returns {Object} Parsed JSON data
 */
function loadJSON(filepath) {
  try {
    const fullPath = path.join(__dirname, filepath);
    const data = fs.readFileSync(fullPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`Error loading ${filepath}:`, error.message);
    process.exit(1);
  }
}

/**
 * Check if a file exists
 * @param {string} filepath - Relative path to file
 * @returns {boolean} True if file exists
 */
function fileExists(filepath) {
  const fullPath = path.join(__dirname, filepath);
  return fs.existsSync(fullPath);
}

/**
 * Get file size in bytes
 * @param {string} filepath - Relative path to file
 * @returns {number} File size in bytes, 0 on error
 */
function getFileSize(filepath) {
  try {
    const fullPath = path.join(__dirname, filepath);
    const stats = fs.statSync(fullPath);
    return stats.size;
  } catch (error) {
    return 0;
  }
}

/**
 * Check roster quality
 * @param {Object} pitchers - Pitchers data with teams array
 * @returns {Object} { issues: Array, totalPitchers: number }
 */
function checkRosterQuality(pitchers) {
  const issues = [];
  const requiredFields = ['id', 'name', 'number', 'position', 'year'];
  const validPositions = ['RHP', 'LHP', 'P'];
  const validYears = [
    'Freshman',
    'Sophomore',
    'Junior',
    'Senior',
    'Graduate',
    'Redshirt Freshman',
    'Redshirt Sophomore',
    'Redshirt Junior',
    'Redshirt Senior'
  ];

  let totalPitchers = 0;
  const seenIds = new Map(); // Track pitcher IDs across all teams

  // Process each team
  for (const team of pitchers.teams) {
    const teamName = team.team;
    const teamId = team.teamId || team.team_id;

    if (!team.pitchers || !Array.isArray(team.pitchers)) {
      issues.push({
        severity: SEVERITY.CRITICAL,
        category: 'roster_quality',
        team: teamName,
        message: 'Team has no pitchers array'
      });
      continue;
    }

    // Process each pitcher
    for (const pitcher of team.pitchers) {
      totalPitchers++;

      // Check for duplicate pitcher IDs across all teams
      if (pitcher.id) {
        if (seenIds.has(pitcher.id)) {
          const previousTeam = seenIds.get(pitcher.id);
          issues.push({
            severity: SEVERITY.CRITICAL,
            category: 'roster_quality',
            team: teamName,
            pitcher: pitcher.name || pitcher.id,
            message: `Duplicate pitcher ID: ${pitcher.id} (also in ${previousTeam})`
          });
        } else {
          seenIds.set(pitcher.id, teamName);
        }
      }

      // Check for missing required fields
      for (const field of requiredFields) {
        if (!pitcher[field] || pitcher[field] === '') {
          issues.push({
            severity: SEVERITY.WARNING,
            category: 'roster_quality',
            team: teamName,
            pitcher: pitcher.name || pitcher.id || 'Unknown',
            message: `Missing required field: ${field}`
          });
        }
      }

      // Check invalid position format
      if (pitcher.position && !validPositions.includes(pitcher.position)) {
        issues.push({
          severity: SEVERITY.INFO,
          category: 'roster_quality',
          team: teamName,
          pitcher: pitcher.name || pitcher.id,
          message: `Invalid position: ${pitcher.position} (expected: ${validPositions.join(', ')})`
        });
      }

      // Check invalid year classification
      if (pitcher.year && !validYears.includes(pitcher.year)) {
        issues.push({
          severity: SEVERITY.INFO,
          category: 'roster_quality',
          team: teamName,
          pitcher: pitcher.name || pitcher.id,
          message: `Invalid year classification: ${pitcher.year}`
        });
      }
    }
  }

  return { issues, totalPitchers };
}

/**
 * Check headshot coverage and file validity
 * @param {Object} pitchers - Pitchers data with teams array
 * @returns {Object} { issues: Array, totalHeadshots: number, missingHeadshots: number, brokenHeadshots: number }
 */
function checkHeadshotCoverage(pitchers) {
  const issues = [];
  let totalHeadshots = 0;
  let missingHeadshots = 0;
  let brokenHeadshots = 0;

  // Process each team
  for (const team of pitchers.teams) {
    const teamName = team.team;

    if (!team.pitchers || !Array.isArray(team.pitchers)) {
      continue;
    }

    // Process each pitcher
    for (const pitcher of team.pitchers) {
      const pitcherName = pitcher.name || pitcher.id || 'Unknown';

      // Check if headshot field exists and is not empty
      if (!pitcher.headshot || pitcher.headshot === '') {
        missingHeadshots++;
        issues.push({
          severity: SEVERITY.WARNING,
          category: 'headshot_coverage',
          team: teamName,
          pitcher: pitcherName,
          message: 'Missing headshot field'
        });
        continue;
      }

      // Check if headshot file exists
      if (!fileExists(pitcher.headshot)) {
        brokenHeadshots++;
        issues.push({
          severity: SEVERITY.WARNING,
          category: 'headshot_coverage',
          team: teamName,
          pitcher: pitcherName,
          message: `Headshot file not found: ${pitcher.headshot}`
        });
        continue;
      }

      // Check file size (must be >1KB)
      const fileSize = getFileSize(pitcher.headshot);
      if (fileSize < 1024) {
        issues.push({
          severity: SEVERITY.INFO,
          category: 'headshot_coverage',
          team: teamName,
          pitcher: pitcherName,
          message: `Headshot file too small: ${fileSize} bytes (${pitcher.headshot})`
        });
      }

      totalHeadshots++;
    }
  }

  return { issues, totalHeadshots, missingHeadshots, brokenHeadshots };
}

/**
 * Check cross-references between pitchers and teams data
 * @param {Object} pitchers - Pitchers data with teams array
 * @param {Object} teams - Teams data with teams array
 * @returns {Object} { issues: Array, teamsVerified: number }
 */
function checkCrossReferences(pitchers, teams) {
  const issues = [];

  // Build team ID lookup from teams.json
  const teamIds = new Set(teams.teams.map(t => t.id));

  // Build team name lookup (lowercase for case-insensitive matching)
  const teamNames = new Map();
  for (const team of teams.teams) {
    teamNames.set(team.name.toLowerCase(), team.name);
  }

  // Verify pitcher team IDs and names
  for (const team of pitchers.teams) {
    const teamId = team.teamId || team.team_id;
    const teamName = team.team;

    // Verify team ID exists in teams.json
    if (!teamIds.has(teamId)) {
      issues.push({
        severity: SEVERITY.CRITICAL,
        category: 'cross_reference',
        team: teamName,
        message: `Team ID ${teamId} not found in teams.json`
      });
    }

    // Verify team name matches teams.json
    if (!teamNames.has(teamName.toLowerCase())) {
      issues.push({
        severity: SEVERITY.WARNING,
        category: 'cross_reference',
        team: teamName,
        message: `Team name "${teamName}" not found in teams.json`
      });
    }
  }

  return { issues, teamsVerified: pitchers.teams.length };
}

/**
 * Check participation setup - verify week 1 coverage
 * @param {Object} pitchers - Pitchers data with teams array
 * @param {Object} schedule - Schedule data with games array
 * @returns {Object} { issues: Array, week1Games: number, teamsWithRosters: number, week1Coverage: string }
 */
function checkParticipationSetup(pitchers, schedule) {
  const issues = [];

  // Build set of team IDs with pitcher rosters
  const teamsWithRosters = new Set(
    pitchers.teams.map(t => t.teamId || t.team_id)
  );

  // Filter for week 1 games
  const week1Games = schedule.games.filter(g => g.week === 1);

  // Collect all team IDs from week 1 games
  const week1TeamIds = new Set();
  for (const game of week1Games) {
    week1TeamIds.add(game.home);
    week1TeamIds.add(game.away);
  }

  // Find teams without pitcher rosters
  const teamsWithoutRosters = Array.from(week1TeamIds).filter(
    teamId => !teamsWithRosters.has(teamId)
  );

  // Report teams without rosters
  if (teamsWithoutRosters.length > 0) {
    issues.push({
      severity: SEVERITY.INFO,
      category: 'participation_setup',
      message: `${teamsWithoutRosters.length} week 1 teams have no pitcher roster: ${teamsWithoutRosters.join(', ')}`
    });
  }

  // Check for invalid game IDs (limit to first 10)
  let invalidGameCount = 0;
  for (const game of week1Games) {
    if (!game.id || !game.espn_game_id) {
      if (invalidGameCount < 10) {
        issues.push({
          severity: SEVERITY.CRITICAL,
          category: 'participation_setup',
          message: `Week 1 game missing ID fields: home=${game.home} vs away=${game.away}`
        });
      }
      invalidGameCount++;
    }
  }

  // Calculate coverage percentage
  const teamsWithRostersInWeek1 = Array.from(week1TeamIds).filter(
    teamId => teamsWithRosters.has(teamId)
  ).length;

  const coveragePercent = week1TeamIds.size > 0
    ? Math.round((teamsWithRostersInWeek1 / week1TeamIds.size) * 100)
    : 0;

  return {
    issues,
    week1Games: week1Games.length,
    teamsWithRosters: teamsWithRostersInWeek1,
    week1Coverage: `${teamsWithRostersInWeek1}/${week1TeamIds.size} (${coveragePercent}%)`
  };
}

/**
 * Main verification function
 */
async function main() {
  try {
    // Print header
    console.log('='.repeat(80));
    console.log('College Baseball Tracker - Data Quality Verification');
    console.log('='.repeat(80));
    console.log(`Started at: ${new Date().toISOString()}`);
    console.log('');

    // Initialize issues array
    const issues = [];

    // Load data files
    console.log('Loading data files...');
    const pitchers = loadJSON('data/pitchers.json');
    const teams = loadJSON('data/teams.json');
    const schedule = loadJSON('data/schedule.json');

    console.log(`Loaded ${pitchers.teams.length} pitcher teams`);
    console.log(`Loaded ${teams.teams.length} teams`);
    console.log(`Loaded ${schedule.games.length} games`);
    console.log('');

    // Check roster quality
    console.log('Checking roster quality...');
    const rosterCheck = checkRosterQuality(pitchers);
    issues.push(...rosterCheck.issues);
    console.log(`✓ Verified ${rosterCheck.totalPitchers} pitchers`);
    console.log('');

    // Check headshot coverage
    console.log('Checking headshot coverage...');
    const headshotCheck = checkHeadshotCoverage(pitchers);
    issues.push(...headshotCheck.issues);
    console.log(`✓ Found ${headshotCheck.totalHeadshots} valid headshots`);
    if (headshotCheck.missingHeadshots > 0) {
      console.log(`  WARNING: ${headshotCheck.missingHeadshots} pitchers missing headshot field`);
    }
    if (headshotCheck.brokenHeadshots > 0) {
      console.log(`  WARNING: ${headshotCheck.brokenHeadshots} headshot files not found`);
    }
    console.log('');

    // Check cross-references
    console.log('Checking cross-references...');
    const crossRefCheck = checkCrossReferences(pitchers, teams);
    issues.push(...crossRefCheck.issues);
    console.log(`✓ Verified ${crossRefCheck.teamsVerified} team references`);
    console.log('');

    // Check participation setup
    console.log('Checking participation setup...');
    const participationCheck = checkParticipationSetup(pitchers, schedule);
    issues.push(...participationCheck.issues);
    console.log(`✓ Week 1 has ${participationCheck.week1Games} scheduled games`);
    console.log(`✓ ${participationCheck.week1Coverage} teams ready for tracking`);
    console.log('');

    // Print completion message
    console.log('');
    console.log('='.repeat(80));
    console.log('Verification Complete');
    console.log(`Completed at: ${new Date().toISOString()}`);
    console.log('='.repeat(80));

  } catch (error) {
    console.error('Error during verification:', error);
    process.exit(1);
  }
}

// Run main function
main();
