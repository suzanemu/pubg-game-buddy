-- Drop restrictive policies and create permissive ones for public screenshot submission
DROP POLICY IF EXISTS "Anyone can insert match screenshots" ON public.match_screenshots;
DROP POLICY IF EXISTS "Anyone can view match screenshots" ON public.match_screenshots;
DROP POLICY IF EXISTS "Anyone authenticated can view match screenshots" ON public.match_screenshots;

-- Create PERMISSIVE policies (default) that allow anyone to insert and view
CREATE POLICY "Public can insert match screenshots" 
ON public.match_screenshots 
FOR INSERT 
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Public can view match screenshots" 
ON public.match_screenshots 
FOR SELECT 
TO anon, authenticated
USING (true);

-- Storage: Drop and recreate as permissive
DROP POLICY IF EXISTS "Anyone can upload screenshots" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view screenshots" ON storage.objects;
DROP POLICY IF EXISTS "Anyone authenticated can view screenshots" ON storage.objects;

CREATE POLICY "Public can upload screenshots" 
ON storage.objects 
FOR INSERT 
TO anon, authenticated
WITH CHECK (bucket_id = 'screenshots');

CREATE POLICY "Public can view screenshots" 
ON storage.objects 
FOR SELECT 
TO anon, authenticated
USING (bucket_id = 'screenshots');