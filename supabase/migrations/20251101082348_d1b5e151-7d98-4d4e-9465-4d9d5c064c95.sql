-- Allow manual entries without screenshots
ALTER TABLE public.match_screenshots
  ALTER COLUMN screenshot_url DROP NOT NULL;

-- Add a comment to clarify manual entries
COMMENT ON COLUMN public.match_screenshots.screenshot_url IS 'URL of the screenshot. Can be NULL for manual admin entries.';