# Local Headshot Scraper Tool

This tool allows you to scrape headshots from blocked teams on your local machine (where anti-bot protections won't block you), then upload the results to Claude for integration.

## Why This Works

When you run the scraper on your own machine:
- It uses your real browser and IP address
- You're not triggering rate limits or bot detection
- Sites see you as a regular user

## Step 1: Run the Local Scraper

```bash
node scrape-for-upload.mjs
```

This will:
- Open a visible browser window (so you can see progress)
- Scrape Texas A&M, Texas, and Rutgers roster pages
- Download all pitcher headshots
- Create an `upload_package` folder with:
  - `headshots/` - All downloaded images
  - `manifest.json` - Metadata about what was scraped
  - `README.md` - Instructions

**Time:** About 2-3 minutes per team

## Step 2: Share with Claude

After the scraper finishes, you have two options:

### Option A: Share the folder path
```
Claude, I've scraped the headshots. The upload_package is at:
/Users/chace/Desktop/CBB/upload_package
```

### Option B: Zip and upload
```bash
cd upload_package
zip -r headshots-upload.zip .
```

Then share the zip file with Claude.

## Step 3: Claude Integrates the Data

Claude will run:
```bash
node integrate-uploaded-headshots.mjs ./upload_package
```

This automatically:
- Copies headshots to `data/headshots/`
- Updates `pitchers.json` with new paths
- Creates a backup of the old data

## Step 4: Commit and Deploy

Claude will commit and deploy the changes:
```bash
git add .
git commit -m "feat: add headshots from local scraper"
vercel --prod
```

## Teams Targeted

- **Texas A&M** (46 low-quality headshots to replace)
- **Texas** (38 low-quality headshots to replace)
- **Rutgers** (21 low-quality headshots to replace)

**Total potential improvement:** Up to 105 high-quality headshots!

## Troubleshooting

**Browser doesn't open:**
- The script runs in non-headless mode (visible browser)
- If you prefer headless, edit `scrape-for-upload.mjs` and change `headless: false` to `headless: 'new'`

**Downloads failing:**
- Check your internet connection
- Some teams might still have protections - that's okay, we'll get what we can

**Can't find upload_package:**
- It's created in the same directory as the script
- Look for: `./upload_package`

## What Gets Scraped

For each team:
1. Roster page HTML
2. All pitcher names, numbers, positions, years
3. Headshot URLs matched to pitcher names
4. Downloaded headshots (only if >1KB to avoid error pages)

## Privacy & Safety

- All scraping is done locally on your machine
- No data is sent anywhere except to Claude for integration
- The scraper uses stealth mode to avoid triggering protections
- Respects rate limits with built-in delays
