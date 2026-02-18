# Data Quality Fixes - Execution Guide

## ✅ Completed

### Task 1: Position Format Standardization
**Status:** COMPLETE
**Changes:** ~50 position formats fixed in pitchers.json

Run this to commit:
```bash
cd ~/Desktop/CBB
git add data/pitchers.json
git commit -m "fix: standardize pitcher position formats

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

## 🔄 Remaining Tasks

### Task 2: Fix Missing Pitcher Years (1,052 pitchers)

**Approach:** Manual data entry or roster scraping required

Priority teams (most missing):
- Check which teams have the most missing years:
```bash
node analyze-missing-years.mjs
```

**Options:**
1. **Quick fix:** Add years manually for high-priority teams
2. **Automated:** Create roster scrapers for each team's website
3. **Hybrid:** Fix top 10 teams manually, automate the rest

### Task 3: Fix Missing Headshots (24 pitchers)

Teams affected:
- Ole Miss: 4 pitchers
- Utah: 19 pitchers
- Clemson: 1 pitcher

**Solution:**
```bash
# Run the headshot scraper for these specific teams
node scrape-missing-headshots.mjs
```

Or use the Chrome extension:
1. Navigate to roster pages
2. Use extension to download headshots
3. Update pitchers.json with new paths

## Verification

After each fix, verify improvements:
```bash
node verify-data-quality.mjs
```

## Deployment

When satisfied with fixes:
```bash
git add -A
git commit -m "fix: improve data quality (years + headshots)"
git push
./deploy.sh
```
