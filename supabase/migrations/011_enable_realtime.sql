-- =============================================
-- ENABLE REALTIME FOR NOTIFICATIONS
-- =============================================
-- This migration enables Realtime subscriptions for the dashboard
-- so notifications work on ALL pages, not just the inbox
-- =============================================

-- Enable Realtime for messages table (if not already enabled)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public'
        AND tablename = 'messages'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
        RAISE NOTICE 'Realtime enabled for messages table';
    ELSE
        RAISE NOTICE 'Realtime already enabled for messages table';
    END IF;
END $$;

-- Enable Realtime for rooms table (if not already enabled)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public'
        AND tablename = 'rooms'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;
        RAISE NOTICE 'Realtime enabled for rooms table';
    ELSE
        RAISE NOTICE 'Realtime already enabled for rooms table';
    END IF;
END $$;

-- Enable Realtime for widgets table (if not already enabled)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public'
        AND tablename = 'widgets'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.widgets;
        RAISE NOTICE 'Realtime enabled for widgets table';
    ELSE
        RAISE NOTICE 'Realtime already enabled for widgets table';
    END IF;
END $$;

-- Verify Realtime is enabled
COMMENT ON TABLE public.messages IS 'Realtime enabled for dashboard notifications';
COMMENT ON TABLE public.rooms IS 'Realtime enabled for dashboard notifications';
COMMENT ON TABLE public.widgets IS 'Realtime enabled for dashboard notifications';

-- Show which tables have Realtime enabled
SELECT 
    schemaname,
    tablename,
    'Realtime ENABLED ✅' as status
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime' 
AND tablename IN ('messages', 'rooms', 'widgets')
ORDER BY tablename;

