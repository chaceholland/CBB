# Comprehensive App Upgrade Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Complete application upgrade with data quality improvements, design consistency, new features, and performance optimizations using rolling deployment strategy.

**Architecture:** Layer improvements onto existing vanilla JS + Supabase architecture. Add Chart.js and PapaParse via CDN. Deploy each improvement independently as completed.

**Tech Stack:** Vanilla JavaScript, Puppeteer (scraping), Chart.js (analytics), PapaParse (CSV export), Supabase (user data)

---

## Phase 1: Data Completion (Priority 1 - Deploy Immediately)

### Task 1: Extend Headshot Scraper for Remaining Teams

**Files:**
- Modify: `scrape-missing-headshots-auto.mjs`
- Run: Script outputs to `data/headshots/` and updates `data/pitchers.json`

**Step 1: Add remaining Power 5 teams to scraper config**

Open `scrape-missing-headshots-auto.mjs` and add these teams to `TEAMS_TO_SCRAPE` array:

```javascript
const TEAMS_TO_SCRAPE = [
  // Existing teams (Ole Miss, Utah, Clemson)
  { name: 'Ole Miss', teamId: '145', url: 'https://olemisssports.com/sports/baseball/roster', slug: 'ole-miss' },
  { name: 'Utah', teamId: '128', url: 'https://utahutes.com/sports/baseball/roster', slug: 'utah' },
  { name: 'Clemson', teamId: '117', url: 'https://clemsontigers.com/sports/baseball/roster', slug: 'clemson' },

  // Add remaining teams with missing headshots
  { name: 'Wyoming', teamId: '264', url: 'https://gowyo.com/sports/baseball/roster', slug: 'wyoming' },
  { name: 'Oregon', teamId: '2483', url: 'https://goducks.com/sports/baseball/roster', slug: 'oregon' },
  // Add more as needed based on verification report
];
```

**Step 2: Add parallel processing for speed**

Replace the sequential `for` loop in `main()` function with parallel processing:

```javascript
async function main() {
  console.log('\n' + '='.repeat(70));
  console.log('AUTOMATED HEADSHOT SCRAPER');
  console.log('='.repeat(70));
  console.log('');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  // Process 3 teams in parallel
  const BATCH_SIZE = 3;
  let totalUpdated = 0;
  let totalDownloaded = 0;

  for (let i = 0; i < TEAMS_TO_SCRAPE.length; i += BATCH_SIZE) {
    const batch = TEAMS_TO_SCRAPE.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map(teamConfig => scrapeTeam(browser, teamConfig))
    );

    for (const result of results) {
      totalUpdated += result.updated;
      totalDownloaded += result.downloaded;
    }
  }

  await browser.close();

  // Save logic remains the same...
}
```

**Step 3: Add retry logic with exponential backoff**

Add retry function before `downloadImageWithBrowser`:

```javascript
async function retryWithBackoff(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      const delay = Math.pow(2, i) * 1000; // 1s, 2s, 4s
      console.log(`  Retry ${i + 1}/${maxRetries} after ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
```

Update `downloadImageWithBrowser` to use retry:

```javascript
async function downloadImageWithBrowser(page, url, filepath) {
  try {
    await retryWithBackoff(async () => {
      const viewSource = await page.goto(url, {
        waitUntil: 'networkidle0',
        timeout: 30000
      });
      const buffer = await viewSource.buffer();

      // Validate file size (min 5KB)
      if (buffer.length < 5120) {
        throw new Error(`File too small: ${buffer.length} bytes`);
      }

      fs.writeFileSync(filepath, buffer);
    });
    return true;
  } catch (error) {
    console.error(`  ✗ Failed to download ${url}: ${error.message}`);
    return false;
  }
}
```

**Step 4: Run the enhanced scraper**

Run: `node scrape-missing-headshots-auto.mjs`

Expected: Downloads headshots for all teams, shows progress per team, creates backup

**Step 5: Verify results**

Run: `node verify-data-quality.mjs`

Expected: Missing headshots count reduced from 24 to <5

**Step 6: Commit**

```bash
git add scrape-missing-headshots-auto.mjs data/headshots/ data/pitchers.json
git commit -m "feat: extend headshot scraper with parallel processing and retry logic

- Added remaining Power 5 teams (Wyoming, Oregon, etc.)
- Parallel processing: 3 teams at once for faster completion
- Retry logic with exponential backoff for failed downloads
- File size validation (min 5KB)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 2: Create Year Classification Scraper

**Files:**
- Create: `scrape-pitcher-years.mjs`
- Modify: `data/pitchers.json`

**Step 1: Create year scraper skeleton**

Create `scrape-pitcher-years.mjs`:

```javascript
#!/usr/bin/env node

import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

puppeteer.use(StealthPlugin());

// Load pitchers data
const pitchersPath = path.join(__dirname, 'data/pitchers.json');
const pitchersData = JSON.parse(fs.readFileSync(pitchersPath, 'utf-8'));

// Create backup
const backupPath = path.join(__dirname, `data/pitchers_backup_years_${Date.now()}.json`);
fs.writeFileSync(backupPath, JSON.stringify(pitchersData, null, 2));
console.log(`✓ Backup created: ${backupPath}\n`);

// Teams configuration - same as headshot scraper
const TEAMS_TO_SCRAPE = [
  { name: 'Ole Miss', teamId: '145', url: 'https://olemisssports.com/sports/baseball/roster', slug: 'ole-miss' },
  { name: 'Utah', teamId: '128', url: 'https://utahutes.com/sports/baseball/roster', slug: 'utah' },
  // Add all Power 5 teams
];

async function extractYearData(page) {
  return await page.evaluate(() => {
    const yearMap = new Map();

    // Pattern 1: SIDEARM roster cards
    const cards = document.querySelectorAll('.s-person-card, [class*="roster-card"]');
    for (const card of cards) {
      const nameEl = card.querySelector('[class*="name"] a, .s-person-details__personal-single-line a');
      if (!nameEl) continue;

      const name = nameEl.textContent.trim();
      const text = card.textContent;

      // Match year indicators
      const yearMatch = text.match(/\b(FR|SO|JR|SR|Freshman|Sophomore|Junior|Senior|R-FR|R-SO|R-JR|GR|Graduate)\b/i);
      if (yearMatch) {
        const year = normalizeYear(yearMatch[1]);
        yearMap.set(name, { year, confidence: 'high' });
      }
    }

    // Pattern 2: Table rows
    if (yearMap.size === 0) {
      const rows = document.querySelectorAll('table tr, [class*="roster"] tr');
      for (const row of rows) {
        const nameLink = row.querySelector('a[href*="roster"], a[href*="bio"]');
        if (!nameLink) continue;

        const name = nameLink.textContent.trim();
        const text = row.textContent;

        const yearMatch = text.match(/\b(FR|SO|JR|SR|Freshman|Sophomore|Junior|Senior|R-FR|R-SO|R-JR|GR)\b/i);
        if (yearMatch) {
          const year = normalizeYear(yearMatch[1]);
          yearMap.set(name, { year, confidence: 'high' });
        }
      }
    }

    function normalizeYear(raw) {
      const upper = raw.toUpperCase();
      if (upper.includes('FR')) return 'FR';
      if (upper.includes('SO')) return 'SO';
      if (upper.includes('JR')) return 'JR';
      if (upper.includes('SR') || upper.includes('GR')) return 'SR';
      return raw;
    }

    return Object.fromEntries(yearMap);
  });
}

async function scrapeTeam(browser, teamConfig) {
  console.log('='.repeat(70));
  console.log(`Scraping years: ${teamConfig.name}`);
  console.log('='.repeat(70));

  const page = await browser.newPage();

  try {
    await page.goto(teamConfig.url, {
      waitUntil: 'networkidle0',
      timeout: 60000
    });

    await page.waitForTimeout(2000);

    const yearData = await extractYearData(page);
    console.log(`Found ${Object.keys(yearData).length} pitchers with year data\n`);

    // Find team in pitchers.json
    const team = pitchersData.teams.find(t =>
      t.team === teamConfig.name ||
      t.slug === teamConfig.slug ||
      t.teamId === teamConfig.teamId
    );

    if (!team) {
      console.log(`⚠ Team not found: ${teamConfig.name}\n`);
      await page.close();
      return { updated: 0 };
    }

    let updated = 0;

    for (const pitcher of team.pitchers) {
      // Skip if already has year
      if (pitcher.year && pitcher.year !== '') continue;

      const yearInfo = yearData[pitcher.name];
      if (yearInfo) {
        pitcher.year = yearInfo.year;
        console.log(`  ✓ ${pitcher.name}: ${yearInfo.year} (${yearInfo.confidence})`);
        updated++;
      }
    }

    console.log(`\n✅ ${teamConfig.name}: ${updated} years added\n`);
    await page.close();
    return { updated };

  } catch (error) {
    console.error(`\n❌ Error scraping ${teamConfig.name}:`, error.message);
    await page.close();
    return { updated: 0 };
  }
}

async function main() {
  console.log('\n' + '='.repeat(70));
  console.log('PITCHER YEAR CLASSIFICATION SCRAPER');
  console.log('='.repeat(70));
  console.log('');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  let totalUpdated = 0;

  // Process 3 teams in parallel
  const BATCH_SIZE = 3;
  for (let i = 0; i < TEAMS_TO_SCRAPE.length; i += BATCH_SIZE) {
    const batch = TEAMS_TO_SCRAPE.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map(teamConfig => scrapeTeam(browser, teamConfig))
    );

    for (const result of results) {
      totalUpdated += result.updated;
    }
  }

  await browser.close();

  if (totalUpdated > 0) {
    fs.writeFileSync(pitchersPath, JSON.stringify(pitchersData, null, 2));
    console.log('='.repeat(70));
    console.log('✅ COMPLETE');
    console.log('='.repeat(70));
    console.log(`Total years added: ${totalUpdated}`);
    console.log(`Updated file: ${pitchersPath}`);
    console.log(`Backup: ${backupPath}`);
  } else {
    console.log('\n⚠ No years were added.');
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
```

