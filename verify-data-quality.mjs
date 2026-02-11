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

// Headshot Validator
function checkHeadshotCoverage(pitchers) {
  const issues = [];
  let totalHeadshots = 0;
  let missingHeadshots = 0;
  let brokenHeadshots = 0;

  for (const team of pitchers.teams) {
    const teamName = team.team;

    if (!team.pitchers) continue;

    for (const pitcher of team.pitchers) {
      // Check if headshot field exists
      if (!pitcher.headshot || pitcher.headshot === '') {
        missingHeadshots++;
        issues.push({
          severity: SEVERITY.WARNING,
          category: 'headshot_coverage',
          team: teamName,
          pitcher_id: pitcher.id,
          pitcher_name: pitcher.name,
          message: 'Missing headshot field'
        });
        continue;
      }

      // Check if file exists
      if (!fileExists(pitcher.headshot)) {
        brokenHeadshots++;
        issues.push({
          severity: SEVERITY.WARNING,
          category: 'headshot_coverage',
          team: teamName,
          pitcher_id: pitcher.id,
          pitcher_name: pitcher.name,
          message: `Headshot file not found: ${pitcher.headshot}`
        });
        continue;
      }

      // Check file size (detect placeholder/corrupted images)
      const fileSize = getFileSize(pitcher.headshot);
      if (fileSize < 1024) { // Less than 1KB
        issues.push({
          severity: SEVERITY.INFO,
          category: 'headshot_coverage',
          team: teamName,
          pitcher_id: pitcher.id,
          pitcher_name: pitcher.name,
          message: `Headshot file too small (${fileSize} bytes), may be placeholder`,
          suggestion: 'Verify image is valid'
        });
      }

      totalHeadshots++;
    }
  }

  return { issues, totalHeadshots, missingHeadshots, brokenHeadshots };
}

// Cross-Reference Validator
function checkCrossReferences(pitchers, teams) {
  const issues = [];

  // Build team ID lookup
  const teamIds = new Set();
  const teamByName = new Map();

  for (const team of teams.teams) {
    teamIds.add(team.id);
    teamByName.set(team.name.toLowerCase(), team);
  }

  // Check pitcher team references
  for (const pitcherTeam of pitchers.teams) {
    const teamId = pitcherTeam.teamId || pitcherTeam.team_id;
    const teamName = pitcherTeam.team;

    // Verify team ID exists in teams.json
    if (teamId && !teamIds.has(teamId)) {
      issues.push({
        severity: SEVERITY.CRITICAL,
        category: 'cross_reference',
        team: teamName,
        message: `Team ID ${teamId} not found in teams.json`,
        suggestion: 'Add team to teams.json or fix team_id reference'
      });
    }

    // Check if team name exists in teams.json
    const matchingTeam = teamByName.get(teamName.toLowerCase());
    if (!matchingTeam) {
      issues.push({
        severity: SEVERITY.WARNING,
        category: 'cross_reference',
        team: teamName,
        message: 'Team name not found in teams.json',
        suggestion: 'Verify team name spelling matches teams.json'
      });
    }
  }

  return { issues, teamsVerified: pitchers.teams.length };
}

// Participation Setup Checker
function checkParticipationSetup(pitchers, schedule) {
  const issues = [];

  // Build pitcher team ID lookup
  const pitcherTeamIds = new Set();
  for (const team of pitchers.teams) {
    const teamId = team.teamId || team.team_id;
    if (teamId) pitcherTeamIds.add(teamId);
  }

  // Check week 1 games for team coverage
  const week1Games = schedule.games.filter(g => g.week === 1);
  const week1Teams = new Set();

  for (const game of week1Games) {
    week1Teams.add(game.home_team_id);
    week1Teams.add(game.away_team_id);
  }

  // Find week 1 teams without pitcher rosters
  const missingRosters = [];
  for (const teamId of week1Teams) {
    if (!pitcherTeamIds.has(teamId)) {
      missingRosters.push(teamId);
    }
  }

  if (missingRosters.length > 0) {
    issues.push({
      severity: SEVERITY.INFO,
      category: 'participation_setup',
      message: `${missingRosters.length} teams in week 1 games lack pitcher rosters`,
      suggestion: 'These teams will not have participation tracking available',
      details: missingRosters.join(', ')
    });
  }

  // Verify game ID format
  const invalidGameIds = schedule.games
    .filter(g => !g.id || !g.espn_game_id)
    .slice(0, 10); // Limit to first 10 to avoid spam

  if (invalidGameIds.length > 0) {
    issues.push({
      severity: SEVERITY.CRITICAL,
      category: 'participation_setup',
      message: `Found ${invalidGameIds.length} games with missing/invalid IDs`,
      suggestion: 'Game IDs required for participation tracking'
    });
  }

  return {
    issues,
    week1Games: week1Games.length,
    teamsWithRosters: pitcherTeamIds.size,
    week1Coverage: week1Teams.size - missingRosters.length
  };
}

// Report Generation
function generateJSONReport(issues, timestamp) {
  const report = {
    generated_at: timestamp,
    summary: {
      total_issues: issues.length,
      critical: issues.filter(i => i.severity === SEVERITY.CRITICAL).length,
      warnings: issues.filter(i => i.severity === SEVERITY.WARNING).length,
      info: issues.filter(i => i.severity === SEVERITY.INFO).length
    },
    issues_by_category: {},
    all_issues: issues
  };

  // Group by category
  for (const issue of issues) {
    const category = issue.category || 'uncategorized';
    if (!report.issues_by_category[category]) {
      report.issues_by_category[category] = [];
    }
    report.issues_by_category[category].push(issue);
  }

  return report;
}

