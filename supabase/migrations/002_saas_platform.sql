-- =====================================================
-- SAAS PLATFORM MIGRATION - Multi-tenant Chat Widget
-- =====================================================

-- Drop old tables if they exist
DROP TABLE IF EXISTS public.messages CASCADE;
DROP TABLE IF EXISTS public.rooms CASCADE;

-- =====================================================
-- 1. USERS (Managed by Supabase Auth)
-- =====================================================
-- Note: auth.users is managed by Supabase
-- We'll create a profiles table to extend user data

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  company_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 2. SUBSCRIPTIONS (Payment control)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_type TEXT NOT NULL CHECK (plan_type IN ('free', 'starter', 'pro', 'enterprise')),
  status TEXT NOT NULL CHECK (status IN ('active', 'trialing', 'past_due', 'canceled', 'paused')) DEFAULT 'trialing',
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  trial_ends_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '14 days',
  max_conversations INT DEFAULT 100,
  max_messages_per_month INT DEFAULT 1000,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 3. WIDGETS (Each client can have multiple widgets)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.widgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  public_key TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  
  -- Customization
  brand_color TEXT DEFAULT '#6366f1',
  position TEXT DEFAULT 'bottom-right' CHECK (position IN ('bottom-right', 'bottom-left')),
  welcome_message TEXT DEFAULT 'Olá! Como posso ajudar você hoje?',
  company_name TEXT,
  avatar_url TEXT,
  
  -- Settings
  is_active BOOLEAN DEFAULT true,
  domains TEXT[], -- Allowed domains
  language TEXT DEFAULT 'pt-BR',
  
  -- Stats
  total_conversations INT DEFAULT 0,
  total_messages INT DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 4. ROOMS (Conversations per widget/visitor)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  widget_id UUID NOT NULL REFERENCES public.widgets(id) ON DELETE CASCADE,
  visitor_id TEXT NOT NULL, -- Anonymous visitor ID
  visitor_name TEXT,
  visitor_email TEXT,
  visitor_ip TEXT,
  visitor_user_agent TEXT,
  
  -- Status
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'closed', 'archived')),
  assigned_to UUID REFERENCES auth.users(id), -- Admin who responded
  
  -- Metadata
  unread_count INT DEFAULT 0,
  last_message_at TIMESTAMPTZ,
  last_message_preview TEXT,
  
  -- Tracking
  page_url TEXT,
  page_title TEXT,
  referrer TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(widget_id, visitor_id)
);

-- =====================================================
-- 5. MESSAGES (Real-time chat messages)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  
  sender_type TEXT NOT NULL CHECK (sender_type IN ('visitor', 'agent', 'bot')),
  sender_id TEXT NOT NULL, -- visitor_id or user_id
  sender_name TEXT,
  sender_avatar TEXT,
  
  content TEXT NOT NULL,
  message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'file', 'system')),
  
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- INDEXES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions(status);

CREATE INDEX IF NOT EXISTS idx_widgets_user_id ON public.widgets(user_id);
CREATE INDEX IF NOT EXISTS idx_widgets_public_key ON public.widgets(public_key);
CREATE INDEX IF NOT EXISTS idx_widgets_active ON public.widgets(is_active);

CREATE INDEX IF NOT EXISTS idx_rooms_widget_id ON public.rooms(widget_id);
CREATE INDEX IF NOT EXISTS idx_rooms_visitor_id ON public.rooms(visitor_id);
CREATE INDEX IF NOT EXISTS idx_rooms_status ON public.rooms(status);
CREATE INDEX IF NOT EXISTS idx_rooms_assigned_to ON public.rooms(assigned_to);

CREATE INDEX IF NOT EXISTS idx_messages_room_id ON public.messages(room_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at DESC);

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.widgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- PROFILES: Users can only see/edit their own profile
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- SUBSCRIPTIONS: Users can only see their own subscription
CREATE POLICY "Users can view own subscription" ON public.subscriptions
  FOR SELECT USING (auth.uid() = user_id);

-- WIDGETS: Users can manage their own widgets
CREATE POLICY "Users can view own widgets" ON public.widgets
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own widgets" ON public.widgets
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own widgets" ON public.widgets
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own widgets" ON public.widgets
  FOR DELETE USING (auth.uid() = user_id);

-- Public can view active widgets by public_key (for embed)
CREATE POLICY "Public can view widget by public_key" ON public.widgets
  FOR SELECT USING (is_active = true);

-- ROOMS: Widget owners can see all rooms, visitors can see their own
CREATE POLICY "Widget owners can view rooms" ON public.rooms
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.widgets 
      WHERE widgets.id = rooms.widget_id 
      AND widgets.user_id = auth.uid()
    )
  );

CREATE POLICY "Public can create rooms" ON public.rooms
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Public can view own rooms" ON public.rooms
  FOR SELECT USING (true);

-- MESSAGES: Widget owners and visitors can see messages
CREATE POLICY "Widget owners can view messages" ON public.messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.rooms
      JOIN public.widgets ON rooms.widget_id = widgets.id
      WHERE rooms.id = messages.room_id
      AND widgets.user_id = auth.uid()
    )
  );

CREATE POLICY "Public can view messages" ON public.messages
  FOR SELECT USING (true);

CREATE POLICY "Public can create messages" ON public.messages
  FOR INSERT WITH CHECK (true);

-- =====================================================
-- FUNCTIONS & TRIGGERS
-- =====================================================

-- Function to update room stats when message is inserted
CREATE OR REPLACE FUNCTION public.update_room_on_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.rooms
  SET 
    last_message_at = NEW.created_at,
    last_message_preview = SUBSTRING(NEW.content, 1, 100),
    updated_at = NEW.created_at,
    unread_count = CASE 
      WHEN NEW.sender_type = 'visitor' THEN unread_count + 1
      ELSE unread_count
    END
  WHERE id = NEW.room_id;
  
  -- Update widget stats
  UPDATE public.widgets
  SET total_messages = total_messages + 1
  WHERE id = (SELECT widget_id FROM public.rooms WHERE id = NEW.room_id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger
DROP TRIGGER IF EXISTS trigger_update_room_on_message ON public.messages;
CREATE TRIGGER trigger_update_room_on_message
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_room_on_message();

-- Function to update widget stats when room is created
CREATE OR REPLACE FUNCTION public.update_widget_on_room()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.widgets
  SET total_conversations = total_conversations + 1
  WHERE id = NEW.widget_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger
DROP TRIGGER IF EXISTS trigger_update_widget_on_room ON public.rooms;
CREATE TRIGGER trigger_update_widget_on_room
  AFTER INSERT ON public.rooms
  FOR EACH ROW
  EXECUTE FUNCTION public.update_widget_on_room();

-- Function to create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email);
  
  -- Create trial subscription
  INSERT INTO public.subscriptions (user_id, plan_type, status)
  VALUES (NEW.id, 'free', 'trialing');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- REALTIME
-- =====================================================

-- Enable Realtime for tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.widgets;

-- =====================================================
-- SEED DATA (Optional - for testing)
-- =====================================================

-- This will be created automatically by the trigger when users sign up



