-- =====================================================
-- MIGRATION: Block Messages in Closed Conversations
-- =====================================================
-- This migration adds a database-level constraint to prevent
-- inserting messages into closed conversations.

-- 1. Drop existing policies that allow unrestricted inserts
DROP POLICY IF EXISTS "Anyone can insert messages in their room" ON public.messages;
DROP POLICY IF EXISTS "Allow insert messages" ON public.messages;

-- 2. Create new policy that checks if room is open
CREATE POLICY "Can only insert messages in open rooms"
ON public.messages
FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 
        FROM public.rooms
        WHERE rooms.id = messages.room_id
        AND rooms.status = 'open'
    )
);

-- 3. Keep existing SELECT policy for reading messages
DROP POLICY IF EXISTS "Anyone can view messages in their rooms" ON public.messages;
CREATE POLICY "Anyone can view messages in their rooms"
ON public.messages
FOR SELECT
USING (true);

-- 4. Ensure Realtime is enabled for rooms table (so widget gets status updates)
-- This is important for the widget to know when a room is closed
-- Run this in Supabase Dashboard -> Database -> Replication if not already done:
-- ALTER PUBLICATION supabase_realtime ADD TABLE rooms;

-- 5. Add helpful comment
COMMENT ON POLICY "Can only insert messages in open rooms" ON public.messages IS 
'Prevents inserting messages into closed conversations. Widget will get a 403 error if room is closed.';

-- Success message
DO $$
BEGIN
    RAISE NOTICE '✅ Migration completed successfully!';
    RAISE NOTICE '🔒 Messages can only be inserted into open rooms';
    RAISE NOTICE '⚠️  Make sure Realtime is enabled on the rooms table!';
END $$;

