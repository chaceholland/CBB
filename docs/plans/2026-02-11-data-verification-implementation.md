# Data Verification System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a comprehensive data verification system to validate 64 team rosters, headshots, cross-references, and participation tracking before the 2026 season launch.

**Architecture:** Modular Node.js script with separate verification functions for each data quality aspect (roster, headshots, cross-references, participation). Generates both JSON and human-readable reports with severity-based issue classification.

**Tech Stack:** Node.js (ES modules), native fs/path modules, JSON parsing

---

## Task 1: Create Report Directory and Base Structure

**Files:**
- Create: `verify-data-quality.mjs`
- Create: `reports/.gitkeep`
- Modify: `.gitignore`

**Step 1: Create reports directory**

```bash
mkdir -p reports
touch reports/.gitkeep
```

**Step 2: Add reports to gitignore**

Add to `.gitignore`:
```
# Verification reports
reports/*.json
reports/*.txt
```

**Step 3: Create base script structure**

Create `verify-data-quality.mjs`:
```javascript
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

// Main execution
async function main() {
  console.log('='.repeat(50));
  console.log('DATA VERIFICATION SYSTEM');
  console.log('='.repeat(50));
  console.log('');

  const timestamp = new Date().toISOString();
  const issues = [];

  console.log('Starting verification...\n');

  // TODO: Add verification modules

  console.log('\nVerification complete!');
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
```

**Step 4: Test script runs**

Run: `node verify-data-quality.mjs`
Expected: Script prints header and completes successfully

**Step 5: Commit**

```bash
git add verify-data-quality.mjs reports/.gitkeep .gitignore
git commit -m "feat: add base verification script structure

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 2: Add Data Loading Functions

**Files:**
- Modify: `verify-data-quality.mjs`

**Step 1: Add data loading utilities**

Add after SEVERITY constant in `verify-data-quality.mjs`:

```javascript
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
```

**Step 2: Add data loaders to main function**

Replace `// TODO: Add verification modules` with:

```javascript
  // Load data files
  console.log('Loading data files...');
  const pitchers = loadJSON('data/pitchers.json');
  const teams = loadJSON('data/teams.json');
  const schedule = loadJSON('data/schedule.json');

  console.log(`✓ Loaded ${pitchers.teams.length} teams with pitchers`);
  console.log(`✓ Loaded ${teams.teams.length} total teams`);
  console.log(`✓ Loaded ${schedule.games.length} scheduled games`);
  console.log('');
```

**Step 3: Test data loading**

Run: `node verify-data-quality.mjs`
Expected: Script loads and displays data counts

**Step 4: Commit**

```bash
git add verify-data-quality.mjs
git commit -m "feat: add data loading utilities

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 3: Implement Roster Quality Checker

**Files:**
- Modify: `verify-data-quality.mjs`

**Step 1: Add roster quality checker function**

Add before main() function:

```javascript
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
```

**Step 2: Add roster check to main function**

Add after data loading in main():

```javascript
  // Check 1: Roster Quality
  console.log('Checking roster quality...');
  const rosterResult = checkRosterQuality(pitchers);
  issues.push(...rosterResult.issues);
  console.log(`✓ Verified ${rosterResult.totalPitchers} pitchers`);
  console.log('');
```

**Step 3: Test roster checker**

Run: `node verify-data-quality.mjs`
Expected: Script verifies pitchers and may report issues

**Step 4: Commit**

```bash
git add verify-data-quality.mjs
git commit -m "feat: add roster quality verification

Checks required fields, duplicate IDs, position/year formats

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 4: Implement Headshot Validator

**Files:**
- Modify: `verify-data-quality.mjs`

**Step 1: Add headshot validator function**

Add before main() function:

```javascript
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
```

**Step 2: Add headshot check to main function**

Add after roster check:

```javascript
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
```

**Step 3: Test headshot checker**

Run: `node verify-data-quality.mjs`
Expected: Script reports headshot statistics

**Step 4: Commit**

```bash
git add verify-data-quality.mjs
git commit -m "feat: add headshot coverage verification

Checks for missing/broken headshot files and validates file sizes

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 5: Implement Cross-Reference Validator

**Files:**
- Modify: `verify-data-quality.mjs`

**Step 1: Add cross-reference validator function**

Add before main() function:

```javascript
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
```

**Step 2: Add cross-reference check to main function**

Add after headshot check:

```javascript
  // Check 3: Cross-References
  console.log('Checking cross-references...');
  const crossRefResult = checkCrossReferences(pitchers, teams);
  issues.push(...crossRefResult.issues);
  console.log(`✓ Verified ${crossRefResult.teamsVerified} team references`);
  console.log('');
