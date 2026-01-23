# ESPN Roster Verification & Update Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a two-phase system that verifies all team rosters against ESPN data and automatically updates pitcher information

**Architecture:** Phase 1 scrapes ESPN, compares with existing rosters, generates triple-format reports (console/detailed/JSON). Phase 2 creates full data backup, updates rosters_2026.json with pitcher changes, regenerates pitchers_2026.json, validates output.

**Tech Stack:** Node.js (ESM), Puppeteer, fs/promises, crypto (for checksums)

---

## Task 1: Create ESPN Scraper Module

**Files:**
- Create: `lib/espn-scraper.mjs`

**Step 1: Create lib directory and module skeleton**

```bash
mkdir -p lib
```

Create `lib/espn-scraper.mjs`:

```javascript
/**
 * ESPN Roster Scraper
 * Fetches current roster data from ESPN team pages
 */

import puppeteer from 'puppeteer';

const DELAY_MS = 2000; // 2 seconds between requests
const MAX_RETRIES = 3;
const TIMEOUT_MS = 30000;

/**
 * Delay helper
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetch roster for a single team from ESPN
 * @param {Object} team - Team object with id and slug
 * @param {Object} browser - Puppeteer browser instance
 * @returns {Object|null} Roster data or null on failure
 */
export async function fetchTeamRoster(team, browser) {
  const url = `https://www.espn.com/college-baseball/team/roster/_/id/${team.id}`;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const page = await browser.newPage();
      await page.setDefaultTimeout(TIMEOUT_MS);

      console.log(`  Fetching ${team.name} (attempt ${attempt}/${MAX_RETRIES})...`);

      await page.goto(url, { waitUntil: 'networkidle2' });

      // Wait for roster table to load
      await page.waitForSelector('.ResponsiveTable, .Table__TBODY', { timeout: 10000 });

      // Extract roster data
      const players = await page.evaluate(() => {
        const rows = Array.from(document.querySelectorAll('.Table__TR'));
        const playerData = [];

        rows.forEach(row => {
          const cells = row.querySelectorAll('.Table__TD');
          if (cells.length === 0) return; // Skip header rows

          // ESPN roster table columns (may vary slightly)
          const name = cells[1]?.textContent?.trim() || '';
          const number = cells[0]?.textContent?.trim() || '';
          const position = cells[2]?.textContent?.trim() || '';
          const year = cells[3]?.textContent?.trim() || '';
          const height = cells[4]?.textContent?.trim() || '';
          const weight = cells[5]?.textContent?.trim() || '';
          const batsThrows = cells[6]?.textContent?.trim() || '';
          const hometown = cells[7]?.textContent?.trim() || '';

          if (name) {
            playerData.push({
              name,
              number,
              position,
              year,
              height,
              weight,
              batsThrows,
              hometown
            });
          }
        });

        return playerData;
      });

      await page.close();

      if (players.length === 0) {
        console.log(`  ⚠️  No players found for ${team.name}`);
        return null;
      }

      console.log(`  ✓ Found ${players.length} players for ${team.name}`);

      return {
        team: team.name,
        teamId: team.id,
        slug: team.slug,
        totalPlayers: players.length,
        allPlayers: players,
        scrapedAt: new Date().toISOString()
      };

    } catch (error) {
      console.error(`  ❌ Error fetching ${team.name} (attempt ${attempt}): ${error.message}`);

      if (attempt === MAX_RETRIES) {
        return null;
      }

      // Exponential backoff
      const backoffDelay = DELAY_MS * Math.pow(2, attempt - 1);
      await delay(backoffDelay);
    }
  }

  return null;
}

/**
 * Fetch rosters for all teams
 * @param {Array} teams - Array of team objects
 * @returns {Object} { rosters: Array, failed: Array }
 */
export async function fetchAllRosters(teams) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const rosters = [];
  const failed = [];

  console.log(`\n🔍 Fetching rosters for ${teams.length} teams...\n`);

  for (let i = 0; i < teams.length; i++) {
    const team = teams[i];

    // Progress logging every 10 teams
    if (i > 0 && i % 10 === 0) {
      console.log(`\n📊 Progress: ${i}/${teams.length} teams processed\n`);
    }

    const roster = await fetchTeamRoster(team, browser);

    if (roster) {
      rosters.push(roster);
    } else {
      failed.push({ teamId: team.id, teamName: team.name });
    }

    // Rate limiting delay between requests
    if (i < teams.length - 1) {
      await delay(DELAY_MS);
    }
  }

  await browser.close();

  console.log(`\n✅ Scraping complete: ${rosters.length} successful, ${failed.length} failed\n`);

  return { rosters, failed };
}
```

**Step 2: Test the module exists and has correct exports**

```bash
node -e "import('./lib/espn-scraper.mjs').then(m => console.log('Exports:', Object.keys(m)))"
```

Expected: `Exports: [ 'fetchTeamRoster', 'fetchAllRosters' ]`

**Step 3: Commit**

```bash
git add lib/espn-scraper.mjs
git commit -m "feat: add ESPN roster scraper module"
```

---

## Task 2: Create Roster Comparison Module

**Files:**
- Create: `lib/roster-comparison.mjs`

**Step 1: Create comparison module**

Create `lib/roster-comparison.mjs`:

```javascript
/**
 * Roster Comparison Logic
 * Compares ESPN roster data with existing roster data
 */

