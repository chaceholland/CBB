# College Baseball Tracker - Data Verification System Design

**Date**: 2026-02-11
**Status**: Approved
**Goal**: Verify data quality for 64 teams before 2026 season launch (Feb 14)

## Overview

Build a comprehensive verification system to ensure all data for the 64 teams with pitcher rosters is accurate, complete, and ready for the season start.

## Scope

### In Scope
- Verify 64 teams with existing pitcher rosters
- Validate roster data quality
- Check headshot coverage and file integrity
- Ensure cross-reference consistency
- Verify participation tracking setup

### Out of Scope
- Adding new teams beyond the existing 64
- Scraping new data
- Filling weeks 15-19 (postseason schedules)
- UI changes (separate phase after data verification)

## Architecture

### Verification Components

#### 1. Roster Quality Checker
**Purpose**: Validate pitcher roster data integrity

**Checks**:
- Required fields present: `name`, `id`, `position`, `number`, `year`
- No duplicate pitcher IDs within teams
- Position format valid (RHP/LHP/P)
- Year classification valid (Freshman/Sophomore/Junior/Senior/Graduate)
- No empty/placeholder values in required fields
- Team ID consistency

**Output**: List of pitchers with missing/invalid data

#### 2. Headshot Validator
**Purpose**: Ensure all headshot files exist and are valid

**Checks**:
- Every pitcher has `headshot` field populated
- Headshot file exists at specified path
- File size > 1KB (detect placeholder/corrupted images)
- Path format follows convention: `data/headshots/{slug}_{teamId}-P{num}.{ext}`
- No broken symlinks or inaccessible files

**Output**: List of missing/broken headshots with pitcher details

#### 3. Cross-Reference Validator
**Purpose**: Verify data consistency across files

**Checks**:
- All pitcher team IDs exist in teams.json
- All 64 roster teams have entries in teams.json
- Team slug/name consistency between files
- Conference assignments match
- No orphaned pitcher records

**Output**: List of reference mismatches

#### 4. Participation Setup Checker
**Purpose**: Ensure tracking system is ready for week 1

**Checks**:
- `pitchers_played_index.json` structure valid
- Game IDs in schedule.json have proper format
- Team IDs in schedule match pitcher rosters
- Week 1 games (Feb 14+) are properly indexed
- Data merge capability between schedule and pitchers

**Output**: Setup readiness report

## Implementation

### Script Structure
```
verify-data-quality.mjs
├── Data Loaders
│   ├── loadPitchers()
│   ├── loadTeams()
│   ├── loadSchedule()
│   └── loadParticipationIndex()
├── Verification Modules
│   ├── checkRosterQuality()
│   ├── checkHeadshotCoverage()
│   ├── checkCrossReferences()
│   └── checkParticipationSetup()
├── Report Generator
│   ├── generateJSONReport()
│   └── generateSummaryReport()
└── Main Runner
    └── runAllChecks()
```

### Execution Flow
1. Load all required data files
2. Run verification checks in parallel
3. Collect issues by severity
4. Generate detailed JSON report
5. Generate human-readable summary
6. Exit with appropriate code

### Issue Severity Levels
- 🔴 **Critical**: Breaks functionality (exit code 1)
  - Missing required fields
  - Broken team references
  - Invalid data structures

- 🟡 **Warning**: Suboptimal but functional
  - Missing optional fields
  - Missing headshots
  - Formatting inconsistencies

- 🔵 **Info**: Nice-to-have improvements
  - Optimization suggestions
  - Best practice recommendations

### Report Output

**JSON Report** (`reports/verification-{date}.json`):
```json
{
  "timestamp": "2026-02-11T...",
  "summary": {
    "total_teams": 64,
    "total_pitchers": 1308,
    "critical_issues": 0,
    "warnings": 5,
    "info": 12
  },
  "issues": [
    {
      "severity": "critical",
      "category": "roster_quality",
      "team": "Auburn",
      "pitcher_id": "2-P5",
      "message": "Missing required field: year",
      "suggestion": "Add year classification"
    }
  ],
  "checks_passed": ["cross_reference", "participation_setup"],
  "checks_failed": ["roster_quality"]
}
```

**Summary Report** (console output):
```
=====================================
DATA VERIFICATION REPORT
2026-02-11
=====================================

OVERVIEW
✅ Teams Verified: 64
✅ Pitchers Verified: 1,308
🔴 Critical Issues: 0
🟡 Warnings: 5
🔵 Info: 12

ROSTER QUALITY
✅ No duplicate IDs
✅ Required fields present
🟡 3 pitchers missing year classification

HEADSHOT COVERAGE
✅ 1,305 headshots found
🟡 3 missing headshots

[Detailed issues below...]
```

## Workflow After Verification

1. **Review Report**: Examine all issues found
2. **Prioritize Fixes**: Address critical issues first
3. **Fix Data**:
   - Automated fixes where possible (script-based)
   - Manual review for complex cases
4. **Re-verify**: Run verification again until clean
5. **Deploy**: Push verified data to production
6. **Monitor**: Track participation data as season starts

## Success Criteria

- ✅ All 64 teams have complete roster data
- ✅ All required pitcher fields populated
- ✅ All headshot files exist and valid
- ✅ No critical data inconsistencies
- ✅ Participation tracking ready for week 1
- ✅ Zero critical issues in verification report

## Next Steps

1. Implement `verify-data-quality.mjs` script
2. Run initial verification
3. Generate and review report
4. Create fix script for common issues
5. Apply fixes and re-verify
6. Proceed to UI refresh phase

---

**Approved By**: User
**Implementation Ready**: Yes
