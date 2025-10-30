-- =============================================
-- ADD UNIQUE CONSTRAINT TO PREVENT DUPLICATE OPEN ROOMS
-- =============================================
-- This migration prevents a single visitor from having
-- multiple open rooms for the same widget (race condition fix)
-- =============================================

-- Drop existing index if it exists
DROP INDEX IF EXISTS idx_unique_open_room;

-- Create unique partial index
-- This ensures a visitor can only have ONE open room per widget
-- (closed rooms can be duplicated, which is OK)
CREATE UNIQUE INDEX idx_unique_open_room 
ON public.rooms(widget_id, visitor_id) 
WHERE status = 'open';

-- Add comment for documentation
COMMENT ON INDEX idx_unique_open_room IS 
'Prevents duplicate open rooms for the same visitor and widget. Allows multiple closed rooms.';

-- Verify the index was created
DO $$ 
DECLARE
    index_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 
        FROM pg_indexes 
        WHERE indexname = 'idx_unique_open_room'
    ) INTO index_exists;
    
    IF index_exists THEN
        RAISE NOTICE '✅ Unique constraint index created successfully';
    ELSE
        RAISE WARNING '⚠️  Failed to create unique constraint index';
    END IF;
END $$;

