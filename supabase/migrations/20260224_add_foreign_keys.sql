-- Add foreign key relationships for PostgREST joins

-- Add foreign key from cbb_pitcher_participation to cbb_games
ALTER TABLE cbb_pitcher_participation
ADD CONSTRAINT fk_pitcher_participation_game
FOREIGN KEY (game_id) REFERENCES cbb_games(game_id);

-- Add foreign key from cbb_pitcher_participation to cbb_pitchers
ALTER TABLE cbb_pitcher_participation
ADD CONSTRAINT fk_pitcher_participation_pitcher
FOREIGN KEY (pitcher_id) REFERENCES cbb_pitchers(pitcher_id);

-- Add foreign key from cbb_pitcher_participation to cbb_teams
ALTER TABLE cbb_pitcher_participation
ADD CONSTRAINT fk_pitcher_participation_team
FOREIGN KEY (team_id) REFERENCES cbb_teams(team_id);