**Step 2: Run the year scraper**

Run: `node scrape-pitcher-years.mjs`

Expected: Adds year classifications for pitchers missing them

**Step 3: Verify results**

Run: `node verify-data-quality.mjs`

Expected: Missing years reduced from 1,052 to <50

**Step 4: Commit**

```bash
git add scrape-pitcher-years.mjs data/pitchers.json
git commit -m "feat: add pitcher year classification scraper

- Scrapes FR/SO/JR/SR from roster pages
- Handles redshirts (R-FR) and graduates (GR)
- Parallel processing for speed
- Confidence scoring for data quality

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 3: Create Team Logo Scraper

**Files:**
- Create: `scrape-team-logos.mjs`
- Create: `data/logos/` directory
- Modify: `data/teams.json`

**Step 1: Create logos directory**

Run: `mkdir -p data/logos`

**Step 2: Create logo scraper**

Create `scrape-team-logos.mjs`:

```javascript
#!/usr/bin/env node

import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

puppeteer.use(StealthPlugin());

// Load teams data
const teamsPath = path.join(__dirname, 'data/teams.json');
const teamsData = JSON.parse(fs.readFileSync(teamsPath, 'utf-8'));

// Backup
const backupPath = path.join(__dirname, `data/teams_backup_logos_${Date.now()}.json`);
fs.writeFileSync(backupPath, JSON.stringify(teamsData, null, 2));

// Power 5 conferences priority
const POWER_5_CONFERENCES = ['SEC', 'Big Ten', 'ACC', 'Big 12', 'Pac-12'];

async function downloadLogo(page, url, filepath) {
  try {
    const viewSource = await page.goto(url, {
      waitUntil: 'networkidle0',
      timeout: 30000
    });
    const buffer = await viewSource.buffer();

    // Validate minimum size (5KB)
    if (buffer.length < 5120) {
      throw new Error(`Logo too small: ${buffer.length} bytes`);
    }

    fs.writeFileSync(filepath, buffer);
    return true;
  } catch (error) {
    console.error(`  ✗ Failed: ${error.message}`);
    return false;
  }
}

async function scrapeLogo(browser, team) {
  console.log(`\nScraping logo: ${team.team}`);

  const page = await browser.newPage();

  try {
    // Try official athletic site first
    if (team.rosterUrl) {
      await page.goto(team.rosterUrl, {
        waitUntil: 'networkidle0',
        timeout: 30000
      });

      // Look for logo in common locations
      const logoUrl = await page.evaluate(() => {
        // Method 1: SIDEARM sports logo
        let img = document.querySelector('.sidearm-logo img, [class*="logo"] img');
        if (img && img.src) return img.src;

        // Method 2: Meta tags
        let meta = document.querySelector('meta[property="og:image"]');
        if (meta && meta.content) return meta.content;

        // Method 3: Site header
        img = document.querySelector('header img[src*="logo"]');
        if (img && img.src) return img.src;

        return null;
      });

      if (logoUrl) {
        const ext = logoUrl.includes('.png') ? 'png' : 'jpg';
        const filename = `${team.slug}.${ext}`;
        const filepath = path.join(__dirname, 'data/logos', filename);

        const success = await downloadLogo(page, logoUrl, filepath);

        if (success) {
          team.logo = `data/logos/${filename}`;
          console.log(`  ✓ Saved: ${filename}`);
          await page.close();
          return true;
        }
      }
    }

    // Fallback: ESPN logo
    const espnUrl = `https://a.espncdn.com/i/teamlogos/ncaa/500/${team.teamId}.png`;
    const filename = `${team.slug}.png`;
    const filepath = path.join(__dirname, 'data/logos', filename);

    const success = await downloadLogo(page, espnUrl, filepath);

    if (success) {
      team.logo = `data/logos/${filename}`;
      console.log(`  ✓ Saved (ESPN): ${filename}`);
      await page.close();
      return true;
    }

    await page.close();
    return false;

  } catch (error) {
    console.error(`  ✗ Error: ${error.message}`);
    await page.close();
    return false;
  }
}