```

**Step 3: Test cross-reference checker**

Run: `node verify-data-quality.mjs`
Expected: Script verifies team references

**Step 4: Commit**

```bash
git add verify-data-quality.mjs
git commit -m "feat: add cross-reference verification

Validates team IDs and names between pitchers.json and teams.json

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 6: Implement Participation Setup Checker

**Files:**
- Modify: `verify-data-quality.mjs`

**Step 1: Add participation setup checker function**

Add before main() function:

```javascript
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
```

**Step 2: Add participation check to main function**

Add after cross-reference check:

```javascript
  // Check 4: Participation Setup
  console.log('Checking participation tracking setup...');
  const participationResult = checkParticipationSetup(pitchers, schedule);
  issues.push(...participationResult.issues);
  console.log(`✓ Week 1 has ${participationResult.week1Games} scheduled games`);
  console.log(`✓ ${participationResult.week1Coverage} teams ready for tracking`);
  console.log('');
```

**Step 3: Test participation checker**

Run: `node verify-data-quality.mjs`
Expected: Script verifies participation setup

**Step 4: Commit**

```bash
git add verify-data-quality.mjs
git commit -m "feat: add participation setup verification

Checks week 1 game coverage and validates game ID format

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 7: Add Report Generation

**Files:**
- Modify: `verify-data-quality.mjs`

**Step 1: Add report generation functions**

Add before main() function:

```javascript
// Report Generation
function generateJSONReport(issues, summary, timestamp) {
  const criticalCount = issues.filter(i => i.severity === SEVERITY.CRITICAL).length;
  const warningCount = issues.filter(i => i.severity === SEVERITY.WARNING).length;
  const infoCount = issues.filter(i => i.severity === SEVERITY.INFO).length;

  const report = {
    timestamp,
    summary: {
      ...summary,
      critical_issues: criticalCount,
      warnings: warningCount,
      info: infoCount
    },
    issues: issues,
    checks_passed: [],
    checks_failed: []
  };

  // Determine which checks passed/failed
  const categories = [...new Set(issues.map(i => i.category))];
  const criticalCategories = new Set(
    issues.filter(i => i.severity === SEVERITY.CRITICAL).map(i => i.category)
  );

  const allCategories = ['roster_quality', 'headshot_coverage', 'cross_reference', 'participation_setup'];
  for (const cat of allCategories) {
    if (criticalCategories.has(cat)) {
      report.checks_failed.push(cat);
    } else {
      report.checks_passed.push(cat);
    }
  }

  return report;
}

