# Comprehensive CBB Application Upgrade Design

**Date:** 2026-02-13
**Goal:** Complete application upgrade covering data quality, design consistency, new features, and performance optimization

## Design Decisions

**Approach:** Quick wins first with rolling deployment
**Primary Focus:** Data completeness (95% for Power 5 conferences)
**Tech Stack:** Minimal additions (Chart.js, PapaParse)
**Mobile:** Desktop-only, no responsive changes needed
**Deployment:** Rolling - push improvements as completed

---

## Overall Architecture

### Foundation
- Maintain vanilla JavaScript + Supabase architecture
- No build step - libraries via CDN
- Deploy through existing Vercel CI/CD
- Layer improvements onto current codebase

### New Dependencies
- **Chart.js** (11kb gzipped) - Analytics visualizations
- **PapaParse** (3kb gzipped) - CSV export functionality
- Total bundle increase: ~14kb (loaded on-demand)

---

## Rolling Deployment Phases

### Phase 1: Data Completion (Week 1)

**Target:** 95%+ completeness for Power 5 conferences, 80%+ for others

**Headshot Completion Scraper**
- Extend `scrape-missing-headshots-auto.mjs` to remaining Power 5 teams
- Parallel processing: 3 teams simultaneously
- Retry logic with exponential backoff
- Validation: min 5KB file size check
- Progress dashboard: completion % per conference
- Current gap: 39 missing headshots → target <5

**Year Classification Scraper**
- Parse roster pages for class indicators (Fr., SO, JR, SR, etc.)
- Handle edge cases: Redshirts (R-FR), Graduate (GR), Transfers
- Fallback: ESPN roster API when official roster lacks data
- Store confidence score: "high" (parsed) vs "inferred" (from eligibility)
- Current gap: 1,052 missing years → target <50

**Team Logo Scraper**
- Priority: Power 5 + top 25 ranked teams
- Sources: Official athletic sites (primary), ESPN (fallback)
- Format: Square PNG/SVG, min 200x200px
- Store light/dark variants for theme flexibility
- Fallback: Conference logo when team logo unavailable

**Data Validation**
- Run `verify-data-quality.mjs` after each scraper
- Automated commits with stats: "Added 47 headshots, 892 years (94.8% complete)"
- Flag anomalies: duplicate IDs, mismatched positions, broken links

### Phase 2: Design Consistency (Week 1-2)

**Theme Unification: index.html → Modern Premium**

Update roster page to match schedule.html exactly:

**Visual Language**
- Typography: Crimson Pro (serif headers) + DM Sans (body)
- Colors: Cream/white base (#fafaf8), emerald accents (#10b981), slate grays
- Replace navy (#002f66) vintage aesthetic completely
- Zero functionality changes - pure visual transformation

**Component Migration**
- Top navigation: Glassmorphic sticky header with blur backdrop
- Team cards: White cards with subtle shadows, emerald favorite borders
- Pitcher items: Grid layout with generous whitespace
- Buttons/inputs: 10px border-radius, emerald focus states, 0.65rem padding
- Badges: Emerald/slate color system for position/year
- Animations: cubic-bezier(0.4, 0, 0.2, 1) easing throughout

**Implementation**
- Copy `:root` CSS variables from schedule.html
- Migrate component styles class-by-class
- Maintain headshot zoom (scale 2.2x on hover)
- Preserve all filtering, search, favorite functionality

### Phase 3: Quick Feature Additions (Week 2-3)

Deploy each feature independently as completed.

**Advanced Multi-Select Filtering**

Enhanced filter modal:
- Team/Conference: Checkbox lists instead of single-select
- Quick buttons: "Select All Power 5", "Select All SEC"
- Visual feedback: "5 teams selected" in filter bar
- OR logic: show games with ANY selected team
- Persist in localStorage

Stat-Based Filters:
- ERA range slider (0.00 - 10.00)
- Strikeout minimum (K > X)
- Appearance count (GP > X)
- Role filter: Starters / Relievers / All

**CSV Export Functionality**

Using PapaParse, add export to schedule and roster pages:

Export Options:
- Current filtered view: "Export 47 visible games"
- Full dataset: "Export all 2,847 pitchers"
- Format: CSV with headers, Excel/Sheets compatible

Exported Fields:
- Schedule: Date, Week, Home, Away, Conference, Priority, Watched, Pitcher Count
- Roster: Name, Team, Position, Year, Number, Headshot URL, Stats

**Keyboard Shortcuts**

Power user navigation:
- `/` - Focus search
- `f` - Toggle filters
- `Esc` - Close modals
- `e` - Export current view
- `1-9` - Jump to week (schedule page)
- `↑↓` - Navigate cards
- `Space` - Toggle favorite
- `?` - Show help modal

Help overlay in bottom-right corner for discoverability.

### Phase 4: Analytics Dashboard (Week 3-4)

**New Page: analytics.html**

Modern premium theme matching schedule/roster pages.

**Page Structure**
- Grid layout: 2 columns of visualization cards
- Interactive filters: Conference, date range, stat type
- All charts update dynamically
- Link from main navigation bar

**Visualization Cards**

1. **Team Performance Leaderboard**
   - Bar chart: Teams by aggregate pitcher ERA (Power 5)
   - Sortable table: Team, ERA, Total K, IP, GP
   - Click team → drill down to pitchers
   - Color-coded by conference

2. **Pitcher Strikeout Leaders**
   - Horizontal bar chart: Top 25 by strikeouts
   - Tooltip: Name, Team, K, ERA, IP
   - Filter by role, conference, week range
   - Export leaderboard as CSV

3. **Conference Comparison**
   - Grouped bar chart: ERA, WHIP, K/9 by conference
   - Shows conference strength
   - Helps prioritize matchups

4. **Weekly Participation Trends**
   - Line chart: Pitcher appearances per week
   - Identifies busy weeks vs. bye weeks
   - Schedule planning tool

**Data Source**
- Existing `pitchers.json` and `pitchers_played_index.json`
- Client-side calculations (aggregate, rankings)
- Cache computed results in localStorage

**Navigation**
- Add "Analytics" link to all pages' top nav
- "New" badge for first 2 weeks post-launch

---

## Performance Optimizations

**Image Lazy Loading**
- Native `loading="lazy"` on all `<img>` tags
- Team logo shows immediately, headshot loads on scroll
- Smooth fade-in transition
- Layout stability (no content jump)

**Virtual Scrolling Enhancement**
- Increase viewport buffer: 3 → 5 items
- Recycle DOM elements (don't destroy/recreate)
- Maintain scroll position on filter changes
- Debounce scroll events (16ms / 60fps)

**Data Caching Strategy**

localStorage caching:
- Cache `pitchers.json`, `schedule.json`, `teams.json` with timestamps
- `If-Modified-Since` check before re-download
- 24-hour invalidation or manual refresh
- "Loading from cache..." toast notification

Computed data cache:
- Analytics calculations stored after first run
- Invalidate on underlying data changes
- Reduces repeat processing

**Performance Targets**
- Schedule page: <500ms load on 3G
- Analytics page: <800ms load on 3G
- No perceptible lag with 2,847 pitchers

---

## Success Metrics

**Data Quality**
- Headshots: 95%+ for Power 5, 85%+ overall
- Pitcher years: 95%+ for Power 5, 80%+ overall
- Team logos: 100% Power 5, 90% overall

**User Experience**
- Design consistency: Both pages use identical theme
- Feature adoption: 25%+ users try analytics within first month
- Export usage: 10%+ users export data weekly

**Performance**
- Page load: <500ms (schedule), <800ms (analytics)
- Time to interactive: <1s on 3G
- Zero layout shift during load

---

## Implementation Order

1. **Data scrapers** (headshots, years, logos) - Deploy as ready
2. **index.html theme update** - Single commit, immediate deploy
3. **Multi-select filters** - Deploy independently
4. **CSV export** - Deploy independently
5. **Keyboard shortcuts** - Deploy independently
6. **Analytics dashboard** - Deploy when complete with all 4 charts

Each deployment is independent and non-breaking. Users see continuous improvement.
