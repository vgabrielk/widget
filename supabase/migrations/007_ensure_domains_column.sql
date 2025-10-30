-- =====================================================
-- Migration: Ensure domains column exists
-- =====================================================
-- This migration ensures the domains column exists in the widgets table
-- It's safe to run multiple times (idempotent)

-- Add domains column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'widgets' 
    AND column_name = 'domains'
  ) THEN
    ALTER TABLE public.widgets ADD COLUMN domains TEXT[];
    RAISE NOTICE 'Column domains added to widgets table';
  ELSE
    RAISE NOTICE 'Column domains already exists in widgets table';
  END IF;
END $$;

-- Ensure the column can accept NULL values
ALTER TABLE public.widgets ALTER COLUMN domains DROP NOT NULL;

-- Add comment to document the column
COMMENT ON COLUMN public.widgets.domains IS 'Array of allowed domains for widget security. NULL = all domains allowed';