function generateSummaryReport(issues, stats) {
  const lines = [];

  lines.push('='.repeat(70));
  lines.push('DATA VERIFICATION REPORT');
  lines.push('='.repeat(70));
  lines.push('');

  // Summary statistics
  lines.push('SUMMARY');
  lines.push('-'.repeat(70));
  lines.push(`Total Issues Found: ${issues.length}`);
  lines.push(`  Critical: ${issues.filter(i => i.severity === SEVERITY.CRITICAL).length}`);
  lines.push(`  Warnings: ${issues.filter(i => i.severity === SEVERITY.WARNING).length}`);
  lines.push(`  Info:     ${issues.filter(i => i.severity === SEVERITY.INFO).length}`);
  lines.push('');

  // Group by category
  const byCategory = {};
  for (const issue of issues) {
    const cat = issue.category || 'uncategorized';
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(issue);
  }

  // Report by category
  for (const [category, categoryIssues] of Object.entries(byCategory)) {
    lines.push('');
    lines.push(`${category.toUpperCase().replace(/_/g, ' ')}`);
    lines.push('-'.repeat(70));

    // Group by severity within category
    const critical = categoryIssues.filter(i => i.severity === SEVERITY.CRITICAL);
    const warnings = categoryIssues.filter(i => i.severity === SEVERITY.WARNING);
    const info = categoryIssues.filter(i => i.severity === SEVERITY.INFO);

    if (critical.length > 0) {
      lines.push('');
      lines.push('CRITICAL:');
      for (const issue of critical) {
        lines.push(`  ${issue.message}`);
        if (issue.team) lines.push(`    Team: ${issue.team}`);
        if (issue.pitcher_name) lines.push(`    Pitcher: ${issue.pitcher_name}`);
        if (issue.suggestion) lines.push(`    → ${issue.suggestion}`);
        if (issue.details) lines.push(`    Details: ${issue.details}`);
        lines.push('');
      }
    }

    if (warnings.length > 0) {
      lines.push('');
      lines.push('WARNINGS:');
      // Limit warnings display to avoid overwhelming output
      const displayWarnings = warnings.slice(0, 20);
      for (const issue of displayWarnings) {
        lines.push(`  ${issue.message}`);
        if (issue.team) lines.push(`    Team: ${issue.team}`);
        if (issue.pitcher_name) lines.push(`    Pitcher: ${issue.pitcher_name}`);
        if (issue.suggestion) lines.push(`    → ${issue.suggestion}`);
        lines.push('');
      }
      if (warnings.length > 20) {
        lines.push(`  ... and ${warnings.length - 20} more warnings`);
        lines.push('  (See JSON report for complete list)');
        lines.push('');
      }
    }

    if (info.length > 0) {
      lines.push('');
      lines.push(`INFO: ${info.length} informational items`);
      lines.push('  (See JSON report for details)');
      lines.push('');
    }
  }

  lines.push('');
  lines.push('='.repeat(70));
  lines.push('END REPORT');
  lines.push('='.repeat(70));

  return lines.join('\n');
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

  // Check 2: Headshot Coverage
  console.log('Checking headshot coverage...');
  const headshotResult = checkHeadshotCoverage(pitchers);
  issues.push(...headshotResult.issues);
  console.log(`✓ Found ${headshotResult.totalHeadshots} valid headshots`);
  if (headshotResult.missingHeadshots > 0) {
    console.log(`⚠ ${headshotResult.missingHeadshots} missing headshot fields`);
  }
  if (headshotResult.brokenHeadshots > 0) {
    console.log(`⚠ ${headshotResult.brokenHeadshots} broken headshot files`);
  }
  console.log('');

  // Check 3: Cross-References
  console.log('Checking cross-references...');
  const crossRefResult = checkCrossReferences(pitchers, teams);
  issues.push(...crossRefResult.issues);
  console.log(`✓ Verified ${crossRefResult.teamsVerified} team references`);
  console.log('');

  // Check 4: Participation Setup
  console.log('Checking participation tracking setup...');
  const participationResult = checkParticipationSetup(pitchers, schedule);
  issues.push(...participationResult.issues);
  console.log(`✓ Week 1 has ${participationResult.week1Games} scheduled games`);
  console.log(`✓ ${participationResult.week1Coverage} teams ready for tracking`);
  console.log('');

  // Generate reports
  console.log('Generating reports...');

  // Ensure reports directory exists
  const reportsDir = path.join(__dirname, 'reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  // Generate JSON report
  const jsonReport = generateJSONReport(issues, timestamp);
  const jsonPath = path.join(reportsDir, `verification-${timestamp.replace(/:/g, '-')}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(jsonReport, null, 2));
  console.log(`✓ JSON report: ${path.relative(__dirname, jsonPath)}`);

  // Generate summary report
  const stats = {
    totalPitchers: rosterResult.totalPitchers,
    totalHeadshots: headshotResult.totalHeadshots,
    teamsVerified: crossRefResult.teamsVerified,
    week1Games: participationResult.week1Games
  };
  const summaryReport = generateSummaryReport(issues, stats);
  const summaryPath = path.join(reportsDir, `summary-${timestamp.replace(/:/g, '-')}.txt`);
  fs.writeFileSync(summaryPath, summaryReport);
  console.log(`✓ Summary report: ${path.relative(__dirname, summaryPath)}`);

  console.log('');
  console.log('='.repeat(50));
  console.log(`Verification complete! Found ${issues.length} issues.`);
  console.log('='.repeat(50));
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