async function main() {
  console.log('\n' + '='.repeat(70));
  console.log('TEAM LOGO SCRAPER');
  console.log('='.repeat(70));

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  // Priority: Power 5 teams first
  const power5Teams = teamsData.teams.filter(t =>
    POWER_5_CONFERENCES.includes(t.conference)
  );

  const otherTeams = teamsData.teams.filter(t =>
    !POWER_5_CONFERENCES.includes(t.conference)
  );

  let updated = 0;

  console.log(`\nProcessing ${power5Teams.length} Power 5 teams...\n`);
  for (const team of power5Teams) {
    if (team.logo && team.logo !== '') continue; // Skip if has logo
    const success = await scrapeLogo(browser, team);
    if (success) updated++;
  }

  console.log(`\nProcessing ${otherTeams.length} other teams...\n`);
  for (const team of otherTeams) {
    if (team.logo && team.logo !== '') continue;
    const success = await scrapeLogo(browser, team);
    if (success) updated++;
  }

  await browser.close();

  if (updated > 0) {
    fs.writeFileSync(teamsPath, JSON.stringify(teamsData, null, 2));
    console.log('\n' + '='.repeat(70));
    console.log('✅ COMPLETE');
    console.log('='.repeat(70));
    console.log(`Total logos added: ${updated}`);
    console.log(`Updated: ${teamsPath}`);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
```

**Step 3: Run logo scraper**

Run: `node scrape-team-logos.mjs`

Expected: Downloads logos for Power 5 teams to `data/logos/`

**Step 4: Commit**

```bash
git add scrape-team-logos.mjs data/logos/ data/teams.json
git commit -m "feat: add team logo scraper

- Downloads logos from official sites + ESPN fallback
- Priority: Power 5 conferences first
- Validates minimum file size
- Stores in data/logos/

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Phase 2: Design Consistency (Deploy After Phase 1)

### Task 4: Update index.html Theme to Match schedule.html

**Files:**
- Modify: `index.html` (entire `<style>` section)

**Step 1: Replace CSS variables**

In `index.html`, replace the `:root` section (lines 9-15) with modern premium theme:

```css
:root{
  --cream: #fafaf8;
  --white: #ffffff;
  --slate-50: #f8fafc;
  --slate-100: #f1f5f9;
  --slate-200: #e2e8f0;
  --slate-300: #cbd5e1;
  --slate-600: #475569;
  --slate-700: #334155;
  --slate-800: #1e293b;
  --slate-900: #0f172a;
  --emerald: #10b981;
  --emerald-dark: #059669;
  --emerald-light: #d1fae5;
  --amber: #f59e0b;
  --amber-light: #fef3c7;
  --blue: #3b82f6;
  --purple: #8b5cf6;
}
```

**Step 2: Update fonts**

Replace the font link in `<head>` (line 7):

```html
<link href="https://fonts.googleapis.com/css2?family=Crimson+Pro:wght@400;600;700&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
```

**Step 3: Update body styles**

Replace body styles:

```css
body{
  background: linear-gradient(135deg, var(--cream) 0%, var(--slate-50) 100%);
  color: var(--slate-900);
  font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif;
  font-size: 15px;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
```

**Step 4: Update top navigation**

Replace `#top-bar` styles:

```css
#top-bar{
  background: rgba(255,255,255,.95);
  backdrop-filter: blur(20px);
  border-bottom: 1px solid var(--slate-200);
  padding: 1.25rem 2rem;
  position: sticky;
  top: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
  box-shadow: 0 1px 3px rgba(15,23,42,.05);
}

#top-bar h1{
  margin: 0;
  font-family: 'Crimson Pro', serif;
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--slate-900);
  letter-spacing: -0.02em;
  flex: 1;
  min-width: 200px;
}

#top-bar input,
#top-bar select{
  background: var(--white);
  border: 1.5px solid var(--slate-300);
  border-radius: 10px;
  padding: 0.65rem 1rem;
  font-family: 'DM Sans', sans-serif;
  font-size: 0.9rem;
  color: var(--slate-700);
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  outline: none;
}

#top-bar input:focus,
#top-bar select:focus{
  border-color: var(--emerald);
  box-shadow: 0 0 0 3px var(--emerald-light);
}

#top-bar button{
  background: var(--emerald);
  color: var(--white);
  border: none;
  border-radius: 10px;
  padding: 0.65rem 1.25rem;
  font-family: 'DM Sans', sans-serif;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

#top-bar button:hover{
  background: var(--emerald-dark);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(16,185,129,.3);
}

#top-bar a{
  color: var(--slate-700);
  text-decoration: none;
  padding: 0.65rem 1rem;
  background: var(--white);
  border: 1.5px solid var(--slate-300);
  border-radius: 10px;
  font-weight: 600;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

#top-bar a:hover{
  border-color: var(--emerald);
  color: var(--emerald-dark);
}
```

**Step 5: Update team cards**

Replace `.team-card` and related styles:

```css
.team-card{
  background: var(--white);
  color: var(--slate-900);
  border-radius: 16px;
  border: 1px solid var(--slate-200);
  box-shadow: 0 2px 8px rgba(15,23,42,.08);
  overflow: hidden;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.team-card:hover{
  box-shadow: 0 8px 24px rgba(15,23,42,.12);
  transform: translateY(-2px);
}

.team-card.favorited{
  border: 2px solid var(--emerald);
  box-shadow: 0 4px 16px rgba(16,185,129,.2);
}

.team-header{
  display: flex;
  align-items: center;
  gap: 1rem;
  background: var(--slate-50);
  padding: 1.25rem;
  border-bottom: 1px solid var(--slate-200);
}

.team-name{
  font-family: 'Crimson Pro', serif;
  font-weight: 700;
  font-size: 1.3rem;
  margin-bottom: 0.25rem;
  color: var(--slate-900);
  letter-spacing: -0.01em;
}
```

**Step 6: Update badges**

Replace badge styles:

```css
.badge{
  background: var(--emerald-light);
  color: var(--emerald-dark);
  padding: 0.35rem 0.75rem;
  border-radius: 999px;
  font-size: 0.8rem;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.pitcher-year{
  background: var(--slate-200);
  color: var(--slate-700);
  padding: 0.2rem 0.5rem;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
}

.pitcher-pos{
  background: var(--emerald-light);
  color: var(--emerald-dark);
  padding: 0.2rem 0.5rem;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
}
```

**Step 7: Update pitcher items**

Replace `.pitcher-item` styles:

```css
.pitcher-item{
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 1rem;
  align-items: center;
  padding: 0.85rem;
  border-radius: 12px;
  background: var(--slate-50);
  border: 1px solid var(--slate-200);
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.pitcher-item:hover{
  background: var(--white);
  border-color: var(--slate-300);
  box-shadow: 0 2px 8px rgba(15,23,42,.06);
}

.pitcher-item.favorited{
  background: var(--emerald-light);
  border-color: var(--emerald);
}
```

**Step 8: Test in browser**

Open: `index.html` in browser

Expected: Modern premium theme matching schedule.html exactly

**Step 9: Commit**

```bash
git add index.html
git commit -m "feat: update roster page to modern premium theme

- Match schedule.html design system exactly
- Crimson Pro + DM Sans typography
- Emerald/slate color palette
- Glassmorphic navigation
- Smooth animations throughout

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Phase 3: Feature Additions (Deploy Independently)

### Task 5: Add Multi-Select Team Filtering

**Files:**
- Modify: `schedule.html` (filter modal section + JavaScript)

**Step 1: Update filter modal HTML**

Find the filter modal section in `schedule.html` and replace team/conference selects with checkbox lists:

```html
<div id="filter-modal" style="display:none">
  <div class="modal-overlay" onclick="closeFilterModal()"></div>
  <div class="modal-content">
    <div class="modal-header">
      <h2>Filter Games</h2>
      <button onclick="closeFilterModal()">✕</button>
    </div>

    <div class="modal-body">
      <!-- Conference Multi-Select -->
      <div class="filter-section">
        <h3>Conferences</h3>
        <div class="quick-selects">
          <button onclick="selectAllPower5()">Select Power 5</button>
          <button onclick="selectConference('SEC')">SEC Only</button>
          <button onclick="clearConferences()">Clear All</button>
        </div>
        <div id="conference-checkboxes" class="checkbox-grid">
          <!-- Generated by JS -->
        </div>
      </div>

      <!-- Team Multi-Select -->
      <div class="filter-section">
        <h3>Teams</h3>
        <div id="selected-count" class="selected-count"></div>
        <input type="text" id="team-search" placeholder="Search teams...">
        <div id="team-checkboxes" class="checkbox-list">
          <!-- Generated by JS -->
        </div>
      </div>

      <!-- Existing filters remain -->
    </div>
  </div>
</div>
```

**Step 2: Add CSS for checkbox lists**

Add these styles to `<style>` section:

```css
.filter-section{
  margin-bottom: 2rem;
}

.filter-section h3{
  font-family: 'Crimson Pro', serif;
  font-size: 1.1rem;
  margin-bottom: 0.75rem;
  color: var(--slate-900);
}

.quick-selects{
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
  flex-wrap: wrap;
}

.quick-selects button{
  background: var(--slate-100);
  color: var(--slate-700);
  border: 1px solid var(--slate-300);
  border-radius: 8px;
  padding: 0.4rem 0.8rem;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.quick-selects button:hover{
  background: var(--emerald);
  color: var(--white);
  border-color: var(--emerald);
}

.checkbox-grid{
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 0.5rem;
}

.checkbox-list{
  max-height: 300px;
  overflow-y: auto;
  border: 1px solid var(--slate-200);
  border-radius: 8px;
  padding: 0.75rem;
}

.checkbox-item{
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.2s;
}

.checkbox-item:hover{
  background: var(--slate-50);
}

.checkbox-item input[type="checkbox"]{
  width: 18px;
  height: 18px;
  cursor: pointer;
}

.checkbox-item label{
  flex: 1;
  cursor: pointer;
  font-size: 0.9rem;
}

.selected-count{
  background: var(--emerald-light);
  color: var(--emerald-dark);
  padding: 0.5rem 1rem;
  border-radius: 8px;
  font-weight: 600;
  font-size: 0.9rem;
  margin-bottom: 0.75rem;
}
```

**Step 3: Add JavaScript for multi-select**

Add this JavaScript before closing `</script>` tag:

```javascript
// Multi-select state
let selectedConferences = new Set();
let selectedTeams = new Set();

// Initialize checkboxes
function initializeMultiSelect() {
  // Get unique conferences
  const conferences = [...new Set(allTeams.map(t => t.conference))].sort();

  // Render conference checkboxes
  const confContainer = document.getElementById('conference-checkboxes');
  confContainer.innerHTML = conferences.map(conf => `
    <div class="checkbox-item">
      <input type="checkbox" id="conf-${conf}" value="${conf}"
             onchange="toggleConference('${conf}')">
      <label for="conf-${conf}">${conf}</label>
    </div>
  `).join('');

  // Render team checkboxes
  renderTeamCheckboxes();

  // Team search
  document.getElementById('team-search').addEventListener('input', (e) => {
    renderTeamCheckboxes(e.target.value);
  });
}

function renderTeamCheckboxes(searchQuery = '') {
  const container = document.getElementById('team-checkboxes');
  let teams = allTeams;

  if (searchQuery) {
    teams = teams.filter(t =>
      t.team.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }

  container.innerHTML = teams.map(team => `
    <div class="checkbox-item">
      <input type="checkbox" id="team-${team.teamId}" value="${team.team}"
             ${selectedTeams.has(team.team) ? 'checked' : ''}
             onchange="toggleTeam('${team.team}')">
      <label for="team-${team.teamId}">${team.team}</label>
    </div>
  `).join('');

  updateSelectedCount();
}

function toggleConference(conf) {
  if (selectedConferences.has(conf)) {
    selectedConferences.delete(conf);
  } else {
    selectedConferences.add(conf);
  }
  applyFilters();
}

function toggleTeam(team) {
  if (selectedTeams.has(team)) {
    selectedTeams.delete(team);
  } else {
    selectedTeams.add(team);
  }
  applyFilters();
}

function selectAllPower5() {
  const power5 = ['SEC', 'Big Ten', 'ACC', 'Big 12', 'Pac-12'];
  power5.forEach(conf => {
    selectedConferences.add(conf);
    document.getElementById(`conf-${conf}`).checked = true;
  });
  applyFilters();
}

function selectConference(conf) {
  clearConferences();
  selectedConferences.add(conf);
  document.getElementById(`conf-${conf}`).checked = true;
  applyFilters();
}

function clearConferences() {
  selectedConferences.clear();
  document.querySelectorAll('#conference-checkboxes input').forEach(cb => {
    cb.checked = false;
  });
  applyFilters();
}

function updateSelectedCount() {
  const count = selectedTeams.size;
  const el = document.getElementById('selected-count');
  if (count > 0) {
    el.textContent = `${count} team${count > 1 ? 's' : ''} selected`;
    el.style.display = 'block';
  } else {
    el.style.display = 'none';
  }
}

// Update applyFilters() to use multi-select
function applyFilters() {
  filteredGames = allGames.filter(game => {
    // Conference filter (OR logic)
    if (selectedConferences.size > 0) {
      const homeConf = allTeams.find(t => t.team === game.home)?.conference;
      const awayConf = allTeams.find(t => t.team === game.away)?.conference;
      if (!selectedConferences.has(homeConf) && !selectedConferences.has(awayConf)) {
        return false;
      }
    }

    // Team filter (OR logic)
    if (selectedTeams.size > 0) {
      if (!selectedTeams.has(game.home) && !selectedTeams.has(game.away)) {
        return false;
      }
    }

    // Other existing filters...
    return true;
  });

  renderGames();
}

// Initialize on page load
window.addEventListener('DOMContentLoaded', initializeMultiSelect);
```

**Step 4: Persist selections in localStorage**

Add persistence:

```javascript
function saveFilterState() {
  localStorage.setItem('selectedConferences', JSON.stringify([...selectedConferences]));
  localStorage.setItem('selectedTeams', JSON.stringify([...selectedTeams]));
}

function loadFilterState() {
  const conferences = JSON.parse(localStorage.getItem('selectedConferences') || '[]');
  const teams = JSON.parse(localStorage.getItem('selectedTeams') || '[]');

  selectedConferences = new Set(conferences);
  selectedTeams = new Set(teams);

  // Update UI
  conferences.forEach(conf => {
    const el = document.getElementById(`conf-${conf}`);
    if (el) el.checked = true;
  });

  renderTeamCheckboxes();
}

// Call in toggleConference and toggleTeam
function toggleConference(conf) {
  // ... existing code ...
  saveFilterState();
}

function toggleTeam(team) {
  // ... existing code ...
  saveFilterState();
}

// Load on init
window.addEventListener('DOMContentLoaded', () => {
  initializeMultiSelect();
  loadFilterState();
  applyFilters();
});
```

**Step 5: Test functionality**

Open: `schedule.html`

Test:
- Click "Select Power 5" → all Power 5 conferences checked
- Search teams → list filters
- Select multiple teams → count updates
- Refresh page → selections persist

Expected: Multi-select works, persists across sessions

**Step 6: Commit**

```bash
git add schedule.html
git commit -m "feat: add multi-select team and conference filtering

- Checkbox lists replace single-select dropdowns
- Quick buttons: 'Select Power 5', 'SEC Only'
- Team search for easy discovery
- Selection counter shows how many teams selected
- Persists in localStorage

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 6: Add CSV Export Functionality

**Files:**
- Modify: `schedule.html` and `index.html` (add export buttons + PapaParse)

**Step 1: Add PapaParse library**

In `schedule.html` and `index.html`, add before closing `</head>`:

```html
<script src="https://cdn.jsdelivr.net/npm/papaparse@5.4.1/papaparse.min.js"></script>
```

**Step 2: Add export button to schedule.html**

In the top navigation bar, add export button:

```html
<button onclick="exportGames()" style="display:flex;align-items:center;gap:0.5rem">
  <span>📥</span> Export CSV
</button>
```

**Step 3: Add export function to schedule.html**

Add this JavaScript:

```javascript
function exportGames() {
  // Use filtered games or all games
  const gamesToExport = filteredGames.length > 0 ? filteredGames : allGames;

  // Prepare CSV data
  const csvData = gamesToExport.map(game => {
    const homePitchers = game.pitchers?.home?.length || 0;
    const awayPitchers = game.pitchers?.away?.length || 0;

    return {
      'Date': game.date,
      'Week': game.week,
      'Away Team': game.away,
      'Home Team': game.home,
      'Conference': getTeamConference(game.home),
      'Priority': game.priority || 'Low',
      'Watched': game.watched ? 'Yes' : 'No',
      'Home Pitchers': homePitchers,
      'Away Pitchers': awayPitchers,
      'Total Pitchers': homePitchers + awayPitchers,
      'ESPN Recap': game.espnRecapUrl || '',
      'ESPN Box Score': game.espnBoxScoreUrl || ''
    };
  });

  // Convert to CSV
  const csv = Papa.unparse(csvData);

  // Download file
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const timestamp = new Date().toISOString().split('T')[0];
  link.href = URL.createObjectURL(blob);
  link.download = `cbb-schedule-${timestamp}.csv`;
  link.click();

  // Show toast
  showToast(`Exported ${gamesToExport.length} games to CSV`);
}

function getTeamConference(teamName) {
  const team = allTeams.find(t => t.team === teamName);
  return team?.conference || '';
}
```

**Step 4: Add export button to index.html (roster page)**

Same process - add button and function:

```javascript
function exportPitchers() {
  // Get all visible pitchers
  const visiblePitchers = [];

  document.querySelectorAll('.team-card').forEach(card => {
    const teamName = card.querySelector('.team-name').textContent;
    const team = allTeams.find(t => t.team === teamName);

    card.querySelectorAll('.pitcher-item').forEach(item => {
      const nameEl = item.querySelector('.pitcher-name');
      const pitcher = team.pitchers.find(p => p.name === nameEl.textContent);

      if (pitcher) {
        visiblePitchers.push({
          'Team': teamName,
          'Conference': team.conference,
          'Name': pitcher.name,
          'Number': pitcher.number || '',
          'Position': pitcher.position || '',
          'Year': pitcher.year || '',
          'Throws': pitcher.throws || '',
          'Headshot': pitcher.headshot || '',
          'Favorited': pitcher.favorited ? 'Yes' : 'No'
        });
      }
    });
  });

  const csv = Papa.unparse(visiblePitchers);

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const timestamp = new Date().toISOString().split('T')[0];
  link.href = URL.createObjectURL(blob);
  link.download = `cbb-pitchers-${timestamp}.csv`;
  link.click();

  showToast(`Exported ${visiblePitchers.length} pitchers to CSV`);
}
```

**Step 5: Test export**

Open: `schedule.html` and `index.html`

Test:
- Click export button
- File downloads with current date in filename
- Open in Excel/Sheets → data formatted correctly
- Apply filters → export shows only filtered results

Expected: CSV downloads with proper data

**Step 6: Commit**

```bash
git add schedule.html index.html
git commit -m "feat: add CSV export functionality

- Export current filtered view or full dataset
- PapaParse for reliable CSV generation
- Timestamped filenames
- Works on both schedule and roster pages

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 7: Add Keyboard Shortcuts

**Files:**
- Modify: `schedule.html` and `index.html` (add keyboard event listeners + help modal)

**Step 1: Create keyboard shortcut handler**

Add to both files' JavaScript:

```javascript
// Keyboard shortcuts
const shortcuts = {
  '/': () => document.getElementById('search').focus(),
  'f': () => openFilterModal(),
  'Escape': () => closeAllModals(),
  'e': () => exportGames(), // or exportPitchers() for index.html
  '?': () => showKeyboardHelp(),
  '1': () => jumpToWeek(1),
  '2': () => jumpToWeek(2),
  '3': () => jumpToWeek(3),
  '4': () => jumpToWeek(4),
  '5': () => jumpToWeek(5),
  '6': () => jumpToWeek(6),
  '7': () => jumpToWeek(7),
  '8': () => jumpToWeek(8),
  '9': () => jumpToWeek(9)
};

document.addEventListener('keydown', (e) => {
  // Don't trigger if user is typing in input
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
    // Exception: Escape always works
    if (e.key === 'Escape') {
      e.target.blur();
      closeAllModals();
    }
    return;
  }

  const handler = shortcuts[e.key];
  if (handler) {
    e.preventDefault();
    handler();
  }
});

function jumpToWeek(weekNum) {
  // For schedule.html only
  const weekCheckbox = document.querySelector(`input[value="${weekNum}"]`);
  if (weekCheckbox) {
    // Uncheck all weeks
    document.querySelectorAll('#week-checks input').forEach(cb => cb.checked = false);
    // Check selected week
    weekCheckbox.checked = true;
    applyFilters();

    // Scroll to first game
    const firstGame = document.querySelector('.game-card');
    if (firstGame) {
      firstGame.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
}

function closeAllModals() {
  document.getElementById('filter-modal').style.display = 'none';
  const helpModal = document.getElementById('keyboard-help-modal');
  if (helpModal) helpModal.style.display = 'none';
}
```

**Step 2: Create help modal HTML**

Add before closing `</body>`:

```html
<div id="keyboard-help-modal" style="display:none">
  <div class="modal-overlay" onclick="closeAllModals()"></div>
  <div class="modal-content" style="max-width:600px">
    <div class="modal-header">
      <h2>⌨️ Keyboard Shortcuts</h2>
      <button onclick="closeAllModals()">✕</button>
    </div>
    <div class="modal-body">
      <div class="shortcut-list">
        <div class="shortcut-item">
          <kbd>/</kbd>
          <span>Focus search box</span>
        </div>
        <div class="shortcut-item">
          <kbd>f</kbd>
          <span>Toggle filter modal</span>
        </div>
        <div class="shortcut-item">
          <kbd>Esc</kbd>
          <span>Close modals</span>
        </div>
        <div class="shortcut-item">
          <kbd>e</kbd>
          <span>Export to CSV</span>
        </div>
        <div class="shortcut-item">
          <kbd>1-9</kbd>
          <span>Jump to week (schedule page)</span>
        </div>
        <div class="shortcut-item">
          <kbd>?</kbd>
          <span>Show this help</span>
        </div>
      </div>
    </div>
  </div>
</div>
```

**Step 3: Add help modal CSS**

```css
.shortcut-list{
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.shortcut-item{
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem;
  background: var(--slate-50);
  border-radius: 8px;
}

.shortcut-item kbd{
  background: var(--slate-900);
  color: var(--white);
  padding: 0.35rem 0.75rem;
  border-radius: 6px;
  font-family: 'DM Sans', monospace;
  font-size: 0.9rem;
  font-weight: 600;
  min-width: 50px;
  text-align: center;
  box-shadow: 0 2px 0 0 var(--slate-700);
}

.shortcut-item span{
  flex: 1;
  color: var(--slate-700);
  font-size: 0.95rem;
}
```

**Step 4: Add help indicator in corner**

Add floating help button:

```html
<div class="help-indicator" onclick="showKeyboardHelp()" title="Keyboard shortcuts (?)">
  ⌨️
</div>
```

```css
.help-indicator{
  position: fixed;
  bottom: 2rem;
  right: 2rem;
  width: 50px;
  height: 50px;
  background: var(--emerald);
  color: var(--white);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(16,185,129,.3);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 50;
}

.help-indicator:hover{
  transform: scale(1.1);
  box-shadow: 0 8px 24px rgba(16,185,129,.4);
}
```

**Step 5: Test shortcuts**

Open: Both pages

Test each shortcut:
- `/` → search focused
- `f` → filter modal opens
- `Esc` → modals close
- `e` → CSV downloads
- `1-9` → jumps to week (schedule only)
- `?` → help modal shows

Expected: All shortcuts work as described

**Step 6: Commit**

```bash
git add schedule.html index.html
git commit -m "feat: add keyboard shortcuts for power users

- / = focus search
- f = toggle filters
- Esc = close modals
- e = export CSV
- 1-9 = jump to week
- ? = show help modal
- Floating help indicator in corner

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Phase 4: Analytics Dashboard

### Task 8: Create Analytics Page Structure

**Files:**
- Create: `analytics.html`

**Step 1: Create analytics page with modern theme**

Create `analytics.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>CBB Analytics Dashboard</title>
<meta name="viewport" content="width=device-width,initial-scale=1" />
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Crimson+Pro:wght@400;600;700&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
<style>
  :root{
    --cream: #fafaf8;
    --white: #ffffff;
    --slate-50: #f8fafc;
    --slate-100: #f1f5f9;
    --slate-200: #e2e8f0;
    --slate-300: #cbd5e1;
    --slate-600: #475569;
    --slate-700: #334155;
    --slate-800: #1e293b;
    --slate-900: #0f172a;
    --emerald: #10b981;
    --emerald-dark: #059669;
    --emerald-light: #d1fae5;
    --amber: #f59e0b;
    --blue: #3b82f6;
    --purple: #8b5cf6;
    --red: #ef4444;
  }

  *{box-sizing:border-box}

  html,body{
    height:100%;
    margin:0;
    padding:0;
  }

  body{
    background: linear-gradient(135deg, var(--cream) 0%, var(--slate-50) 100%);
    color: var(--slate-900);
    font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: 15px;
    line-height: 1.6;
    -webkit-font-smoothing: antialiased;
  }

  /* Navigation */
  #top-bar{
    background: rgba(255,255,255,.95);
    backdrop-filter: blur(20px);
    border-bottom: 1px solid var(--slate-200);
    padding: 1.25rem 2rem;
    position: sticky;
    top: 0;
    z-index: 100;
    display: flex;
    align-items: center;
    gap: 1rem;
    box-shadow: 0 1px 3px rgba(15,23,42,.05);
  }

  #top-bar h1{
    margin: 0;
    font-family: 'Crimson Pro', serif;
    font-size: 1.75rem;
    font-weight: 700;
    color: var(--slate-900);
    flex: 1;
  }

  #top-bar nav{
    display: flex;
    gap: 0.5rem;
  }

  #top-bar nav a{
    color: var(--slate-700);
    text-decoration: none;
    padding: 0.65rem 1rem;
    background: var(--white);
    border: 1.5px solid var(--slate-300);
    border-radius: 10px;
    font-weight: 600;
    transition: all 0.2s;
  }

  #top-bar nav a:hover,
  #top-bar nav a.active{
    border-color: var(--emerald);
    color: var(--emerald-dark);
  }

  /* Main content */
  main{
    padding: 2rem;
    max-width: 1400px;
    margin: 0 auto;
  }

  .page-header{
    margin-bottom: 2rem;
  }

  .page-header h2{
    font-family: 'Crimson Pro', serif;
    font-size: 2rem;
    font-weight: 700;
    margin: 0 0 0.5rem 0;
    color: var(--slate-900);
  }

  .page-header p{
    color: var(--slate-600);
    font-size: 1.05rem;
    margin: 0;
  }

  /* Filters */
  .analytics-filters{
    background: var(--white);
    border: 1px solid var(--slate-200);
    border-radius: 16px;
    padding: 1.5rem;
    margin-bottom: 2rem;
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
    box-shadow: 0 2px 8px rgba(15,23,42,.08);
  }

  .analytics-filters select{
    background: var(--white);
    border: 1.5px solid var(--slate-300);
    border-radius: 10px;
    padding: 0.65rem 1rem;
    font-family: 'DM Sans', sans-serif;
    font-size: 0.9rem;
    color: var(--slate-700);
    transition: all 0.2s;
  }

  .analytics-filters select:focus{
    border-color: var(--emerald);
    outline: none;
    box-shadow: 0 0 0 3px var(--emerald-light);
  }

  /* Chart grid */
  .charts-grid{
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 2rem;
  }

  .chart-card{
    background: var(--white);
    border: 1px solid var(--slate-200);
    border-radius: 16px;
    padding: 1.5rem;
    box-shadow: 0 2px 8px rgba(15,23,42,.08);
    transition: all 0.3s;
  }

  .chart-card:hover{
    box-shadow: 0 8px 24px rgba(15,23,42,.12);
    transform: translateY(-2px);
  }

  .chart-card h3{
    font-family: 'Crimson Pro', serif;
    font-size: 1.3rem;
    font-weight: 700;
    margin: 0 0 1rem 0;
    color: var(--slate-900);
  }

  .chart-wrapper{
    position: relative;
    height: 400px;
  }

  .chart-wrapper.tall{
    height: 600px;
  }

  /* Table for leaderboards */
  .leaderboard-table{
    width: 100%;
    border-collapse: collapse;
    margin-top: 1rem;
  }

  .leaderboard-table thead{
    background: var(--slate-50);
  }

  .leaderboard-table th{
    padding: 0.75rem;
    text-align: left;
    font-weight: 700;
    color: var(--slate-700);
    font-size: 0.85rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .leaderboard-table td{
    padding: 0.75rem;
    border-bottom: 1px solid var(--slate-200);
    color: var(--slate-800);
  }

  .leaderboard-table tr:hover{
    background: var(--slate-50);
  }

  .rank{
    font-weight: 700;
    color: var(--emerald);
  }
</style>
</head>
<body>

<div id="top-bar">
  <h1>🎯 CBB Analytics</h1>
  <nav>
    <a href="schedule.html">Schedule</a>
    <a href="index.html">Rosters</a>
    <a href="analytics.html" class="active">Analytics</a>
  </nav>
</div>

<main>
  <div class="page-header">
    <h2>Season Analytics</h2>
    <p>Insights and trends across college baseball</p>
  </div>

  <div class="analytics-filters">
    <select id="conference-filter" onchange="updateCharts()">
      <option value="all">All Conferences</option>
      <option value="SEC">SEC</option>
      <option value="Big Ten">Big Ten</option>
      <option value="ACC">ACC</option>
      <option value="Big 12">Big 12</option>
      <option value="Pac-12">Pac-12</option>
    </select>

    <select id="stat-type" onchange="updateCharts()">
      <option value="era">ERA</option>
      <option value="strikeouts">Strikeouts</option>
      <option value="innings">Innings Pitched</option>
    </select>
  </div>

  <div class="charts-grid">
    <div class="chart-card">
      <h3>📊 Team Performance</h3>
      <div class="chart-wrapper">
        <canvas id="team-performance-chart"></canvas>
      </div>
    </div>

    <div class="chart-card">
      <h3>🏆 Pitcher Leaderboard</h3>
      <div class="chart-wrapper tall">
        <canvas id="pitcher-leaderboard-chart"></canvas>
      </div>
    </div>

    <div class="chart-card">
      <h3>🎓 Conference Comparison</h3>
      <div class="chart-wrapper">
        <canvas id="conference-comparison-chart"></canvas>
      </div>
    </div>

    <div class="chart-card">
      <h3>📈 Weekly Participation</h3>
      <div class="chart-wrapper">
        <canvas id="weekly-participation-chart"></canvas>
      </div>
    </div>
  </div>
</main>

<script>
// Data will be loaded here
let pitchersData = null;
let scheduleData = null;
let teamsData = null;

// Chart instances
let teamChart = null;
let pitcherChart = null;
let conferenceChart = null;
let weeklyChart = null;

// Load data
async function loadData() {
  const [pitchers, schedule, teams] = await Promise.all([
    fetch('data/pitchers.json').then(r => r.json()),
    fetch('data/schedule.json').then(r => r.json()),
    fetch('data/teams.json').then(r => r.json())
  ]);

  pitchersData = pitchers;
  scheduleData = schedule;
  teamsData = teams;

  initializeCharts();
}

function initializeCharts() {
  createTeamPerformanceChart();
  createPitcherLeaderboardChart();
  createConferenceComparisonChart();
  createWeeklyParticipationChart();
}

function updateCharts() {
  // Update all charts based on filter selections
  createTeamPerformanceChart();
  createPitcherLeaderboardChart();
  createConferenceComparisonChart();
  // Weekly chart doesn't need conference filter
}

// Placeholder chart functions (will be implemented in next tasks)
function createTeamPerformanceChart() {
  console.log('Creating team performance chart...');
}

function createPitcherLeaderboardChart() {
  console.log('Creating pitcher leaderboard chart...');
}

function createConferenceComparisonChart() {
  console.log('Creating conference comparison chart...');
}

function createWeeklyParticipationChart() {
  console.log('Creating weekly participation chart...');
}

// Initialize
loadData();
</script>

</body>
</html>
```

**Step 2: Add analytics link to other pages**

Update `schedule.html` and `index.html` navigation:

```html
<nav>
  <a href="schedule.html">Schedule</a>
  <a href="index.html">Rosters</a>
  <a href="analytics.html">Analytics <span class="new-badge">New</span></a>
</nav>
```

Add badge CSS:

```css
.new-badge{
  background: var(--emerald);
  color: var(--white);
  padding: 0.2rem 0.5rem;
  border-radius: 999px;
  font-size: 0.7rem;
  font-weight: 700;
  margin-left: 0.25rem;
}
```

**Step 3: Test page structure**

Open: `analytics.html`

Expected: Page loads with modern theme, filters present, empty chart placeholders

**Step 4: Commit**

```bash
git add analytics.html schedule.html index.html
git commit -m "feat: create analytics dashboard page structure

- Modern premium theme matching schedule/roster
- Chart.js loaded for visualizations
- Filter controls for conference and stat type
- Grid layout for 4 charts
- Navigation links on all pages

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 9: Implement Team Performance Chart

**Files:**
- Modify: `analytics.html` (implement `createTeamPerformanceChart()`)

**Step 1: Implement team performance calculation**

Replace the `createTeamPerformanceChart()` function:

```javascript
function createTeamPerformanceChart() {
  const conferenceFilter = document.getElementById('conference-filter').value;
  const statType = document.getElementById('stat-type').value;

  // Filter teams by conference
  let teams = teamsData.teams;
  if (conferenceFilter !== 'all') {
    teams = teams.filter(t => t.conference === conferenceFilter);
  }

  // Calculate team stats
  const teamStats = teams.map(team => {
    const teamPitchers = pitchersData.teams.find(t => t.team === team.team);
    if (!teamPitchers) return null;

    let statValue = 0;
    let count = 0;

    teamPitchers.pitchers.forEach(pitcher => {
      if (statType === 'era' && pitcher.era) {
        statValue += parseFloat(pitcher.era);
        count++;
      } else if (statType === 'strikeouts' && pitcher.strikeouts) {
        statValue += parseInt(pitcher.strikeouts);
      } else if (statType === 'innings' && pitcher.inningsPitched) {
        statValue += parseFloat(pitcher.inningsPitched);
      }
    });

    if (statType === 'era') {
      statValue = count > 0 ? (statValue / count).toFixed(2) : 0;
    }

    return {
      team: team.team,
      value: statValue,
      conference: team.conference
    };
  }).filter(Boolean);

  // Sort and take top 15
  const sortOrder = statType === 'era' ? 1 : -1; // ERA lower is better
  teamStats.sort((a, b) => sortOrder * (a.value - b.value));
  const top15 = teamStats.slice(0, 15);

  // Create chart
  const ctx = document.getElementById('team-performance-chart');

  if (teamChart) {
    teamChart.destroy();
  }

  const conferenceColors = {
    'SEC': '#8b5cf6',
    'Big Ten': '#3b82f6',
    'ACC': '#ef4444',
    'Big 12': '#f59e0b',
    'Pac-12': '#10b981'
  };

  teamChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: top15.map(t => t.team),
      datasets: [{
        label: getStatLabel(statType),
        data: top15.map(t => t.value),
        backgroundColor: top15.map(t => conferenceColors[t.conference] || '#94a3b8'),
        borderRadius: 8
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          padding: 12,
          titleFont: {
            size: 14,
            family: 'DM Sans'
          },
          bodyFont: {
            size: 13,
            family: 'DM Sans'
          },
          borderColor: '#cbd5e1',
          borderWidth: 1
        }
      },
      scales: {
        x: {
          beginAtZero: true,
          grid: {
            color: '#f1f5f9'
          },
          ticks: {
            font: {
              family: 'DM Sans'
            }
          }
        },
        y: {
          grid: {
            display: false
          },
          ticks: {
            font: {
              family: 'DM Sans',
              size: 12
            }
          }
        }
      }
    }
  });
}

function getStatLabel(statType) {
  const labels = {
    'era': 'Team Average ERA',
    'strikeouts': 'Total Strikeouts',
    'innings': 'Total Innings Pitched'
  };
  return labels[statType] || statType;
}
```

**Step 2: Test chart**

Open: `analytics.html`

Test:
- Change conference filter → chart updates
- Change stat type → chart shows different stat
- Bars colored by conference

Expected: Chart displays top 15 teams with proper data

**Step 3: Commit**

```bash
git add analytics.html
git commit -m "feat: implement team performance chart

- Top 15 teams by selected stat
- Color-coded by conference
- Responsive to filter changes
- ERA, strikeouts, innings supported

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 10: Implement Pitcher Leaderboard Chart

**Files:**
- Modify: `analytics.html` (implement `createPitcherLeaderboardChart()`)

**Step 1: Implement pitcher leaderboard**

Replace function:

```javascript
function createPitcherLeaderboardChart() {
  const conferenceFilter = document.getElementById('conference-filter').value;
  const statType = document.getElementById('stat-type').value;

  // Collect all pitchers
  let allPitchers = [];

  pitchersData.teams.forEach(team => {
    const teamInfo = teamsData.teams.find(t => t.team === team.team);
    if (!teamInfo) return;

    // Filter by conference
    if (conferenceFilter !== 'all' && teamInfo.conference !== conferenceFilter) {
      return;
    }

    team.pitchers.forEach(pitcher => {
      let statValue = 0;

      if (statType === 'era' && pitcher.era) {
        statValue = parseFloat(pitcher.era);
      } else if (statType === 'strikeouts' && pitcher.strikeouts) {
        statValue = parseInt(pitcher.strikeouts);
      } else if (statType === 'innings' && pitcher.inningsPitched) {
        statValue = parseFloat(pitcher.inningsPitched);
      }

      if (statValue > 0) {
        allPitchers.push({
          name: pitcher.name,
          team: team.team,
          value: statValue
        });
      }
    });
  });

  // Sort and take top 25
  const sortOrder = statType === 'era' ? 1 : -1;
  allPitchers.sort((a, b) => sortOrder * (a.value - b.value));
  const top25 = allPitchers.slice(0, 25);

  // Create chart
  const ctx = document.getElementById('pitcher-leaderboard-chart');

  if (pitcherChart) {
    pitcherChart.destroy();
  }

  pitcherChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: top25.map(p => `${p.name} (${p.team})`),
      datasets: [{
        label: getStatLabel(statType),
        data: top25.map(p => p.value),
        backgroundColor: '#10b981',
        borderRadius: 6
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          padding: 12,
          titleFont: {
            size: 13,
            family: 'DM Sans'
          },
          bodyFont: {
            size: 12,
            family: 'DM Sans'
          }
        }
      },
      scales: {
        x: {
          beginAtZero: true,
          grid: {
            color: '#f1f5f9'
          }
        },
        y: {
          grid: {
            display: false
          },
          ticks: {
            font: {
              family: 'DM Sans',
              size: 10
            }
          }
        }
      }
    }
  });
}
```

**Step 2: Test leaderboard**

Open: `analytics.html`

Test:
- Shows top 25 pitchers
- Changes with conference and stat filters
- Names include team in parentheses

Expected: Top performers displayed correctly

**Step 3: Commit**

```bash
git add analytics.html
git commit -m "feat: implement pitcher leaderboard chart

- Top 25 pitchers by selected stat
- Includes team name in label
- Filters by conference
- Supports ERA, strikeouts, innings

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 11: Implement Conference Comparison Chart

**Files:**
- Modify: `analytics.html` (implement `createConferenceComparisonChart()`)

**Step 1: Implement conference comparison**

Replace function:

```javascript
function createConferenceComparisonChart() {
  const conferences = ['SEC', 'Big Ten', 'ACC', 'Big 12', 'Pac-12'];

  // Calculate stats for each conference
  const conferenceStats = conferences.map(conf => {
    const confTeams = teamsData.teams.filter(t => t.conference === conf);

    let totalERA = 0;
    let totalK = 0;
    let totalIP = 0;
    let pitcherCount = 0;

    confTeams.forEach(team => {
      const teamPitchers = pitchersData.teams.find(t => t.team === team.team);
      if (!teamPitchers) return;

      teamPitchers.pitchers.forEach(pitcher => {
        if (pitcher.era) {
          totalERA += parseFloat(pitcher.era);
          pitcherCount++;
        }
        if (pitcher.strikeouts) totalK += parseInt(pitcher.strikeouts);
        if (pitcher.inningsPitched) totalIP += parseFloat(pitcher.inningsPitched);
      });
    });

    const avgERA = pitcherCount > 0 ? (totalERA / pitcherCount).toFixed(2) : 0;
    const k9 = totalIP > 0 ? ((totalK / totalIP) * 9).toFixed(2) : 0;

    return {
      conference: conf,
      avgERA: parseFloat(avgERA),
      totalK,
      k9: parseFloat(k9),
      totalIP
    };
  });

  // Create grouped bar chart
  const ctx = document.getElementById('conference-comparison-chart');

  if (conferenceChart) {
    conferenceChart.destroy();
  }

  conferenceChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: conferences,
      datasets: [
        {
          label: 'Avg ERA',
          data: conferenceStats.map(c => c.avgERA),
          backgroundColor: '#ef4444',
          borderRadius: 8
        },
        {
          label: 'K/9',
          data: conferenceStats.map(c => c.k9),
          backgroundColor: '#10b981',
          borderRadius: 8
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: {
            font: {
              family: 'DM Sans',
              size: 13
            },
            padding: 15,
            usePointStyle: true
          }
        },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          padding: 12
        }
      },
      scales: {
        x: {
          grid: {
            display: false
          },
          ticks: {
            font: {
              family: 'DM Sans',
              size: 12
            }
          }
        },
        y: {
          beginAtZero: true,
          grid: {
            color: '#f1f5f9'
          },
          ticks: {
            font: {
              family: 'DM Sans'
            }
          }
        }
      }
    }
  });
}
```

**Step 2: Test comparison**

Open: `analytics.html`

Expected: Grouped bar chart showing ERA and K/9 for Power 5 conferences

**Step 3: Commit**

```bash
git add analytics.html
git commit -m "feat: implement conference comparison chart

