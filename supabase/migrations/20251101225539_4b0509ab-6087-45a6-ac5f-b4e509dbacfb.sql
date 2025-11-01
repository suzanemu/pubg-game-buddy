-- Add INSERT policy for admins on match_screenshots
CREATE POLICY "Admins can insert match screenshots" 
ON public.match_screenshots 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));