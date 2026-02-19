const SUPABASE_URL = 'https://dtnozcqkuzhjmjvsfjqk.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0bm96Y3FrdXpoam1qdnNmanFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ5MDY4MzAsImV4cCI6MjA4MDQ4MjgzMH0.7puo2RCr6VMNNp_lywpAqufLEGnnE3TYqAtX8zQ0X8c';
const headers = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
};
const sleep = ms => new Promise(r => setTimeout(r, ms));
// Strip " - P " middle-name marker ESPN sometimes inserts, then normalize
const normalize = s => (s || '').toLowerCase().replace(/\s-\s[p]\s/gi, ' ').replace(/[^a-z0-9]/g, '');

async function main() {
  // Step 1: Load tracked team IDs
  const r1 = await fetch(`${SUPABASE_URL}/rest/v1/cbb_teams?select=team_id`, { headers });
  const teams = await r1.json();
  const trackedTeamIds = new Set(teams.map(t => t.team_id));
  console.log(`${trackedTeamIds.size} tracked teams`);

  // Step 2: Paginate through all participation rows
  const allParticipation = [];
  let page = 0;
  while (true) {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/cbb_pitcher_participation?select=pitcher_id,pitcher_name,team_id&offset=${page * 1000}&limit=1000`,
      { headers }
    );
    const batch = await r.json();
    if (!batch || batch.length === 0) break;
    allParticipation.push(...batch);
    process.stdout.write(`\r  Loading participation: ${allParticipation.length} rows...`);
    if (batch.length < 1000) break;
    page++;
  }
  console.log(`\n${allParticipation.length} total participation rows`);

  // Step 3: Unique ESPN pitcher IDs for tracked teams only (first occurrence wins for name/team)
  const espnPitchers = new Map(); // espnId -> { name, team_id }
  for (const row of allParticipation) {
    if (!trackedTeamIds.has(row.team_id)) continue;
    if (!espnPitchers.has(row.pitcher_id)) {
      espnPitchers.set(row.pitcher_id, { name: row.pitcher_name, team_id: row.team_id });
    }
  }
  console.log(`${espnPitchers.size} unique ESPN pitcher IDs for tracked teams`);

  // Step 4: Load all pitchers from DB for name matching
  const allPitchers = [];
  page = 0;
  while (true) {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/cbb_pitchers?select=pitcher_id,team_id,name&offset=${page * 1000}&limit=1000`,
      { headers }
    );
    const batch = await r.json();
    if (!batch || batch.length === 0) break;
    allPitchers.push(...batch);
    if (batch.length < 1000) break;
    page++;
  }
  console.log(`${allPitchers.length} pitchers in DB`);

  // Lookup: "team_id:normalizedName" -> pitcher_id
  const pitcherLookup = new Map();
  for (const p of allPitchers) {
    const key = `${p.team_id}:${normalize(p.name)}`;
    pitcherLookup.set(key, p.pitcher_id);
  }

  // Step 5: Fetch ESPN athlete profiles
  const updates = [];
  let fetched = 0, matched = 0, errors = 0;
  const entries = [...espnPitchers.entries()];

  for (let i = 0; i < entries.length; i++) {
    const [espnId, { name, team_id }] = entries[i];
    await sleep(150);

    try {
      const resp = await fetch(
        `https://sports.core.api.espn.com/v2/sports/baseball/leagues/college-baseball/athletes/${espnId}`
      );
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      fetched++;

      const key = `${team_id}:${normalize(name)}`;
      const pitcherId = pitcherLookup.get(key);
      if (!pitcherId) {
        process.stdout.write(`\r[${i + 1}/${entries.length}] fetched:${fetched} matched:${matched} errors:${errors} (no match: ${name})`);
        continue;
      }

      matched++;
      const hometown = data.birthPlace?.city
        ? data.birthPlace.city +
          (data.birthPlace.state ? ', ' + data.birthPlace.state : '') +
          (data.birthPlace.country && data.birthPlace.country !== 'United States' ? ', ' + data.birthPlace.country : '')
        : null;
      const batsThrows = data.bats?.abbreviation && data.throws?.abbreviation
        ? `${data.bats.abbreviation}/${data.throws.abbreviation}`
        : null;

      updates.push({
        pitcher_id: pitcherId,
        height: data.displayHeight || null,
        weight: data.displayWeight || null,
        hometown,
        bats_throws: batsThrows,
      });

      process.stdout.write(`\r[${i + 1}/${entries.length}] fetched:${fetched} matched:${matched} errors:${errors}`);
    } catch (e) {
      errors++;
      process.stdout.write(`\r[${i + 1}/${entries.length}] fetched:${fetched} matched:${matched} errors:${errors}`);
    }
  }

  console.log(`\n\nFetched ${fetched}, matched ${matched}. Patching DB...`);

  // Step 6: PATCH each pitcher individually (avoids NOT NULL constraint on name from upsert)
  let updated = 0, patchErrors = 0;
  for (let i = 0; i < updates.length; i++) {
    const u = updates[i];
    await sleep(50);
    const resp = await fetch(
      `${SUPABASE_URL}/rest/v1/cbb_pitchers?pitcher_id=eq.${encodeURIComponent(u.pitcher_id)}`,
      {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          height: u.height,
          weight: u.weight,
          hometown: u.hometown,
          bats_throws: u.bats_throws,
        }),
      }
    );
    if (resp.ok) {
      updated++;
    } else {
      patchErrors++;
      const text = await resp.text();
      console.error(`\nPATCH error for ${u.pitcher_id}: ${text}`);
    }
    if ((i + 1) % 25 === 0 || i === updates.length - 1) {
      process.stdout.write(`\r  Updated ${updated}/${updates.length} (${patchErrors} errors)`);
    }
  }

  console.log(`\n\nDone!`);
  console.log(`  ESPN profiles fetched: ${fetched}`);
  console.log(`  Matched to DB pitchers: ${matched}`);
  console.log(`  DB rows updated: ${updated}`);
  console.log(`  Errors: ${errors + patchErrors}`);
}

main().catch(console.error);
