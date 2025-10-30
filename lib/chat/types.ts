export interface Room {
  id: string;
  visitor_id: string;
  visitor_name: string | null;
  visitor_email: string | null;
  status: 'active' | 'closed';
  unread_count: number;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  room_id: string;
  sender_type: 'visitor' | 'admin';
  sender_id: string;
  sender_name: string | null;
  content: string;
  is_read: boolean;
  created_at: string;
}

export interface ChatWidgetConfig {
  supabaseUrl: string;
  supabaseKey: string;
  theme?: 'light' | 'dark' | 'auto';
  position?: 'bottom-right' | 'bottom-left';
  brandColor?: string;
  welcomeMessage?: string;
}

