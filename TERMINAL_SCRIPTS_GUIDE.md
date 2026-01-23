# CBB Pitcher Tracker - Terminal Scripts Guide

## 🎯 Quick Start

All scripts are located in `/Users/chace/Desktop/CBB/` and numbered for easy execution.

### **Make Scripts Executable (One Time Setup)**
```bash
cd /Users/chace/Desktop/CBB
chmod +x 1-scrape-all-d1-teams.sh
chmod +x 2-check-espn-2026-data.sh
chmod +x 3-start-cbb-server.sh
chmod +x 4-start-all-trackers.sh
chmod +x 5-stop-all-trackers.sh
chmod +x 6-verify-mlb-cbb-sync.sh
```

---

## 📜 Available Scripts

### **1. Scrape All D1 Teams** (`1-scrape-all-d1-teams.sh`)
**Purpose:** Fetch 2026 rosters and schedules from ALL ~300 D1 baseball teams

**What it does:**
- Fetches team list from ESPN API
- Scrapes each team's athletic website for roster and schedule data
- Extracts pitcher information automatically
- Saves to JSON files

**Usage:**
```bash
./1-scrape-all-d1-teams.sh
```

**Options when running:**
1. Scrape rosters only (fast, ~20 mins)
2. Scrape schedules only
3. Scrape both (comprehensive, ~60 mins)
4. Filter by conference (e.g., SEC, ACC, Big 12)

**Output files:**
- `data/all_d1_rosters_2026.json` - All team rosters
- `data/all_d1_pitchers_2026.json` - Extracted pitcher data
- `data/all_d1_schedules_2026.json` - Game schedules

**When to use:**
- Start of 2026 season to get fresh data
- To expand beyond just SEC teams
- When team websites update their rosters

---

### **2. Check ESPN 2026 Data** (`2-check-espn-2026-data.sh`)
**Purpose:** Test what 2026 data is available from ESPN API

**What it does:**
- Queries ESPN API for multiple teams across different conferences
- Reports how many games are scheduled for each
- Helps determine if ESPN has populated 2026 data yet

**Usage:**
```bash
./2-check-espn-2026-data.sh
```

**Expected results:**
- **Early season (Oct-Jan):** Usually 0 games (ESPN hasn't populated yet)
- **Late season (Feb+):** Full schedules available

**When to use:**
- To check if ESPN API is ready
- Before deciding between ESPN vs team site scraping

---

### **3. Start CBB Server** (`3-start-cbb-server.sh`)
**Purpose:** Start the College Baseball tracker on port 8073

**What it does:**
- Checks if port 8073 is available
- Kills existing process if needed
- Starts the CBB server

**Usage:**
```bash
./3-start-cbb-server.sh
```

**Access:**
- Main interface: `http://localhost:8073/schedule.html`
- Runs in foreground (Ctrl+C to stop)

**When to use:**
- Daily work with CBB tracker
- When you only need CBB running

---

### **4. Start All Trackers** (`4-start-all-trackers.sh`)
**Purpose:** Start NFL, MLB, and CBB trackers simultaneously

**What it does:**
- Starts all three trackers in background
- Each on their dedicated port
- Creates log files in `/tmp/` for each

**Usage:**
```bash
./4-start-all-trackers.sh
```

**Ports:**
- NFL: `http://localhost:8071/schedule.html`
- MLB: `http://localhost:8072/schedule.html`
- CBB: `http://localhost:8073/schedule.html`

**When to use:**
- When monitoring multiple sports
- Season overlap periods
- System testing

---

### **5. Stop All Trackers** (`5-stop-all-trackers.sh`)
**Purpose:** Stop all running tracker servers

**What it does:**
- Finds processes on ports 8071, 8072, 8073
- Terminates them gracefully
- Reports status

**Usage:**
```bash
./5-stop-all-trackers.sh
```

**When to use:**
- Before system shutdown
- To free up ports
- When restarting trackers

---

### **6. Verify MLB-CBB Sync** (`6-verify-mlb-cbb-sync.sh`)
**Purpose:** Confirm CBB has all MLB improvements

**What it does:**
- Compares schedule.html files
- Checks port configurations
- Verifies file integrity
- Reports sync status

**Usage:**
```bash
./6-verify-mlb-cbb-sync.sh
```

**Expected output:**
- ✅ Line counts match
- ✅ Ports correctly configured
- ✅ Files synchronized

**When to use:**
- After MLB updates
- Before deploying changes
- Troubleshooting issues

---

## 🗂️ File Structure

```
/Users/chace/Desktop/CBB/
├── 1-scrape-all-d1-teams.sh      # D1 team scraper
├── 2-check-espn-2026-data.sh     # ESPN API checker
├── 3-start-cbb-server.sh         # Start CBB only
├── 4-start-all-trackers.sh       # Start all trackers
├── 5-stop-all-trackers.sh        # Stop all trackers
├── 6-verify-mlb-cbb-sync.sh      # Verify sync
├── scrape-all-d1-teams.cjs       # Node scraper script
├── scrape-2026-team-sites.cjs    # SEC-only scraper
├── server.mjs                    # Web server (port 8073)
├── schedule.html                 # Main web interface
└── data/
    ├── pitchers_2026.json        # Current pitcher data
    ├── rosters_2026.json         # Current rosters
    ├── schedules_2026.json       # Current schedules
    ├── all_d1_rosters_2026.json  # From script 1
    ├── all_d1_pitchers_2026.json # From script 1
    └── all_d1_schedules_2026.json# From script 1
```

---

## 🚦 Common Workflows

### **Initial 2026 Season Setup**
```bash
# 1. Check if ESPN has 2026 data
./2-check-espn-2026-data.sh

# 2. If ESPN has no data, scrape team sites (SEC only for now)
cd /Users/chace/Desktop/CBB
node scrape-2026-team-sites.cjs

# 3. Or scrape ALL D1 teams
./1-scrape-all-d1-teams.sh
# Choose option 3 (both rosters and schedules)

# 4. Start the tracker
./3-start-cbb-server.sh
```

### **Daily Usage**
```bash
# Start CBB tracker
./3-start-cbb-server.sh

# Or start all trackers
./4-start-all-trackers.sh

# When done
./5-stop-all-trackers.sh
```

### **After MLB Updates**
```bash
# Verify CBB has latest improvements
./6-verify-mlb-cbb-sync.sh

# If updates needed, manually copy or re-sync
```

---

## 🔍 Troubleshooting

### **Port Already in Use**
```bash
# Find what's using the port
lsof -i :8073

# Kill it manually
lsof -ti:8073 | xargs kill -9

# Or use the stop script
./5-stop-all-trackers.sh
```

### **Scraper Fails**
- Check internet connection
- Some schools may have different website structures
- Try filtering to specific conference: `./1-scrape-all-d1-teams.sh` → Option 4

### **No Data Showing**
- Verify JSON files exist in `/data/` folder
- Check file sizes: `ls -lh data/`
- Re-run appropriate scraper

---

## 📝 Notes

- **CBB Port:** 8073 (keep separate from MLB 8072, NFL 8071)
- **Data Source Priority:** Team athletic sites > ESPN API
- **Scraping Speed:** ~5 teams/minute (rate limited to be polite)
- **All D1 Scraper:** Tries to guess athletic site URLs, some may fail
- **MLB Sync:** CBB already has all MLB improvements - verified synced

---

## ❓ Questions?

Reference the individual script headers for more details, or check the main project documentation in the CBB directory.
