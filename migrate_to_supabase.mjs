// Migration script to load existing CBB data into Supabase
// Run with: node migrate_to_supabase.mjs

const SUPABASE_URL = 'https://dtnozcqkuzhjmjvsfjqk.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0bm96Y3FrdXpoam1qdnNmanFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ5MDY4MzAsImV4cCI6MjA4MDQ4MjgzMH0.7puo2RCr6VMNNp_lywpAqufLEGnnE3TYqAtX8zQ0X8c';

import fs from 'fs';
import path from 'path';

const dataDir = './data';

async function supabaseRequest(endpoint, method, body = null) {
  const opts = {
    method,
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    }
  };
  if (body) opts.body = JSON.stringify(body);
  
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/${endpoint}`, opts);
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Supabase error: ${resp.status} ${text}`);
  }
  return resp;
}

async function migrate() {
  console.log('=== CBB Supabase Migration ===\n');

  // 1. Load local data
  console.log('Loading local data...');
  
  let favorites = { pitchers: [], teams: [], games: [] };
  let watchPriority = {};
  let watchHistory = [];
  
  try {
    favorites = JSON.parse(fs.readFileSync(path.join(dataDir, 'favorites.json'), 'utf-8'));
  } catch(e) { console.log('  No favorites.json found'); }
  
  try {
    watchPriority = JSON.parse(fs.readFileSync(path.join(dataDir, 'watch_priority.json'), 'utf-8'));
  } catch(e) { console.log('  No watch_priority.json found'); }
  
  try {
    watchHistory = JSON.parse(fs.readFileSync(path.join(dataDir, 'watch_history.json'), 'utf-8'));
    if (!Array.isArray(watchHistory)) watchHistory = [];
  } catch(e) { console.log('  No watch_history.json found'); }
  
  console.log(`  Favorites: ${favorites.teams?.length || 0} teams, ${favorites.pitchers?.length || 0} pitchers, ${favorites.games?.length || 0} games`);
  console.log(`  Watch Priorities: ${Object.keys(watchPriority).length} games`);
  console.log(`  Watch History: ${watchHistory.length} games\n`);

  // 2. Migrate favorites (CBB uses unified favorites table with tracker='cbb')
  console.log('Migrating favorites to Supabase...');
  
  // Build unified row for cbb_unified_favorites table
  const favBody = {
    tracker: 'cbb',
    user_id: 'default',
    pitchers: favorites.pitchers || [],
    teams: favorites.teams || [],
    games: favorites.games || []
  };
  
  try {
    await supabaseRequest('cbb_unified_favorites?on_conflict=tracker,user_id', 'POST', favBody);
    console.log('  ✅ Favorites migrated');
  } catch(e) {
    console.log('  ⚠️ Favorites migration failed:', e.message);
  }

  // 3. Migrate watch priorities
  console.log('\nMigrating watch priorities...');
  const LEVELS = ['Priority', 'High', 'Medium', 'Low'];
  
  const prioBody = {
    tracker: 'cbb',
    user_id: 'default',
    priorities: watchPriority
  };
  
  try {
    await supabaseRequest('cbb_unified_priorities?on_conflict=tracker,user_id', 'POST', prioBody);
    console.log('  ✅ Priorities migrated');
  } catch(e) {
    console.log('  ⚠️ Priorities migration failed:', e.message);
  }

  // 4. Migrate watch history
  console.log('\nMigrating watch history...');
  
  const historyBody = {
    tracker: 'cbb',
    user_id: 'default',
    games: watchHistory
  };
  
  try {
    await supabaseRequest('cbb_unified_history?on_conflict=tracker,user_id', 'POST', historyBody);
    console.log('  ✅ Watch history migrated');
  } catch(e) {
    console.log('  ⚠️ Watch history migration failed:', e.message);
  }

  console.log('\n✅ Migration complete!');
  console.log('   Your data is now stored in Supabase cloud.');
  console.log('   The live site at cbb-pitcher-tracker.vercel.app will use this data.');
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
