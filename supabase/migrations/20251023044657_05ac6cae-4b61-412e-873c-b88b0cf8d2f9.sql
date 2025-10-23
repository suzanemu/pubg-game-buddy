-- Fix critical security issue: Restrict access_codes visibility to admins only
DROP POLICY IF EXISTS "Anyone authenticated can read access codes" ON access_codes;

-- Add admin-only access policy
CREATE POLICY "Only admins can view access codes" 
ON access_codes FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));