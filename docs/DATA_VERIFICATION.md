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
