# CBB Data Fetching Scripts - Execution Order

## 📋 Complete Setup Workflow

Follow these steps in order to populate your tracker with real data.

---

## 🏁 FIRST TIME SETUP (Start of Season)

Run these scripts once at the beginning of the season:

### Step 1: Fetch D1 Baseball Teams
```bash
cd ~/Desktop/CBB
node espn-api-fetcher.cjs
```

**What it does:**
- Fetches all D1 college baseball teams from ESPN API
- Downloads team logos
- Extracts conference information
- Creates/updates `data/teams.json`

**Expected output:** ~300 D1 teams

**Time:** 2-3 minutes

---

### Step 2: Fetch Full Season Schedule
```bash
node tools/fetch_schedule.js --year=2025 --weeks=1-20
```

**What it does:**
- Fetches game schedules for all weeks
- Creates `data/schedule.json`
- Creates `data/schedule_week.json` (current week only)

**Expected output:** 1000+ games across 20 weeks

**Time:** 3-5 minutes

---

### Step 3: Add Missing Teams
```bash
node fetch-missing-teams.cjs
```

**What it does:**
- Compares team IDs in schedule vs teams.json
- Fetches any missing teams from ESPN
- Adds them to teams.json

**Expected output:** Adds 20-50 teams (small D1 schools ESPN doesn't list initially)

**Time:** 1-2 minutes

---

### Step 4: Fetch Pitcher Rosters
```bash
node fetch-pitcher-rosters.cjs
```

**What it does:**
- Reads all teams from teams.json
- Fetches roster for each team
- Extracts pitcher information
- Creates `data/pitchers.json`

**Expected output:** 2000+ pitchers

**Time:** 10-15 minutes (API rate limiting)

---

### Step 5: Initialize Participation Tracking
```bash
node rebuild_played_index.js
```

**What it does:**
- Reads completed games from schedule.json
- Fetches box scores for each completed game
- Extracts pitcher stats (IP, pitch count, innings list)
- Creates `data/pitchers_played_index.json`

**Expected output:** Participation data for all completed games

**Time:** 5-10 minutes (depends on # of completed games)

---

### Step 6: Start Server
```bash
node server.mjs
```

Open http://localhost:8071

**You're ready to track pitchers!** 🎉

---

## 📅 DAILY MAINTENANCE (During Season)

Run these scripts each day during the season:

### Morning Routine (Before Games)
```bash
cd ~/Desktop/CBB

# Update current week's schedule (picks up any changes)
node tools/fetch_schedule.js --year=2025 --weeks=current
```

**Time:** 30 seconds

---

### After Games Routine (Sunday/Monday)
```bash
cd ~/Desktop/CBB

# Update pitcher participation for completed games
node rebuild_played_index.js

# Restart server to see updates
node server.mjs
```

**Time:** 5-10 minutes (depending on # of games)

---

## 🔄 WEEKLY MAINTENANCE

Run these scripts once per week:

### Monday Morning (Start of Week)
```bash
cd ~/Desktop/CBB

# Full schedule refresh (entire season)
node tools/fetch_schedule.js --year=2025 --weeks=1-20

# Update participation
node rebuild_played_index.js

# Restart server
node server.mjs
```

**Time:** 10 minutes total

---

## 🆕 MID-SEASON UPDATES

### Adding New Pitchers (Transfers, Call-ups)

If a new pitcher appears that isn't in your database:

**Option 1: Manual Add (Quick)**

Edit `data/pitcher_enhance.json`:
```json
{
  "teams": [
    {
      "team_id": "333",
      "team": "Alabama", 
      "pitchers": [
        {
          "id": "4567890",
          "espn_id": "4567890",
          "name": "New Transfer",
          "jersey_number": "18",
          "role": "Starter",
          "height": "6'3\"",
          "weight": "205",
          "year": "JR",
          "hometown": "Dallas, TX",
          "headshot": "https://a.espncdn.com/i/headshots/college-baseball/players/full/4567890.png"
        }
      ]
    }
  ]
}
```

**Option 2: Re-fetch All Rosters**
```bash
node fetch-pitcher-rosters.cjs
```

---

### Updating Conferences (Realignment)

If conferences change:
```bash
# Re-fetch teams (updates conference info)
node espn-api-fetcher.cjs

# Re-fetch rosters (updates pitcher team info)
node fetch-pitcher-rosters.cjs
```

---

## 🔍 SCRIPT DETAILS

### espn-api-fetcher.cjs
- **Input:** None (fetches from ESPN API)
- **Output:** `data/teams.json`
- **API Calls:** ~10-20 requests
- **Rate Limit:** None typically
- **Run:** Once per season, or when adding new teams

### tools/fetch_schedule.js
- **Input:** Year, week(s) via command line args
- **Output:** `data/schedule.json`, `data/schedule_week.json`
- **API Calls:** 1 per week
- **Rate Limit:** None typically
- **Run:** Daily (current week) or Weekly (full season)

**Options:**
```bash
--year=2025              # Season year
--weeks=current          # Current week only
--weeks=5                # Specific week
--weeks=5-10             # Week range
--weeks=5,7,9            # Multiple specific weeks
--weeks=1-20             # Full season
```

### fetch-missing-teams.cjs
- **Input:** `data/schedule.json`, `data/teams.json`
- **Output:** Updates `data/teams.json`
- **API Calls:** 1 per missing team
- **Rate Limit:** None typically
- **Run:** After fetching schedule, or when seeing unknown teams

### fetch-pitcher-rosters.cjs
- **Input:** `data/teams.json`
- **Output:** `data/pitchers.json`
- **API Calls:** 1 per team (~300 teams)
- **Rate Limit:** May need throttling (350ms delay)
- **Run:** Once per season, or when rosters change significantly

### rebuild_played_index.js
- **Input:** `data/schedule.json`, `data/pitchers.json`
- **Output:** `data/pitchers_played_index.json`
- **API Calls:** 1 per completed game
- **Rate Limit:** May need throttling (350ms delay)
- **Run:** After games complete (daily during season)

---

## ⚠️ TROUBLESHOOTING

### "ECONNRESET" or "Network Error"
- ESPN API rate limit hit
- **Solution:** Wait 5 minutes, try again
- Scripts have built-in throttling, but may need adjustment

### "Team not found" in tracker
- Team in schedule but not in teams.json
- **Solution:** Run `node fetch-missing-teams.cjs`

### "No pitchers showing"
- Roster data missing
- **Solution:** Run `node fetch-pitcher-rosters.cjs`

### "All pitchers show 'Unknown' status"
- Participation index not built
- **Solution:** Run `node rebuild_played_index.js`

### "Old games still showing"
- Browser cache
- **Solution:** Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)

---

## 📊 TYPICAL SEASON WORKFLOW

**Week 1 (Pre-season):**
1. Run full setup (Steps 1-6 above)
2. Set priorities for important series
3. Star favorite teams/pitchers

**Weeks 2-20 (During season):**
1. **Each morning:** `fetch_schedule.js --weeks=current`
2. **After weekend:** `rebuild_played_index.js`
3. **Monday:** Full schedule refresh if needed

**Post-season:**
1. Final `rebuild_played_index.js` run
2. Archive data for historical reference

---

## 💡 PRO TIPS

1. **Create aliases** for common commands:
```bash
# Add to ~/.zshrc or ~/.bashrc
alias cbb-update-schedule="cd ~/Desktop/CBB && node tools/fetch_schedule.js --year=2025 --weeks=current"
alias cbb-update-pitchers="cd ~/Desktop/CBB && node rebuild_played_index.js"
alias cbb-server="cd ~/Desktop/CBB && node server.mjs"
```

2. **Automate daily updates** with cron:
```bash
# Run at 6 AM every day during season
0 6 * 2-6 * cd ~/Desktop/CBB && node tools/fetch_schedule.js --year=2025 --weeks=current
```

3. **Keep backup copies** of data files:
```bash
cp -r data/ data_backup_$(date +%Y%m%d)
```

---

**Ready to fetch data?** Start with Step 1 above! 🚀
