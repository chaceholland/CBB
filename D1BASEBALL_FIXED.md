# ✅ D1Baseball Scraper - Fixed for 2024 Data

## What Was Fixed

### Issues:
1. ❌ Wrong URL pattern: `/team/` → ✅ `/teams/` (plural)
2. ❌ No year specified → ✅ Added `/2024/` to URLs
3. ❌ 30 second timeout → ✅ 45 second timeout
4. ❌ Too strict page load → ✅ `domcontentloaded` (faster)

### Improvements:
- ✅ Tries 3 URL patterns per team (fallback strategy)
- ✅ Better error handling (continues on failures)
- ✅ Improved pitcher detection (multiple strategies)
- ✅ 3 second delay between requests (more respectful)
- ✅ More team slug mappings (50+ major programs)

---

## Quick Start

### Step 1: Test URLs (Optional but Recommended)
```bash
node test-d1baseball-urls.cjs
```

Expected output:
```
🧪 Testing D1Baseball URLs...

Testing: Alabama
  🔄 301 - https://d1baseball.com/teams/alabama/2024/
  ✅ URLs are working!
```

### Step 2: Install Puppeteer (if not already installed)
```bash
npm install puppeteer
```

This downloads Chromium (~170MB, one-time download)

### Step 3: Run Scraper
```bash
node scrape-d1baseball-rosters.cjs
```

**Expected Output:**
```
⚾ D1Baseball Roster Scraper
============================
⚠️  IMPORTANT NOTES:
  - Scraping D1Baseball.com 2024 roster data
  - 3 second delay between requests
  - Testing with first 50 teams

📋 Loaded 430 teams
🚀 Starting browser...

[1/50] Abilene Christian Wildcats
  Trying: https://d1baseball.com/teams/abilene-christian/2024/
    ✓ Page loaded successfully
  ✅ Found 12 pitchers

[2/50] Alabama Crimson Tide
  Trying: https://d1baseball.com/teams/alabama/2024/
    ✓ Page loaded successfully
  ✅ Found 18 pitchers
```

---

## Configuration

### Process More Teams
Edit `scrape-d1baseball-rosters.cjs` line 244:

**Current (first 50 teams):**
```javascript
const teamsToProcess = teams.slice(0, 50);
```

**Process ALL teams:**
```javascript
const teamsToProcess = teams;
```

**Process first 100 teams:**
```javascript
const teamsToProcess = teams.slice(0, 100);
```

**Process specific conference:**
```javascript
const teamsToProcess = teams.filter(t => t.conference === 'SEC');
```

### Add Custom Team Mappings
If a team isn't found, add to `TEAM_SLUG_MAP` (line 24):

```javascript
const TEAM_SLUG_MAP = {
  'Alabama': 'alabama',
  'Your Team': 'your-team-slug',  // Add here
  // ...
};
```

To find the slug, check D1Baseball URLs:
- Visit: https://d1baseball.com/teams/
- Click your team
- URL will show: `/teams/{slug}/`

---

## Time Estimates

| Teams | Estimated Time |
|-------|---------------|
| 10 teams | ~1 minute |
| 50 teams | ~3-4 minutes |
| 100 teams | ~6-8 minutes |
| 430 teams (all) | ~25-30 minutes |

*(3 seconds per team + processing time)*

---

## Troubleshooting

### "Navigation timeout"
- **Cause**: Site is slow or blocking
- **Fix**: Increase timeout on line 149
  ```javascript
  timeout: 60000  // 60 seconds
  ```

### "Team page not found"
- **Cause**: Team not on D1Baseball or wrong slug
- **Fix**: Add custom mapping to `TEAM_SLUG_MAP`
- **Or**: Team may not be in D1Baseball's database

### "Found 0 pitchers"
- **Cause**: Page structure different than expected
- **Check**: Visit the team page manually
- **Note**: Some teams may not have complete rosters posted

### Puppeteer install fails
```bash
# Use --force flag
npm install puppeteer --force

# Or use puppeteer-core + system Chrome
npm install puppeteer-core
```

---

## Success Indicators

### Good Run:
```
[1/50] Alabama Crimson Tide
  Trying: https://d1baseball.com/teams/alabama/2024/
    ✓ Page loaded successfully
  ✅ Found 18 pitchers        ← Good!

[2/50] Auburn Tigers
  Trying: https://d1baseball.com/teams/auburn/2024/
    ✓ Page loaded successfully
  ✅ Found 15 pitchers        ← Good!
```

### Partial Success (OK):
```
[3/50] Some Team
  Trying: https://d1baseball.com/teams/some-team/2024/
    ⚠️  Not found, trying next...
  Trying: https://d1baseball.com/teams/some-team/
    ✓ Page loaded successfully
  ✅ Found 0 pitchers         ← Team exists but no roster data
```

### Complete Failure (Rare):
```
[4/50] Some Team
  Trying: https://d1baseball.com/teams/some-team/2024/
    ⚠️  Not found, trying next...
  Trying: https://d1baseball.com/teams/some-team/
    ⚠️  Not found, trying next...
  ❌ All URLs failed          ← Team not in D1Baseball
```

---

## What Gets Saved

**File**: `data/pitchers.json`

**Structure**:
```json
{
  "teams": [
    {
      "team_id": "148",
      "team": "Alabama",
      "displayName": "Alabama Crimson Tide",
      "logo": "...",
      "pitchers": [
        {
          "name": "Luke Holman",
          "position": "RHP",
          "jersey_number": "39",
          "year": "Jr",
          "hometown": "Mobile, AL",
          "role": "Reliever"
        }
      ]
    }
  ],
  "metadata": {
    "fetchedAt": "2024-10-30T...",
    "source": "D1Baseball.com",
    "teamsCount": 45,
    "pitchersCount": 687
  }
}
```

---

## After Scraping

### View Results:
```bash
# Count teams with rosters
cat data/pitchers.json | grep '"team_id"' | wc -l

# Count total pitchers
cat data/pitchers.json | grep '"name"' | wc -l
```

### Start Server:
```bash
node server.mjs
```

Then visit: http://localhost:8071

---

## Next Steps

1. **Run test**: `node test-d1baseball-urls.cjs`
2. **Install Puppeteer**: `npm install puppeteer`
3. **Run scraper**: `node scrape-d1baseball-rosters.cjs`
4. **Check results**: Look at summary output
5. **Adjust if needed**: Edit team count or add mappings
6. **Run again**: Process remaining teams

---

## Files Modified

- ✅ `scrape-d1baseball-rosters.cjs` - Updated with 2024 URLs
- ✅ `test-d1baseball-urls.cjs` - New test script

## Ready to Run!

The scraper is fixed and ready. Start with the test, then run the scraper.
