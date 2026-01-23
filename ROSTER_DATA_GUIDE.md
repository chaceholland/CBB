# Getting Roster Data - Complete Guide

Since ESPN doesn't have 2024 or 2025 rosters yet, here are your options:

---

## Option 1: Browser Scraping (D1Baseball.com) 🌐

### What It Does
Uses headless Chrome to scrape roster data from D1Baseball.com

### Requirements
```bash
npm install puppeteer
```
This downloads Chromium (~170MB)

### Pros
- Automated data collection
- Handles ~200-300 major programs
- Gets current roster data

### Cons
- Requires Puppeteer installation
- Takes time (~10-15 minutes for 50 teams)
- Not all D1 teams may be on D1Baseball
- Depends on site structure

### Usage
```bash
# Install Puppeteer first
npm install puppeteer

# Run scraper
node scrape-d1baseball-rosters.cjs
```

### Configuration
Edit the script to:
- Adjust `DELAY_MS` (default: 2000ms between requests)
- Modify `TEAM_SLUG_MAP` for custom team name mappings
- Remove `.slice(0, 50)` on line 200 to process all teams

### Expected Output
```
⚾ D1Baseball Roster Scraper
============================
📋 Loaded 430 teams
🚀 Starting browser...

[1/50] Alabama Crimson Tide
  Trying: https://d1baseball.com/team/alabama/roster/
  ✅ Found 18 pitchers

[2/50] Arkansas Razorbacks
  Trying: https://d1baseball.com/team/arkansas/roster/
  ✅ Found 15 pitchers

...

✅ Scraping complete!
  Teams processed: 50
  Teams with rosters: 45
  Total pitchers: 687
```

---

## Option 2: CSV Import (Manual Entry) 📊

### What It Does
Import roster data from a CSV file you create/collect manually

### Requirements
None - just Node.js

### Pros
- No dependencies
- Complete control over data
- Works for any team
- Can copy/paste from websites

### Cons
- Manual data entry required
- Time consuming for many teams

### Usage

#### Step 1: Create CSV File
Use the template: `roster-template.csv`

CSV Format:
```csv
team_name,player_name,position,jersey_number,year,hometown
Alabama,John Smith,RHP,25,Jr,Birmingham AL
Alabama,Bob Jones,LHP,12,So,Mobile AL
Auburn,Tom Brown,RHP,15,Fr,Atlanta GA
```

#### Step 2: Import CSV
```bash
node import-roster-csv.cjs your-rosters.csv
```

### CSV Guidelines

**Required Columns:**
- `team_name` - Team name (matches displayName from teams.json)
- `player_name` - Player full name
- `position` - Must be: P, RHP, LHP, SP, or RP

**Optional Columns:**
- `jersey_number` - Player number
- `year` - Fr, So, Jr, Sr, etc.
- `hometown` - City, State

**Tips:**
- Use team names like "Alabama", "Auburn", "LSU" (not full names with mascots)
- Position must include P (pitcher indicator)
- Leave optional fields blank if unknown: `Alabama,John Smith,RHP,,,`

### Example Workflow

1. **Find rosters online**:
   - Google: "Alabama baseball roster 2024"
   - Visit team athletics website
   - Copy pitcher information

2. **Create CSV**:
   ```csv
   team_name,player_name,position,jersey_number,year,hometown
   Alabama,Luke Holman,RHP,39,Jr,Mobile AL
   Alabama,Ben Hess,RHP,34,Sr,Orlando FL
   Alabama,Justin Johnson,RHP,35,Jr,Hoover AL
   ```

3. **Import**:
   ```bash
   node import-roster-csv.cjs alabama-rosters.csv
   ```

---

## Option 3: Wait for ESPN ⏰

### What It Does
Nothing - just wait for ESPN to publish 2025 rosters

### When Available
- **Best Case**: Late January 2025
- **Likely**: Early-Mid February 2025
- **Season Start**: Mid-February 2025

### Usage
```bash
# Check weekly starting late December
node fetch-pitcher-rosters.cjs

# Or try 2024 data
node fetch-2024-rosters.cjs
```

