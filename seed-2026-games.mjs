// Seed cbb_games with 2026 season games for tracked teams
// Then check ESPN for completion status on past games

import { readFileSync } from 'fs';

const SUPABASE_URL = 'https://dtnozcqkuzhjmjvsfjqk.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0bm96Y3FrdXpoam1qdnNmanFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ5MDY4MzAsImV4cCI6MjA4MDQ4MjgzMH0.7puo2RCr6VMNNp_lywpAqufLEGnnE3TYqAtX8zQ0X8c';
const THROTTLE_MS = 300;
const sleep = ms => new Promise(r => setTimeout(r, ms));

const headers = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'resolution=merge-duplicates,return=minimal'
};

// Load data
const schedule = JSON.parse(readFileSync('./data/schedule.json', 'utf8'));
const pitchers = JSON.parse(readFileSync('./data/pitchers.json', 'utf8'));

const trackedIds = new Set(
  (pitchers.teams || []).map(t => String(t.teamId || t.team_id || '')).filter(Boolean)
);

const allGames = schedule.games || schedule;
const now = new Date();

// Filter to games involving tracked teams
const trackedGames = allGames.filter(g => {
  const home = String(g.home_team_id || g.home || '');
  const away = String(g.away_team_id || g.away || '');
  return trackedIds.has(home) || trackedIds.has(away);
});

console.log(`Total games: ${allGames.length}, tracked team games: ${trackedGames.length}`);

// Check ESPN for completion status
async function checkCompleted(gameId) {
  try {
    const resp = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/baseball/college-baseball/summary?event=${gameId}`
    );
    if (!resp.ok) return false;
    const data = await resp.json();
    return data?.header?.competitions?.[0]?.status?.type?.completed === true;
  } catch {
    return false;
  }
}

// Only process past games (date < now)
const pastGames = trackedGames.filter(g => new Date(g.date) < now);
const futureGames = trackedGames.filter(g => new Date(g.date) >= now);

console.log(`Past games: ${pastGames.length}, future games: ${futureGames.length}`);

// First, insert all tracked games as not completed
console.log('\n--- Inserting all tracked games into cbb_games ---');
const allRecords = trackedGames.map(g => ({
  game_id: String(g.id || g.espn_game_id || ''),
  week: g.week || 1,
  home_team_id: String(g.home_team_id || g.home || ''),
  away_team_id: String(g.away_team_id || g.away || ''),
  date: g.date,
  completed: false,
  status: g.status || 'scheduled'
})).filter(r => r.game_id);

// Insert in batches of 100
let inserted = 0;
for (let i = 0; i < allRecords.length; i += 100) {
  const batch = allRecords.slice(i, i + 100);
  const resp = await fetch(
    `${SUPABASE_URL}/rest/v1/cbb_games?on_conflict=game_id`,
    { method: 'POST', headers, body: JSON.stringify(batch) }
  );
  if (!resp.ok) {
    const err = await resp.text();
    console.error(`Insert batch failed:`, err.slice(0, 200));
  } else {
    inserted += batch.length;
    process.stdout.write(`\rInserted ${inserted}/${allRecords.length}`);
  }
}
console.log(`\n✓ Inserted/updated ${inserted} games`);

// Now check ESPN for past games and mark completed
console.log('\n--- Checking ESPN status for past games ---');
let completed = 0, failed = 0;

for (const game of pastGames) {
  const gameId = String(game.id || game.espn_game_id || '');
  if (!gameId) continue;

  await sleep(THROTTLE_MS);
  const isComplete = await checkCompleted(gameId);

  if (isComplete) {
    const resp = await fetch(
      `${SUPABASE_URL}/rest/v1/cbb_games?game_id=eq.${gameId}`,
      { method: 'PATCH', headers, body: JSON.stringify({ completed: true, status: 'final' }) }
    );
    if (resp.ok) {
      completed++;
      process.stdout.write(`\r✓ ${completed} completed, ${failed} failed (${gameId})`);
    } else {
      failed++;
    }
  }
}

console.log(`\n✓ Marked ${completed} games as completed (${failed} failed)`);
console.log('\nDone! Now trigger the cron job to scrape participation data.');
console.log('Run: curl https://cbb-pitcher-tracker.vercel.app/api/update');
