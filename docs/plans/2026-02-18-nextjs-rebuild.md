# CBB Pitcher Tracker — Next.js Rebuild Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rebuild the CBB Pitcher Tracker as a Next.js 15/React/Tailwind SPA that visually matches the NCAA D1 Swimming & Diving Tracker, with all data served from Supabase.

**Architecture:** Single-page app with hash-based tab switching (Schedule default, Rosters). Phase 1 migrates all local data (pitchers, teams, headshots) into Supabase. Phase 2 builds the Next.js app in `~/Desktop/CBB-Next` mirroring the swim tracker component architecture exactly.

**Tech Stack:** Next.js 15, React 19, Tailwind CSS v4, Framer Motion, `@supabase/supabase-js`, clsx, tailwind-merge

---

## Reference Files

- Design doc: `/Users/chace/Desktop/CBB/docs/plans/2026-02-18-nextjs-rebuild-design.md`
- Swim tracker to mirror: `~/Desktop/ncaa-swim-dive-tracker/`
- Source data: `/Users/chace/Desktop/CBB/data/pitchers.json` (64 teams, 1341 pitchers)
- Headshots: `/Users/chace/Desktop/CBB/data/headshots/` (1830 .jpg files)
- Supabase URL: `https://dtnozcqkuzhjmjvsfjqk.supabase.co`
- Supabase anon key: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0bm96Y3FrdXpoam1qdnNmanFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ5MDY4MzAsImV4cCI6MjA4MDQ4MjgzMH0.7puo2RCr6VMNNp_lywpAqufLEGnnE3TYqAtX8zQ0X8c`

---

## PHASE 1: Supabase Data Migration

### Task 1: Add Missing Columns to `cbb_pitchers`

**Context:** `cbb_pitchers` exists but only has `pitcher_id, team_id, name, display_name, number, headshot, espn_link, updated_at`. We need `position`, `year`, `height`, `weight`, `hometown`, `bats_throws`.

**Files:**
- Create: `/Users/chace/Desktop/CBB/scripts/migrate-add-columns.mjs`

**Step 1: Write the migration script**

```js
// /Users/chace/Desktop/CBB/scripts/migrate-add-columns.mjs
const URL = 'https://dtnozcqkuzhjmjvsfjqk.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SERVICE_KEY) {
  console.error('Set SUPABASE_SERVICE_KEY env var (service_role key from Supabase dashboard)');
  process.exit(1);
}

const h = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
};

// Use PostgREST RPC or direct SQL via management API
// These columns don't exist yet — add via Supabase dashboard SQL editor instead
console.log(`
Run this SQL in the Supabase dashboard (SQL editor):

ALTER TABLE cbb_pitchers
  ADD COLUMN IF NOT EXISTS position TEXT,
  ADD COLUMN IF NOT EXISTS year TEXT,
  ADD COLUMN IF NOT EXISTS height TEXT,
  ADD COLUMN IF NOT EXISTS weight TEXT,
  ADD COLUMN IF NOT EXISTS hometown TEXT,
  ADD COLUMN IF NOT EXISTS bats_throws TEXT;

ALTER TABLE cbb_teams
  ADD COLUMN IF NOT EXISTS logo TEXT,
  ADD COLUMN IF NOT EXISTS slug TEXT,
  ADD COLUMN IF NOT EXISTS abbreviation TEXT;
`);
```

**Step 2: Run it to get the SQL**

```bash
node /Users/chace/Desktop/CBB/scripts/migrate-add-columns.mjs
```

**Step 3: Execute the SQL in Supabase Dashboard**

Go to https://supabase.com/dashboard/project/dtnozcqkuzhjmjvsfjqk/sql/new and run:

```sql
ALTER TABLE cbb_pitchers
  ADD COLUMN IF NOT EXISTS position TEXT,
  ADD COLUMN IF NOT EXISTS year TEXT,
  ADD COLUMN IF NOT EXISTS height TEXT,
  ADD COLUMN IF NOT EXISTS weight TEXT,
  ADD COLUMN IF NOT EXISTS hometown TEXT,
  ADD COLUMN IF NOT EXISTS bats_throws TEXT;

ALTER TABLE cbb_teams
  ADD COLUMN IF NOT EXISTS logo TEXT,
  ADD COLUMN IF NOT EXISTS slug TEXT,
  ADD COLUMN IF NOT EXISTS abbreviation TEXT;
```

**Step 4: Verify columns exist**

```bash
node --input-type=module << 'EOF'
const URL = 'https://dtnozcqkuzhjmjvsfjqk.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0bm96Y3FrdXpoam1qdnNmanFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ5MDY4MzAsImV4cCI6MjA4MDQ4MjgzMH0.7puo2RCr6VMNNp_lywpAqufLEGnnE3TYqAtX8zQ0X8c';
const r = await fetch(`${URL}/rest/v1/`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } });
const spec = await r.json();
console.log('cbb_pitchers cols:', Object.keys(spec.definitions.cbb_pitchers?.properties || {}));
console.log('cbb_teams cols:', Object.keys(spec.definitions.cbb_teams?.properties || {}));
EOF
```

Expected: `cbb_pitchers` includes `position`, `year`, `height`, `weight`, `hometown`, `bats_throws`. `cbb_teams` includes `logo`, `slug`, `abbreviation`.

**Step 5: Commit**

```bash
git add scripts/migrate-add-columns.mjs
git commit -m "chore: add column migration script for cbb_pitchers and cbb_teams"
```

---

### Task 2: Populate `cbb_teams` from pitchers.json

**Files:**
- Create: `/Users/chace/Desktop/CBB/scripts/migrate-teams.mjs`

**Step 1: Write the script**

```js
// /Users/chace/Desktop/CBB/scripts/migrate-teams.mjs
import { readFileSync } from 'fs';

const SUPABASE_URL = 'https://dtnozcqkuzhjmjvsfjqk.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0bm96Y3FrdXpoam1qdnNmanFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ5MDY4MzAsImV4cCI6MjA4MDQ4MjgzMH0.7puo2RCr6VMNNp_lywpAqufLEGnnE3TYqAtX8zQ0X8c';

const h = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=minimal,resolution=merge-duplicates',
};

const data = JSON.parse(readFileSync('/Users/chace/Desktop/CBB/data/pitchers.json', 'utf8'));
const teams = data.teams;

const rows = teams.map(t => ({
  team_id: String(t.teamId || t.team_id),
  name: t.team,
  display_name: t.team,
  conference: t.conference || '',
  logo: t.logo || '',
  slug: t.slug || '',
  abbreviation: t.teamAbbrev || t.abbrev || '',
}));

console.log(`Upserting ${rows.length} teams...`);

const res = await fetch(`${SUPABASE_URL}/rest/v1/cbb_teams?on_conflict=team_id`, {
  method: 'POST',
  headers: h,
  body: JSON.stringify(rows),
});

if (!res.ok) {
  const err = await res.text();
  console.error('Error:', res.status, err);
  process.exit(1);
}

console.log(`✅ ${rows.length} teams upserted`);

