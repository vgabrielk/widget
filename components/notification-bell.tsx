'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
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

  const loadNotifications = useCallback(async () => {
    try {
      // Get user's widgets
      const { data: widgets } = await supabase
        .from('widgets')
        .select('id')
        .eq('user_id', userId);

      if (!widgets || widgets.length === 0) {
        setLoading(false);
        return;
      }

      const widgetIds = widgets.map(w => w.id);

      // Get unread messages count from rooms
      const { data: rooms } = await supabase
        .from('rooms')
        .select('id, widget_id, unread_count, visitor_name, last_message_at, last_message_preview, widgets!inner(name)')
        .in('widget_id', widgetIds)
        .gt('unread_count', 0)
        .order('last_message_at', { ascending: false })
        .limit(10);

      if (rooms) {
        // Convert rooms to notifications
        const notifs: Notification[] = rooms.map((room: any) => ({
          id: room.id,
          type: 'new_message',
          title: `Nova mensagem de ${room.visitor_name || 'Visitante'}`,
          message: room.last_message_preview || 'Mensagem recebida',
          room_id: room.id,
          widget_id: room.widget_id,
          is_read: false,
          created_at: room.last_message_at,
        }));

        setNotifications(notifs);
        
        // Calculate total unread
        const total = rooms.reduce((sum: number, room: any) => sum + (room.unread_count || 0), 0);
        setUnreadCount(total);
      }
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
    }
  }, [userId, supabase]);

  // Notification audio state - use ref to persist across renders
  const notificationAudioRef = useRef<HTMLAudioElement | null>(null);
  const notificationPlayingRef = useRef<boolean>(false);
  const lastNotificationTimeRef = useRef<number>(0);
  const NOTIFICATION_COOLDOWN = 2000; // 2 segundos entre notificações

  const playNotificationSound = useCallback(() => {
    try {
      const now = Date.now();
      
      // Prevent multiple notifications within cooldown period
      if (now - lastNotificationTimeRef.current < NOTIFICATION_COOLDOWN) {
        return;
      }
      
      // Prevent if already playing
      if (notificationPlayingRef.current) {
        return;
      }
      
      // Create audio element if it doesn't exist
      if (!notificationAudioRef.current) {
        notificationAudioRef.current = new Audio('/notification.mp3');
        notificationAudioRef.current.volume = 0.5;
        
        // Reset audio when it finishes playing
        notificationAudioRef.current.addEventListener('ended', () => {
          notificationPlayingRef.current = false;
          if (notificationAudioRef.current) {
            notificationAudioRef.current.currentTime = 0;
          }
        });
        
        notificationAudioRef.current.addEventListener('error', () => {
          notificationPlayingRef.current = false;
        });
      }
      
      // Reset audio to beginning and play
      notificationAudioRef.current.currentTime = 0;
      notificationPlayingRef.current = true;
      lastNotificationTimeRef.current = now;
      
      notificationAudioRef.current.play().catch(() => {
        notificationPlayingRef.current = false;
      });
    } catch (error) {
      notificationPlayingRef.current = false;
    }
  }, []);

  const subscribeToNotifications = useCallback(() => {
    // Subscribe to rooms updates (which includes message counts)
    // Note: We subscribe to rooms instead of messages to avoid RLS issues
    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'rooms',
        },
        async (payload) => {
          const oldRoom = payload.old as any;
          const newRoom = payload.new as any;
          
          // Check if unread_count increased (new message from visitor)
          if (newRoom.unread_count > (oldRoom.unread_count || 0)) {
            // Reload notifications
            await loadNotifications();
            
            // Play notification sound
            playNotificationSound();
            
            // Show browser notification
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification('Nova Mensagem no ChatWidget', {
                body: newRoom.last_message_preview || 'Você recebeu uma nova mensagem de um visitante',
                icon: '/icon.png',
                tag: 'chat-message',
                requireInteraction: false,
              });
            }
          } else {
            // Just reload to keep UI in sync
            await loadNotifications();
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'rooms',
        },
        async () => {
          await loadNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, supabase, loadNotifications, playNotificationSound]);

  useEffect(() => {
    if (!userId) return;
    
    loadNotifications();
    const cleanup = subscribeToNotifications();
    
    return () => {
      if (cleanup) cleanup();
    };
  }, [userId, loadNotifications, subscribeToNotifications]);

  const handleNotificationClick = useCallback(async (notification: Notification) => {
    if (notification.widget_id) {
      router.push(`/dashboard/widgets/${notification.widget_id}/inbox`);
    }
  }, [router]);

  const markAllAsRead = useCallback(async () => {
    try {
      // Get user's widgets
      const { data: widgets } = await supabase
        .from('widgets')
        .select('id')
        .eq('user_id', userId);

      if (!widgets) return;

      const widgetIds = widgets.map(w => w.id);

      // Mark all messages in these widgets as read
      await supabase
        .from('rooms')
        .update({ unread_count: 0 })
        .in('widget_id', widgetIds);

      setNotifications([]);
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  }, [userId, supabase]);

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
              onClick={() => router.push('/dashboard/inbox')}
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

