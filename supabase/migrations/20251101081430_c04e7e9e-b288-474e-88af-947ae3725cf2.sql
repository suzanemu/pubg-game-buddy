-- Fix duplicate match_number conflicts and enable auto-assignment
-- 1) Drop bad default that causes duplicate 0 values
ALTER TABLE public.match_screenshots
  ALTER COLUMN match_number DROP DEFAULT;

-- 2) Ensure the auto-assign function also handles zero values (idempotent)
CREATE OR REPLACE FUNCTION public.auto_assign_match_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Assign next match_number when it's missing or set to 0
  IF NEW.match_number IS NULL OR NEW.match_number = 0 THEN
    SELECT COALESCE(MAX(match_number), 0) + 1 
      INTO NEW.match_number
      FROM match_screenshots
     WHERE team_id = NEW.team_id;
  END IF;
  RETURN NEW;
END;
$function$;

-- 3) Create the BEFORE INSERT trigger if it doesn't exist yet
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_match_number_before_insert') THEN
    CREATE TRIGGER set_match_number_before_insert
    BEFORE INSERT ON public.match_screenshots
    FOR EACH ROW
    EXECUTE FUNCTION public.auto_assign_match_number();
  END IF;
END$$;