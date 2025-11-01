-- =============================================
-- DEBUG AND FIX RLS POLICIES
-- =============================================
-- This migration verifies and fixes RLS policies
-- =============================================

-- First, let's check current policies
DO $$ 
BEGIN
    RAISE NOTICE '=== CURRENT RLS POLICIES ===';
END $$;

-- Show all policies on rooms
SELECT 
    schemaname, 
    tablename, 
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies 
WHERE tablename IN ('rooms', 'messages', 'widgets')
ORDER BY tablename, policyname;

-- Drop ALL existing policies to start fresh
DROP POLICY IF EXISTS "Allow reading rooms" ON public.rooms;
DROP POLICY IF EXISTS "Allow creating rooms with valid widget" ON public.rooms;
DROP POLICY IF EXISTS "Allow updating rooms" ON public.rooms;
DROP POLICY IF EXISTS "Only authenticated users can delete rooms" ON public.rooms;

DROP POLICY IF EXISTS "Allow reading messages from valid rooms" ON public.messages;
DROP POLICY IF EXISTS "Allow creating messages in open rooms" ON public.messages;
DROP POLICY IF EXISTS "Only authenticated users can update messages" ON public.messages;
DROP POLICY IF EXISTS "Only authenticated users can delete messages" ON public.messages;

-- =============================================
-- RECREATE ROOMS POLICIES (SIMPLIFIED AND FIXED)
-- =============================================

-- Policy 1: SELECT - Allow reading rooms
CREATE POLICY "Allow reading rooms"
  ON public.rooms
  FOR SELECT
  USING (
    -- Anonymous users (visitors) can read rooms
    auth.uid() IS NULL
    OR 
    -- Authenticated users can read rooms from their widgets
    EXISTS (
      SELECT 1 FROM public.widgets 
      WHERE widgets.id = rooms.widget_id 
      AND widgets.user_id = auth.uid()
    )
  );

-- Policy 2: INSERT - Allow creating rooms with valid widget
CREATE POLICY "Allow creating rooms"
  ON public.rooms
  FOR INSERT
  WITH CHECK (
    widget_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.widgets 
      WHERE id = widget_id 
      AND is_active = true
    )
  );

-- Policy 3: UPDATE - Allow updating rooms
CREATE POLICY "Allow updating rooms"
  ON public.rooms
  FOR UPDATE
  USING (
    -- Anonymous users can update (for visitor actions)
    auth.uid() IS NULL
    OR 
    -- Authenticated users can update their widget's rooms
    EXISTS (
      SELECT 1 FROM public.widgets 
      WHERE widgets.id = rooms.widget_id 
      AND widgets.user_id = auth.uid()
    )
  );

-- Policy 4: DELETE - Only authenticated users can delete rooms
CREATE POLICY "Allow deleting rooms"
  ON public.rooms
  FOR DELETE
  USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.widgets 
      WHERE widgets.id = rooms.widget_id 
      AND widgets.user_id = auth.uid()
    )
  );

-- =============================================
-- RECREATE MESSAGES POLICIES (SIMPLIFIED AND FIXED)
-- =============================================

-- Policy 1: SELECT - Allow reading messages
CREATE POLICY "Allow reading messages"
  ON public.messages
  FOR SELECT
  USING (
    -- Anonymous users can read
    auth.uid() IS NULL
    OR
    -- Authenticated users can read messages from rooms in their widgets
    EXISTS (
      SELECT 1 FROM public.rooms
      INNER JOIN public.widgets ON widgets.id = rooms.widget_id
      WHERE rooms.id = messages.room_id
      AND widgets.user_id = auth.uid()
    )
  );

-- Policy 2: INSERT - Allow creating messages
CREATE POLICY "Allow creating messages"
  ON public.messages
  FOR INSERT
  WITH CHECK (
    -- Must be in an open room with a valid widget
    EXISTS (
      SELECT 1 FROM public.rooms
      WHERE rooms.id = room_id
      AND rooms.widget_id IS NOT NULL
      AND rooms.status = 'open'
    )
  );

-- Policy 3: UPDATE - Only authenticated users can update
CREATE POLICY "Allow updating messages"
  ON public.messages
  FOR UPDATE
  USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.rooms
      INNER JOIN public.widgets ON widgets.id = rooms.widget_id
      WHERE rooms.id = messages.room_id
      AND widgets.user_id = auth.uid()
    )
  );

-- Policy 4: DELETE - Only authenticated users can delete
CREATE POLICY "Allow deleting messages"
  ON public.messages
  FOR DELETE
  USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.rooms
      INNER JOIN public.widgets ON widgets.id = rooms.widget_id
      WHERE rooms.id = messages.room_id
      AND widgets.user_id = auth.uid()
    )
  );

-- =============================================
-- VERIFY POLICIES WERE CREATED
-- =============================================

DO $$ 
DECLARE
    rooms_policies_count INT;
    messages_policies_count INT;
BEGIN
    SELECT COUNT(*) INTO rooms_policies_count
    FROM pg_policies 
    WHERE tablename = 'rooms';
    
    SELECT COUNT(*) INTO messages_policies_count
    FROM pg_policies 
    WHERE tablename = 'messages';
    
    RAISE NOTICE '=== POLICIES CREATED ===';
    RAISE NOTICE 'Rooms policies: %', rooms_policies_count;
    RAISE NOTICE 'Messages policies: %', messages_policies_count;
    
    IF rooms_policies_count < 4 THEN
        RAISE WARNING 'Expected 4 rooms policies, got %', rooms_policies_count;
    END IF;
    
    IF messages_policies_count < 4 THEN
        RAISE WARNING 'Expected 4 messages policies, got %', messages_policies_count;
    END IF;
END $$;

-- Show final policies
SELECT 
    tablename, 
    policyname,
    cmd as operation,
    CASE 
        WHEN roles = '{public}' THEN 'public'
        ELSE roles::text 
    END as roles
FROM pg_policies 
WHERE tablename IN ('rooms', 'messages')
ORDER BY tablename, cmd, policyname;