// Verify
const check = await fetch(`${SUPABASE_URL}/rest/v1/cbb_teams?select=count`, {
  headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Prefer': 'count=exact' },
});
console.log('Teams in DB:', check.headers.get('content-range'));
```

**Step 2: Run it**

```bash
node /Users/chace/Desktop/CBB/scripts/migrate-teams.mjs
```

Expected output: `✅ 64 teams upserted`

**Step 3: Commit**

```bash
git add scripts/migrate-teams.mjs
git commit -m "chore: add team migration script, populate cbb_teams"
```

---

### Task 3: Populate `cbb_pitchers` from pitchers.json

**Files:**
- Create: `/Users/chace/Desktop/CBB/scripts/migrate-pitchers.mjs`

**Step 1: Write the script**

```js
// /Users/chace/Desktop/CBB/scripts/migrate-pitchers.mjs
import { readFileSync } from 'fs';

const SUPABASE_URL = 'https://dtnozcqkuzhjmjvsfjqk.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0bm96Y3FrdXpoam1qdnNmanFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ5MDY4MzAsImV4cCI6MjA4MDQ4MjgzMH0.7puo2RCr6VMNNp_lywpAqufLEGnnE3TYqAtX8zQ0X8c';

const h = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=minimal,resolution=merge-duplicates',
};

const data = JSON.parse(readFileSync('/Users/chace/Desktop/CBB/data/pitchers.json', 'utf8'));
const teams = data.teams;

// Flatten all pitchers across teams
const rows = [];
for (const team of teams) {
  const teamId = String(team.teamId || team.team_id);
  for (const p of (team.pitchers || [])) {
    rows.push({
      pitcher_id: String(p.id),
      team_id: teamId,
      name: p.name,
      display_name: p.name,
      number: p.number || '',
      position: p.position || '',
      year: p.year || '',
      height: p.height || '',
      weight: p.weight || '',
      hometown: p.hometown || '',
      bats_throws: p.batsThrows || '',
      // headshot: set in task 5 after upload
      headshot: p.headshot?.startsWith('http') ? p.headshot : null,
    });
  }
}

console.log(`Upserting ${rows.length} pitchers in batches...`);

// Upsert in batches of 200
const BATCH = 200;
for (let i = 0; i < rows.length; i += BATCH) {
  const batch = rows.slice(i, i + BATCH);
  const res = await fetch(`${SUPABASE_URL}/rest/v1/cbb_pitchers?on_conflict=pitcher_id`, {
    method: 'POST',
    headers: h,
    body: JSON.stringify(batch),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error(`Error at batch ${i}:`, res.status, err);
    process.exit(1);
  }
  console.log(`  ✅ Batch ${i}–${i + batch.length}`);
}

console.log(`✅ ${rows.length} pitchers upserted`);
```

**Step 2: Run it**

```bash
node /Users/chace/Desktop/CBB/scripts/migrate-pitchers.mjs
```

Expected output: `✅ 1341 pitchers upserted`

**Step 3: Commit**

```bash
git add scripts/migrate-pitchers.mjs
git commit -m "chore: add pitcher migration script, populate cbb_pitchers"
```

---

### Task 4: Create Supabase Storage Bucket for Headshots

**Step 1: Create bucket in Supabase Dashboard**

Go to https://supabase.com/dashboard/project/dtnozcqkuzhjmjvsfjqk/storage/buckets and:
- Click "New bucket"
- Name: `cbb-headshots`
- Public: **ON** (so images are publicly accessible via URL)
- Click "Create"

**Step 2: Verify public URL format**

The public URL pattern will be:
`https://dtnozcqkuzhjmjvsfjqk.supabase.co/storage/v1/object/public/cbb-headshots/<filename>`

---

### Task 5: Upload Headshots to Supabase Storage

**Files:**
- Create: `/Users/chace/Desktop/CBB/scripts/migrate-headshots.mjs`

**Step 1: Write the upload script**

```js
// /Users/chace/Desktop/CBB/scripts/migrate-headshots.mjs
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const SUPABASE_URL = 'https://dtnozcqkuzhjmjvsfjqk.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SERVICE_KEY) {
  console.error('Set SUPABASE_SERVICE_KEY (service_role key from Supabase Settings > API)');
  process.exit(1);
}

const HEADSHOTS_DIR = '/Users/chace/Desktop/CBB/data/headshots';
const BUCKET = 'cbb-headshots';

const files = readdirSync(HEADSHOTS_DIR).filter(f => f.endsWith('.jpg') || f.endsWith('.png'));
console.log(`Uploading ${files.length} headshots...`);

let uploaded = 0, skipped = 0, failed = 0;

for (const file of files) {
  const filePath = join(HEADSHOTS_DIR, file);
  const fileData = readFileSync(filePath);

  const res = await fetch(
    `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${file}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'image/jpeg',
        'x-upsert': 'true',
      },
      body: fileData,
    }
  );

  if (res.ok) {
    uploaded++;
  } else if (res.status === 409) {
    skipped++; // Already exists
  } else {
    const err = await res.text();
    console.error(`Failed: ${file}`, res.status, err);
    failed++;
  }

  if ((uploaded + skipped + failed) % 100 === 0) {
    console.log(`  Progress: ${uploaded + skipped + failed}/${files.length}`);
  }
}

console.log(`✅ Done: ${uploaded} uploaded, ${skipped} skipped, ${failed} failed`);
```

**Step 2: Get service role key**

Go to https://supabase.com/dashboard/project/dtnozcqkuzhjmjvsfjqk/settings/api and copy the `service_role` key (NOT the anon key).

**Step 3: Run the upload**

```bash
SUPABASE_SERVICE_KEY=<your-service-role-key> node /Users/chace/Desktop/CBB/scripts/migrate-headshots.mjs
```

This will take a few minutes for 1,830 files. Expected: `✅ Done: 1830 uploaded, 0 skipped, 0 failed`

**Step 4: Commit**

```bash
git add scripts/migrate-headshots.mjs
git commit -m "chore: add headshot upload script to Supabase Storage"
```

---

### Task 6: Update Headshot URLs in `cbb_pitchers`

**Files:**
- Create: `/Users/chace/Desktop/CBB/scripts/migrate-headshot-urls.mjs`

**Step 1: Write the URL update script**

```js
// /Users/chace/Desktop/CBB/scripts/migrate-headshot-urls.mjs
import { readFileSync } from 'fs';

const SUPABASE_URL = 'https://dtnozcqkuzhjmjvsfjqk.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0bm96Y3FrdXpoam1qdnNmanFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ5MDY4MzAsImV4cCI6MjA4MDQ4MjgzMH0.7puo2RCr6VMNNp_lywpAqufLEGnnE3TYqAtX8zQ0X8c';
const BUCKET_BASE = `${SUPABASE_URL}/storage/v1/object/public/cbb-headshots`;

const h = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=minimal',
};

const data = JSON.parse(readFileSync('/Users/chace/Desktop/CBB/data/pitchers.json', 'utf8'));
const teams = data.teams;

let updated = 0, skipped = 0;