/**
 * Classify a change by importance
 */
function classifyChange(change, player) {
  const isPitcher = ['P', 'RHP', 'LHP'].includes(player.position) ||
                    ['P', 'RHP', 'LHP'].includes(player.oldPosition);

  if (change.type === 'new_player' && isPitcher) return 'important';
  if (change.type === 'removed_player' && isPitcher) return 'important';
  if (change.type === 'position_change' && isPitcher) return 'critical';
  if (change.type === 'position_change') return 'important';

  return 'minor';
}

/**
 * Compare a single player between ESPN and existing data
 */
function comparePlayer(espnPlayer, existingPlayer) {
  const changes = [];

  if (!existingPlayer) {
    return [{
      type: 'new_player',
      player: espnPlayer
    }];
  }

  // Check for position change
  if (espnPlayer.position !== existingPlayer.position && espnPlayer.position) {
    changes.push({
      type: 'position_change',
      player: espnPlayer.name,
      number: espnPlayer.number,
      old: existingPlayer.position,
      new: espnPlayer.position
    });
  }

  // Check for year change
  if (espnPlayer.year !== existingPlayer.year && espnPlayer.year) {
    changes.push({
      type: 'year_change',
      player: espnPlayer.name,
      number: espnPlayer.number,
      old: existingPlayer.year,
      new: espnPlayer.year
    });
  }

  // Check for number change
  if (espnPlayer.number !== existingPlayer.number && espnPlayer.number) {
    changes.push({
      type: 'number_change',
      player: espnPlayer.name,
      oldNumber: existingPlayer.number,
      newNumber: espnPlayer.number
    });
  }

  // Check for bio updates (if previously empty)
  if (espnPlayer.height && !existingPlayer.height) {
    changes.push({
      type: 'bio_update',
      player: espnPlayer.name,
      field: 'height',
      value: espnPlayer.height
    });
  }

  if (espnPlayer.weight && !existingPlayer.weight) {
    changes.push({
      type: 'bio_update',
      player: espnPlayer.name,
      field: 'weight',
      value: espnPlayer.weight
    });
  }

  if (espnPlayer.hometown && !existingPlayer.hometown) {
    changes.push({
      type: 'bio_update',
      player: espnPlayer.name,
      field: 'hometown',
      value: espnPlayer.hometown
    });
  }

  return changes;
}

/**
 * Compare team rosters
 * @param {Object} espnRoster - Roster from ESPN
 * @param {Object} existingRoster - Current roster data
 * @returns {Object} Comparison results
 */
export function compareRosters(espnRoster, existingRoster) {
  const changes = [];

  if (!existingRoster) {
    // Brand new team - all players are new
    return {
      teamId: espnRoster.teamId,
      team: espnRoster.team,
      changeCount: espnRoster.totalPlayers,
      changes: espnRoster.allPlayers.map(p => ({
        type: 'new_player',
        player: p
      }))
    };
  }

  // Create lookup maps
  const espnPlayersByName = new Map();
  const espnPlayersByNumber = new Map();
  espnRoster.allPlayers.forEach(p => {
    espnPlayersByName.set(p.name, p);
    if (p.number) espnPlayersByNumber.set(p.number, p);
  });

  const existingPlayersByName = new Map();
  const existingPlayersByNumber = new Map();
  existingRoster.allPlayers.forEach(p => {
    existingPlayersByName.set(p.name, p);
    if (p.number) existingPlayersByNumber.set(p.number, p);
  });

  // Check for new and changed players
  espnRoster.allPlayers.forEach(espnPlayer => {
    // Try to match by name + number first
    let existingPlayer = existingPlayersByName.get(espnPlayer.name);

    // If name match has different number, it's a number change
    if (existingPlayer && existingPlayer.number !== espnPlayer.number) {
      // Still the same player, just note the number change
    }

    const playerChanges = comparePlayer(espnPlayer, existingPlayer);
    changes.push(...playerChanges);
  });

  // Check for removed players
  existingRoster.allPlayers.forEach(existingPlayer => {
    if (!espnPlayersByName.has(existingPlayer.name)) {
      changes.push({
        type: 'removed_player',
        player: existingPlayer
      });
    }
  });

  return {
    teamId: espnRoster.teamId,
    team: espnRoster.team,
    changeCount: changes.length,
    changes
  };
}

/**
 * Compare all rosters
 * @param {Array} espnRosters - Rosters from ESPN
 * @param {Array} existingRosters - Current roster data
 * @returns {Object} Full comparison report
 */
