# Getting Started with CBB Pitcher Tracker

## ✅ What's Been Created

Your College Baseball Pitcher Tracker is now set up at `/Users/chace/Desktop/CBB` with:

### Core Files
- ✅ `schedule.html` - Main tracker interface (complete)
- ✅ `server.mjs` - Web server on port 8071 (complete)
- ✅ `package.json` - Node.js configuration (complete)
- ✅ `README.md` - Full documentation (complete)

### Data Files (Templates)
- ✅ `data/teams.json` - Team database template
- ✅ `data/pitchers.json` - Pitcher database template
- ✅ `data/pitcher_enhance.json` - Manual additions
- ✅ `data/schedule.json` - Schedule template
- ✅ `data/conferences_map.json` - Conference mapping
- ✅ `data/pitchers_played_index.json` - Participation tracking template

### Directories
- ✅ `data/` - JSON data storage
- ✅ `tools/` - Scripts directory (empty, ready for scripts)

## 🚀 Quick Test

### Step 1: Test the Server

```bash
cd ~/Desktop/CBB
node server.mjs
```

You should see:
```
⚾ CBB Pitcher Tracker Server
=============================
Server running at http://localhost:8071/
Press Ctrl+C to stop
```

### Step 2: Open in Browser

Open http://localhost:8071 in your browser.

**Expected Result:**
- Page loads successfully
- Shows "CBB Weekly Matchups & Pitcher Participation" title
- Shows 1 sample game (from template data)
- Shows 1 team (Alabama)
- Shows 1 sample pitcher

### Step 3: Test Features

Try these features:
- ✅ Click "Filters" button - modal opens
- ✅ Toggle "Games" / "Series" view buttons
- ✅ Search for "Alabama" in search box
- ✅ Click star next to pitcher name - turns gold
- ✅ Click "Set Priority" button - cycles through priority levels
- ✅ Check "Watched" checkbox - game becomes grayed out

## 📋 Key Differences from CFB Project

### Port
- CFB: `http://localhost:8070`
- CBB: `http://localhost:8071` ⚾

### Terminology
- QBs → Pitchers
- Quarterback → Pitcher
- "Played" pills → Shows innings pitched + pitch count

### UI Enhancements
- **Starter/Reliever Sections** - Pitchers grouped by role
- **Stats Display** - Shows IP, innings list, pitch count when pitcher played
- **Series View** - Groups games into series (3-game weekends)
- **Game Toggle** - Switch between individual games and series rollup

### LocalStorage Keys
- `cfb:` prefix → `cbb:` prefix
- `qbs` → `pitchers`

## 🔨 Next Steps: Build Data Fetching Scripts

Now you need to create the data fetching scripts. Here's what needs to be built:

### 1. tools/fetch_schedule.js
**Purpose**: Fetch game schedules from ESPN

```javascript
// Fetch games from ESPN College Baseball API
// Parse schedule data
// Save to data/schedule.json
```

### 2. espn-api-fetcher.cjs (root level)
**Purpose**: Fetch all D1 baseball teams

```javascript
// Fetch D1 teams from ESPN
// Extract: team ID, name, logo, conference
// Save to data/teams.json
```

### 3. rebuild_played_index.js (root level)
**Purpose**: Build pitcher participation tracking

```javascript
// Read schedule.json for completed games
// For each game, fetch box score from ESPN
// Parse pitcher appearances, innings, pitch counts
// Build pitchers_played_index.json
```

### 4. fetch-missing-teams.cjs (root level)
**Purpose**: Find teams in schedule but not in teams.json

```javascript
// Compare schedule team IDs to teams.json
// Fetch missing teams from ESPN
// Add to teams.json
```

## 🎯 ESPN API Endpoints for Baseball

Replace the football endpoints with baseball:

### Football → Baseball URL Mapping

| Football | Baseball |
|----------|----------|
| `/college-football/` | `/college-baseball/` |
| `/football/` | `/baseball/` |
| `football` query param | `baseball` query param |

### Key ESPN Baseball URLs

```javascript
// Teams list
https://site.api.espn.com/apis/site/v2/sports/baseball/college-baseball/teams

// Team roster
https://site.web.api.espn.com/apis/common/v3/sports/baseball/college-baseball/teams/{teamId}/roster

// Schedule
https://site.api.espn.com/apis/site/v2/sports/baseball/college-baseball/scoreboard?dates={YYYYMMDD}

// Game box score
https://site.api.espn.com/apis/site/v2/sports/baseball/college-baseball/summary?event={gameId}
```

## 📝 Development Workflow

Once scripts are built:

```bash
# 1. Fetch teams (run once at start of season)
node espn-api-fetcher.cjs

# 2. Fetch schedule (daily during season)
node tools/fetch_schedule.js --year=2025 --weeks=current

# 3. Update pitcher participation (after games)
node rebuild_played_index.js

# 4. Start server
node server.mjs
```

## 🐛 Troubleshooting

### Server won't start
- Check if port 8071 is available
- Try: `lsof -i :8071` to see what's using the port

### Page loads but shows errors
- Check browser console (F12)
- Verify data files exist in `data/` directory

### No games showing
- Check `data/schedule.json` has games array
- Check week filter isn't excluding all games

## ✨ What's Working Now

- ✅ Full UI/UX interface
- ✅ Pitcher display (starters/relievers separated)
- ✅ Stats display for pitched innings
- ✅ Series grouping logic
- ✅ Game/Series view toggle
- ✅ All filters and search
- ✅ Priority and favorites system
- ✅ Watched tracking
- ✅ LocalStorage persistence
- ✅ Responsive design

## 🚧 What Needs Data Scripts

- ⏳ Real team data from ESPN
- ⏳ Real pitcher rosters from ESPN
- ⏳ Real game schedules from ESPN
- ⏳ Real pitcher participation from box scores

---

**Ready to proceed?** Ask me to create the data fetching scripts next!
