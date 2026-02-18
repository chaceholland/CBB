#!/usr/bin/env node
/**
 * Backfill innings_list into existing cbb_pitcher_participation rows.
 *
 * For each completed game that already has participation rows but no
 * innings_list in their stats JSONB, this script fetches the ESPN boxscore,
 * extracts which innings each pitcher appeared in, and patches the row.
 *
 * Usage:
 *   node scripts/backfill-innings.mjs
 *   node scripts/backfill-innings.mjs --week=3        # only week 3
 *   node scripts/backfill-innings.mjs --dry-run        # preview without writing
 */

import https from 'https';

const SUPABASE_URL = 'https://dtnozcqkuzhjmjvsfjqk.supabase.co';
// Service role key preferred; falls back to anon key (write policy allows it)
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY
  || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0bm96Y3FrdXpoam1qdnNmanFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ5MDY4MzAsImV4cCI6MjA4MDQ4MjgzMH0.7puo2RCr6VMNNp_lywpAqufLEGnnE3TYqAtX8zQ0X8c';

const THROTTLE_MS = 350;
const PAGE_SIZE   = 1000;
const DRY_RUN     = process.argv.includes('--dry-run');
const WEEK_ARG    = process.argv.find(a => a.startsWith('--week='));
const FILTER_WEEK = WEEK_ARG ? parseInt(WEEK_ARG.split('=')[1]) : null;

const sleep = ms => new Promise(r => setTimeout(r, ms));

const supaHeaders = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'resolution=merge-duplicates,return=minimal'
};

// ── Helpers ────────────────────────────────────────────────────────────────

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      let buf = '';
      res.on('data', c => buf += c);
      res.on('end', () => {
        try { resolve(JSON.parse(buf)); }
        catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

async function supaGet(path) {
  const { default: nodeFetch } = await import('node-fetch').catch(() => ({ default: fetch }));
  const fn = typeof fetch !== 'undefined' ? fetch : nodeFetch;
  const resp = await fn(`${SUPABASE_URL}/rest/v1/${path}`, { headers: supaHeaders });
  if (!resp.ok) throw new Error(`GET ${path} → ${resp.status}: ${await resp.text()}`);
  return resp.json();
}

async function supaPatch(path, body) {
  const { default: nodeFetch } = await import('node-fetch').catch(() => ({ default: fetch }));
  const fn = typeof fetch !== 'undefined' ? fetch : nodeFetch;
  const resp = await fn(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: 'PATCH',
    headers: supaHeaders,
    body: JSON.stringify(body)
  });
  if (!resp.ok) throw new Error(`PATCH ${path} → ${resp.status}: ${await resp.text()}`);
}

// ── Innings extraction (same logic as api/update.js) ───────────────────────

function extractInningsList(data, pitcherId) {
  const innings = new Set();
  try {
    data?.plays?.forEach(play => {
      if (play.period && play.participants) {
        play.participants.forEach(p => {
          if (String(p.athlete?.id) === String(pitcherId)) innings.add(play.period);
        });
      }
    });
    data?.header?.competitions?.[0]?.details?.forEach(detail => {
      if (detail.inning) {
        detail.athletesInvolved?.forEach(a => {
          if (String(a.id) === String(pitcherId)) innings.add(detail.inning);
        });
      }
    });
  } catch (e) { /* best-effort */ }
  return Array.from(innings).sort((a, b) => a - b);
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('⚾  CBB Innings Backfill');
  console.log('========================');
  if (DRY_RUN) console.log('  DRY RUN — no writes will be made\n');
  if (FILTER_WEEK) console.log(`  Filtering to week ${FILTER_WEEK}\n`);

  // 1. Fetch all participation rows that don't already have innings_list
  console.log('Fetching participation rows without innings_list...');
  let allRows = [];
  let offset = 0;
  while (true) {
    const rows = await supaGet(
      `cbb_pitcher_participation?select=game_id,pitcher_id,stats&order=game_id.asc&limit=${PAGE_SIZE}&offset=${offset}`
    );
    if (!rows.length) break;
    allRows = allRows.concat(rows);
    if (rows.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  const needsUpdate = allRows.filter(r => {
    const s = r.stats || {};
    return !s.innings_list || !Array.isArray(s.innings_list) || s.innings_list.length === 0;
  });

  console.log(`  Total rows: ${allRows.length}`);
  console.log(`  Rows needing innings backfill: ${needsUpdate.length}\n`);

  if (!needsUpdate.length) {
    console.log('✅ All rows already have innings_list — nothing to do.');
    return;
  }

  // 2. Group by game_id so we only fetch each ESPN boxscore once
  const byGame = {};
  for (const row of needsUpdate) {
    if (!byGame[row.game_id]) byGame[row.game_id] = [];
    byGame[row.game_id].push(row);
  }

  // Optionally filter by week using cbb_games
  let gameIds = Object.keys(byGame);
  if (FILTER_WEEK) {
    const gameRows = await supaGet(
      `cbb_games?week=eq.${FILTER_WEEK}&select=game_id`
    );
    const weekSet = new Set(gameRows.map(g => String(g.game_id)));
    gameIds = gameIds.filter(id => weekSet.has(String(id)));
    console.log(`  Games in week ${FILTER_WEEK} needing update: ${gameIds.length}\n`);
  }

  let updatedRows = 0, updatedGames = 0, errorCount = 0, noInningsCount = 0;
  const total = gameIds.length;

  for (let i = 0; i < gameIds.length; i++) {
    const gameId = gameIds[i];
    process.stdout.write(`\r  [${i + 1}/${total}] game ${gameId}...`);

    try {
      const url = `https://site.api.espn.com/apis/site/v2/sports/baseball/college-baseball/summary?event=${gameId}`;
      const data = await fetchJSON(url);

      const pitcherRows = byGame[gameId];
      let gameUpdated = false;

      for (const row of pitcherRows) {
        const inningsList = extractInningsList(data, row.pitcher_id);

        if (inningsList.length === 0) {
          noInningsCount++;
          continue; // ESPN doesn't have play-by-play for this game
        }

        if (!DRY_RUN) {
          const newStats = { ...(row.stats || {}), innings_list: inningsList };
          await supaPatch(
            `cbb_pitcher_participation?game_id=eq.${gameId}&pitcher_id=eq.${row.pitcher_id}`,
            { stats: newStats }
          );
        }

        updatedRows++;
        gameUpdated = true;
      }

      if (gameUpdated) updatedGames++;
      await sleep(THROTTLE_MS);

    } catch (e) {
      errorCount++;
      if (errorCount <= 5) {
        process.stdout.write(`\n  ⚠️  game ${gameId}: ${e.message}\n`);
      }
    }
  }

  console.log('\n\n📊 Summary:');
  console.log(`  Games processed : ${total}`);
  console.log(`  Rows updated    : ${updatedRows}${DRY_RUN ? ' (dry run)' : ''}`);
  console.log(`  Games updated   : ${updatedGames}${DRY_RUN ? ' (dry run)' : ''}`);
  console.log(`  No play-by-play : ${noInningsCount} pitchers`);
  console.log(`  Errors          : ${errorCount}`);

  if (!DRY_RUN && updatedRows > 0) {
    console.log('\n✅ Done! Clear the browser localStorage cache to see updated innings.');
    console.log('   (Open DevTools → Application → Storage → Clear site data, or just wait 2 hours for the cache to expire)');
  }
}

main().catch(e => { console.error('\nFatal:', e); process.exit(1); });
