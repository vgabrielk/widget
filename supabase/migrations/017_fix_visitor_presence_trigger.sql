-- =====================================================
-- FIX VISITOR PRESENCE - REMOVE AUTO-UPDATE TRIGGER
-- =====================================================

-- Problem: trigger_update_room_activity was updating last_activity
-- on EVERY room update, including when owner clicks on conversation
-- 
-- Solution: Remove the trigger. last_activity should ONLY be updated by:
-- 1. Visitor heartbeat (POST /api/visitor/heartbeat)
-- 2. Visitor going offline (POST /api/visitor/offline)

-- Drop the problematic trigger
DROP TRIGGER IF EXISTS trigger_update_room_activity ON public.rooms;

-- Drop the function (no longer needed)
DROP FUNCTION IF EXISTS public.update_room_activity();

-- =====================================================
-- COMMENT
-- =====================================================

COMMENT ON COLUMN public.rooms.last_activity IS 'Last activity timestamp from visitor (updated ONLY by heartbeat/offline endpoints, not by room updates)';

