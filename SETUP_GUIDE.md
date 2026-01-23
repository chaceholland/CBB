# CBB Pitcher Tracker - Complete Setup Guide

## 📋 Table of Contents
1. [Initial Setup](#initial-setup)
2. [Data Population (First Time)](#data-population-first-time)
3. [Daily Workflow](#daily-workflow)
4. [Weekly Maintenance](#weekly-maintenance)
5. [Script Reference](#script-reference)
6. [Troubleshooting](#troubleshooting)

---

## Initial Setup

### Prerequisites
- Node.js v14 or higher
- Internet connection
- Terminal/Command Line access

### Verify Installation
```bash
cd ~/Desktop/CBB
ls -la
# Should see: schedule.html, server.mjs, tools/, data/
```

---

## Data Population (First Time)

**Run these scripts IN ORDER to populate your tracker with real data.**

### Step 1: Fetch D1 Baseball Teams

```bash
node espn-api-fetcher.cjs
```

**What it does:**
- Fetches all D1 college baseball teams from ESPN API
- Gets team names, logos, conferences
- Saves to `data/teams.json`

**Expected Output:**
```
🔍 Fetching D1 Baseball teams from ESPN...
📋 Processing Division I...
  ✓ Alabama Crimson Tide (SEC)
  ✓ Auburn Tigers (SEC)
  ...
✅ Successfully fetched 300+ teams
```

**Time:** 30-60 seconds

---

### Step 2: Fetch Current Schedule

```bash
node tools/fetch_schedule.js --year=2025 --weeks=current
```

**What it does:**
- Fetches games for the current week
- Gets game dates, times, matchups
- Saves to `data/schedule.json` and `data/schedule_week.json`

**Options:**
```bash
# Current week only
node tools/fetch_schedule.js --year=2025 --weeks=current

# Specific week
node tools/fetch_schedule.js --year=2025 --weeks=5

# Week range
node tools/fetch_schedule.js --year=2025 --weeks=1-10

# Multiple weeks
node tools/fetch_schedule.js --year=2025 --weeks=1,3,5,7

# Entire season (Feb-June = weeks 1-20)
node tools/fetch_schedule.js --year=2025 --weeks=all
```

**Expected Output:**
```
⚾ College Baseball Schedule Fetcher
====================================
Year: 2025
Weeks: 1

📅 Fetching Week 1...
   2/14/2025 - 2/20/2025
   2/14/2025: 25 games
   2/15/2025: 48 games
   ...
   ✓ Found 150 games for Week 1

✅ Saved full schedule
📊 Summary:
   Total games: 150
   Weeks covered: 1
   Teams involved: 85
```

**Time:** 1-2 minutes per week

---

### Step 3: Add Any Missing Teams

```bash
node fetch-missing-teams.cjs
```

**What it does:**
- Compares schedule team IDs to teams.json
- Fetches data for any missing teams
- Updates teams.json

**When to run:**
- After fetching schedule
- If you see "Unknown" teams in tracker
- Mid-season when new teams appear

**Expected Output:**
```
🔍 Scanning for Missing Teams
📋 Existing teams: 300
📅 Teams in schedule: 85
✅ No missing teams! All teams in schedule are already in database.
```

**Time:** 10-30 seconds

---

### Step 4: Build Pitcher Participation Index

```bash
node rebuild_played_index.js
```

**What it does:**
- Reads completed games from schedule.json
- Fetches box scores from ESPN
- Extracts pitcher participation (IP, pitch count, innings)
- Saves to `data/pitchers_played_index.json`

**⚠️ IMPORTANT:** This only works for COMPLETED games. If you run this before games are played, the index will be empty.

**Expected Output:**
```
⚾ Rebuilding Pitcher Participation Index
📋 Found 150 games in schedule
✓ 45 completed games to process

[1/45] Week 1
  Processing: Florida @ Alabama
    Home pitchers: 5
    Away pitchers: 6

...

✅ Rebuild complete!
📊 Summary:
   Completed games: 45
   Successfully processed: 45
   Errors: 0
   Total pitcher appearances: 530
```

**Time:** 2-5 minutes (depends on number of completed games)

---

### Step 5: Start the Server

```bash
node server.mjs
```

**Expected Output:**
```
⚾ CBB Pitcher Tracker Server
=============================
Server running at http://localhost:8071/
Press Ctrl+C to stop
```

### Step 6: Open in Browser

Navigate to: **http://localhost:8071**

You should now see your tracker with real data!

---

## Daily Workflow (During Season)

### Morning Routine (Before Games)

Update today's schedule:
```bash
cd ~/Desktop/CBB
node tools/fetch_schedule.js --year=2025 --weeks=current
```

**Time:** 30 seconds

---

### After Games Complete (Evening/Next Morning)

Update pitcher participation:
```bash
cd ~/Desktop/CBB
node rebuild_played_index.js
```

**Time:** 2-5 minutes

---

### Quick Daily Script

Create a script for daily updates:

```bash
# Save as: ~/Desktop/CBB/daily_update.sh
#!/bin/bash
cd ~/Desktop/CBB

echo "📅 Updating schedule..."
node tools/fetch_schedule.js --year=2025 --weeks=current

echo "⚾ Updating pitcher participation..."
node rebuild_played_index.js

echo "✅ Update complete!"
```

Then run:
```bash
chmod +x daily_update.sh
./daily_update.sh
```

---

## Weekly Maintenance

### Full Week Update (Mondays)

```bash
cd ~/Desktop/CBB

# Fetch next 2 weeks of schedule
node tools/fetch_schedule.js --year=2025 --weeks=current

# Update participation for completed games
node rebuild_played_index.js

# Check for new teams
node fetch-missing-teams.cjs
```

**Time:** 5 minutes

---

### Mid-Season Refresh (Monthly)

```bash
cd ~/Desktop/CBB

# Refresh all teams
node espn-api-fetcher.cjs

# Fetch entire season schedule
node tools/fetch_schedule.js --year=2025 --weeks=all

# Add any missing teams
node fetch-missing-teams.cjs

# Rebuild full participation index
node rebuild_played_index.js
```

**Time:** 10-15 minutes

---

## Script Reference

### espn-api-fetcher.cjs

**Purpose:** Fetch D1 baseball teams from ESPN

**When to run:**
- Initial setup
- Start of new season
- Monthly refresh

**Output:**
- `data/teams.json`

**Command:**
```bash
node espn-api-fetcher.cjs
```

**No options available**

---

### tools/fetch_schedule.js

**Purpose:** Fetch game schedules from ESPN

**When to run:**
- Daily during season
- Before viewing games
- After schedule changes

**Output:**
- `data/schedule.json` (full schedule)
- `data/schedule_week.json` (current week)
- `data/schedule_week_##.json` (individual weeks)

**Commands:**
```bash
# Current week
node tools/fetch_schedule.js --year=2025 --weeks=current

# Next week
node tools/fetch_schedule.js --year=2025 --weeks=next

# Specific week
node tools/fetch_schedule.js --year=2025 --weeks=5

# Week range
node tools/fetch_schedule.js --year=2025 --weeks=1-10

# Multiple weeks (non-consecutive)
node tools/fetch_schedule.js --year=2025 --weeks=1,3,5,7

# All weeks (1-20)
node tools/fetch_schedule.js --year=2025 --weeks=all
```

---

### rebuild_played_index.js

**Purpose:** Build pitcher participation tracking

**When to run:**
- After games complete
- Daily during season
- After schedule updates

**Output:**
- `data/pitchers_played_index.json` (full index)
- `data/pitchers_played_index_week_##.json` (weekly indexes)

**Command:**
```bash
node rebuild_played_index.js
```

**No options available**

**Note:** Only processes completed games

---

### fetch-missing-teams.cjs

**Purpose:** Add teams from schedule not in teams.json

**When to run:**
- After fetching schedule
- When seeing unknown teams
- Mid-season updates

**Output:**
- Updates `data/teams.json`

**Command:**
```bash
node fetch-missing-teams.cjs
```

**No options available**

---

## Troubleshooting

### Schedule Not Updating

**Problem:** New games not showing after running fetch script

**Solutions:**
1. Check if script ran successfully (look for errors)
2. Verify file was updated: `ls -la data/schedule*.json`
3. Hard refresh browser: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
4. Restart server

---

### Pitchers Showing "Unknown" Status

**Problem:** All pitchers showing gray "—" pills

**Solution:**
```bash
node rebuild_played_index.js
```

**Note:** This only works for completed games. In-progress or future games will show "—"

---

### Missing Teams

**Problem:** Games showing team IDs instead of names

**Solution:**
```bash
node fetch-missing-teams.cjs
```

---

### Script Errors

**Problem:** Script crashes or shows errors

**Common Causes:**
1. No internet connection
2. ESPN API temporarily down
3. Rate limiting (too many requests)

**Solutions:**
1. Wait a few minutes and try again
2. Check internet connection
3. For rate limiting, add delays between requests

---

### Empty Pitcher Index

**Problem:** No pitchers showing as "Played"

**Causes:**
1. No completed games yet
2. Script ran before games finished
3. Box score data not available

**Solution:**
Wait for games to complete, then run:
```bash
node rebuild_played_index.js
```

---

## Baseball Season Timeline

**Pre-Season:** Late January - Early February
- **Action:** Set up tracker, fetch teams

**Season Start:** Mid-February (Week 1)
- **Action:** Start daily updates

**Regular Season:** February - May (Weeks 1-15)
- **Action:** Daily schedule + participation updates

**Conference Tournaments:** Late May (Weeks 16-17)
- **Action:** Continue daily updates

**NCAA Regionals:** Early June (Week 18)
- **Action:** Monitor closely, more frequent updates

**College World Series:** Mid-June (Weeks 19-20)
- **Action:** Daily updates for championship games

---

## Quick Command Cheat Sheet

```bash
# INITIAL SETUP
node espn-api-fetcher.cjs                           # Fetch teams
node tools/fetch_schedule.js --year=2025 --weeks=1  # Get schedule
node fetch-missing-teams.cjs                        # Add missing teams
node rebuild_played_index.js                        # Build index
node server.mjs                                     # Start server

# DAILY
node tools/fetch_schedule.js --year=2025 --weeks=current  # Update schedule
node rebuild_played_index.js                              # Update pitchers

# WEEKLY
node tools/fetch_schedule.js --year=2025 --weeks=1-20  # Full schedule
node fetch-missing-teams.cjs                           # Check teams
node rebuild_played_index.js                           # Rebuild index

# VIEW
node server.mjs                                        # Start server
# Then open: http://localhost:8071
```

---

## Next Steps After Setup

1. ✅ Run all initial setup scripts
2. ✅ Verify data in browser
3. ✅ Set priorities on important series
4. ✅ Favorite your teams
5. ✅ Set up daily update routine
6. ✅ Enjoy tracking pitchers! ⚾

---

**Questions?** Check the README.md or GETTING_STARTED.md for more details.
