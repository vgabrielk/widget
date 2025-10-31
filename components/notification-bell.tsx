'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Bell, MessageSquare, CheckCheck, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useTabNotification } from '@/hooks/use-tab-notification';

interface Notification {
  id: string;
  type: 'new_message' | 'new_conversation' | 'conversation_closed';
  title: string;
  message: string;
  room_id?: string;
  widget_id?: string;
  is_read: boolean;
  created_at: string;
}

interface NotificationBellProps {
  userId: string;
}

export function NotificationBell({ userId }: NotificationBellProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  // Tab title notification hook
  const { restoreTitle } = useTabNotification({
    hasNotifications: unreadCount > 0,
  });

  const previousUnreadCountRef = useRef(0);

  const loadNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/user/notifications', {
        credentials: 'include',
      });

      if (!res.ok) {
        throw new Error('Failed to load notifications');
      }

      const data = await res.json();
      const newNotifications = data.notifications || [];
      const newUnreadCount = data.unreadCount || 0;
      
      // Show browser notification if unread count increased
      if (previousUnreadCountRef.current < newUnreadCount && newNotifications.length > 0) {
        const newestNotification = newNotifications[0];
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('Nova Mensagem no ChatWidget', {
            body: newestNotification.message || 'Você recebeu uma nova mensagem de um visitante',
            icon: '/icon.png',
            tag: `notification-${newestNotification.id}`,
            requireInteraction: false,
          });
        }
      }
      
      previousUnreadCountRef.current = newUnreadCount;
      setNotifications(newNotifications);
      setUnreadCount(newUnreadCount);
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounce loadNotifications to prevent excessive calls
  const loadingNotificationsRef = useRef(false);
  const loadNotificationsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const DEBOUNCE_DELAY = 500; // 500ms debounce for UI updates
  
  const debouncedLoadNotifications = useCallback(async () => {
    // Clear existing timeout
    if (loadNotificationsTimeoutRef.current) {
      clearTimeout(loadNotificationsTimeoutRef.current);
    }
    
    // Skip if already loading
    if (loadingNotificationsRef.current) {
      // Schedule for after current load finishes
      loadNotificationsTimeoutRef.current = setTimeout(() => {
        debouncedLoadNotifications();
      }, DEBOUNCE_DELAY);
      return;
    }
    
    // Schedule load with debounce
    loadNotificationsTimeoutRef.current = setTimeout(async () => {
      if (loadingNotificationsRef.current) return;
      
      loadingNotificationsRef.current = true;
      try {
        await loadNotifications();
      } finally {
        loadingNotificationsRef.current = false;
      }
    }, DEBOUNCE_DELAY);
  }, [loadNotifications]);

  // Cache user's widget IDs
  const userWidgetIdsRef = useRef<Set<string>>(new Set());
  const subscriptionChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const subscribeToNotifications = useCallback(() => {
    // Clean up existing subscription
    if (subscriptionChannelRef.current) {
      supabase.removeChannel(subscriptionChannelRef.current);
      subscriptionChannelRef.current = null;
    }

    // Get user's widget IDs via API
    fetch('/api/user/widgets', {
      credentials: 'include',
    })
      .then(res => res.json())
      .then(({ widgets }) => {
        if (!widgets || widgets.length === 0) return;
        
        const widgetIds = widgets.map((w: { id: string }) => w.id);
        userWidgetIdsRef.current = new Set(widgetIds);
        
        // Create channel for real-time updates (only subscriptions, no queries)
        const channel = supabase
          .channel(`notifications-${userId}`, {
            config: {
              broadcast: { self: false },
            },
          })
          // Subscribe to new messages (for notifications)
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'messages',
              filter: `sender_type=eq.visitor`,
            },
            async (payload) => {
              const newMessage = payload.new as any;
              
              // Update notifications (this will check if room belongs to user's widgets via API)
              // The API will only return notifications for user's widgets, so it's safe to update
              debouncedLoadNotifications();
            }
          );

        // Subscribe to rooms updates - create separate subscriptions for each widget
        // because Supabase Realtime doesn't support 'in.()' operator in filters
        widgetIds.forEach((widgetId) => {
          channel
            .on(
              'postgres_changes',
              {
                event: 'UPDATE',
                schema: 'public',
                table: 'rooms',
                filter: `widget_id=eq.${widgetId}`,
              },
              (payload) => {
                const updatedRoom = payload.new as any;
                const oldRoom = payload.old as any;
                
                // Only update if unread_count changed
                if (oldRoom?.unread_count !== updatedRoom?.unread_count) {
                  debouncedLoadNotifications();
                }
              }
            );
        });

        channel
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              console.log('🔔 [Notifications] Subscribed to messages and rooms for real-time notifications');
            } else if (status === 'CHANNEL_ERROR') {
              console.error('❌ [Notifications] Channel error:', status);
            }
          });

        subscriptionChannelRef.current = channel;
      })
      .catch((error) => {
        console.error('Error loading widgets for notifications:', error);
      });

    return () => {
      if (subscriptionChannelRef.current) {
        supabase.removeChannel(subscriptionChannelRef.current);
        subscriptionChannelRef.current = null;
      }
      if (loadNotificationsTimeoutRef.current) {
        clearTimeout(loadNotificationsTimeoutRef.current);
        loadNotificationsTimeoutRef.current = null;
      }
    };
  }, [userId, supabase, debouncedLoadNotifications]);

  useEffect(() => {
    if (!userId) return;
    
    // Initial load
    loadNotifications();
    
    // Subscribe to real-time notifications
    const cleanup = subscribeToNotifications();
    
    return () => {
      if (cleanup) cleanup();
      // Clean up any pending timeouts
      if (loadNotificationsTimeoutRef.current) {
        clearTimeout(loadNotificationsTimeoutRef.current);
        loadNotificationsTimeoutRef.current = null;
      }
    };
  }, [userId, loadNotifications, subscribeToNotifications]);

  const handleNotificationClick = useCallback(async (notification: Notification) => {
    // Restore title when user clicks on notification (views it)
    restoreTitle();
    
    if (notification.widget_id && notification.room_id) {
      // Navigate directly to the specific conversation using dynamic route
      router.push(`/dashboard/widgets/${notification.widget_id}/inbox/${notification.room_id}`);
    } else if (notification.widget_id) {
      // Fallback to inbox if room_id is missing
      router.push(`/dashboard/widgets/${notification.widget_id}/inbox`);
    }
  }, [router, restoreTitle]);

  const markAllAsRead = useCallback(async () => {
    try {
      const res = await fetch('/api/user/notifications/read-all', {
        method: 'PATCH',
        credentials: 'include',
      });

      if (!res.ok) {
        throw new Error('Failed to mark all as read');
      }

      setNotifications([]);
      setUnreadCount(0);
      
      // Restore title when all notifications are marked as read
      restoreTitle();
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  }, [restoreTitle]);

  useEffect(() => {
    const requestNotificationPermission = async () => {
      if ('Notification' in window && Notification.permission === 'default') {
        await Notification.requestPermission();
      }
    };
    
    requestNotificationPermission();
  }, []);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9 sm:h-10 sm:w-10">
          <Bell className="h-4 w-4 sm:h-5 sm:w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 sm:-top-1 sm:-right-1 h-4 w-4 sm:h-5 sm:w-5 rounded-full bg-primary text-[9px] sm:text-[10px] font-bold text-primary-foreground flex items-center justify-center animate-pulse">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[calc(100vw-2rem)] sm:w-80 max-w-md">
        <DropdownMenuLabel className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <span className="text-sm sm:text-base">Notificações</span>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto p-1 text-xs"
              onClick={markAllAsRead}
            >
              <CheckCheck className="h-3 w-3 mr-1" />
              <span className="hidden sm:inline">Marcar todas como lidas</span>
              <span className="sm:hidden">Marcar lidas</span>
            </Button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {loading ? (
          <div className="p-3 sm:p-4 text-center text-xs sm:text-sm text-muted-foreground">
            Carregando...
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-6 sm:p-8 text-center">
            <Bell className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
            <p className="text-xs sm:text-sm font-medium text-muted-foreground">
              Nenhuma notificação
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Você está em dia! 🎉
            </p>
          </div>
        ) : (
          <div className="max-h-[60vh] sm:max-h-[400px] overflow-y-auto">
            {notifications.map((notification) => (
              <DropdownMenuItem
                key={notification.id}
                className="flex items-start gap-2 sm:gap-3 p-3 sm:p-4 cursor-pointer hover:bg-accent"
                onClick={() => handleNotificationClick(notification)}
              >
                <div className="flex h-8 w-8 sm:h-10 sm:w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <MessageSquare className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                </div>
                <div className="flex-1 space-y-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs sm:text-sm font-medium leading-none truncate">
                      {notification.title}
                    </p>
                    {!notification.is_read && (
                      <Badge variant="default" className="h-2 w-2 rounded-full p-0 flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {notification.message}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(notification.created_at), {
                      addSuffix: true,
                      locale: ptBR,
                    })}
                  </p>
                </div>
                <ExternalLink className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0" />
              </DropdownMenuItem>
            ))}
          </div>
        )}
        
        {notifications.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="justify-center text-center cursor-pointer py-3"
              onClick={() => {
                restoreTitle();
                router.push('/dashboard/inbox');
              }}
            >
              <span className="text-xs sm:text-sm font-medium text-primary">
                Ver todas as conversas
              </span>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

