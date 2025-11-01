-- Recalculate team stats automatically when match_screenshots change
-- Placement points helper
CREATE OR REPLACE FUNCTION public.calculate_placement_points(placement integer)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE placement
    WHEN 1 THEN 10
    WHEN 2 THEN 6
    WHEN 3 THEN 5
    WHEN 4 THEN 4
    WHEN 5 THEN 3
    WHEN 6 THEN 2
    WHEN 7 THEN 1
    WHEN 8 THEN 1
    ELSE 0
  END;
$$;

-- Main recalculation function
CREATE OR REPLACE FUNCTION public.recalculate_team_stats(p_team_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_placement_points integer := 0;
  v_total_kills integer := 0;
  v_kill_points integer := 0;
  v_matches integer := 0;
  v_wwcd integer := 0;
BEGIN
  SELECT
    COALESCE(SUM(public.calculate_placement_points(ms.placement)), 0),
    COALESCE(SUM(COALESCE(ms.kills, 0)), 0),
    COALESCE(COUNT(*), 0),
    COALESCE(SUM(CASE WHEN ms.placement = 1 THEN 1 ELSE 0 END), 0)
  INTO
    v_placement_points,
    v_total_kills,
    v_matches,
    v_wwcd
  FROM public.match_screenshots ms
  WHERE ms.team_id = p_team_id;

  -- KILL_POINTS = 1
  v_kill_points := v_total_kills;

  UPDATE public.teams t
  SET
    placement_points = v_placement_points,
    kill_points = v_kill_points,
    total_kills = v_total_kills,
    matches_played = v_matches,
    first_place_wins = v_wwcd,
    total_points = v_placement_points + v_kill_points
  WHERE t.id = p_team_id;
END;
$$;

-- Trigger wrapper
CREATE OR REPLACE FUNCTION public.tg_recalculate_team_stats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    PERFORM public.recalculate_team_stats(OLD.team_id);
    RETURN OLD;
  ELSE
    PERFORM public.recalculate_team_stats(NEW.team_id);
    RETURN NEW;
  END IF;
END;
$$;

-- Create trigger on match_screenshots
DROP TRIGGER IF EXISTS trg_recalculate_team_stats ON public.match_screenshots;
CREATE TRIGGER trg_recalculate_team_stats
AFTER INSERT OR UPDATE OR DELETE ON public.match_screenshots
FOR EACH ROW EXECUTE FUNCTION public.tg_recalculate_team_stats();

-- Backfill all current teams once
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.teams LOOP
    PERFORM public.recalculate_team_stats(r.id);
  END LOOP;
END;$$;