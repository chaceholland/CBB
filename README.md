# College Baseball (CBB) Pitcher Tracker

A comprehensive College Baseball Pitcher tracking system that monitors pitcher participation across D1 baseball teams.

## ☁️ Cloud Deployment

**Live Site:** https://cbb-pitcher-tracker.vercel.app

### Architecture
- **Frontend:** Vercel (static hosting)
- **Database:** Supabase (user data: favorites, priorities, watch history)
- **Static Data:** Vercel (schedule, pitchers, participation data)

### Deploy Updates
```bash
cd ~/Desktop/CBB
./deploy.sh
```

### Migrate Local Data to Cloud
```bash
cd ~/Desktop/CBB
node migrate_to_supabase.mjs
```

---

## 🎯 Overview

This project tracks:
- **D1 College Baseball Teams**
- **Pitcher Rosters** (Starters & Relievers)
- **Game Schedules** (with series grouping)
- **Pitcher Participation** (innings pitched, pitch counts)
- **Watch Priority** system for important series
- **Favorites** for teams and pitchers

## 📁 Project Structure

```
CBB/
├── schedule.html              # Main tracker interface
├── deploy.sh                  # Vercel deployment script
├── migrate_to_supabase.mjs    # Data migration to Supabase
├── server.mjs                 # Local dev server (port 8071)
├── vercel.json                # Vercel configuration
├── data/                      # JSON data files
│   ├── teams.json            # Team database
│   ├── pitchers.json         # Pitcher database
│   ├── schedule.json         # Full season schedule
│   └── pitchers_played_index.json  # Participation tracking
└── tools/                     # Data fetching scripts
```

## 🚀 Quick Start

### Use the Live Site (Recommended)
Just visit: **https://cbb-pitcher-tracker.vercel.app**

### Local Development (Optional)
```bash
cd ~/Desktop/CBB
node server.mjs   # Starts on http://localhost:8071
```

## 📊 Update Data Workflow

### Quick Update (Single Week)
```bash
cd ~/Desktop/CBB
node fetch_all_pitcher_participation.cjs --week=1
node strip_unused_stats.cjs
./deploy.sh
```

### Full Season Update
```bash
cd ~/Desktop/CBB
node fetch_all_pitcher_participation.cjs
node strip_unused_stats.cjs
./deploy.sh
```

### Backup Before Updates
```bash
cd ~/Desktop/CBB
mkdir -p backups
tar -czf "backups/cbb_backup_$(date +%Y%m%d_%H%M%S).tar.gz" data/
```

## 🎨 Features

### UI Features
- **Game View / Series View** - Toggle between individual games and series rollups
- **Week Filters** - Select specific weeks to display
- **Conference Filters** - Filter by D1 conferences (SEC, ACC, Big 12, etc.)
- **Search** - Find teams or pitchers quickly
- **Priority System** - Mark important series (Priority, High, Medium, Low)
- **Favorites** - Star your favorite teams and pitchers
- **Watched Tracking** - Mark series as watched
- **Virtual Scrolling** - Efficient rendering for large game lists

### Pitcher Display
- **Starters Section** - Shows starting pitchers separately
- **Relievers Section** - Shows relief pitchers separately
- **Participation Pills**:
  - 🟢 **Played** - Pitcher appeared in game
  - ⚫ **DNP** - Pitcher did not play
  - ⚪ **Unknown** - Game not yet analyzed
- **Stats Display**:
  - Innings Pitched (IP: 6.0)
  - Innings List (Inn: 1,2,3,4,5,6)
  - Pitch Count (95 pitches)

## 🔧 Troubleshooting

### Clear Browser Cache
Press `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows)

### Check Deployment Status
```bash
npx vercel ls
```

### Re-migrate Data to Supabase
```bash
cd ~/Desktop/CBB && node migrate_to_supabase.mjs
```

## 📝 Notes

- **Live URL:** https://cbb-pitcher-tracker.vercel.app
- **Local Port:** 8071 (for development only)
- **Database:** Supabase (shared instance with CFB/MLB trackers)
- **Season:** February - June (weeks 1-20)

## 🔗 Related Projects

- [MLB Pitcher Tracker](https://mlb-pitcher-tracker.vercel.app)
- [CFB QB Tracker](https://cfb-qb-tracker.vercel.app)

---

**Status:** ✅ Cloud Deployed - Data syncs across all devices via Supabase