- Compares Power 5 conferences
- Shows average ERA and K/9 rate
- Grouped bar chart for easy comparison
- Identifies conference strengths

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 12: Implement Weekly Participation Chart

**Files:**
- Modify: `analytics.html` (implement `createWeeklyParticipationChart()`)

**Step 1: Implement weekly trends**

Replace function:

```javascript
function createWeeklyParticipationChart() {
  // Count appearances per week
  const weeklyData = {};

  // Initialize weeks 1-20
  for (let i = 1; i <= 20; i++) {
    weeklyData[i] = 0;
  }

  // Count from schedule data
  if (scheduleData && scheduleData.games) {
    scheduleData.games.forEach(game => {
      if (game.pitchers) {
        const homeCount = game.pitchers.home?.length || 0;
        const awayCount = game.pitchers.away?.length || 0;
        const week = game.week || 1;

        if (weeklyData[week] !== undefined) {
          weeklyData[week] += homeCount + awayCount;
        }
      }
    });
  }

  const weeks = Object.keys(weeklyData).map(Number).sort((a, b) => a - b);
  const counts = weeks.map(w => weeklyData[w]);

  // Create line chart
  const ctx = document.getElementById('weekly-participation-chart');

  if (weeklyChart) {
    weeklyChart.destroy();
  }

  weeklyChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: weeks.map(w => `Week ${w}`),
      datasets: [{
        label: 'Pitcher Appearances',
        data: counts,
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        borderWidth: 3,
        fill: true,
        tension: 0.4,
        pointRadius: 5,
        pointBackgroundColor: '#10b981',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointHoverRadius: 7
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          padding: 12,
          titleFont: {
            size: 14,
            family: 'DM Sans'
          },
          bodyFont: {
            size: 13,
            family: 'DM Sans'
          }
        }
      },
      scales: {
        x: {
          grid: {
            display: false
          },
          ticks: {
            font: {
              family: 'DM Sans'
            }
          }
        },
        y: {
          beginAtZero: true,
          grid: {
            color: '#f1f5f9'
          },
          ticks: {
            font: {
              family: 'DM Sans'
            }
          },
          title: {
            display: true,
            text: 'Total Appearances',
            font: {
              family: 'DM Sans',
              size: 13
            }
          }
        }
      }
    }
  });
}
```

