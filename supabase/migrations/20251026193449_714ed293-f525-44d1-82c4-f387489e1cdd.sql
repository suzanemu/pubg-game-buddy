-- Allow unauthenticated users to view teams (for public leaderboard)
DROP POLICY IF EXISTS "Anyone authenticated can view teams" ON teams;

CREATE POLICY "Anyone can view teams"
ON teams
FOR SELECT
USING (true);