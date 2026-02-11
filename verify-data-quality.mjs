#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Issue severity levels
const SEVERITY = {
  CRITICAL: 'critical',
  WARNING: 'warning',
  INFO: 'info'
};

// Data loading utilities
function loadJSON(filepath) {
  try {
    const fullPath = path.join(__dirname, filepath);
    const content = fs.readFileSync(fullPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`Failed to load ${filepath}:`, error.message);
    process.exit(1);
  }
}

function fileExists(filepath) {
  const fullPath = path.join(__dirname, filepath);
  return fs.existsSync(fullPath);
}

function getFileSize(filepath) {
  try {
    const fullPath = path.join(__dirname, filepath);
    const stats = fs.statSync(fullPath);
    return stats.size;
  } catch {
    return 0;
  }
}

// Roster Quality Checker
function checkRosterQuality(pitchers) {
  const issues = [];
  const requiredFields = ['id', 'name', 'number', 'position', 'year'];
  const validPositions = ['RHP', 'LHP', 'P'];
  const validYears = ['Freshman', 'Sophomore', 'Junior', 'Senior', 'Graduate', 'Redshirt Freshman', 'Redshirt Sophomore', 'Redshirt Junior', 'Redshirt Senior'];

  const pitcherIds = new Set();
  let totalPitchers = 0;

  for (const team of pitchers.teams) {
    const teamName = team.team;
    const teamId = team.teamId || team.team_id;

    if (!team.pitchers || !Array.isArray(team.pitchers)) {
      issues.push({
        severity: SEVERITY.CRITICAL,
        category: 'roster_quality',
        team: teamName,
        message: 'Missing or invalid pitchers array'
      });
      continue;
    }

    for (const pitcher of team.pitchers) {
      totalPitchers++;

      // Check for duplicate IDs across all teams
      if (pitcherIds.has(pitcher.id)) {
        issues.push({
          severity: SEVERITY.CRITICAL,
          category: 'roster_quality',
          team: teamName,
          pitcher_id: pitcher.id,
          pitcher_name: pitcher.name,
          message: 'Duplicate pitcher ID found across teams'
        });
      }
      pitcherIds.add(pitcher.id);

      // Check required fields
      for (const field of requiredFields) {
        if (!pitcher[field] || pitcher[field] === '') {
          issues.push({
            severity: SEVERITY.WARNING,
            category: 'roster_quality',
            team: teamName,
            pitcher_id: pitcher.id,
            pitcher_name: pitcher.name || 'Unknown',
            message: `Missing required field: ${field}`,
            suggestion: `Add ${field} for this pitcher`
          });
        }
      }

      // Validate position format
      if (pitcher.position && !validPositions.includes(pitcher.position)) {
        issues.push({
          severity: SEVERITY.INFO,
          category: 'roster_quality',
          team: teamName,
          pitcher_id: pitcher.id,
          pitcher_name: pitcher.name,
          message: `Non-standard position format: ${pitcher.position}`,
          suggestion: `Should be one of: ${validPositions.join(', ')}`
        });
      }

      // Validate year classification
      if (pitcher.year && !validYears.includes(pitcher.year)) {
        issues.push({
          severity: SEVERITY.INFO,
          category: 'roster_quality',
          team: teamName,
          pitcher_id: pitcher.id,
          pitcher_name: pitcher.name,
          message: `Non-standard year classification: ${pitcher.year}`,
          suggestion: `Should be one of: ${validYears.join(', ')}`
        });
      }
    }
  }

  return { issues, totalPitchers };
}

// Main execution
async function main() {
  console.log('='.repeat(50));
  console.log('DATA VERIFICATION SYSTEM');
  console.log('='.repeat(50));
  console.log('');

  const timestamp = new Date().toISOString();
  const issues = [];

  // Load data files
  console.log('Loading data files...');
  const pitchers = loadJSON('data/pitchers.json');
  const teams = loadJSON('data/teams.json');
  const schedule = loadJSON('data/schedule.json');

  console.log(`✓ Loaded ${pitchers.teams.length} teams with pitchers`);
  console.log(`✓ Loaded ${teams.teams.length} total teams`);
  console.log(`✓ Loaded ${schedule.games.length} scheduled games`);
  console.log('');

  // Check 1: Roster Quality
  console.log('Checking roster quality...');
  const rosterResult = checkRosterQuality(pitchers);
  issues.push(...rosterResult.issues);
  console.log(`✓ Verified ${rosterResult.totalPitchers} pitchers`);
  console.log('');

  console.log('\nVerification complete!');
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