**Step 2: Test weekly trends**

Open: `analytics.html`

Expected: Line chart showing participation trends across the season, highlighting busy weeks

**Step 3: Commit**

```bash
git add analytics.html
git commit -m "feat: implement weekly participation trends chart

- Line chart showing pitcher appearances per week
- Identifies busy weeks for scheduling
- Smooth curve with fill
- Helps plan watching time

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Phase 5: Performance Optimizations

### Task 13: Add Image Lazy Loading

**Files:**
- Modify: `schedule.html` and `index.html` (all `<img>` tags)

**Step 1: Add lazy loading to headshots in index.html**

Find all headshot images and add `loading="lazy"`:

```html
<img class="headshot" src="${pitcher.headshot}" alt="${pitcher.name}" loading="lazy">
```

**Step 2: Add lazy loading to team logos**

```html
<img class="team-logo-big" src="${team.logo}" alt="${team.team}" loading="lazy">
```

**Step 3: Add lazy loading to schedule.html**

Same process for any images in game cards or pitcher lists.

**Step 4: Test lazy loading**

Open: `index.html` with DevTools Network tab

Expected:
- Images load as you scroll
- Initial page load is faster
- Network shows images loading incrementally

**Step 5: Commit**

```bash
git add schedule.html index.html
git commit -m "perf: add native lazy loading to all images