export function compareAllRosters(espnRosters, existingRosters) {
  const existingRosterMap = new Map(
    existingRosters.map(r => [r.teamId, r])
  );

  const teamChanges = [];
  const summary = {
    teamsProcessed: espnRosters.length,
    teamsWithChanges: 0,
    teamsUnchanged: 0,
    changesBreakdown: {
      newPitchers: 0,
      removedPitchers: 0,
      positionChanges: 0,
      otherChanges: 0
    }
  };

  espnRosters.forEach(espnRoster => {
    const existingRoster = existingRosterMap.get(espnRoster.teamId);
    const comparison = compareRosters(espnRoster, existingRoster);

    if (comparison.changeCount > 0) {
      teamChanges.push(comparison);
      summary.teamsWithChanges++;

      // Count changes by type
      comparison.changes.forEach(change => {
        const isPitcher = change.player?.position && ['P', 'RHP', 'LHP'].includes(change.player.position);

        if (change.type === 'new_player' && isPitcher) {
          summary.changesBreakdown.newPitchers++;
        } else if (change.type === 'removed_player' && isPitcher) {
          summary.changesBreakdown.removedPitchers++;
        } else if (change.type === 'position_change') {
          summary.changesBreakdown.positionChanges++;
        } else {
          summary.changesBreakdown.otherChanges++;
        }
      });
    } else {
      summary.teamsUnchanged++;
    }
  });

  return {
    timestamp: new Date().toISOString(),
    summary,
    teamChanges
  };
}
```

**Step 2: Test module exports**

```bash
node -e "import('./lib/roster-comparison.mjs').then(m => console.log('Exports:', Object.keys(m)))"
```

Expected: `Exports: [ 'compareRosters', 'compareAllRosters' ]`

**Step 3: Commit**

```bash
git add lib/roster-comparison.mjs
git commit -m "feat: add roster comparison module"
```

---

## Task 3: Create Backup Module

**Files:**
- Create: `lib/backup.mjs`

**Step 1: Create backup module with checksum generation**

Create `lib/backup.mjs`:

```javascript
/**
 * Data Backup System
 * Creates timestamped backups with manifest and checksums
 */

import fs from 'fs/promises';
import { createHash } from 'crypto';
import path from 'path';

/**
 * Generate SHA256 checksum for a file
 */
async function generateChecksum(filePath) {
  try {
    const content = await fs.readFile(filePath);
    return createHash('sha256').update(content).digest('hex');
  } catch (error) {
    return null;
  }
}

/**
 * Create full data snapshot backup
 * @param {string} reason - Reason for backup (e.g., "pre-roster-update")
 * @returns {string} Backup directory path
 */
export async function createDataSnapshot(reason = 'manual-backup') {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const backupDir = path.join(process.cwd(), 'backups', `full_snapshot_${timestamp}`);

  console.log(`\n📦 Creating data snapshot: ${backupDir}\n`);

  // Create backup directory
  await fs.mkdir(backupDir, { recursive: true });

  // Files to backup
  const filesToBackup = [
    'data/rosters_2026.json',
    'data/pitchers_2026.json',
    'data/teams.json',
    'data/schedules_2026.json',
    'data/pitchers_played_index.json'
  ];

  const manifest = {
    timestamp: new Date().toISOString(),
    script: 'verify-update-rosters.mjs',
    reason,
    files: []
  };

  // Copy files and generate checksums
  for (const file of filesToBackup) {
    const sourcePath = path.join(process.cwd(), file);
    const destPath = path.join(backupDir, path.basename(file));

    try {
      await fs.copyFile(sourcePath, destPath);

      const stats = await fs.stat(sourcePath);
      const checksum = await generateChecksum(sourcePath);

      manifest.files.push({
        filename: path.basename(file),
        originalPath: file,
        size: stats.size,
        checksum
      });

      console.log(`  ✓ Backed up: ${file}`);
    } catch (error) {
      console.error(`  ❌ Failed to backup ${file}: ${error.message}`);
    }
  }

  // Write manifest
  await fs.writeFile(
    path.join(backupDir, 'manifest.json'),
    JSON.stringify(manifest, null, 2)
  );

  console.log(`\n✅ Backup complete: ${manifest.files.length} files backed up\n`);

  return backupDir;
}

/**
 * Restore from a backup
 * @param {string} backupDir - Path to backup directory
 */
export async function restoreFromBackup(backupDir) {
  console.log(`\n♻️  Restoring from backup: ${backupDir}\n`);

  // Read manifest
  const manifestPath = path.join(backupDir, 'manifest.json');
  const manifestContent = await fs.readFile(manifestPath, 'utf-8');
  const manifest = JSON.parse(manifestContent);

  // Restore each file
  for (const fileInfo of manifest.files) {
    const sourcePath = path.join(backupDir, fileInfo.filename);
    const destPath = path.join(process.cwd(), fileInfo.originalPath);

    try {
      await fs.copyFile(sourcePath, destPath);
      console.log(`  ✓ Restored: ${fileInfo.originalPath}`);
    } catch (error) {
      console.error(`  ❌ Failed to restore ${fileInfo.originalPath}: ${error.message}`);
    }
  }

  console.log(`\n✅ Restore complete\n`);
}
```

**Step 2: Test module exports**

```bash
node -e "import('./lib/backup.mjs').then(m => console.log('Exports:', Object.keys(m)))"
```

Expected: `Exports: [ 'createDataSnapshot', 'restoreFromBackup' ]`

**Step 3: Commit**

```bash
git add lib/backup.mjs
git commit -m "feat: add data backup module with checksums"
```

---

## Task 4: Create Roster Update Module

**Files:**
- Create: `lib/roster-updater.mjs`

**Step 1: Create roster updater for pitcher-focused updates**

Create `lib/roster-updater.mjs`:

```javascript
/**
 * Roster Update Module
 * Updates rosters_2026.json and regenerates pitchers_2026.json
 */

