// =====================================================
// SAAS PLATFORM TYPES
// =====================================================

export interface Profile {
  id: string;
  email: string;
  company_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  plan_type: 'free' | 'starter' | 'pro' | 'enterprise';
  status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'paused';
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  trial_ends_at: string | null;
  max_conversations: number;
  max_messages_per_month: number;
  created_at: string;
  updated_at: string;
}

export interface Widget {
  id: string;
  user_id: string;
  name: string;
  public_key: string;
  
  // Customization
  brand_color: string;
  position: 'bottom-right' | 'bottom-left';
  welcome_message: string;
  company_name: string | null;
  avatar_url: string | null;
  
  // Settings
  is_active: boolean;
  domains: string[] | null;
  language: string;
  
  // Stats
  total_conversations: number;
  total_messages: number;
  
  created_at: string;
  updated_at: string;
}

export interface Room {
  id: string;
  widget_id: string;
  visitor_id: string;
  visitor_name: string | null;
  visitor_email: string | null;
  visitor_ip: string | null;
  visitor_user_agent: string | null;
  
  // Status
  status: 'open' | 'closed' | 'archived';
  assigned_to: string | null;
  
  // Metadata
  unread_count: number;
  last_message_at: string | null;
  last_message_preview: string | null;
  
  // Tracking
  page_url: string | null;
  page_title: string | null;
  referrer: string | null;
  
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  room_id: string;
  
  sender_type: 'visitor' | 'agent' | 'bot';
  sender_id: string;
  sender_name: string | null;
  sender_avatar: string | null;
  
  content: string | null;
  message_type: 'text' | 'image' | 'file' | 'system';
  
  // Image support
  image_url?: string | null;
  image_name?: string | null;
  
  is_read: boolean;
  read_at: string | null;
  
  created_at: string;
}

// Plan features
export interface PlanFeatures {
  name: string;
  price: number;
  interval: 'month' | 'year';
  features: {
    conversations: number;
    messages: number;
    widgets: number;
    teamMembers: number;
    customBranding: boolean;
    analytics: boolean;
    priority: boolean;
    api: boolean;
  };
}

export const PLANS: Record<string, PlanFeatures> = {
  free: {
    name: 'Free',
    price: 0,
    interval: 'month',
    features: {
      conversations: 50,
      messages: 500,
      widgets: 1,
      teamMembers: 1,
      customBranding: false,
      analytics: false,
      priority: false,
      api: false,
    },
  },
  starter: {
    name: 'Starter',
    price: 29,
    interval: 'month',
    features: {
      conversations: 500,
      messages: 5000,
      widgets: 3,
      teamMembers: 3,
      customBranding: true,
      analytics: true,
      priority: false,
      api: false,
    },
  },
  pro: {
    name: 'Pro',
    price: 99,
    interval: 'month',
    features: {
      conversations: 2000,
      messages: 20000,
      widgets: 10,
      teamMembers: 10,
      customBranding: true,
      analytics: true,
      priority: true,
      api: true,
    },
  },
  enterprise: {
    name: 'Enterprise',
    price: 299,
    interval: 'month',
    features: {
      conversations: -1, // unlimited
      messages: -1,
      widgets: -1,
      teamMembers: -1,
      customBranding: true,
      analytics: true,
      priority: true,
      api: true,
    },
  },
};