- loading='lazy' attribute on headshots and logos
- Faster initial page render
- Images load on scroll
- No library needed (native browser feature)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 14: Implement Data Caching

**Files:**
- Modify: `schedule.html`, `index.html`, `analytics.html` (data loading functions)

**Step 1: Create cache utility functions**

Add to all three HTML files before data loading:

```javascript
// Cache utilities
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

function getCachedData(key) {
  const cached = localStorage.getItem(`cache_${key}`);
  if (!cached) return null;

  const { data, timestamp } = JSON.parse(cached);
  const now = Date.now();

  if (now - timestamp > CACHE_DURATION) {
    localStorage.removeItem(`cache_${key}`);
    return null;
  }

  return data;
}

function setCachedData(key, data) {
  const cacheEntry = {
    data,
    timestamp: Date.now()
  };
  localStorage.setItem(`cache_${key}`, JSON.stringify(cacheEntry));
}

async function fetchWithCache(url, cacheKey) {
  // Try cache first
  const cached = getCachedData(cacheKey);
  if (cached) {
    console.log(`📦 Loading ${cacheKey} from cache`);
    showToast('Loading from cache...');
    return cached;
  }

  // Fetch fresh data
  console.log(`🌐 Fetching fresh ${cacheKey}`);
  const response = await fetch(url);
  const data = await response.json();

  // Cache it
  setCachedData(cacheKey, data);

  return data;
}

// Manual cache clear
function clearDataCache() {
  ['pitchers', 'schedule', 'teams'].forEach(key => {
    localStorage.removeItem(`cache_${key}`);
  });
  showToast('Cache cleared. Refreshing...');
  location.reload();
}
```