### Pros
- Official ESPN data
- Automated
- No manual work
- Covers all teams

### Cons
- Have to wait 2-3 months
- Can't use system until then

---

## Recommendation by Use Case

### If You Need Data NOW:
**Option 2 (CSV Import)** for your favorite 10-20 teams
- Quick to get started
- Focus on teams you care about
- Expand later

### If You Want Comprehensive Coverage:
**Option 1 (Browser Scraping)** from D1Baseball
- Covers most major programs
- One-time setup
- Good for 200-300 teams

### If You Can Wait:
**Option 3 (ESPN)** in January/February
- Official data
- Zero effort
- Complete coverage

### Best Hybrid Approach:
1. Use **CSV Import** for 10-20 key teams NOW
2. Wait for **ESPN** to publish in February
3. Use scraper for any remaining gaps

---

## Files Created for You

### Scraping:
- ✅ `scrape-d1baseball-rosters.cjs` - Browser-based scraper
- ✅ `ALTERNATIVE_SOURCES.md` - Source comparison

### Manual Import:
- ✅ `import-roster-csv.cjs` - CSV importer
- ✅ `roster-template.csv` - CSV template

### ESPN (Future):
- ✅ `fetch-pitcher-rosters.cjs` - 2025 rosters (when available)
- ✅ `fetch-2024-rosters.cjs` - 2024 rosters (if re-enabled)

---

## Quick Start Examples

### Example 1: Import SEC Teams Manually
```bash
# Create CSV with just SEC teams you care about
cat > sec-pitchers.csv << EOF
team_name,player_name,position,jersey_number,year,hometown
Alabama,John Smith,RHP,25,Jr,Birmingham AL
Auburn,Tom Brown,RHP,15,Fr,Atlanta GA
LSU,Frank Miller,RHP,5,Sr,Baton Rouge LA
EOF

# Import
node import-roster-csv.cjs sec-pitchers.csv
```

### Example 2: Scrape Top 50 Programs
```bash
# Install Puppeteer
npm install puppeteer

# Run scraper (configured for first 50 teams)
node scrape-d1baseball-rosters.cjs
```

### Example 3: Wait and Check
```bash
# Try ESPN weekly starting December
node fetch-pitcher-rosters.cjs

# If it works, you're done! Otherwise wait longer.
```

---

## Data Quality Notes

| Source | Accuracy | Completeness | Effort | Speed |
|--------|----------|--------------|--------|-------|
| ESPN | ⭐⭐⭐⭐⭐ Official | All teams | None | N/A (not available yet) |
| D1Baseball | ⭐⭐⭐⭐ Good | 200-300 teams | Low | ~15 min |
| Manual CSV | ⭐⭐⭐ Varies | You choose | High | Depends on # teams |

---

## Troubleshooting

### Scraper Issues:
```bash
# If Puppeteer fails:
npm install puppeteer --force

# If team not found:
# Edit TEAM_SLUG_MAP in scrape-d1baseball-rosters.cjs
```

### CSV Import Issues:
```bash
# If team not matched:
# Use exact team name from teams.json displayName

# Check your team names:
node -e "console.log(require('./data/teams.json').teams.map(t => t.displayName).slice(0,20))"
```

---

## Legal/Ethical Notes

- ✅ Personal/educational use only
- ✅ Respect rate limits (built-in 2s delay)
- ✅ Cite sources appropriately
- ❌ Don't use scraped data commercially without permission
- ❌ Don't overwhelm sites with requests

---

## Questions?

**Q: Which option is best?**
A: CSV Import for < 20 teams, Browser Scraping for 50-300 teams, Wait for ESPN for all teams

**Q: Can I combine approaches?**
A: Yes! Import some manually, scrape others, fill gaps with ESPN later

**Q: Will the scraper get all teams?**
A: No - D1Baseball may not have all 430 teams. It covers major programs well.

**Q: How often should I update?**
A: Once before season starts, then update from ESPN during season

---

## You're Ready! 🎉

Choose your approach and get started. All three scripts are ready to use.
