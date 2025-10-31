-- Add icon_name column to widgets table
ALTER TABLE public.widgets 
ADD COLUMN IF NOT EXISTS icon_name TEXT DEFAULT 'MessageSquare';

-- Update existing widgets to have default icon
UPDATE public.widgets 
SET icon_name = 'MessageSquare' 
WHERE icon_name IS NULL;

