# CBB Pitcher Tracker - Fixes Applied

## Summary of Issues Fixed

### 1. ✅ Conference Detection Fixed
**Problem**: All teams showing as "Unknown" conference  
**Root Cause**: ESPN API changed structure - conference info not in team list endpoint  
**Solution**: 
- Created `fetch-conferences.cjs` to build conference ID → name mapping
- Updated `espn-api-fetcher.cjs` to:
  - Fetch individual team details to get `groups.id`
  - Use conference map to resolve conference names
  - Added progress indicators (processes ~430 teams)

**Usage**:
```bash
# Optional but recommended - build conference map first
node fetch-conferences.cjs

# Then fetch teams with conferences
node espn-api-fetcher.cjs
```

### 2. ✅ Schedule Fetching All Weeks
**Problem**: Only fetching week 20 (end of season) instead of all weeks  
**Root Cause**: `quickstart.sh` was calling `--weeks=current`, which calculated week 20 since we're in October  
**Solution**: Changed quickstart to use `--weeks=all` to populate entire season (weeks 1-20)

**Manual Usage**:
```bash
# Fetch all weeks for the season
node tools/fetch_schedule.js --year=2025 --weeks=all

# Or fetch specific weeks
node tools/fetch_schedule.js --year=2025 --weeks=1-10
node tools/fetch_schedule.js --year=2025 --weeks=current
```

### 3. ✅ Pitcher Roster Data Collection
**Problem**: Roster data not being fetched before first game  
**Root Cause**: Roster fetcher existed but wasn't in the setup workflow  
**Solution**: 
- Added Step 3 to quickstart: Fetching Pitcher Rosters
- This runs AFTER schedule fetch but BEFORE participation index
- Gathers roster data from all 430 teams (~2-3 minutes)

**What it does**:
- Fetches current rosters for all teams
- Extracts pitcher information (name, jersey, height, weight, year, etc.)
- Saves to `data/pitchers.json`
- This data is available immediately, not dependent on games being played

### 4. ✅ Module Format Error Fixed
**Problem**: `rebuild_played_index.js` using CommonJS `require()` in ES module  
**Root Cause**: package.json has `"type": "module"` but file was using CommonJS syntax  
**Solution**: 
- Renamed `rebuild_played_index.js` → `rebuild_played_index.cjs`
- Updated quickstart.sh to use new filename
- File now correctly recognized as CommonJS module

## Updated Workflow

The quickstart now runs 5 steps (was 4):

```
Step 0/5: Building Conference Map (Optional)
  - Builds conference ID mapping
  - Takes a few minutes but ensures accurate conference labels

Step 1/5: Fetching D1 Baseball Teams
  - Fetches 430 teams with conference data
  - Uses conference map if available

Step 2/5: Fetching Full Season Schedule
  - Fetches ALL weeks (1-20), not just current week
  - Populates complete season schedule

Step 3/5: Fetching Pitcher Rosters  [NEW]
  - Fetches pitcher rosters for all teams
  - Happens BEFORE games are played
  - Creates pitchers.json with ~5000+ pitchers

Step 4/5: Checking for Missing Teams
  - Adds any teams in schedule not in teams.json

Step 5/5: Building Pitcher Participation Index
  - Only works after games are played
  - Creates game-by-game pitcher participation data
```

## How to Use

### Initial Setup (First Time)
```bash
./quickstart.sh
```
This will now:
1. Optionally build conference map
2. Fetch all teams with proper conferences
3. Fetch ENTIRE season schedule (weeks 1-20)
4. Fetch all pitcher rosters (before games!)
5. Check for missing teams
6. Build participation index (empty until games played)

### Daily Updates (During Season)
```bash
# Fetch latest schedule for current week
node tools/fetch_schedule.js --year=2025 --weeks=current

# Update pitcher participation after games
node rebuild_played_index.cjs
```

## Key Improvements

1. **Conferences Now Accurate**: Teams show proper conference names instead of "Unknown"
2. **Full Schedule Available**: All 20 weeks populated, not just one week
3. **Rosters Available Early**: Pitcher rosters gathered before season starts
4. **No Module Errors**: rebuild_played_index.cjs works correctly

## Files Changed

- ✅ `fetch-conferences.cjs` (NEW) - Conference mapping builder
- ✅ `espn-api-fetcher.cjs` - Updated to use conference map
- ✅ `quickstart.sh` - Added roster fetch step, changed to fetch all weeks
- ✅ `rebuild_played_index.js` → `rebuild_played_index.cjs` (RENAMED)

## Testing

To verify the fixes work:

```bash
# Test conference fetching
node fetch-conferences.cjs

# Test team fetching with conferences
node espn-api-fetcher.cjs
# Should show conference breakdown with actual names

# Test full schedule fetch
node tools/fetch_schedule.js --year=2025 --weeks=1-3
# Should fetch weeks 1, 2, 3

# Test roster fetching
node fetch-pitcher-rosters.cjs
# Should fetch rosters for all teams

# Test participation index
node rebuild_played_index.cjs
# Should work without module errors
```

## Notes

- Conference fetching takes ~5 minutes (fetches details for 430 teams)
- Roster fetching takes ~2-3 minutes (fetches rosters for all teams)
- Schedule fetching all weeks takes ~3-4 minutes
- All of these are one-time setup costs, daily updates are much faster
