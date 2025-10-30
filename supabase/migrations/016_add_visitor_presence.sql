-- =====================================================
-- VISITOR PRESENCE TRACKING
-- =====================================================

-- Add last_activity column to rooms table
ALTER TABLE public.rooms 
ADD COLUMN IF NOT EXISTS last_activity TIMESTAMPTZ DEFAULT NOW();

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_rooms_last_activity ON public.rooms(last_activity);

-- Update trigger to update last_activity
CREATE OR REPLACE FUNCTION public.update_room_activity()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_activity = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS trigger_update_room_activity ON public.rooms;

-- Create trigger on room update
CREATE TRIGGER trigger_update_room_activity
  BEFORE UPDATE ON public.rooms
  FOR EACH ROW
  EXECUTE FUNCTION public.update_room_activity();

-- Function to check if visitor is online (active in last 3 minutes)
CREATE OR REPLACE FUNCTION public.is_visitor_online(room_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  last_activity_time TIMESTAMPTZ;
BEGIN
  SELECT last_activity INTO last_activity_time
  FROM public.rooms
  WHERE id = room_id;
  
  -- Consider online if activity within last 3 minutes
  RETURN (last_activity_time IS NOT NULL AND 
          last_activity_time > NOW() - INTERVAL '3 minutes');
END;
$$ LANGUAGE plpgsql;

-- Update existing rooms to have last_activity
UPDATE public.rooms 
SET last_activity = updated_at 
WHERE last_activity IS NULL;

-- =====================================================
-- COMMENT
-- =====================================================

COMMENT ON COLUMN public.rooms.last_activity IS 'Last activity timestamp from visitor (heartbeat)';
COMMENT ON FUNCTION public.is_visitor_online IS 'Check if visitor is currently online (active in last 3 minutes)';

