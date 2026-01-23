# CBB Pitcher Tracker - Data Version Management

## Current Setup (December 2024)

**Active Data**: 2025 Season (for testing)
- 17 teams (16 SEC + 1 ACC)
- 370 pitchers
- Source: Scraped rosters from 2025 season

**Purpose**: Test the tracking system with real data while waiting for 2026 rosters

---

## Data Files

### Active Data
- `data/pitchers.json` - Currently loaded by the server

### Backup/Version Files
- `data/pitchers_2025_testing.json` - 2025 season data (347 SEC pitchers)
- `data/pitchers_2026_production.json` - Will be created when 2026 rosters are ready

---

## Switching Between Years

Use the swap script to change active data:

```bash
# Use 2025 data (current - for testing)
./swap-data-year.sh 2025

# Switch to 2026 data (when ready)
./swap-data-year.sh 2026
```

The script will:
1. Backup your current `pitchers.json`
2. Copy the requested year's data to `pitchers.json`
3. Show summary of active data
4. Remind you to restart the server

---

## Collecting 2026 Data

### When rosters are posted (January-February 2026):

```bash
# Run the 2026 scraper
node scrape-2026-rosters.cjs
```

This will scrape:
- ACC teams (17)
- Big 12 teams (15)
- Big Ten teams (18)
- Pac-12 teams (2)
- SEC teams (16) - if you want to refresh

The scraper is **merge-safe**: it won't overwrite existing data, only adds/updates.

### After scraping 2026 data:

```bash
# Save the scraped data as 2026 production
cp data/pitchers.json data/pitchers_2026_production.json

# Switch to using 2026 data
./swap-data-year.sh 2026

# Restart server
npm start
```

---

## Important Files

### Scrapers
- `scrape-2026-rosters.cjs` - Main scraper for 2026 season (all conferences)
- `rebuild-sec.mjs` - SEC-only scraper (useful for testing)
- `scrape-merge-safe.cjs` - Generic merge-safe scraper

### Configuration
- `known-athletic-websites.cjs` - Website URLs for team rosters
- `data/teams.json` - All D1 teams with ESPN IDs

### Server
- `server.mjs` - Web server (port 8073)
- Reads from `data/pitchers.json` automatically

---

## Workflow Timeline

**Now (December 2024):**
- ✅ Using 2025 data for testing
- ✅ System fully functional with 370 pitchers
- ✅ 2026 scraper ready but waiting for rosters

**January-February 2026:**
1. Run `node scrape-2026-rosters.cjs`
2. Save as `data/pitchers_2026_production.json`
3. Run `./swap-data-year.sh 2026`
4. Restart server

**During 2026 Season:**
- Add game tracking
- Use 2026 production data
- Keep 2025 data as backup for reference

---

## Notes

- All scrapers are merge-safe - they won't overwrite existing data
- Backups are created automatically when swapping
- Server must be restarted after data changes
- 2026 rosters typically post in late January/early February