for (const team of teams) {
  for (const p of (team.pitchers || [])) {
    if (!p.headshot || p.headshot.startsWith('http')) {
      skipped++;
      continue; // remote URL already set, or no headshot
    }

    // Local path like: data/headshots/auburn_2-2-P1.jpg
    const filename = p.headshot.replace('data/headshots/', '');
    const newUrl = `${BUCKET_BASE}/${filename}`;

    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/cbb_pitchers?pitcher_id=eq.${encodeURIComponent(p.id)}`,
      {
        method: 'PATCH',
        headers: h,
        body: JSON.stringify({ headshot: newUrl }),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      console.error(`Failed to update ${p.id}:`, err);
    } else {
      updated++;
    }
  }
}

console.log(`✅ Updated ${updated} headshot URLs, skipped ${skipped}`);
```

**Step 2: Run it**

```bash
node /Users/chace/Desktop/CBB/scripts/migrate-headshot-urls.mjs
```

Expected: `✅ Updated 1128 headshot URLs, skipped 213`

**Step 3: Verify a random pitcher has the correct URL**

```bash
node --input-type=module << 'EOF'
const URL = 'https://dtnozcqkuzhjmjvsfjqk.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0bm96Y3FrdXpoam1qdnNmanFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ5MDY4MzAsImV4cCI6MjA4MDQ4MjgzMH0.7puo2RCr6VMNNp_lywpAqufLEGnnE3TYqAtX8zQ0X8c';
const r = await fetch(`${URL}/rest/v1/cbb_pitchers?limit=3&headshot=not.is.null`, {
  headers: { apikey: KEY, Authorization: `Bearer ${KEY}` }
});
const d = await r.json();
d.forEach(p => console.log(p.name, p.headshot));
EOF
```

**Step 4: Commit**

```bash
git add scripts/migrate-headshot-urls.mjs
git commit -m "chore: update cbb_pitchers headshot URLs to Supabase Storage"
```

---

## PHASE 2: Next.js App

### Task 7: Scaffold Next.js Project

**Step 1: Create the project**

```bash
cd ~/Desktop
npx create-next-app@latest CBB-Next \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --no-src-dir \
  --import-alias "@/*"
cd ~/Desktop/CBB-Next
```

**Step 2: Install dependencies (exact versions matching swim tracker)**

```bash
npm install framer-motion @supabase/supabase-js clsx tailwind-merge react-intersection-observer
npm install -D tsx
```

**Step 3: Verify dev server starts**

```bash
npm run dev
```

Open http://localhost:3000 — should see default Next.js page.

**Step 4: Initialize git + first commit**

```bash
git init
git add .
git commit -m "feat: scaffold Next.js CBB tracker app"
```

---

### Task 8: Configure Environment, Tailwind, and next.config.ts

**Files:**
- Create: `~/Desktop/CBB-Next/.env.local`
- Modify: `~/Desktop/CBB-Next/next.config.ts`
- Modify: `~/Desktop/CBB-Next/app/globals.css`

**Step 1: Create `.env.local`**

```
NEXT_PUBLIC_SUPABASE_URL=https://dtnozcqkuzhjmjvsfjqk.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0bm96Y3FrdXpoam1qdnNmanFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ5MDY4MzAsImV4cCI6MjA4MDQ4MjgzMH0.7puo2RCr6VMNNp_lywpAqufLEGnnE3TYqAtX8zQ0X8c
```

**Step 2: Write `next.config.ts`**

```ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'dtnozcqkuzhjmjvsfjqk.supabase.co' },
      { protocol: 'https', hostname: 'a.espncdn.com' },
      { protocol: 'https', hostname: 'images.sidearmdev.com' },
      { protocol: 'https', hostname: '**.edu' },
      { protocol: 'https', hostname: 'd1baseball.com' },
    ],
  },
};

export default nextConfig;
```

**Step 3: Write `app/globals.css`** (exact match to swim tracker)

```css
@import "tailwindcss";

:root {
  --background: #0a0a0a;
  --foreground: #ffffff;
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-primary: #1a73e8;
  --color-secondary: #ea4335;
  --color-accent: #fbbc04;
  --color-navy-900: #0d1b2a;
  --color-navy-800: #1b263b;
  --color-navy-700: #415a77;
  --color-slate-800: #1e293b;
  --color-slate-700: #334155;
  --color-slate-600: #475569;
  --color-gold-400: #fbbf24;
  --animate-gradient: gradient 8s ease infinite;
  --animate-fade-in: fadeIn 0.5s ease-in;
  --animate-slide-up: slideUp 0.6s ease-out;
}

@keyframes gradient {
  0%, 100% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideUp {
  from { opacity: 0; transform: translateY(30px); }
  to { opacity: 1; transform: translateY(0); }
}

html { scroll-behavior: smooth; }

body {
  background: var(--background);
  color: var(--foreground);
  -webkit-font-smoothing: antialiased;
}

::-webkit-scrollbar { width: 8px; }
::-webkit-scrollbar-track { background: #0d1b2a; }
::-webkit-scrollbar-thumb { background: #475569; border-radius: 4px; }
::-webkit-scrollbar-thumb:hover { background: #334155; }
```

**Step 4: Commit**

```bash
git add .
git commit -m "feat: configure tailwind, globals.css, next.config image domains"
```

---

### Task 9: Set Up Supabase Client and TypeScript Types

**Files:**
- Create: `~/Desktop/CBB-Next/lib/supabase/client.ts`
- Create: `~/Desktop/CBB-Next/lib/supabase/types.ts`

**Step 1: Write `lib/supabase/client.ts`**

```ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

**Step 2: Write `lib/supabase/types.ts`**

```ts
export interface CbbTeam {
  team_id: string;
  name: string;
  display_name: string;
  conference: string;
  logo: string;
  slug: string;
  abbreviation: string;
}

export interface CbbPitcher {
  pitcher_id: string;
  team_id: string;
  name: string;
  display_name: string;
  number: string;
  position: string;        // 'RHP' | 'LHP' | 'P'
  year: string;            // 'Freshman' | 'Sophomore' | etc.
  height: string;
  weight: string;
  hometown: string;
  bats_throws: string;
  headshot: string | null;
  espn_link: string | null;
}

export interface CbbGame {
  game_id: string;
  date: string;
  week: number;
  season: number;
  home_team_id: string;
  away_team_id: string;
  home_name: string | null;
  away_name: string | null;
  status: string;
  completed: boolean;
  venue: string | null;
  home_score: string | null;
  away_score: string | null;
}

export interface PitcherStats {
  IP?: string;
  K?: string;
  BB?: string;
  ER?: string;
  H?: string;
  HR?: string;
  ERA?: string;
}

export interface PitcherParticipation {
  id: number;
  game_id: string;
  team_id: string;
  pitcher_id: string;
  pitcher_name: string;
  stats: PitcherStats;
}

// Enriched pitcher with team data + stats merged in
export interface EnrichedPitcher extends CbbPitcher {
  team: CbbTeam;
  appearances: number;
  ip: number;
  strikeouts: number;
  walks: number;
  era: number;
}
```

**Step 3: Commit**

```bash
git add lib/
git commit -m "feat: add Supabase client and TypeScript types"
```

---

### Task 10: Create Utility Functions

**Files:**
- Create: `~/Desktop/CBB-Next/lib/utils.ts`
- Create: `~/Desktop/CBB-Next/lib/hooks/useLocalStorage.ts`
- Create: `~/Desktop/CBB-Next/lib/hooks/useIntersectionObserver.ts`

**Step 1: Write `lib/utils.ts`** (copy from swim tracker, adapted for CBB)

```ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getTeamGradient(primaryColor?: string, secondaryColor?: string): string {
  if (!primaryColor) return 'linear-gradient(135deg, #1a73e8 0%, #ea4335 100%)';
  const p = primaryColor.replace('#', '');
  const s = secondaryColor?.replace('#', '');
  const isValid = (h: string) => /^[0-9A-Fa-f]{6}$/.test(h);
  if (!isValid(p)) return 'linear-gradient(135deg, #1a73e8 0%, #ea4335 100%)';
  if (s && isValid(s)) return `linear-gradient(135deg, #${p} 0%, #${s} 100%)`;
  return `linear-gradient(135deg, #${p} 0%, #${lighten(p, 25)} 100%)`;
}

function lighten(hex: string, pct: number): string {
  const n = parseInt(hex, 16);
  const a = Math.round(2.55 * pct);
  const R = Math.min(255, ((n >> 16) & 0xff) + a);
  const G = Math.min(255, ((n >> 8) & 0xff) + a);
  const B = Math.min(255, (n & 0xff) + a);
  return ((R << 16) | (G << 8) | B).toString(16).padStart(6, '0');
}

export function getContrastColor(hex?: string): 'white' | 'black' {
  if (!hex) return 'white';
  const h = hex.replace('#', '');
  if (!/^[0-9A-Fa-f]{6}$/.test(h)) return 'white';
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.5 ? 'black' : 'white';
}

export function formatGameDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export function formatGameTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
}
```

**Step 2: Write `lib/hooks/useLocalStorage.ts`** (copy from swim tracker)

```ts
'use client';
import { useState, useEffect } from 'react';

export function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(initialValue);

  useEffect(() => {
    try {
      const item = window.localStorage.getItem(key);
      if (item) setStoredValue(JSON.parse(item));
    } catch (e) {
      console.error(e);
    }
  }, [key]);

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (e) {
      console.error(e);
    }
  };

  return [storedValue, setValue] as const;
}
```

**Step 3: Write `lib/hooks/useIntersectionObserver.ts`** (copy from swim tracker)

```ts
import { useEffect, useRef, useState } from 'react';