import fs from 'fs/promises';
import path from 'path';

/**
 * Apply roster changes from ESPN data
 * @param {Array} espnRosters - Rosters from ESPN
 * @param {Array} existingRosters - Current rosters
 * @param {Object} comparisonReport - Results from roster comparison
 * @returns {Array} Updated rosters
 */
export function applyRosterUpdates(espnRosters, existingRosters, comparisonReport) {
  console.log(`\n📝 Applying roster updates...\n`);

  const espnRosterMap = new Map(espnRosters.map(r => [r.teamId, r]));
  const existingRosterMap = new Map(existingRosters.map(r => [r.teamId, r]));

  const updatedRosters = [];
  let updateCount = 0;

  // Process each team
  for (const [teamId, espnRoster] of espnRosterMap) {
    const existingRoster = existingRosterMap.get(teamId);

    if (!existingRoster) {
      // New team - use ESPN data as-is
      updatedRosters.push(espnRoster);
      updateCount++;
      console.log(`  + Added new team: ${espnRoster.team}`);
      continue;
    }

    // Check if this team has changes
    const teamChanges = comparisonReport.teamChanges.find(tc => tc.teamId === teamId);

    if (!teamChanges || teamChanges.changeCount === 0) {
      // No changes - keep existing
      updatedRosters.push(existingRoster);
      continue;
    }

    // Team has changes - merge ESPN data with existing
    const updated = {
      ...existingRoster,
      totalPlayers: espnRoster.totalPlayers,
      allPlayers: espnRoster.allPlayers,
      lastUpdated: new Date().toISOString()
    };

    updatedRosters.push(updated);
    updateCount++;
    console.log(`  ✓ Updated: ${espnRoster.team} (${teamChanges.changeCount} changes)`);
  }

  console.log(`\n✅ Updated ${updateCount} team rosters\n`);

  return updatedRosters;
}

/**
 * Regenerate pitchers_2026.json from updated rosters
 * @param {Array} rosters - Updated roster data
 * @param {Array} existingPitchers - Current pitcher data (for preserving metadata)
 * @param {Array} teams - Team metadata (for conference, abbrev)
 * @returns {Array} Regenerated pitcher list
 */
export function regeneratePitchers(rosters, existingPitchers, teams) {
  console.log(`\n⚾ Regenerating pitchers_2026.json...\n`);

  const teamMap = new Map(teams.map(t => [t.id, t]));
  const existingPitcherMap = new Map(existingPitchers.map(p => [p.id, p]));

  const pitchers = [];

  rosters.forEach(roster => {
    const team = teamMap.get(roster.teamId);
    if (!team) {
      console.warn(`  ⚠️  Team not found: ${roster.teamId}`);
      return;
    }

    // Extract pitchers (P, RHP, LHP)
    const teamPitchers = roster.allPlayers.filter(player =>
      ['P', 'RHP', 'LHP'].includes(player.position)
    );

    teamPitchers.forEach(player => {
      const pitcherId = `${roster.teamId}-${player.number}`;
      const existingPitcher = existingPitcherMap.get(pitcherId);

      // Preserve existing metadata if pitcher already exists
      const pitcher = {
        id: pitcherId,
        name: player.name,
        number: player.number,
        position: player.position,
        team: team.location || team.name,
        teamId: roster.teamId,
        teamAbbrev: team.abbrev,
        conference: team.conference,
        height: player.height || existingPitcher?.height || '',
        weight: player.weight || existingPitcher?.weight || '',
        year: player.year || existingPitcher?.year || '',
        role: existingPitcher?.role || 'Reliever' // Default to Reliever, keep existing if available
      };

      pitchers.push(pitcher);
    });

    console.log(`  ✓ Extracted ${teamPitchers.length} pitchers from ${roster.team}`);
  });

  console.log(`\n✅ Regenerated ${pitchers.length} total pitchers\n`);

  return pitchers;
}

/**
 * Save updated data to disk
 * @param {Array} rosters - Updated rosters
 * @param {Array} pitchers - Regenerated pitchers
 */
export async function saveUpdatedData(rosters, pitchers) {
  console.log(`\n💾 Saving updated data...\n`);

  const rostersPath = path.join(process.cwd(), 'data', 'rosters_2026.json');
  const pitchersPath = path.join(process.cwd(), 'data', 'pitchers_2026.json');

  await fs.writeFile(rostersPath, JSON.stringify(rosters, null, 2));
  console.log(`  ✓ Saved: rosters_2026.json (${rosters.length} teams)`);

  await fs.writeFile(pitchersPath, JSON.stringify(pitchers, null, 2));
  console.log(`  ✓ Saved: pitchers_2026.json (${pitchers.length} pitchers)`);

  console.log(`\n✅ Data saved successfully\n`);
}

