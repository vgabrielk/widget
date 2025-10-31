-- Update default brand_color to match new primary color
ALTER TABLE public.widgets 
ALTER COLUMN brand_color SET DEFAULT '#0BC3DF';