interface Options {
  threshold?: number;
  rootMargin?: string;
  freezeOnceVisible?: boolean;
}

export function useIntersectionObserver({ threshold = 0.1, rootMargin = '0px', freezeOnceVisible = true }: Options = {}) {
  const ref = useRef<HTMLElement | null>(null);
  const [isIntersecting, setIsIntersecting] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        const visible = entry.isIntersecting;
        setIsIntersecting(visible);
        if (visible && freezeOnceVisible) observer.unobserve(el);
      },
      { threshold, rootMargin }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold, rootMargin, freezeOnceVisible]);

  return { ref, isIntersecting };
}
```

**Step 4: Commit**

```bash
git add lib/
git commit -m "feat: add utility functions and custom hooks"
```

---

### Task 11: Create Layout and Navigation

**Files:**
- Modify: `~/Desktop/CBB-Next/app/layout.tsx`
- Create: `~/Desktop/CBB-Next/components/Navigation.tsx`

**Step 1: Write `app/layout.tsx`**

```tsx
import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geist = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'CBB Pitcher Tracker',
  description: 'Track college baseball pitchers across Division I conferences — rosters, schedules, and live stats.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable}`}>
      <body className="antialiased bg-slate-50 text-slate-900">{children}</body>
    </html>
  );
}
```

**Step 2: Write `components/Navigation.tsx`**

```tsx
'use client';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface NavigationProps {
  searchQuery: string;
  onSearch: (q: string) => void;
  favoritesCount: number;
  onFavoritesClick: () => void;
}

export default function Navigation({ searchQuery, onSearch, favoritesCount, onFavoritesClick }: NavigationProps) {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav className={cn(
      'sticky top-0 z-50 transition-all duration-300 backdrop-blur-xl bg-white/80',
      isScrolled && 'shadow-lg shadow-slate-900/10'
    )}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚾</span>
            <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-[#1a73e8] to-[#ea4335] bg-clip-text text-transparent">
              CBB Pitcher Tracker
            </h1>
          </div>

          {/* Desktop: search + favorites */}
          <div className="hidden md:flex items-center gap-3">
            <input
              type="text"
              value={searchQuery}
              onChange={e => onSearch(e.target.value)}
              placeholder="Search pitchers or teams..."
              className="w-72 px-4 py-2 rounded-full bg-slate-100 border border-slate-300 text-slate-900 placeholder:text-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a73e8]/30"
            />
            <button
              onClick={onFavoritesClick}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-[#1a73e8] to-[#ea4335] text-white text-sm font-medium"
            >
              ★ Favorites
              {favoritesCount > 0 && (
                <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs">{favoritesCount}</span>
              )}
            </button>
          </div>
        </div>

        {/* Mobile search */}
        <div className="md:hidden pb-3">
          <input
            type="text"
            value={searchQuery}
            onChange={e => onSearch(e.target.value)}
            placeholder="Search pitchers or teams..."
            className="w-full px-4 py-2 rounded-full bg-slate-100 border border-slate-300 text-sm focus:outline-none"
          />
        </div>
      </div>
    </nav>
  );
}
```

**Step 3: Commit**

```bash
git add app/layout.tsx components/Navigation.tsx
git commit -m "feat: add layout and Navigation component"
```

---

### Task 12: Create HeroSection

**Files:**
- Create: `~/Desktop/CBB-Next/components/HeroSection.tsx`

**Step 1: Write `components/HeroSection.tsx`** (mirrors swim tracker HeroSection exactly)

```tsx
'use client';
import { motion, useAnimation } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useInView } from 'react-intersection-observer';

function StatCard({ value, label, highlight = false }: { value: number; label: string; highlight?: boolean }) {
  const [count, setCount] = useState(0);
  const [ref, inView] = useInView({ threshold: 0.3, triggerOnce: true });

  useEffect(() => {
    if (!inView) return;
    let start: number;
    const animate = (t: number) => {
      if (!start) start = t;
      const p = Math.min((t - start) / 2000, 1);
      const ease = 1 - Math.pow(1 - p, 4);
      setCount(Math.floor(ease * value));
      if (p < 1) requestAnimationFrame(animate);
      else setCount(value);
    };
    requestAnimationFrame(animate);
  }, [inView, value]);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6 }}
      className={cn(
        'relative overflow-hidden rounded-2xl p-8 backdrop-blur-sm hover:scale-105 transition-transform duration-300',
        highlight
          ? 'bg-orange-500/20 border-2 border-orange-500/50'
          : 'bg-white/10 border-2 border-white/20'
      )}
    >
      <div className={cn('text-5xl md:text-6xl font-bold mb-2', highlight ? 'text-orange-300' : 'text-[#60a5fa]')}>
        {count.toLocaleString()}
      </div>
      <div className="text-white/90 text-lg font-medium">{label}</div>
    </motion.div>
  );
}

import { cn } from '@/lib/utils';

