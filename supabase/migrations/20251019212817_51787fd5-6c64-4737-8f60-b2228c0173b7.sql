-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'player');

-- Create user_roles table
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- RLS policies for user_roles - users can view their own roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Create tournaments table
CREATE TABLE public.tournaments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    total_matches INT NOT NULL DEFAULT 6,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on tournaments
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;

-- RLS policies for tournaments
CREATE POLICY "Anyone authenticated can view tournaments"
ON public.tournaments
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Only admins can insert tournaments"
ON public.tournaments
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can update tournaments"
ON public.tournaments
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can delete tournaments"
ON public.tournaments
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Create teams table
CREATE TABLE public.teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    tournament_id UUID REFERENCES public.tournaments(id) ON DELETE CASCADE NOT NULL,
    total_points INT DEFAULT 0,
    placement_points INT DEFAULT 0,
    kill_points INT DEFAULT 0,
    total_kills INT DEFAULT 0,
    matches_played INT DEFAULT 0,
    first_place_wins INT DEFAULT 0,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE (name, tournament_id)
);

-- Enable RLS on teams
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

-- RLS policies for teams
CREATE POLICY "Anyone authenticated can view teams"
ON public.teams
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Only admins can insert teams"
ON public.teams
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can update teams"
ON public.teams
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can delete teams"
ON public.teams
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Create access_codes table
CREATE TABLE public.access_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    role app_role NOT NULL,
    team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on access_codes
ALTER TABLE public.access_codes ENABLE ROW LEVEL SECURITY;

-- RLS policies for access_codes
CREATE POLICY "Anyone authenticated can read access codes"
ON public.access_codes
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Only admins can insert access codes"
ON public.access_codes
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can delete access codes"
ON public.access_codes
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Create sessions table
CREATE TABLE public.sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    role app_role NOT NULL,
    team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on sessions
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

-- RLS policies for sessions
CREATE POLICY "Users can view their own session"
ON public.sessions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own session"
ON public.sessions
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own session"
ON public.sessions
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own session"
ON public.sessions
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Create match_screenshots table
CREATE TABLE public.match_screenshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL,
    match_number INT NOT NULL,
    placement INT,
    kills INT,
    points INT,
    screenshot_url TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE (team_id, match_number)
);

-- Enable RLS on match_screenshots
ALTER TABLE public.match_screenshots ENABLE ROW LEVEL SECURITY;

-- RLS policies for match_screenshots
CREATE POLICY "Anyone authenticated can view match screenshots"
ON public.match_screenshots
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Players can insert screenshots for their own team"
ON public.match_screenshots
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.sessions
    WHERE sessions.user_id = auth.uid()
      AND sessions.team_id = match_screenshots.team_id
  )
);

CREATE POLICY "Admins can update match screenshots"
ON public.match_screenshots
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete match screenshots"
ON public.match_screenshots
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Create storage bucket for screenshots
INSERT INTO storage.buckets (id, name, public)
VALUES ('screenshots', 'screenshots', true)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS policies
CREATE POLICY "Anyone authenticated can view screenshots"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'screenshots');

CREATE POLICY "Authenticated users can upload screenshots"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'screenshots');

CREATE POLICY "Admins can delete screenshots"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'screenshots' AND public.has_role(auth.uid(), 'admin'));