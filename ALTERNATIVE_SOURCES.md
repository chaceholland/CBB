# Alternative Roster Data Sources

## Best Options (Ranked)

### 1. D1Baseball.com ⭐ RECOMMENDED
**Pros:**
- Comprehensive D1 coverage (all teams)
- Standardized roster format
- Updated regularly
- Position data clearly labeled
- Direct team roster URLs

**URL Pattern:**
```
https://d1baseball.com/team/{team-slug}/roster/
Example: https://d1baseball.com/team/alabama/roster/
```

**Data Available:**
- Player name, number, position
- Height, weight, year
- Hometown, high school
- Usually has 2024 rosters still posted

### 2. WarrenNolan.com
**Pros:**
- Analytics-focused site
- Has roster data
- Good for statistics

**Cons:**
- May not have full roster details
- Focuses more on stats than rosters

### 3. NCAA.org Stats
**Pros:**
- Official NCAA source
- Comprehensive stats

**Cons:**
- Complex navigation
- May not have preseason rosters
- Harder to scrape

### 4. BaseballReference (College)
**Pros:**
- Excellent historical data
- Detailed stats

**Cons:**
- May not have current rosters yet
- More focused on stats than rosters

## Recommendation

**Use D1Baseball.com** - It's the best balance of:
- Complete coverage
- Standardized format  
- Currently available data
- Reasonable scraping (with proper rate limiting)

## Important Notes

### Legal/Ethical Considerations:
- ✅ Personal/educational use only
- ✅ Respect robots.txt
- ✅ Rate limiting (1-2 seconds between requests)
- ✅ Proper attribution
- ❌ Don't overwhelm their servers
- ❌ Don't use for commercial purposes without permission

### Success Rate:
- D1Baseball likely has 200-300 teams (major programs)
- Smaller programs may not be listed
- Can fall back to ESPN when those rosters become available

## Next Steps

I'll create a scraper for D1Baseball.com that:
1. Maps your teams to D1Baseball team slugs
2. Scrapes roster pages with proper delays
3. Extracts pitcher information
4. Falls back gracefully for missing teams
5. Respects their server with rate limiting
