-- Make match_number nullable and auto-increment
ALTER TABLE match_screenshots 
ALTER COLUMN match_number DROP NOT NULL,
ALTER COLUMN match_number SET DEFAULT 0;

-- Add a function to auto-assign match numbers based on team's screenshot count
CREATE OR REPLACE FUNCTION auto_assign_match_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.match_number IS NULL THEN
    SELECT COALESCE(MAX(match_number), 0) + 1 
    INTO NEW.match_number
    FROM match_screenshots
    WHERE team_id = NEW.team_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-assign match numbers
DROP TRIGGER IF EXISTS set_match_number ON match_screenshots;
CREATE TRIGGER set_match_number
  BEFORE INSERT ON match_screenshots
  FOR EACH ROW
  EXECUTE FUNCTION auto_assign_match_number();