-- Allow anyone (including anonymous/public) to insert match screenshots
CREATE POLICY "Anyone can insert match screenshots" 
ON public.match_screenshots 
FOR INSERT 
WITH CHECK (true);

-- Allow anyone to view match screenshots (for the public screenshot gallery)
DROP POLICY IF EXISTS "Anyone authenticated can view match screenshots" ON public.match_screenshots;
CREATE POLICY "Anyone can view match screenshots" 
ON public.match_screenshots 
FOR SELECT 
USING (true);

-- Allow anyone to upload screenshots to storage
CREATE POLICY "Anyone can upload screenshots" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'screenshots');

-- Update screenshot viewing policy
DROP POLICY IF EXISTS "Anyone authenticated can view screenshots" ON storage.objects;
CREATE POLICY "Anyone can view screenshots" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'screenshots');