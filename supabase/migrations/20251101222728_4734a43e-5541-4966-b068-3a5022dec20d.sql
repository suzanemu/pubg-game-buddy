-- Allow players to delete screenshots for their own team
CREATE POLICY "Players can delete screenshots for their own team"
ON public.match_screenshots
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM sessions
    WHERE sessions.user_id = auth.uid()
    AND sessions.team_id = match_screenshots.team_id
  )
);