ALTER TABLE cbb_pitchers
  ADD COLUMN IF NOT EXISTS position text,
  ADD COLUMN IF NOT EXISTS year text,
  ADD COLUMN IF NOT EXISTS height text,
  ADD COLUMN IF NOT EXISTS weight text,
  ADD COLUMN IF NOT EXISTS hometown text,
  ADD COLUMN IF NOT EXISTS bats_throws text;

ALTER TABLE cbb_teams
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS abbreviation text;
