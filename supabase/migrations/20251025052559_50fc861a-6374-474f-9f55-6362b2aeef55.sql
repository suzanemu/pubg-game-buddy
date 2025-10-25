-- Create a secure function to validate access codes during login
-- This allows code validation without exposing all codes
CREATE OR REPLACE FUNCTION public.validate_access_code(_code text)
RETURNS TABLE(role app_role, team_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role, team_id
  FROM public.access_codes
  WHERE code = _code
  LIMIT 1;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.validate_access_code(text) TO authenticated;