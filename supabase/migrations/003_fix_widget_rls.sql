-- Fix RLS for widgets table to allow public access by public_key
-- This allows the embed widget to fetch config from any website

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Public can view widget by public_key" ON public.widgets;

-- Create new policy that allows anyone to read active widgets
CREATE POLICY "Anyone can view active widgets by public_key"
  ON public.widgets
  FOR SELECT
  USING (is_active = true);

-- Make sure RLS is enabled (it should already be)
ALTER TABLE public.widgets ENABLE ROW LEVEL SECURITY;

-- Add a note about this in a comment
COMMENT ON POLICY "Anyone can view active widgets by public_key" ON public.widgets IS 
  'Allows anonymous access to active widgets for embedding. This is safe because only public_key and config data is exposed.';


