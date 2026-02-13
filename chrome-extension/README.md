# College Baseball Headshot Scraper - Chrome Extension

A Chrome extension that extracts and downloads college baseball pitcher headshots directly from team roster pages using your browser's session.

## Why This Works

The extension runs in your actual browser with your real cookies and session, so it bypasses all anti-bot protections!

## Installation

1. **Open Chrome Extensions Page**
   - Go to `chrome://extensions/`
   - Or click: Menu (⋮) → Extensions → Manage Extensions

2. **Enable Developer Mode**
   - Toggle the "Developer mode" switch in the top-right corner

3. **Load the Extension**
   - Click "Load unpacked"
   - Select the `chrome-extension` folder from your Desktop/CBB directory

4. **Verify Installation**
   - You should see "College Baseball Headshot Scraper" in your extensions list
   - Pin it to your toolbar for easy access (click the puzzle icon, then the pin icon)

## Usage

### Step 1: Navigate to a Roster Page

Go to one of these team roster pages:
- **Texas A&M**: https://12thman.com/sports/baseball/roster
- **Texas**: https://texassports.com/sports/baseball/roster
- **Rutgers**: https://scarletknights.com/sports/baseball/roster

You should see a green "⚾ Scraper Ready" indicator appear briefly in the top-right corner.

### Step 2: Open the Extension

Click the extension icon in your toolbar (⚾ icon)

### Step 3: Extract Data

1. Click **"1. Extract Pitcher Data"**
2. Wait a few seconds
3. You'll see a list of all pitchers with checkmarks (✓) for those with headshots

### Step 4: Download Headshots

1. Click **"2. Download Headshots"**
2. The extension will download all headshots to your `Downloads/cbb-headshots/` folder
3. Progress will show in the popup (e.g., "Downloaded 15/19...")
4. Wait for it to complete (about 1-2 seconds per image)

### Step 5: Export Manifest

1. Click **"3. Export Manifest"**
2. This saves a JSON file with all the pitcher data and filenames
3. Also saved to `Downloads/cbb-headshots/`

### Step 6: Repeat for Other Teams

1. Navigate to the next team's roster page
2. Repeat steps 3-5

## Finding Your Downloads

All files are downloaded to:
```
Downloads/cbb-headshots/
```

You should see:
- `texas-am_123-P1.jpg` (headshot images)
- `texas-am_123-P2.jpg`
- ...
- `texas-am_manifest.json` (metadata)

## Sharing with Claude

Once you've downloaded headshots for all three teams:

1. **Locate the folder:**
   ```
   ~/Downloads/cbb-headshots/
   ```

2. **Tell Claude:**
   ```
   Claude, I've downloaded the headshots!
   They're at: ~/Downloads/cbb-headshots/
   ```

3. **Claude will:**
   - Copy the headshots to the project
   - Update pitchers.json
   - Commit and deploy

## Troubleshooting

**Extension won't load:**
- Make sure you selected the correct folder
- The folder should contain `manifest.json`

**"Not on a supported roster page" error:**
- Make sure you're on one of the three team roster pages
- Refresh the page and try again

**Downloads failing:**
- Check if Chrome is blocking downloads (look for a download icon in the address bar)
- Allow downloads for this extension

**No green indicator:**
- Refresh the roster page
- Make sure the extension is enabled in `chrome://extensions/`

## Supported Teams

Currently configured for:
- ✅ Texas A&M (12thman.com)
- ✅ Texas (texassports.com)
- ✅ Rutgers (scarletknights.com)

These are the three teams with blocked headshot downloads that this extension solves.

## Technical Details

**How it works:**
1. Content script runs on roster pages and extracts pitcher data from the DOM
2. Matches pitchers with headshot URLs found in page source
3. Uses Chrome's download API (which uses your browser's session/cookies)
4. Downloads are authenticated because they use your real browser session

**Why this bypasses blocks:**
- Not a headless browser (it's a real browser!)
- Uses your actual cookies/session
- Makes requests as you (not as a bot)
- No special headers or tricks needed