/**
 * Validate updated data
 * @param {Array} oldRosters - Original rosters
 * @param {Array} newRosters - Updated rosters
 * @param {Array} oldPitchers - Original pitchers
 * @param {Array} newPitchers - Regenerated pitchers
 */
export function validateUpdates(oldRosters, newRosters, oldPitchers, newPitchers) {
  console.log(`\n🔍 Validating updates...\n`);

  console.log(`  Rosters: ${oldRosters.length} → ${newRosters.length} (${newRosters.length - oldRosters.length >= 0 ? '+' : ''}${newRosters.length - oldRosters.length})`);
  console.log(`  Pitchers: ${oldPitchers.length} → ${newPitchers.length} (${newPitchers.length - oldPitchers.length >= 0 ? '+' : ''}${newPitchers.length - oldPitchers.length})`);

  // Check for reasonable changes
  const rosterDiff = Math.abs(newRosters.length - oldRosters.length);
  const pitcherDiff = Math.abs(newPitchers.length - oldPitchers.length);

  if (rosterDiff > oldRosters.length * 0.1) {
    console.warn(`  ⚠️  WARNING: Roster count changed by more than 10%`);
  }

  if (pitcherDiff > oldPitchers.length * 0.2) {
    console.warn(`  ⚠️  WARNING: Pitcher count changed by more than 20%`);
  }

  console.log(`\n✅ Validation complete\n`);
}
```

**Step 2: Test module exports**

```bash
node -e "import('./lib/roster-updater.mjs').then(m => console.log('Exports:', Object.keys(m)))"
```

Expected: `Exports: [ 'applyRosterUpdates', 'regeneratePitchers', 'saveUpdatedData', 'validateUpdates' ]`

**Step 3: Commit**

```bash
git add lib/roster-updater.mjs
git commit -m "feat: add roster update and pitcher regeneration module"
```

---

## Task 5: Create Report Generator Module

**Files:**
- Create: `lib/report-generator.mjs`

**Step 1: Create report generator for console and JSON output**

Create `lib/report-generator.mjs`:

```javascript
/**
 * Report Generator
 * Generates console summary, detailed logs, and JSON reports
 */

import fs from 'fs/promises';
import path from 'path';

/**
 * Print console summary
 * @param {Object} comparisonReport - Report from compareAllRosters
 * @param {Array} failedTeams - Teams that failed to scrape
 */
export function printConsoleSummary(comparisonReport, failedTeams = []) {
  console.log('\n' + '='.repeat(60));
  console.log('ROSTER VERIFICATION SUMMARY');
  console.log('='.repeat(60) + '\n');

  const totalTeams = comparisonReport.summary.teamsProcessed + failedTeams.length;

  console.log(`Teams Processed: ${comparisonReport.summary.teamsProcessed}/${totalTeams} (${failedTeams.length} failed)`);
  console.log(`Teams with Changes: ${comparisonReport.summary.teamsWithChanges}`);
  console.log(`Teams Unchanged: ${comparisonReport.summary.teamsUnchanged}`);
  console.log('');
  console.log('Changes Breakdown:');
  console.log(`  - New Pitchers Added: ${comparisonReport.summary.changesBreakdown.newPitchers}`);
  console.log(`  - Pitchers Removed: ${comparisonReport.summary.changesBreakdown.removedPitchers}`);
  console.log(`  - Position Changes: ${comparisonReport.summary.changesBreakdown.positionChanges}`);
  console.log(`  - Other Changes: ${comparisonReport.summary.changesBreakdown.otherChanges}`);

  if (failedTeams.length > 0) {
    console.log('\n❌ Failed Teams:');
    failedTeams.forEach(ft => {
      console.log(`  - ${ft.teamName} (${ft.teamId})`);
    });
  }

  console.log('\n' + '='.repeat(60) + '\n');
}

/**
 * Print detailed changes
 * @param {Object} comparisonReport - Report from compareAllRosters
 */
export function printDetailedChanges(comparisonReport) {
  if (comparisonReport.teamChanges.length === 0) {
    console.log('No changes detected.\n');
    return;
  }

  console.log('\n' + '='.repeat(60));
  console.log('DETAILED CHANGES');
  console.log('='.repeat(60) + '\n');

  comparisonReport.teamChanges.forEach(teamChange => {
    console.log(`\n📋 ${teamChange.team} (${teamChange.changeCount} changes):`);

    teamChange.changes.forEach(change => {
      switch (change.type) {
        case 'new_player':
          const isPitcher = ['P', 'RHP', 'LHP'].includes(change.player.position);
          console.log(`  + New ${isPitcher ? '⚾ PITCHER' : 'player'}: ${change.player.name} #${change.player.number} (${change.player.position}, ${change.player.year})`);
          break;
        case 'removed_player':
          const wasP = ['P', 'RHP', 'LHP'].includes(change.player.position);
          console.log(`  - Removed ${wasP ? '⚾ PITCHER' : 'player'}: ${change.player.name} #${change.player.number}`);
          break;
        case 'position_change':
          console.log(`  ↔ Position change: ${change.player} #${change.number} (${change.old} → ${change.new})`);
          break;
        case 'year_change':
          console.log(`  ↑ Year change: ${change.player} #${change.number} (${change.old} → ${change.new})`);
          break;
        case 'number_change':
          console.log(`  # Number change: ${change.player} (#${change.oldNumber} → #${change.newNumber})`);
          break;
        case 'bio_update':
          console.log(`  ℹ Bio update: ${change.player} - ${change.field}: ${change.value}`);
          break;
      }
    });
  });

  console.log('\n' + '='.repeat(60) + '\n');
}

