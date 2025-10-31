-- Create rooms table for chat sessions
CREATE TABLE IF NOT EXISTS public.rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id TEXT NOT NULL,
  visitor_name TEXT,
  visitor_email TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'closed')),
  unread_count INTEGER DEFAULT 0,
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create messages table
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('visitor', 'admin')),
  sender_id TEXT NOT NULL,
  sender_name TEXT,
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_messages_room_id ON public.messages(room_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rooms_visitor_id ON public.rooms(visitor_id);
CREATE INDEX IF NOT EXISTS idx_rooms_status ON public.rooms(status);

-- Enable Row Level Security
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Policies for rooms table
-- Allow anonymous users to read their own room
CREATE POLICY "Users can read their own room"
  ON public.rooms FOR SELECT
  USING (true);

-- Allow anonymous users to create rooms
CREATE POLICY "Users can create rooms"
  ON public.rooms FOR INSERT
  WITH CHECK (true);

-- Allow users to update their own room
CREATE POLICY "Users can update their own room"
  ON public.rooms FOR UPDATE
  USING (true);

-- Policies for messages table
-- Allow reading messages from any room
CREATE POLICY "Users can read messages"
  ON public.messages FOR SELECT
  USING (true);

-- Allow creating messages
CREATE POLICY "Users can create messages"
  ON public.messages FOR INSERT
  WITH CHECK (true);

-- Function to update room's last_message_at
CREATE OR REPLACE FUNCTION public.update_room_last_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.rooms
  SET 
    last_message_at = NEW.created_at,
    updated_at = NEW.created_at,
    unread_count = CASE 
      WHEN NEW.sender_type = 'visitor' THEN unread_count + 1
      ELSE unread_count
    END
  WHERE id = NEW.room_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update room when message is inserted
CREATE TRIGGER update_room_on_message
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_room_last_message();

-- Enable Realtime for messages table
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;