export default function HeroSection({ teamCount, pitcherCount, gameCount }: {
  teamCount: number;
  pitcherCount: number;
  gameCount: number;
}) {
  const controls = useAnimation();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    controls.start({
      backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
      transition: { duration: 8, ease: 'linear', repeat: Infinity },
    });
  }, [controls]);

  if (!mounted) return null;

  return (
    <section className="relative min-h-[60vh] flex items-center justify-center overflow-hidden">
      <motion.div
        className="absolute inset-0 bg-gradient-to-br from-[#0A1628] via-[#1E3A5F] to-[#0A1628]"
        animate={controls}
        style={{ backgroundSize: '200% 200%' }}
      />

      <div className="relative z-10 container mx-auto px-6 py-16">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: -30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center mb-8"
          >
            <h1 className="text-5xl md:text-7xl font-bold mb-4">
              <span className="bg-gradient-to-r from-[#60a5fa] via-blue-400 to-[#60a5fa] bg-clip-text text-transparent">
                NCAA D1 Baseball
              </span>
              <br />
              <span className="text-white">Pitcher Tracker</span>
            </h1>
            <p className="text-xl text-white/80 max-w-2xl mx-auto">
              Track every pitcher across Division I baseball — rosters, schedules, and live game stats
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.8 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8"
          >
            <StatCard value={teamCount} label="D1 Teams" />
            <StatCard value={pitcherCount} label="Pitchers" />
            <StatCard value={gameCount} label="Games Tracked" highlight />
          </motion.div>

          <motion.div
            animate={{ y: [0, 10, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="flex flex-col items-center gap-2 text-white/60"
          >
            <span className="text-sm">Scroll</span>
            <svg className="w-6 h-6 text-[#60a5fa]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
```

**Step 2: Commit**

```bash
git add components/HeroSection.tsx
git commit -m "feat: add HeroSection with animated gradient and stat counters"
```

---

### Task 13: Create TabBar and FilterPills

**Files:**
- Create: `~/Desktop/CBB-Next/components/TabBar.tsx`
- Create: `~/Desktop/CBB-Next/components/FilterPills.tsx`

**Step 1: Write `components/TabBar.tsx`**

```tsx
'use client';
import { cn } from '@/lib/utils';

export type Tab = 'schedule' | 'rosters';

interface TabBarProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

export default function TabBar({ activeTab, onTabChange }: TabBarProps) {
  const tabs: { id: Tab; label: string; emoji: string }[] = [
    { id: 'schedule', label: 'Schedule', emoji: '📅' },
    { id: 'rosters', label: 'Rosters', emoji: '⚾' },
  ];

  return (
    <div className="flex justify-center gap-3 px-4 py-4 bg-slate-50">
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={cn(
            'flex items-center gap-2 px-6 py-2.5 rounded-full font-medium text-sm transition-all duration-200',
            activeTab === tab.id
              ? 'bg-gradient-to-r from-[#1a73e8] to-[#ea4335] text-white shadow-lg'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300'
          )}
        >
          <span>{tab.emoji}</span>
          <span>{tab.label}</span>
        </button>
      ))}
    </div>
  );
}
```

**Step 2: Write `components/FilterPills.tsx`**

```tsx
'use client';
import { cn } from '@/lib/utils';

export type Conference = 'all' | 'sec' | 'big-12' | 'acc' | 'big-ten' | 'pac-12' | 'other';
export type HandFilter = 'all' | 'rhp' | 'lhp';

interface FilterPillsProps {
  conference: Conference;
  onConferenceChange: (c: Conference) => void;
  handFilter?: HandFilter;
  onHandFilterChange?: (h: HandFilter) => void;
  showHandFilter?: boolean;
}

function Pill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 whitespace-nowrap',
        active
          ? 'bg-gradient-to-r from-[#1a73e8] to-[#ea4335] text-white shadow-lg'
          : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300'
      )}
    >
      {label}
    </button>
  );
}

const CONFERENCES: { id: Conference; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'sec', label: 'SEC' },
  { id: 'big-12', label: 'Big 12' },
  { id: 'acc', label: 'ACC' },
  { id: 'big-ten', label: 'Big Ten' },
  { id: 'pac-12', label: 'Pac-12' },
  { id: 'other', label: 'Other' },
];