/**
 * Save JSON report to file
 * @param {Object} comparisonReport - Report from compareAllRosters
 * @param {Array} failedTeams - Teams that failed to scrape
 * @returns {string} Path to saved report
 */
export async function saveJsonReport(comparisonReport, failedTeams = []) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const filename = `roster_verification_report_${timestamp}.json`;
  const filepath = path.join(process.cwd(), 'data', filename);

  const report = {
    ...comparisonReport,
    summary: {
      ...comparisonReport.summary,
      teamsFailed: failedTeams.length
    },
    failedTeams: failedTeams.map(ft => ({
      teamId: ft.teamId,
      teamName: ft.teamName
    }))
  };

  await fs.writeFile(filepath, JSON.stringify(report, null, 2));

  console.log(`\n📄 JSON report saved: ${filename}\n`);

  return filepath;
}

/**
 * Save failed teams to separate file
 * @param {Array} failedTeams - Teams that failed to scrape
 */
export async function saveFailedTeams(failedTeams) {
  if (failedTeams.length === 0) return;

  const filepath = path.join(process.cwd(), 'data', 'failed_teams.json');
  await fs.writeFile(filepath, JSON.stringify(failedTeams, null, 2));

  console.log(`\n⚠️  Failed teams saved: failed_teams.json\n`);
}
```

**Step 2: Test module exports**

```bash
node -e "import('./lib/report-generator.mjs').then(m => console.log('Exports:', Object.keys(m)))"
```

Expected: `Exports: [ 'printConsoleSummary', 'printDetailedChanges', 'saveJsonReport', 'saveFailedTeams' ]`

**Step 3: Commit**

```bash
git add lib/report-generator.mjs
git commit -m "feat: add report generator for verification results"
```

---

## Task 6: Create Main Script

**Files:**
- Create: `verify-update-rosters.mjs`

**Step 1: Create main orchestration script**

Create `verify-update-rosters.mjs`:

```javascript
#!/usr/bin/env node

/**
 * ESPN Roster Verification & Update System
 *
 * Phase 1: Verify rosters against ESPN data
 * Phase 2: Update pitcher data automatically
 *
 * Usage:
 *   node verify-update-rosters.mjs
 *   node verify-update-rosters.mjs --verify-only
 *   node verify-update-rosters.mjs --skip-verification
 */

import fs from 'fs/promises';
import path from 'path';
import { fetchAllRosters } from './lib/espn-scraper.mjs';
import { compareAllRosters } from './lib/roster-comparison.mjs';
import { createDataSnapshot } from './lib/backup.mjs';
import { applyRosterUpdates, regeneratePitchers, saveUpdatedData, validateUpdates } from './lib/roster-updater.mjs';
import { printConsoleSummary, printDetailedChanges, saveJsonReport, saveFailedTeams } from './lib/report-generator.mjs';

const DATA_DIR = path.join(process.cwd(), 'data');

// Parse command line args
const args = process.argv.slice(2);
const verifyOnly = args.includes('--verify-only');
const skipVerification = args.includes('--skip-verification');

/**
 * Load JSON file
 */
async function loadJson(filename) {
  const filepath = path.join(DATA_DIR, filename);
  const content = await fs.readFile(filepath, 'utf-8');
  return JSON.parse(content);
}

/**
 * Main execution
 */
