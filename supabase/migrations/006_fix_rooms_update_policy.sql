-- =====================================================
-- MIGRATION: Fix Rooms Update Policy
-- =====================================================
-- Add UPDATE policy for rooms table so widget owners can close conversations

-- Widget owners can update their rooms (close, reopen, etc)
CREATE POLICY "Widget owners can update rooms" ON public.rooms
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.widgets 
      WHERE widgets.id = rooms.widget_id 
      AND widgets.user_id = auth.uid()
    )
  );

-- Success message
DO $$
BEGIN
    RAISE NOTICE '✅ Migration completed successfully!';
    RAISE NOTICE '🔓 Widget owners can now update their rooms (close/reopen conversations)';
END $$;