export default function FilterPills({ conference, onConferenceChange, handFilter, onHandFilterChange, showHandFilter }: FilterPillsProps) {
  return (
    <div className="space-y-3 px-4 sm:px-6 lg:px-8 py-4 bg-slate-50">
      <div className="max-w-7xl mx-auto space-y-3">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {CONFERENCES.map(c => (
            <Pill key={c.id} label={c.label} active={conference === c.id} onClick={() => onConferenceChange(c.id)} />
          ))}
        </div>

        {showHandFilter && onHandFilterChange && (
          <div className="flex gap-2">
            {(['all', 'rhp', 'lhp'] as HandFilter[]).map(h => (
              <Pill
                key={h}
                label={h === 'all' ? 'All' : h.toUpperCase()}
                active={handFilter === h}
                onClick={() => onHandFilterChange(h)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add components/TabBar.tsx components/FilterPills.tsx
git commit -m "feat: add TabBar and FilterPills components"
```

---

### Task 14: Create GameCard and ScheduleView

**Files:**
- Create: `~/Desktop/CBB-Next/components/schedule/GameCard.tsx`
- Create: `~/Desktop/CBB-Next/components/schedule/ScheduleView.tsx`

**Step 1: Write `components/schedule/GameCard.tsx`**

```tsx
'use client';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { CbbGame, CbbTeam } from '@/lib/supabase/types';
import { useIntersectionObserver } from '@/lib/hooks/useIntersectionObserver';
import { cn, formatGameDate, formatGameTime } from '@/lib/utils';

interface GameCardProps {
  game: CbbGame;
  trackedTeam: CbbTeam | undefined;   // the team we track (home or away)
  opponent: CbbTeam | undefined;
  isHome: boolean;
  index: number;
}

function ResultBadge({ game, isHome }: { game: CbbGame; isHome: boolean }) {
  if (!game.completed) {
    return (
      <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-medium">
        {formatGameTime(game.date)}
      </span>
    );
  }

  const ourScore = isHome ? Number(game.home_score) : Number(game.away_score);
  const theirScore = isHome ? Number(game.away_score) : Number(game.home_score);
  const won = ourScore > theirScore;

  return (
    <span className={cn(
      'px-2 py-1 rounded-full text-xs font-bold',
      won ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
    )}>
      {won ? 'W' : 'L'} {ourScore}–{theirScore}
    </span>
  );
}

export default function GameCard({ game, trackedTeam, opponent, isHome, index }: GameCardProps) {
  const { ref, isIntersecting } = useIntersectionObserver({ threshold: 0.1, freezeOnceVisible: true });

  return (
    <motion.div
      ref={ref as React.RefObject<HTMLDivElement>}
      initial={{ opacity: 0, y: 20 }}
      animate={isIntersecting ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay: Math.min(index * 0.03, 0.3) }}
      className="bg-white rounded-2xl shadow-md p-4 hover:shadow-lg transition-shadow duration-300 border border-slate-100"
    >
      {/* Week badge + date */}
      <div className="flex items-center justify-between mb-3">
        <span className="px-2.5 py-1 bg-[#1a73e8]/10 text-[#1a73e8] text-xs font-semibold rounded-full">
          Week {game.week}
        </span>
        <span className="text-xs text-slate-500">{formatGameDate(game.date)}</span>
      </div>

      {/* Matchup */}
      <div className="flex items-center gap-3 mb-3">
        {/* Our team */}
        <div className="flex flex-col items-center gap-1 flex-1">
          {trackedTeam?.logo ? (
            <Image src={trackedTeam.logo} alt={trackedTeam.name} width={40} height={40} className="object-contain" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold">
              {trackedTeam?.abbreviation || '?'}
            </div>
          )}
          <span className="text-xs font-semibold text-slate-800 text-center line-clamp-1">
            {trackedTeam?.name || 'Unknown'}
          </span>
        </div>

        {/* VS */}
        <div className="flex flex-col items-center gap-1">
          <span className="text-slate-400 font-bold text-sm">vs</span>
          <span className={cn(
            'text-xs px-2 py-0.5 rounded-full font-medium',
            isHome ? 'bg-emerald-50 text-emerald-700' : 'bg-orange-50 text-orange-700'
          )}>
            {isHome ? 'Home' : 'Away'}
          </span>
        </div>

        {/* Opponent */}
        <div className="flex flex-col items-center gap-1 flex-1">
          {opponent?.logo ? (
            <Image src={opponent.logo} alt={opponent.name} width={40} height={40} className="object-contain" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold">
              {opponent?.abbreviation || '?'}
            </div>
          )}
          <span className="text-xs font-semibold text-slate-800 text-center line-clamp-1">
            {opponent?.name || game.away_name || 'Opponent'}
          </span>
        </div>
      </div>

      {/* Result / time */}
      <div className="flex justify-center">
        <ResultBadge game={game} isHome={isHome} />
      </div>
    </motion.div>
  );
}
```

**Step 2: Write `components/schedule/ScheduleView.tsx`**

```tsx
'use client';
import { useState, useMemo } from 'react';
import { CbbGame, CbbTeam } from '@/lib/supabase/types';
import FilterPills, { Conference } from '@/components/FilterPills';
import GameCard from '@/components/schedule/GameCard';

interface ScheduleViewProps {
  games: CbbGame[];
  teams: CbbTeam[];
}

export default function ScheduleView({ games, teams }: ScheduleViewProps) {
  const [conference, setConference] = useState<Conference>('all');
  const [showCompleted, setShowCompleted] = useState(true);

  const teamMap = useMemo(() => {
    const m = new Map<string, CbbTeam>();
    teams.forEach(t => m.set(t.team_id, t));
    return m;
  }, [teams]);

  const filtered = useMemo(() => {
    return games.filter(g => {
      if (!showCompleted && g.completed) return false;
      if (conference === 'all') return true;
      const home = teamMap.get(g.home_team_id);
      const away = teamMap.get(g.away_team_id);
      const conf = (home?.conference || away?.conference || '').toLowerCase().replace(/\s+/g, '-');
      return conf.includes(conference);
    });
  }, [games, conference, showCompleted, teamMap]);

  return (
    <div className="min-h-screen bg-slate-50">
      <FilterPills conference={conference} onConferenceChange={setConference} />

      {/* Upcoming / All toggle */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex gap-2">
        <button
          onClick={() => setShowCompleted(true)}
          className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${showCompleted ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600'}`}
        >
          All Games
        </button>
        <button
          onClick={() => setShowCompleted(false)}
          className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${!showCompleted ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600'}`}
        >
          Upcoming Only
        </button>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {filtered.length === 0 ? (
          <div className="text-center py-20 text-slate-500">No games found</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((game, i) => {
              const home = teamMap.get(game.home_team_id);
              const away = teamMap.get(game.away_team_id);
              // Show card from home team's perspective if we track them, else away
              const trackedIsHome = !!home;
              return (
                <GameCard
                  key={game.game_id}
                  game={game}
                  trackedTeam={trackedIsHome ? home : away}
                  opponent={trackedIsHome ? away : home}
                  isHome={trackedIsHome}
                  index={i}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add components/schedule/
git commit -m "feat: add GameCard and ScheduleView components"
```

---

### Task 15: Create PitcherCard, PitcherModal, and RosterView

**Files:**
- Create: `~/Desktop/CBB-Next/components/roster/PitcherCard.tsx`
- Create: `~/Desktop/CBB-Next/components/roster/PitcherModal.tsx`
- Create: `~/Desktop/CBB-Next/components/roster/RosterView.tsx`

**Step 1: Write `components/roster/PitcherCard.tsx`**

```tsx
'use client';
import { useState } from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { EnrichedPitcher } from '@/lib/supabase/types';
import { useIntersectionObserver } from '@/lib/hooks/useIntersectionObserver';
import { cn } from '@/lib/utils';

interface PitcherCardProps {
  pitcher: EnrichedPitcher;
  index: number;
  isFavorite: boolean;
  onFavoriteToggle: (id: string) => void;
  onClick: (pitcher: EnrichedPitcher) => void;
}

function PositionBadge({ position }: { position: string }) {
  const isLHP = position?.toUpperCase().includes('L');
  return (
    <span className={cn(
      'px-2 py-0.5 rounded-full text-xs font-bold',
      isLHP ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'
    )}>
      {position || 'P'}
    </span>
  );
}

export default function PitcherCard({ pitcher, index, isFavorite, onFavoriteToggle, onClick }: PitcherCardProps) {
  const [imgError, setImgError] = useState(false);
  const { ref, isIntersecting } = useIntersectionObserver({ threshold: 0.05, freezeOnceVisible: true });

  const showPhoto = pitcher.headshot && !imgError;
  const initials = pitcher.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <motion.div
      ref={ref as React.RefObject<HTMLDivElement>}
      initial={{ opacity: 0, y: 20 }}
      animate={isIntersecting ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.4, delay: Math.min(index * 0.03, 0.4) }}
      className="cursor-pointer group"
      onClick={() => onClick(pitcher)}
    >
      <div className="bg-white rounded-2xl shadow-md overflow-hidden hover:shadow-xl transition-shadow duration-300 border border-slate-100">
        {/* Headshot — PRIMARY FOCUS */}
        <div className="relative aspect-square bg-gradient-to-br from-slate-200 to-slate-300 overflow-hidden">
          {showPhoto ? (
            <Image
              src={pitcher.headshot!}
              alt={pitcher.name}
              fill
              className="object-cover object-top group-hover:scale-105 transition-transform duration-500"
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              onError={() => setImgError(true)}
              loading={index < 12 ? 'eager' : 'lazy'}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-4xl font-black text-slate-400">
              {initials}
            </div>
          )}

          {/* Favorite button overlay */}
          <button
            onClick={e => { e.stopPropagation(); onFavoriteToggle(pitcher.pitcher_id); }}
            className={cn(
              'absolute top-2 right-2 w-8 h-8 rounded-full backdrop-blur-sm flex items-center justify-center transition-all',
              isFavorite ? 'bg-yellow-400/90 text-white' : 'bg-black/30 text-white/70 hover:bg-black/50'
            )}
          >
            {isFavorite ? '★' : '☆'}
          </button>

          {/* Team logo overlay bottom-left */}
          {pitcher.team?.logo && (
            <div className="absolute bottom-2 left-2 w-8 h-8 rounded-full bg-white/90 p-1">
              <Image src={pitcher.team.logo} alt={pitcher.team.name} width={24} height={24} className="object-contain w-full h-full" />
            </div>
          )}
        </div>

        {/* Info below photo */}
        <div className="p-3">
          <div className="flex items-start justify-between gap-1">
            <div className="min-w-0">
              <p className="font-bold text-slate-900 text-sm leading-tight truncate">{pitcher.name}</p>
              <p className="text-xs text-slate-500 truncate">{pitcher.team?.name}</p>
            </div>
            <PositionBadge position={pitcher.position} />
          </div>
          {pitcher.appearances > 0 && (
            <p className="mt-1.5 text-xs text-slate-400">{pitcher.appearances} APP · {pitcher.ip.toFixed(1)} IP · {pitcher.strikeouts} K</p>
          )}
        </div>
      </div>
    </motion.div>
  );
}
```

**Step 2: Write `components/roster/PitcherModal.tsx`**

```tsx
'use client';
import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { EnrichedPitcher } from '@/lib/supabase/types';
import { cn } from '@/lib/utils';

interface PitcherModalProps {
  pitcher: EnrichedPitcher | null;
  isFavorite: boolean;
  onFavoriteToggle: (id: string) => void;
  onClose: () => void;
}

export default function PitcherModal({ pitcher, isFavorite, onFavoriteToggle, onClose }: PitcherModalProps) {
  useEffect(() => {
    if (!pitcher) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [pitcher, onClose]);

  return (
    <AnimatePresence>
      {pitcher && (
        <motion.div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            onClick={e => e.stopPropagation()}
          >
            {/* Photo header */}
            <div className="relative h-64 bg-gradient-to-br from-slate-700 to-slate-900">
              {pitcher.headshot && (
                <Image
                  src={pitcher.headshot}
                  alt={pitcher.name}
                  fill
                  className="object-cover object-top"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <button
                onClick={onClose}
                className="absolute top-3 right-3 w-8 h-8 bg-black/40 rounded-full flex items-center justify-center text-white hover:bg-black/60"
              >
                ✕
              </button>
              <div className="absolute bottom-4 left-4 right-4">
                <h2 className="text-2xl font-bold text-white">{pitcher.name}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className={cn(
                    'px-2 py-0.5 rounded-full text-xs font-bold',
                    pitcher.position?.includes('L') ? 'bg-blue-500 text-white' : 'bg-red-500 text-white'
                  )}>{pitcher.position || 'P'}</span>
                  <span className="text-white/80 text-sm">#{pitcher.number}</span>
                  <span className="text-white/80 text-sm">{pitcher.year}</span>
                </div>
              </div>
            </div>

            {/* Details */}
            <div className="p-6 space-y-4">
              {/* Team */}
              <div className="flex items-center gap-3">
                {pitcher.team?.logo && (
                  <Image src={pitcher.team.logo} alt={pitcher.team.name} width={32} height={32} className="object-contain" />
                )}
                <div>
                  <p className="font-semibold text-slate-900">{pitcher.team?.name}</p>
                  <p className="text-sm text-slate-500">{pitcher.team?.conference}</p>
                </div>
              </div>

              {/* Stats grid */}
              {pitcher.appearances > 0 && (
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { label: 'APP', value: pitcher.appearances },
                    { label: 'IP', value: pitcher.ip.toFixed(1) },
                    { label: 'K', value: pitcher.strikeouts },
                    { label: 'ERA', value: pitcher.era > 0 ? pitcher.era.toFixed(2) : '—' },
                  ].map(stat => (
                    <div key={stat.label} className="text-center bg-slate-50 rounded-xl p-3">
                      <p className="text-lg font-bold text-slate-900">{stat.value}</p>
                      <p className="text-xs text-slate-500">{stat.label}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Bio info */}
              <div className="space-y-1 text-sm text-slate-600">
                {pitcher.height && <p>Height: {pitcher.height}</p>}
                {pitcher.hometown && <p>Hometown: {pitcher.hometown}</p>}
                {pitcher.bats_throws && <p>B/T: {pitcher.bats_throws}</p>}
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={() => onFavoriteToggle(pitcher.pitcher_id)}
                  className={cn(
                    'flex-1 py-2.5 rounded-full font-medium text-sm transition-all',
                    isFavorite
                      ? 'bg-yellow-400 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  )}
                >
                  {isFavorite ? '★ Saved' : '☆ Save'}
                </button>
                {pitcher.espn_link && (
                  <a
                    href={pitcher.espn_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-2.5 rounded-full bg-gradient-to-r from-[#1a73e8] to-[#ea4335] text-white font-medium text-sm text-center"
                  >
                    ESPN Profile
                  </a>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

**Step 3: Write `components/roster/RosterView.tsx`**

```tsx
'use client';
import { useState, useMemo } from 'react';
import { EnrichedPitcher } from '@/lib/supabase/types';
import FilterPills, { Conference, HandFilter } from '@/components/FilterPills';
import PitcherCard from '@/components/roster/PitcherCard';
import PitcherModal from '@/components/roster/PitcherModal';

interface RosterViewProps {
  pitchers: EnrichedPitcher[];
  favoritePitcherIds: Set<string>;
  onFavoriteToggle: (id: string) => void;
  searchQuery: string;
  favoritesOnly: boolean;
}

export default function RosterView({ pitchers, favoritePitcherIds, onFavoriteToggle, searchQuery, favoritesOnly }: RosterViewProps) {
  const [conference, setConference] = useState<Conference>('all');
  const [handFilter, setHandFilter] = useState<HandFilter>('all');
  const [selectedPitcher, setSelectedPitcher] = useState<EnrichedPitcher | null>(null);

  const filtered = useMemo(() => {
    return pitchers.filter(p => {
      if (favoritesOnly && !favoritePitcherIds.has(p.pitcher_id)) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!p.name.toLowerCase().includes(q) && !p.team?.name.toLowerCase().includes(q)) return false;
      }
      if (conference !== 'all') {
        const conf = (p.team?.conference || '').toLowerCase().replace(/\s+/g, '-');
        if (!conf.includes(conference)) return false;
      }
      if (handFilter !== 'all') {
        const pos = (p.position || '').toUpperCase();
        if (handFilter === 'lhp' && !pos.includes('L')) return false;
        if (handFilter === 'rhp' && pos.includes('L')) return false;
      }
      return true;
    });
  }, [pitchers, favoritesOnly, favoritePitcherIds, searchQuery, conference, handFilter]);

  return (
    <div className="min-h-screen bg-slate-50">
      <FilterPills
        conference={conference}
        onConferenceChange={setConference}
        handFilter={handFilter}
        onHandFilterChange={setHandFilter}
        showHandFilter
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <p className="text-sm text-slate-500 mb-4">{filtered.length} pitchers</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filtered.map((pitcher, i) => (
            <PitcherCard
              key={pitcher.pitcher_id}
              pitcher={pitcher}
              index={i}
              isFavorite={favoritePitcherIds.has(pitcher.pitcher_id)}
              onFavoriteToggle={onFavoriteToggle}
              onClick={setSelectedPitcher}
            />
          ))}
        </div>
      </div>

      <PitcherModal
        pitcher={selectedPitcher}
        isFavorite={selectedPitcher ? favoritePitcherIds.has(selectedPitcher.pitcher_id) : false}
        onFavoriteToggle={onFavoriteToggle}
        onClose={() => setSelectedPitcher(null)}
      />
    </div>
  );
}
```

**Step 4: Commit**

```bash
git add components/roster/
git commit -m "feat: add PitcherCard, PitcherModal, RosterView components"
```

---

### Task 16: Wire Up Main page.tsx

**Files:**
- Modify: `~/Desktop/CBB-Next/app/page.tsx`

**Step 1: Write `app/page.tsx`**

```tsx
'use client';
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase/client';
import { CbbTeam, CbbPitcher, CbbGame, EnrichedPitcher, PitcherParticipation } from '@/lib/supabase/types';
import { useLocalStorage } from '@/lib/hooks/useLocalStorage';
import Navigation from '@/components/Navigation';
import HeroSection from '@/components/HeroSection';
import TabBar, { Tab } from '@/components/TabBar';
import ScheduleView from '@/components/schedule/ScheduleView';
import RosterView from '@/components/roster/RosterView';

function parseIP(ip: string): number {
  if (!ip) return 0;
  const parts = ip.split('.');
  const full = parseInt(parts[0]) || 0;
  const thirds = parseInt(parts[1]) || 0;
  return full + thirds / 3;
}

export default function Home() {
  const [teams, setTeams] = useState<CbbTeam[]>([]);
  const [pitchers, setPitchers] = useState<CbbPitcher[]>([]);
  const [games, setGames] = useState<CbbGame[]>([]);
  const [participation, setParticipation] = useState<PitcherParticipation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [favoritePitcherIds, setFavoritePitcherIds] = useLocalStorage<string[]>('cbb-fav-pitchers', []);
  const [activeTab, setActiveTab] = useState<Tab>('schedule');

  // Sync tab with URL hash
  useEffect(() => {
    const hash = window.location.hash.replace('#', '') as Tab;
    if (hash === 'rosters' || hash === 'schedule') setActiveTab(hash);
  }, []);

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    window.location.hash = tab;
  };

  // Fetch all data
  useEffect(() => {
    async function fetchAll() {
      setLoading(true);
      const [teamsRes, pitchersRes, gamesRes, statsRes] = await Promise.all([
        supabase.from('cbb_teams').select('*'),
        supabase.from('cbb_pitchers').select('*'),
        supabase.from('cbb_games').select('*').order('date', { ascending: true }),
        supabase.from('cbb_pitcher_participation').select('pitcher_id,team_id,stats'),
      ]);
      setTeams(teamsRes.data || []);
      setPitchers(pitchersRes.data || []);
      setGames(gamesRes.data || []);
      setParticipation(statsRes.data || []);
      setLoading(false);
    }
    fetchAll();
  }, []);

  // Build team map
  const teamMap = useMemo(() => {
    const m = new Map<string, CbbTeam>();
    teams.forEach(t => m.set(t.team_id, t));
    return m;
  }, [teams]);

  // Build stats map from participation
  const statsMap = useMemo(() => {
    const m = new Map<string, { appearances: number; ip: number; k: number; bb: number; er: number }>();
    for (const row of participation) {
      const pid = String(row.pitcher_id);
      if (!m.has(pid)) m.set(pid, { appearances: 0, ip: 0, k: 0, bb: 0, er: 0 });
      const s = m.get(pid)!;
      const stats = (row as any).stats || {};
      s.appearances++;
      s.ip += parseIP(stats.IP || '0');
      s.k += parseInt(stats.K) || 0;
      s.bb += parseInt(stats.BB) || 0;
      s.er += parseInt(stats.ER) || 0;
    }
    return m;
  }, [participation]);

  // Enrich pitchers with team + stats
  const enrichedPitchers = useMemo((): EnrichedPitcher[] => {
    return pitchers.map(p => {
      const stats = statsMap.get(p.pitcher_id) || { appearances: 0, ip: 0, k: 0, bb: 0, er: 0 };
      const era = stats.ip > 0 ? (stats.er / stats.ip) * 9 : 0;
      return {
        ...p,
        team: teamMap.get(p.team_id)!,
        appearances: stats.appearances,
        ip: stats.ip,
        strikeouts: stats.k,
        walks: stats.bb,
        era,
      };
    });
  }, [pitchers, teamMap, statsMap]);

  const favPitcherIdSet = useMemo(() => new Set(favoritePitcherIds), [favoritePitcherIds]);

  const handleFavoritePitcher = (id: string) => {
    setFavoritePitcherIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#1a73e8] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-600">Loading...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <Navigation
        searchQuery={searchQuery}
        onSearch={setSearchQuery}
        favoritesCount={favoritePitcherIds.length}
        onFavoritesClick={() => setFavoritesOnly(f => !f)}
      />

      <HeroSection
        teamCount={teams.length}
        pitcherCount={pitchers.length}
        gameCount={games.length}
      />

      <TabBar activeTab={activeTab} onTabChange={handleTabChange} />

      {activeTab === 'schedule' ? (
        <ScheduleView games={games} teams={teams} />
      ) : (
        <RosterView
          pitchers={enrichedPitchers}
          favoritePitcherIds={favPitcherIdSet}
          onFavoriteToggle={handleFavoritePitcher}
          searchQuery={searchQuery}
          favoritesOnly={favoritesOnly}
        />
      )}
    </main>
  );
}
```

**Step 2: Test in dev**

```bash
npm run dev
```

Open http://localhost:3000 — verify:
- Hero section renders with animated gradient
- Tab switching works (Schedule / Rosters)
- Games load from Supabase
- Pitchers load with headshots
- Filter pills work

**Step 3: Commit**

```bash
git add app/page.tsx
git commit -m "feat: wire up main SPA page with all data and tab switching"
```

---

### Task 17: Deploy to Vercel

**Step 1: Connect to Vercel**

```bash
cd ~/Desktop/CBB-Next
vercel --prod
```

When prompted:
- Link to existing project? **No** (new project)
- Project name: `cbb-pitcher-tracker-next`
- Framework: **Next.js** (auto-detected)

**Step 2: Add environment variables in Vercel dashboard**

Go to Vercel project settings → Environment Variables, add:
- `NEXT_PUBLIC_SUPABASE_URL` = `https://dtnozcqkuzhjmjvsfjqk.supabase.co`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = (anon key)

**Step 3: Redeploy with env vars**

```bash
vercel --prod
```

**Step 4: Verify production**

Open the production URL in browser. Check:
- [ ] Hero renders with navy gradient + stat counters
- [ ] Schedule tab loads game cards
- [ ] Rosters tab loads pitcher headshot grid
- [ ] Filters work (conference, RHP/LHP)
- [ ] Clicking a pitcher opens the modal
- [ ] Favorites work and persist across page refresh

**Step 5: Final commit**

```bash
git add .
git commit -m "feat: deploy CBB Next.js tracker to Vercel"
```

---

## Summary

| Phase | Tasks | What Gets Done |
|---|---|---|
| Phase 1 | 1–6 | All data (pitchers, teams, headshots) migrated to Supabase |
| Phase 2 | 7–17 | Next.js app built and deployed, matching swim tracker UI exactly |
