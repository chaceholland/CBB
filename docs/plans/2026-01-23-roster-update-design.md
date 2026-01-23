# ESPN Roster Verification & Update System Design

**Date:** 2026-01-23
**Purpose:** Verify and update college baseball team rosters from ESPN for all teams in the tracker
**Scope:** Two-phase system - (1) Verify existing data, (2) Update pitchers only

---

## Overview

This system automates roster updates by fetching current data from ESPN team pages, comparing against existing rosters, generating detailed reports, and automatically updating pitcher information.

### Key Requirements

1. **Verify existing rosters** against ESPN data
2. **Report changes** in three formats: console summary, detailed log, exportable file
3. **Automatic updates** for all roster changes
4. **Full data snapshot backup** before any modifications
5. **Focus on pitchers** for final updates (RHP, LHP, P positions)

---

## Architecture

### Phase 1: Verification & Reporting

**Process Flow:**
```
Load teams.json → For each team → Fetch ESPN roster → Compare with existing data → Generate reports
```

**Outputs:**
1. Console summary (counts, statistics)
2. Detailed change log (player-by-player differences)
3. Exportable JSON report (`roster_verification_report_YYYYMMDD_HHMMSS.json`)

### Phase 2: Pitcher Update

**Process Flow:**
```
Create backup → Update rosters_2026.json → Regenerate pitchers_2026.json → Validate → Log summary
```

**Backup Strategy:**
- Full snapshot of all data files before updates
- Timestamped directory in `backups/`
- Includes manifest with checksums and metadata

---

## ESPN Scraping Strategy

### Data Source

**URL Pattern:**
```
https://www.espn.com/college-baseball/team/roster/_/id/{teamId}/{team-name}
```

Uses existing `teamId` from `data/teams.json` (e.g., Alabama = "333")

### Scraping Implementation

**Technology:** Puppeteer (already in dependencies)

**Approach:**
- Navigate to each team's roster page
- Wait for roster table (`.ResponsiveTable` or `.Table__TBODY`)
- Extract: name, number, position, year, height, weight, bats/throws, hometown
- Handle missing data with empty strings
- Retry failed fetches up to 3 times

**Rate Limiting:**
- 2-second delay between requests
- Exponential backoff on errors (2s → 4s → 8s)
- Progress logging every 10 teams

**Error Handling:**
- Log failed teams to `failed_teams.json`
- Continue processing remaining teams
- Report success/failure counts in summary

### Data Mapping

| ESPN Field | Target Field |
|-----------|-------------|
| Player Name | `name` |
| Jersey # | `number` |
| Position | `position` |
| Class | `year` |
| Height | `height` |
| Weight | `weight` |
| B-T | `batsThrows` |
| Hometown | `hometown` |

---

## Verification & Comparison Logic

### Player Matching Strategy

**Primary Match:** Same name + same number
**Secondary Match:** Same name (if number changed)
**New Player:** Name doesn't exist in current roster
**Removed Player:** Current roster player not found in ESPN data

### Change Detection

**Types of Changes:**
1. **Position changes** (e.g., "P" → "RHP")
2. **Year changes** (e.g., "Fr." → "So.")
3. **Number changes** (jersey reassignments)
4. **Bio updates** (height, weight, hometown)

**Change Classification:**
- **Critical:** Position changes for pitchers
- **Important:** New pitchers added, pitchers removed
- **Minor:** Number changes, bio updates, non-pitcher changes

### Report Formats

**Console Summary:**
```
=== ROSTER VERIFICATION SUMMARY ===
Teams Processed: 297/300 (3 failed)
Teams with Changes: 45
Teams Unchanged: 252

Changes Breakdown:
  - New Pitchers Added: 23
  - Pitchers Removed: 8
  - Position Changes: 12
  - Other Changes: 67
```

**JSON Report Structure:**
```json
{
  "timestamp": "2026-01-23T10:30:00Z",
  "summary": {
    "teamsProcessed": 297,
    "teamsFailed": 3,
    "teamsWithChanges": 45,
    "changesBreakdown": { }
  },
  "teamChanges": [
    {
      "team": "Alabama",
      "teamId": "333",
      "changeCount": 3,
      "changes": [
        {
          "type": "new_pitcher",
          "player": { "name": "John Smith", "number": "45", "position": "RHP" }
        }
      ]
    }
  ],
  "failedTeams": ["team-id-1", "team-id-2"]
}
```

---

## Backup Strategy

### Full Data Snapshot

**Location:** `backups/full_snapshot_YYYYMMDD_HHMMSS/`

**Files Backed Up:**
- `rosters_2026.json`
- `pitchers_2026.json`
- `teams.json`
- `schedules_2026.json`
- `pitchers_played_index.json`

**Manifest File (`manifest.json`):**
```json
{
  "timestamp": "2026-01-23T10:30:00Z",
  "script": "verify-update-rosters.mjs",
  "reason": "pre-roster-update",
  "files": [
    {
      "filename": "rosters_2026.json",
      "size": 123456,
      "checksum": "sha256-hash"
    }
  ]
}
```

---

## Update Process (Pitchers Only)

### Step 1: Update `rosters_2026.json`

For teams with pitcher changes:
- Add new pitchers to `allPlayers` array
- Remove departed pitchers
- Update position/year/bio for changed pitchers
- **Preserve all non-pitcher players unchanged**

### Step 2: Regenerate `pitchers_2026.json`

Extract all players with position: "P", "RHP", or "LHP"

**Transform to pitcher format:**
```json
{
  "id": "teamId-number",
  "name": "Player Name",
  "number": "45",
  "position": "RHP",
  "team": "Alabama",
  "teamId": "333",
  "teamAbbrev": "ALA",
  "conference": "SEC",
  "height": "6-2",
  "weight": "195",
  "year": "Junior",
  "role": "Starter"
}
```

**Preservation Rules:**
- Keep existing `role` (Starter/Reliever) if player already exists
- Keep existing stats/metadata
- Only update biographical data

### Step 3: Post-Update Validation

- Verify JSON structure validity
- Check pitcher counts are reasonable
- Compare before/after counts
- Log detailed update summary

---

## Error Handling & Edge Cases

### Failed Team Fetches
- Log to `failed_teams.json`
- Continue processing other teams
- Include in final report

### Invalid ESPN Data
- Skip malformed player entries
- Log warnings for investigation
- Use existing data as fallback

### Network Issues
- Implement retry with exponential backoff
- Timeout after 30 seconds per page
- Graceful degradation

### Data Conflicts
- ESPN data always takes precedence
- Log significant discrepancies
- Preserve internal IDs and metadata

---

## Success Metrics

- **Coverage:** Successfully process 95%+ of teams
- **Accuracy:** Match ESPN data exactly for processed teams
- **Safety:** All updates backed up and reversible
- **Performance:** Complete full verification in under 30 minutes
- **Reporting:** Clear, actionable reports for manual review

---

## Future Enhancements

1. **Differential updates** - Only fetch teams that likely changed
2. **Historical tracking** - Keep changelog across multiple updates
3. **Automated scheduling** - Run verification weekly during season
4. **Email notifications** - Alert on significant roster changes
5. **Manual override system** - Allow corrections to ESPN data errors
