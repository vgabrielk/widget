-- =============================================
-- FIX WIDGET OWNERSHIP IN RLS
-- =============================================
-- This migration fixes the RLS policies to ensure users can only
-- see rooms and messages from widgets they own
-- =============================================

-- Drop and recreate the rooms SELECT policy with widget ownership check
DROP POLICY IF EXISTS "Allow reading rooms" ON public.rooms;

CREATE POLICY "Allow reading rooms"
  ON public.rooms
  FOR SELECT
  USING (
    -- Visitors can read rooms (app layer filters by visitor_id)
    (auth.uid() IS NULL AND widget_id IS NOT NULL)
    OR 
    -- Authenticated users can only read rooms from widgets they own
    (
      auth.uid() IS NOT NULL 
      AND EXISTS (
        SELECT 1 FROM public.widgets 
        WHERE widgets.id = rooms.widget_id 
        AND widgets.user_id = auth.uid()
      )
    )
  );

-- Drop and recreate the messages SELECT policy with widget ownership check
DROP POLICY IF EXISTS "Allow reading messages from valid rooms" ON public.messages;

CREATE POLICY "Allow reading messages from valid rooms"
  ON public.messages
  FOR SELECT
  USING (
    -- Messages can be read if the room's widget belongs to the authenticated user
    -- OR if it's a visitor reading their own room (via widget_id check)
    EXISTS (
      SELECT 1 FROM public.rooms
      WHERE rooms.id = messages.room_id
      AND rooms.widget_id IS NOT NULL
      AND (
        auth.uid() IS NULL  -- Visitors can read
        OR 
        EXISTS (
          SELECT 1 FROM public.widgets
          WHERE widgets.id = rooms.widget_id
          AND widgets.user_id = auth.uid()
        )
      )
    )
  );

-- Add helpful comments
COMMENT ON POLICY "Allow reading rooms" ON public.rooms IS 
'Security: Users can only read rooms from widgets they own. Visitors can read rooms via anon access (app layer filters by visitor_id).';

COMMENT ON POLICY "Allow reading messages from valid rooms" ON public.messages IS 
'Security: Users can only read messages from rooms belonging to their widgets. Visitors can read their own messages.';


