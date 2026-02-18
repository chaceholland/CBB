# CBB Pitcher Tracker — Next.js Rebuild Design

**Date:** 2026-02-18
**Status:** Approved

## Goal

Rebuild the CBB Pitcher Tracker as a Next.js/React/Tailwind SPA that visually matches the NCAA D1 Swimming & Diving Tracker in UI style and UX — dark navy hero, glassmorphism nav, pill filters, team color gradient cards, Framer Motion animations, Geist Sans typography.

---

## Tech Stack

- **Framework:** Next.js 15 (App Router)
- **Styling:** Tailwind CSS
- **Animations:** Framer Motion
- **Font:** Geist Sans (same as swim tracker)
- **Data:** Supabase (no local files)
- **Deploy:** Vercel (replaces current static deploy)

---

## Project Structure

New directory: `~/Desktop/CBB-Next`
Built in parallel — current deploy stays live until ready.

```
app/
  page.tsx          ← SPA shell, tab state (default: Schedule)
  layout.tsx        ← fonts, metadata, PWA

components/
  Navigation.tsx    ← glassmorphism sticky nav, search, favorites badge
  TabBar.tsx        ← Schedule / Rosters tab pills
  FilterPills.tsx   ← conference + hand filter pills
  HeroSection.tsx   ← dark navy animated gradient, stat counters
  schedule/
    ScheduleView.tsx
    GameCard.tsx
  roster/
    RosterView.tsx
    PitcherGrid.tsx
    PitcherCard.tsx
    PitcherModal.tsx

lib/
  supabase/
    client.ts
    types.ts
  hooks/
    useLocalStorage.ts
    useIntersectionObserver.ts
```

---

## Routing

Single-page app. Tab state managed via URL hash:
- `/#schedule` — default landing view
- `/#rosters` — pitcher roster grid

---

## Visual Design

Mirrors swim tracker exactly:

| Element | Style |
|---|---|
| Background | `#0a0a0a` dark base |
| Nav | `bg-white/80 backdrop-blur-xl`, shadow on scroll |
| Hero | Animated gradient `#0A1628 → #1E3A5F` |
| Active pill | `bg-gradient-to-r from-[#1a73e8] to-[#ea4335]` |
| Cards | `rounded-2xl shadow-lg`, team color gradients |
| Typography | Geist Sans, bold headings, gradient clip text |
| Animations | Framer Motion — scroll fade-in, stagger, hover lift |

---

## Schedule Tab (default)

Responsive game card grid (1 col mobile → 3 col desktop).

Each **GameCard** shows:
- Opponent logo + team name
- Date & time
- Home / Away badge
- W / L / Upcoming result badge
- Week number pill
- Conference filter pills above grid

---

## Roster Tab

Large **photo grid** — headshots are the primary focus.
2 col mobile → 3 col tablet → 4-5 col desktop.

Each **PitcherCard** shows:
- Large square headshot (fills card top)
- Name in bold below
- RHP / LHP badge
- Team name + conference (small)
- Click → modal with full details (stats, year, height, hometown)

Filter pills: All / RHP / LHP, Conference, Favorites only.

---

## Data Layer (All Supabase)

| Data | Table / Source |
|---|---|
| Teams | `cbb_teams` |
| Pitchers + headshot URLs | `cbb_pitchers` |
| Headshot images | Supabase Storage bucket `cbb-headshots` |
| Live game stats | `cbb_pitcher_participation` |
| Schedule | `cbb_games` |
| Favorites | `favorites` |

---

## Pre-Rebuild Migration (one-time)

Before building the Next.js app, run migration scripts:

1. **Add columns to `cbb_pitchers`** — `position`, `year`, `height`, `weight`, `hometown`, `bats_throws`
2. **Populate `cbb_teams`** — 64 teams from `pitchers.json`
3. **Populate `cbb_pitchers`** — 1,341 pitchers from `pitchers.json`
4. **Upload headshots** — 1,830 `.jpg` files → Supabase Storage `cbb-headshots` bucket
5. **Update headshot URLs** — patch `cbb_pitchers.headshot` with Supabase Storage public URLs

---

## Analytics

Skipped for now — placeholder tab can be added later.

---

## Out of Scope

- Analytics rebuild
- Any changes to existing Supabase data scrapers
- MLB / CFB / NFL trackers (separate projects)
