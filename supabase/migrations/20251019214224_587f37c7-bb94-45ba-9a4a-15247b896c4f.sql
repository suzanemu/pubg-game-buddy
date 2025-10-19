-- Enable realtime for teams table
ALTER TABLE public.teams REPLICA IDENTITY FULL;

-- Add teams table to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.teams;