**Step 2: Update data loading to use cache**

Replace fetch calls:

```javascript
// Before:
const pitchersData = await fetch('data/pitchers.json').then(r => r.json());

// After:
const pitchersData = await fetchWithCache('data/pitchers.json', 'pitchers');
```

**Step 3: Add cache clear button**

Add to settings or nav:

```html
<button onclick="clearDataCache()" title="Clear cache and reload fresh data">
  🔄 Clear Cache
</button>
```

**Step 4: Test caching**

Open: Any page

Test:
- First load → fetches from network
- Refresh → loads from cache (faster)
- Click "Clear Cache" → fetches fresh
- Check localStorage → sees cache entries

Expected: Faster subsequent page loads

**Step 5: Commit**

```bash
git add schedule.html index.html analytics.html
git commit -m "perf: implement data caching with localStorage

- 24-hour cache for pitchers, schedule, teams JSON
- Automatic cache invalidation after 24h
- Manual cache clear button
- Toast notifications for cache status
- Faster repeat visits

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Final Deployment

### Task 15: Deploy All Improvements

**Step 1: Run final verification**

Run: `node verify-data-quality.mjs`

Expected:
- Headshots: >95% complete for Power 5
- Years: >95% complete for Power 5
- Team logos: >90% complete

**Step 2: Test all pages**

Test:
- `schedule.html` - filters, export, keyboard shortcuts work
- `index.html` - modern theme, export works
- `analytics.html` - all 4 charts render correctly

**Step 3: Commit any final tweaks**

```bash
git add .
git commit -m "chore: final tweaks and polish

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

**Step 4: Push to main**

Run: `git push origin feature/comprehensive-app-upgrade:main`

**Step 5: Deploy to Vercel**

Run: `./deploy.sh`

**Step 6: Verify production**

Visit: Production URL

Test all features in production environment.

---

## Summary

This plan delivers comprehensive improvements across:

**Data Quality:**
- Headshots: 24 → <5 missing (95%+ Power 5)
- Years: 1,052 → <50 missing (95%+ Power 5)
- Logos: 0 → 90%+ coverage

**Design:**
- Unified modern premium theme across all pages
- Consistent typography and colors

**Features:**
- Multi-select filtering
- CSV export
- Keyboard shortcuts
- Full analytics dashboard with 4 charts

**Performance:**
- Image lazy loading
- Data caching (24h)
- Faster page loads

All deployed via rolling releases for continuous user-visible progress.