function generateSummaryReport(issues, summary) {
  const criticalCount = issues.filter(i => i.severity === SEVERITY.CRITICAL).length;
  const warningCount = issues.filter(i => i.severity === SEVERITY.WARNING).length;
  const infoCount = issues.filter(i => i.severity === SEVERITY.INFO).length;

  let output = '\n';
  output += '='.repeat(60) + '\n';
  output += 'DATA VERIFICATION REPORT\n';
  output += new Date().toISOString().split('T')[0] + '\n';
  output += '='.repeat(60) + '\n\n';

  output += 'OVERVIEW\n';
  output += `✓ Teams Verified: ${summary.total_teams}\n`;
  output += `✓ Pitchers Verified: ${summary.total_pitchers}\n`;
  output += `${criticalCount > 0 ? '🔴' : '✅'} Critical Issues: ${criticalCount}\n`;
  output += `${warningCount > 0 ? '🟡' : '✅'} Warnings: ${warningCount}\n`;
  output += `🔵 Info: ${infoCount}\n\n`;

  // Group issues by category and severity
  const groupedIssues = {};
  for (const issue of issues) {
    const key = `${issue.category}_${issue.severity}`;
    if (!groupedIssues[key]) {
      groupedIssues[key] = [];
    }
    groupedIssues[key].push(issue);
  }

  // Display issues by category
  const categories = {
    'roster_quality': 'ROSTER QUALITY',
    'headshot_coverage': 'HEADSHOT COVERAGE',
    'cross_reference': 'CROSS-REFERENCES',
    'participation_setup': 'PARTICIPATION SETUP'
  };

  for (const [catKey, catName] of Object.entries(categories)) {
    output += `${catName}\n`;
    output += '-'.repeat(60) + '\n';

    const catIssues = issues.filter(i => i.category === catKey);
    if (catIssues.length === 0) {
      output += '✅ No issues found\n\n';
      continue;
    }

    // Show counts by severity
    const catCritical = catIssues.filter(i => i.severity === SEVERITY.CRITICAL).length;
    const catWarning = catIssues.filter(i => i.severity === SEVERITY.WARNING).length;
    const catInfo = catIssues.filter(i => i.severity === SEVERITY.INFO).length;

    if (catCritical > 0) output += `🔴 ${catCritical} critical\n`;
    if (catWarning > 0) output += `🟡 ${catWarning} warnings\n`;
    if (catInfo > 0) output += `🔵 ${catInfo} info\n`;

    output += '\n';
  }

  // Detailed issues (limit to first 20 per category for readability)
  if (issues.length > 0) {
    output += '\nDETAILED ISSUES\n';
    output += '='.repeat(60) + '\n\n';

    for (const [catKey, catName] of Object.entries(categories)) {
      const catIssues = issues.filter(i => i.category === catKey).slice(0, 20);
      if (catIssues.length === 0) continue;

      output += `${catName}:\n\n`;
      for (const issue of catIssues) {
        const icon = issue.severity === SEVERITY.CRITICAL ? '🔴' :
                     issue.severity === SEVERITY.WARNING ? '🟡' : '🔵';
        output += `${icon} ${issue.message}\n`;
        if (issue.team) output += `   Team: ${issue.team}\n`;
        if (issue.pitcher_name) output += `   Pitcher: ${issue.pitcher_name}\n`;
        if (issue.suggestion) output += `   → ${issue.suggestion}\n`;
        output += '\n';
      }
    }
  }

  output += '='.repeat(60) + '\n';

  return output;
}
```

**Step 2: Add report generation to main function**

Replace the ending of main() (after all checks) with:

```javascript
  // Generate reports
  console.log('Generating reports...');

  const summary = {
    total_teams: pitchers.teams.length,
    total_pitchers: rosterResult.totalPitchers,
    headshots_found: headshotResult.totalHeadshots
  };

  const report = generateJSONReport(issues, summary, timestamp);
  const summaryText = generateSummaryReport(issues, summary);

  // Save JSON report
  const dateStr = new Date().toISOString().split('T')[0];
  const jsonPath = path.join(__dirname, 'reports', `verification-${dateStr}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  console.log(`✓ JSON report saved to: ${jsonPath}`);

  // Save text summary
  const txtPath = path.join(__dirname, 'reports', `verification-${dateStr}-summary.txt`);
  fs.writeFileSync(txtPath, summaryText);
  console.log(`✓ Summary saved to: ${txtPath}`);

  // Print summary to console
  console.log(summaryText);

  // Exit with appropriate code
  const criticalCount = issues.filter(i => i.severity === SEVERITY.CRITICAL).length;
  if (criticalCount > 0) {
    console.log(`\n⚠️  Found ${criticalCount} critical issues. Please review and fix.\n`);
    process.exit(1);
  } else {
    console.log('\n✅ Verification complete! No critical issues found.\n');
    process.exit(0);
  }
```

**Step 3: Test report generation**

Run: `node verify-data-quality.mjs`
Expected: Reports generated in `reports/` directory

**Step 4: Verify report files created**

Run: `ls -lh reports/`
Expected: Shows JSON and TXT files with timestamps

**Step 5: Commit**

```bash
git add verify-data-quality.mjs
git commit -m "feat: add report generation

Generates JSON and human-readable summary reports with issue details

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 8: Add README Documentation

**Files:**
- Create: `docs/DATA_VERIFICATION.md`

**Step 1: Create documentation**

Create `docs/DATA_VERIFICATION.md`:

```markdown
# Data Verification System

## Overview

Comprehensive verification system for validating College Baseball Tracker data quality before season launches.

## Usage

### Run Full Verification

```bash
node verify-data-quality.mjs
```

### Output

The script generates two reports in the `reports/` directory:

1. **JSON Report**: `verification-YYYY-MM-DD.json`
   - Machine-readable full results
   - All issues with detailed metadata
   - Summary statistics

2. **Summary Report**: `verification-YYYY-MM-DD-summary.txt`
   - Human-readable overview
   - Issue counts by category
   - Top issues listed

### Exit Codes

- `0`: No critical issues (success)
- `1`: Critical issues found (failure)

## Verification Checks

### 1. Roster Quality
- Required fields present (id, name, number, position, year)
- No duplicate pitcher IDs
- Valid position formats (RHP/LHP/P)
- Valid year classifications

### 2. Headshot Coverage
- Headshot field populated
- Files exist at specified paths
- File sizes validate (>1KB)
- No broken/corrupted images

### 3. Cross-References
- Pitcher team IDs match teams.json
- Team names consistent across files
- No orphaned records

### 4. Participation Setup
- Week 1 game coverage
- Valid game ID formats
- Teams ready for participation tracking

## Issue Severity Levels

- 🔴 **Critical**: Breaks functionality (missing required data, broken references)
- 🟡 **Warning**: Suboptimal but functional (missing optional data, formatting issues)
- 🔵 **Info**: Nice-to-have improvements (optimization suggestions)

## Common Fixes

### Missing Required Fields

Edit `data/pitchers.json` and add the missing field values.

### Broken Headshots

1. Check if file exists: `ls data/headshots/[filename]`
2. If missing, download or add placeholder
3. Update path in `data/pitchers.json`

### Team Reference Mismatches

Verify team IDs and names match between:
- `data/pitchers.json` (teamId/team_id field)
- `data/teams.json` (id field)

## Pre-Season Checklist

Before each season launch:

1. ✅ Run verification: `node verify-data-quality.mjs`
2. ✅ Review reports in `reports/` directory
3. ✅ Fix all critical issues
4. ✅ Address warnings for better UX
5. ✅ Re-verify until clean: `node verify-data-quality.mjs`
6. ✅ Deploy to production: `./deploy.sh`

## Automation

Add to your workflow:

```bash
# Before deployment
node verify-data-quality.mjs && ./deploy.sh
```

This ensures you never deploy with critical data issues.
```

**Step 2: Commit documentation**

```bash
git add docs/DATA_VERIFICATION.md
git commit -m "docs: add data verification guide

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 9: Make Script Executable and Test

**Files:**
- Modify: `verify-data-quality.mjs`
- Modify: `package.json`

**Step 1: Make script executable**

```bash
chmod +x verify-data-quality.mjs
```

**Step 2: Add npm script**

Edit `package.json` and add to `"scripts"`:

```json
"verify": "node verify-data-quality.mjs"
```

**Step 3: Test with npm**

Run: `npm run verify`
Expected: Script runs and generates reports

**Step 4: Review generated reports**

Run: `cat reports/verification-*-summary.txt`
Expected: Summary report displays issues found

**Step 5: Commit**

```bash
git add verify-data-quality.mjs package.json
git commit -m "feat: make verification script executable

Add npm script for easy verification runs

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 10: Final Testing and Validation

**Files:**
- Test: All verification functionality

**Step 1: Run full verification**

Run: `npm run verify`
Expected: Complete run with all checks

**Step 2: Verify JSON report structure**

Run: `jq '.summary' reports/verification-*.json`
Expected: Shows summary with counts

**Step 3: Check exit code behavior**

```bash
npm run verify
echo "Exit code: $?"
```
Expected: Exit code 0 (success) or 1 (critical issues)

**Step 4: Review all issues found**

Run: `jq '.issues[] | select(.severity == "critical")' reports/verification-*.json`
Expected: Lists all critical issues (if any)

**Step 5: Document results**

Create verification results summary for user review.

**Step 6: Final commit**

```bash
git add -A
git commit -m "test: verify all data quality checks working

All verification modules tested and functional

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Post-Implementation

After completing all tasks:

1. **Review Reports**: Examine generated verification reports
2. **Fix Issues**: Address any critical issues found
3. **Re-verify**: Run verification again until clean
4. **Merge to Main**: Use @superpowers:finishing-a-development-branch
5. **Deploy**: Run `./deploy.sh` to push verified data to production

---

## Success Criteria

- ✅ Script runs without errors
- ✅ All four verification modules working
- ✅ Reports generated in JSON and text formats
- ✅ Exit codes correct (0 for success, 1 for critical issues)
- ✅ Documentation complete
- ✅ Ready to identify and fix data issues

## Next Phase

After data verification is clean:
1. Review and fix identified issues
2. Re-verify data
3. Proceed to UI refresh with @frontend-design skill