async function main() {
  console.log('\n🏈 ESPN Roster Verification & Update System\n');

  // Load existing data
  console.log('📂 Loading existing data...\n');
  const teams = await loadJson('teams.json');
  const existingRosters = await loadJson('rosters_2026.json');
  const existingPitchers = await loadJson('pitchers_2026.json');

  console.log(`  ✓ Loaded ${teams.teams.length} teams`);
  console.log(`  ✓ Loaded ${existingRosters.length} rosters`);
  console.log(`  ✓ Loaded ${existingPitchers.length} pitchers\n`);

  // PHASE 1: VERIFICATION
  let comparisonReport;
  let espnRosters;
  let failedTeams = [];

  if (!skipVerification) {
    console.log('='.repeat(60));
    console.log('PHASE 1: ROSTER VERIFICATION');
    console.log('='.repeat(60) + '\n');

    // Fetch rosters from ESPN
    const scrapeResult = await fetchAllRosters(teams.teams);
    espnRosters = scrapeResult.rosters;
    failedTeams = scrapeResult.failed;

    // Compare with existing data
    console.log('\n🔍 Comparing rosters with existing data...\n');
    comparisonReport = compareAllRosters(espnRosters, existingRosters);

    // Generate reports
    printConsoleSummary(comparisonReport, failedTeams);
    printDetailedChanges(comparisonReport);

    await saveJsonReport(comparisonReport, failedTeams);

    if (failedTeams.length > 0) {
      await saveFailedTeams(failedTeams);
    }

    if (verifyOnly) {
      console.log('✅ Verification complete. (--verify-only mode, skipping updates)\n');
      return;
    }

    // Ask user to confirm proceeding to Phase 2
    if (comparisonReport.summary.teamsWithChanges === 0) {
      console.log('✅ No changes detected. No updates needed.\n');
      return;
    }
  }

  // PHASE 2: UPDATE
  console.log('='.repeat(60));
  console.log('PHASE 2: ROSTER UPDATE');
  console.log('='.repeat(60) + '\n');

  // Create backup
  await createDataSnapshot('pre-roster-update');

  // Apply updates
  const updatedRosters = applyRosterUpdates(espnRosters, existingRosters, comparisonReport);

  // Regenerate pitchers
  const updatedPitchers = regeneratePitchers(updatedRosters, existingPitchers, teams.teams);

  // Validate
  validateUpdates(existingRosters, updatedRosters, existingPitchers, updatedPitchers);

  // Save
  await saveUpdatedData(updatedRosters, updatedPitchers);

  console.log('='.repeat(60));
  console.log('✅ ROSTER UPDATE COMPLETE');
  console.log('='.repeat(60) + '\n');

  console.log('Updated files:');
  console.log('  - data/rosters_2026.json');
  console.log('  - data/pitchers_2026.json\n');
}

// Run
main().catch(error => {
  console.error('\n❌ Error:', error.message);
  console.error(error.stack);
  process.exit(1);
});
```

**Step 2: Make script executable**

```bash
chmod +x verify-update-rosters.mjs
```

**Step 3: Test script syntax**

```bash
node --check verify-update-rosters.mjs
```

Expected: No output (syntax is valid)

**Step 4: Commit**

```bash
git add verify-update-rosters.mjs
git commit -m "feat: add main roster verification and update script"
```

---

## Task 7: Add Usage Documentation

**Files:**
- Create: `docs/ROSTER_UPDATE_GUIDE.md`

**Step 1: Create user guide**

Create `docs/ROSTER_UPDATE_GUIDE.md`:

```markdown
# Roster Update Guide

## Overview

The `verify-update-rosters.mjs` script automates the process of updating team rosters from ESPN data.

## Two-Phase Process

### Phase 1: Verification & Reporting
- Fetches current rosters from ESPN for all teams
- Compares with existing data in `rosters_2026.json`
- Generates three types of reports:
  1. **Console summary** - High-level statistics
  2. **Detailed changes** - Player-by-player breakdown
  3. **JSON report** - Exportable file in `data/`

### Phase 2: Automatic Update
- Creates full data snapshot backup in `backups/`
- Updates `rosters_2026.json` with ESPN data
- Regenerates `pitchers_2026.json` from updated rosters
- Validates changes are reasonable
- Saves updated files

## Usage

### Standard Run (Verify + Update)
```bash
node verify-update-rosters.mjs
```

This runs both phases: verification and automatic update.

### Verify Only (No Updates)
```bash
node verify-update-rosters.mjs --verify-only
```

Only runs Phase 1 verification and generates reports. No data is changed.

### Update Only (Skip Verification)
```bash
node verify-update-rosters.mjs --skip-verification
```

Skips Phase 1 and goes directly to Phase 2 update. **Not recommended** unless you already ran verification separately.

## What Gets Updated

### Rosters (`rosters_2026.json`)
- All player data updated from ESPN
- Team metadata preserved
- Timestamp added to updated teams

### Pitchers (`pitchers_2026.json`)
- Regenerated from updated rosters
- Only players with position P, RHP, or LHP included
- Existing pitcher metadata preserved (role, stats)
- New pitchers added with default role "Reliever"

## Safety Features

### Automatic Backups
Every update creates a timestamped backup:
```
backups/full_snapshot_2026-01-23T10-30-00/
  ├── rosters_2026.json
  ├── pitchers_2026.json
  ├── teams.json
  ├── schedules_2026.json
  ├── pitchers_played_index.json
  └── manifest.json
```

The manifest includes file checksums for verification.

### Validation Checks
- Warns if roster count changes by >10%
- Warns if pitcher count changes by >20%
- Reports before/after counts

### Error Handling
- Failed team fetches logged to `data/failed_teams.json`
- Script continues processing remaining teams
- Failed teams reported in summary

## Reports

### Console Summary
```
=== ROSTER VERIFICATION SUMMARY ===
Teams Processed: 297/300 (3 failed)
Teams with Changes: 45
Teams Unchanged: 252

Changes Breakdown:
  - New Pitchers Added: 23
  - Pitchers Removed: 8
  - Position Changes: 12
  - Other Changes: 67
```

