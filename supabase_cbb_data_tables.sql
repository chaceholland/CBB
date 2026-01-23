-- CBB (College Baseball) Pitcher Tracker - Supabase Data Tables
-- Run this in Supabase SQL Editor

-- ============================================
-- CBB TEAMS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS cbb_teams (
  team_id TEXT PRIMARY KEY,
  name TEXT,
  display_name TEXT,
  conference TEXT,
  logo TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE cbb_teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cbb_teams_read" ON cbb_teams FOR SELECT USING (true);
CREATE POLICY "cbb_teams_write" ON cbb_teams FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- CBB GAMES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS cbb_games (
  game_id TEXT PRIMARY KEY,
  date TIMESTAMPTZ,
  week INTEGER,
  season INTEGER DEFAULT 2025,
  home_team_id TEXT,
  away_team_id TEXT,
  home_name TEXT,
  away_name TEXT,
  status TEXT,
  completed BOOLEAN DEFAULT FALSE,
  venue TEXT,
  home_score TEXT,
  away_score TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cbb_games_week ON cbb_games(week);
CREATE INDEX IF NOT EXISTS idx_cbb_games_completed ON cbb_games(completed);

ALTER TABLE cbb_games ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cbb_games_read" ON cbb_games FOR SELECT USING (true);
CREATE POLICY "cbb_games_write" ON cbb_games FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- CBB PITCHERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS cbb_pitchers (
  pitcher_id TEXT PRIMARY KEY,
  team_id TEXT,
  name TEXT NOT NULL,
  display_name TEXT,
  number TEXT,
  headshot TEXT,
  espn_link TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cbb_pitchers_team ON cbb_pitchers(team_id);

ALTER TABLE cbb_pitchers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cbb_pitchers_read" ON cbb_pitchers FOR SELECT USING (true);
CREATE POLICY "cbb_pitchers_write" ON cbb_pitchers FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- CBB PITCHER PARTICIPATION TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS cbb_pitcher_participation (
  id SERIAL PRIMARY KEY,
  game_id TEXT,
  team_id TEXT,
  pitcher_id TEXT,
  pitcher_name TEXT,
  stats JSONB DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(game_id, pitcher_id)
);

CREATE INDEX IF NOT EXISTS idx_cbb_participation_game ON cbb_pitcher_participation(game_id);
CREATE INDEX IF NOT EXISTS idx_cbb_participation_pitcher ON cbb_pitcher_participation(pitcher_id);

ALTER TABLE cbb_pitcher_participation ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cbb_participation_read" ON cbb_pitcher_participation FOR SELECT USING (true);
CREATE POLICY "cbb_participation_write" ON cbb_pitcher_participation FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- CBB SYNC LOG TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS cbb_sync_log (
  id SERIAL PRIMARY KEY,
  sync_type TEXT NOT NULL,
  records_count INTEGER,
  status TEXT,
  error_message TEXT,
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE cbb_sync_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cbb_sync_log_read" ON cbb_sync_log FOR SELECT USING (true);
CREATE POLICY "cbb_sync_log_write" ON cbb_sync_log FOR ALL USING (true) WITH CHECK (true);
