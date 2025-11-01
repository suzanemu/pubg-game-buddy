-- Fix the search_path for the auto_assign_match_number function
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
$$ LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public;