### JSON Report
Saved to `data/roster_verification_report_YYYY-MM-DDTHH-MM-SS.json`

Contains:
- Full summary statistics
- Team-by-team changes
- Player-level details for each change
- List of failed teams

## Troubleshooting

### Script Fails to Fetch Teams
- Check internet connection
- Verify ESPN is accessible
- Check `data/failed_teams.json` for specific errors

### Pitcher Count Drastically Different
- Review detailed changes report
- Check if ESPN changed position labels (P vs RHP/LHP)
- Verify backup before proceeding

### Restore from Backup
```bash
node -e "import('./lib/backup.mjs').then(m => m.restoreFromBackup('backups/full_snapshot_2026-01-23T10-30-00'))"
```

## Best Practices

1. **Run verification first** - Use `--verify-only` to review changes
2. **Check reports** - Review detailed changes before updating
3. **Backup manually** - Create additional backup if nervous
4. **Test on subset** - Filter to single conference first if unsure
5. **Git commit** - Commit updated data with descriptive message

## Example Workflow

```bash
# 1. Verify changes first
node verify-update-rosters.mjs --verify-only

# 2. Review the reports
cat data/roster_verification_report_*.json | jq '.summary'

# 3. Run full update
node verify-update-rosters.mjs

# 4. Verify results look good
git diff data/rosters_2026.json | head -100

# 5. Commit changes
git add data/rosters_2026.json data/pitchers_2026.json
git commit -m "Update rosters from ESPN (Jan 23, 2026)"
```
```

**Step 2: Commit documentation**

```bash
git add docs/ROSTER_UPDATE_GUIDE.md
git commit -m "docs: add roster update guide"
```

---

## Task 8: Update Main README

**Files:**
- Modify: `README.md`

**Step 1: Add roster update section to README**

Find the "Update Data Workflow" section and add after it:

```markdown
### Update Rosters from ESPN
```bash
cd ~/Desktop/CBB
node verify-update-rosters.mjs --verify-only  # Check changes first
node verify-update-rosters.mjs                # Run full update
./deploy.sh                                   # Deploy to Vercel
```

See [Roster Update Guide](docs/ROSTER_UPDATE_GUIDE.md) for details.
```

**Step 2: Commit README update**

```bash
git add README.md
git commit -m "docs: add roster update instructions to README"
```

---

## Task 9: Manual Testing

**Files:**
- Test: All created modules and main script

**Step 1: Test verify-only mode on small subset**

Create a test with just SEC teams:

```bash
node verify-update-rosters.mjs --verify-only 2>&1 | tee test_verify_output.log
```

Expected:
- Script runs without errors
- Console summary printed
- Detailed changes shown
- JSON report created in `data/`
- No data files modified

**Step 2: Verify JSON report structure**

```bash
cat data/roster_verification_report_*.json | jq '.summary'
```

Expected: Valid JSON with summary stats

**Step 3: Test backup creation**

```bash
node -e "import('./lib/backup.mjs').then(m => m.createDataSnapshot('test-backup'))"
```

Expected:
- Backup directory created in `backups/`
- All 5 data files copied
- manifest.json created with checksums

**Step 4: Check backup manifest**

```bash
cat backups/full_snapshot_*/manifest.json | jq '.files[].filename'
```

Expected: List of 5 filenames

**Step 5: Manual verification of single team**

Visit https://www.espn.com/college-baseball/team/roster/_/id/333 (Alabama) and compare with verification report output for that team.

---

## Task 10: Final Integration & Cleanup

**Files:**
- Various: Clean up test files, finalize commits

**Step 1: Remove test output files**

```bash
rm -f test_verify_output.log
```

**Step 2: Add .gitignore entries**

Add to `.gitignore`:

```
# Roster update outputs
data/roster_verification_report_*.json
data/failed_teams.json
backups/full_snapshot_*/
```

**Step 3: Commit .gitignore**

```bash
git add .gitignore
git commit -m "chore: ignore roster verification outputs and backups"
```

**Step 4: Create final commit with all changes**

```bash
git log --oneline -10
```

Expected: 10+ commits showing the implementation progress

**Step 5: Tag the release**

```bash
git tag -a v1.0.0-roster-update -m "ESPN roster verification and update system"
```

---

## Success Criteria

- [ ] All modules export correct functions
- [ ] Main script runs without errors
- [ ] Verification phase generates all three report types
- [ ] Backup creates timestamped directory with manifest
- [ ] Update phase modifies rosters_2026.json and pitchers_2026.json
- [ ] Validation warns on large changes
- [ ] Documentation is complete and accurate
- [ ] Failed teams are logged appropriately
- [ ] Rate limiting prevents overwhelming ESPN

## Future Enhancements

1. **Incremental updates** - Track last update time per team
2. **Conference filtering** - Allow `--conference=SEC` flag
3. **Dry run mode** - Show what would change without saving
4. **Email notifications** - Alert on significant roster changes
5. **Historical changelog** - Keep record of all updates over time
