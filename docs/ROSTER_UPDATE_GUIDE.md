# Roster Update Guide

## Overview

The `verify-update-rosters.mjs` script automates the process of updating team rosters from ESPN data.

## Two-Phase Process

### Phase 1: Verification & Reporting
- Fetches current rosters from ESPN for all teams
- Compares with existing data in `rosters_2026.json`
- Generates three types of reports:
  1. **Console summary** - High-level statistics
  2. **Detailed changes** - Player-by-player breakdown
  3. **JSON report** - Exportable file in `data/`

### Phase 2: Automatic Update
- Creates full data snapshot backup in `backups/`
- Updates `rosters_2026.json` with ESPN data
- Regenerates `pitchers_2026.json` from updated rosters
- Validates changes are reasonable
- Saves updated files

## Usage

### Standard Run (Verify + Update)
```bash
node verify-update-rosters.mjs
```

This runs both phases: verification and automatic update.

### Verify Only (No Updates)
```bash
node verify-update-rosters.mjs --verify-only
```

Only runs Phase 1 verification and generates reports. No data is changed.

### Update Only (Skip Verification)
```bash
node verify-update-rosters.mjs --skip-verification
```

Skips Phase 1 and goes directly to Phase 2 update. **Not recommended** unless you already ran verification separately.

## What Gets Updated

### Rosters (`rosters_2026.json`)
- All player data updated from ESPN
- Team metadata preserved
- Timestamp added to updated teams

### Pitchers (`pitchers_2026.json`)
- Regenerated from updated rosters
- Only players with position P, RHP, or LHP included
- Existing pitcher metadata preserved (role, stats)
- New pitchers added with default role "Reliever"

## Safety Features

### Automatic Backups
Every update creates a timestamped backup:
```
backups/full_snapshot_2026-01-23T10-30-00/
  ├── rosters_2026.json
  ├── pitchers_2026.json
  ├── teams.json
  ├── schedules_2026.json
  ├── pitchers_played_index.json
  └── manifest.json
```

The manifest includes file checksums for verification.

### Validation Checks
- Warns if roster count changes by >10%
- Warns if pitcher count changes by >20%
- Reports before/after counts

### Error Handling
- Failed team fetches logged to `data/failed_teams.json`
- Script continues processing remaining teams
- Failed teams reported in summary

## Reports

### Console Summary
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

### JSON Report
Saved to `data/roster_verification_report_YYYY-MM-DDTHH-MM-SS.json`

Contains:
- Full summary statistics
- Team-by-team changes
- Player-level details for each change
- List of failed teams

## Troubleshooting

### Script Fails to Fetch Teams
- Check internet connection
- Verify ESPN is accessible
- Check `data/failed_teams.json` for specific errors

### Pitcher Count Drastically Different
- Review detailed changes report
- Check if ESPN changed position labels (P vs RHP/LHP)
- Verify backup before proceeding

### Restore from Backup
```bash
node -e "import('./lib/backup.mjs').then(m => m.restoreFromBackup('backups/full_snapshot_2026-01-23T10-30-00'))"
```

## Best Practices

1. **Run verification first** - Use `--verify-only` to review changes
2. **Check reports** - Review detailed changes before updating
3. **Backup manually** - Create additional backup if nervous
4. **Test on subset** - Filter to single conference first if unsure
5. **Git commit** - Commit updated data with descriptive message

## Example Workflow

```bash
# 1. Verify changes first
node verify-update-rosters.mjs --verify-only

# 2. Review the reports
cat data/roster_verification_report_*.json | jq '.summary'

# 3. Run full update
node verify-update-rosters.mjs

# 4. Verify results look good
git diff data/rosters_2026.json | head -100

# 5. Commit changes
git add data/rosters_2026.json data/pitchers_2026.json
git commit -m "Update rosters from ESPN (Jan 23, 2026)"
```
