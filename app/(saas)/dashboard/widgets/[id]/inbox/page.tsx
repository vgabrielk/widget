'use client';

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Room, Message, Widget } from '@/lib/types/saas';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { DashboardLayout } from '@/components/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { 
  Send, 
  Search, 
  MoreVertical, 
  X, 
  CheckCircle2, 
  Clock, 
  Mail,
  ExternalLink,
  Loader2,
  ArrowLeft,
  Menu,
  Ban,
  RotateCcw
} from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import { useUser } from '@/lib/contexts/user-context';
import { Skeleton } from '@/components/ui/skeleton';
import { useInboxStore } from '@/stores/useInboxStore';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { useToast } from '@/components/ui/toast';
import { useInfiniteQueryApi } from '@/lib/hooks/use-infinite-query-api';

export default function InboxPage() {
  const params = useParams();
  const router = useRouter();
  const widgetId = params.id as string;
  const { user, profile, loading: userLoading } = useUser();
  
  // Track if this is the initial mount - helps with navigation detection
  const isInitialMountRef = useRef(true);
  
  const { messages, setMessages, addMessage, clearMessages } = useInboxStore();
  const { confirm, AlertDialogComponent } = useAlertDialog();
  const { error: showError, success: showSuccess, ToastContainer } = useToast();
  const [banDialogOpen, setBanDialogOpen] = useState(false);
  const [banReason, setBanReason] = useState('');
  const [isVisitorBanned, setIsVisitorBanned] = useState(false);
  const [checkingBanStatus, setCheckingBanStatus] = useState(false);
  const [widget, setWidget] = useState<Widget | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'closed'>('all');
  const [isWidgetLoading, setIsWidgetLoading] = useState(true);
  const loadMoreRoomsRef = useRef<HTMLDivElement>(null);

  // Use infinite query for rooms
  const {
    data: rooms,
    isLoading: isRoomsLoading,
    isFetching: isRoomsFetching,
    hasMore: hasMoreRooms,
    fetchNextPage: fetchNextRoomsPage,
    reset: resetRooms,
    count: totalRoomsCount,
  } = useInfiniteQueryApi<Room>({
    apiEndpoint: `/api/widgets/${widgetId}/rooms`,
    pageSize: 10,
    queryKey: `rooms-${widgetId}`,
  });
  const [isMessagesLoading, setIsMessagesLoading] = useState(false);
  const [widgetError, setWidgetError] = useState<string | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const currentRoomIdRef = useRef<string | null>(null);
  const messageChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const roomsChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const presenceChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastRoomUpdateRef = useRef<{ [roomId: string]: number }>({});
  const selectedRoomRef = useRef<Room | null>(null);
  const previousWidgetIdRef = useRef<string | null>(null);
  const [isVisitorOnline, setIsVisitorOnline] = useState(false);
  const [isConversationsMenuOpen, setIsConversationsMenuOpen] = useState(false);
  
  // Local state for realtime updates (merged with infinite query data)
  const [realtimeRooms, setRealtimeRooms] = useState<Map<string, Room>>(new Map());
  
  // Stats from API (total counts)
  const [roomsStats, setRoomsStats] = useState<{ open: number; closed: number; unread: number } | null>(null);
  
  // Load widget - usando ref para prevenir múltiplas cargas
  // IMPORTANT: These refs must be defined before the useEffect that uses them
  const widgetLoadInProgressRef = useRef<string | null>(null); // Store widgetId being loaded
  const loadedWidgetIdRef = useRef<string | null>(null);
  const widgetAbortControllerRef = useRef<AbortController | null>(null);
  const retryCountRef = useRef<number>(0);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const MAX_RETRIES = 2; // Tentar 2 vezes antes de mostrar erro
  
  // NOTE: We don't need to monitor pathname separately
  // The widgetId from params already captures route changes
  // Monitoring pathname was causing unnecessary request cancellations
  
  // Manter selectedRoomRef sincronizado
  useEffect(() => {
    selectedRoomRef.current = selectedRoom;
  }, [selectedRoom]);
  
  const supabase = useMemo(() => createClient(), []);

  // NOTE: loadRooms function removed - we now use API route instead
  // This avoids the client-side query hanging issue

  const loadMessages = useCallback(async (roomId: string) => {
    if (!widgetId || !roomId) {
      console.warn('⏸️ [Inbox] loadMessages: Missing widgetId or roomId');
      return;
    }
    
    try {
      setIsMessagesLoading(true);
      console.log('📥 [Inbox] Loading messages via API for roomId:', roomId);
      
      // Load messages via API route (server-side, more reliable)
      const res = await fetch(`/api/widgets/${widgetId}/rooms/${roomId}/messages`, {
        credentials: 'include' // CRITICAL: Include cookies for auth
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to load messages: ${res.statusText}`);
      }
      
      const data = await res.json();
      console.log('✅ [Inbox] Messages loaded via API:', data.messages?.length || 0);
      setMessages(data.messages || []);
    } catch (error: any) {
      console.error('❌ [Inbox] Error loading messages:', error);
      setMessages([]); // Clear messages on error
    } finally {
      console.log('✅ [Inbox] Setting isMessagesLoading to false');
      setIsMessagesLoading(false);
    }
  }, [widgetId, setMessages]);

  useEffect(() => {
    // Mark that initial mount is complete after first render
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
    }
    
    if (!widgetId) {
      previousWidgetIdRef.current = widgetId;
      return;
    }
    
    // ⚠️ CRITICAL: Detect widgetId change
    const widgetIdChanged = previousWidgetIdRef.current !== widgetId && previousWidgetIdRef.current !== null;
    const isFirstLoad = previousWidgetIdRef.current === null;
    
    // Always reset state when widgetId changes (including first load)
    if (widgetIdChanged || isFirstLoad) {
      // Clear any pending retry
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
      retryCountRef.current = 0;
      
      // Abort any pending request for a different widgetId
      if (widgetAbortControllerRef.current) {
        const currentLoadingId = widgetLoadInProgressRef.current;
        if (currentLoadingId !== widgetId) {
          widgetAbortControllerRef.current.abort();
        }
        widgetAbortControllerRef.current = null;
      }
      
      // Reset refs and state
      widgetLoadInProgressRef.current = null;
      if (widgetIdChanged) {
        loadedWidgetIdRef.current = null;
        setWidget(null);
        setWidgetError(null);
        setIsWidgetLoading(false);
      }
    }
    
    // ⚠️ CRITICAL: Don't load until user is authenticated
    if (userLoading || !user) {
      previousWidgetIdRef.current = widgetId;
      return;
    }
    
    // Skip if already loaded for this widgetId (and widgetId didn't change)
    if (!widgetIdChanged && !isFirstLoad && loadedWidgetIdRef.current === widgetId) {
      // Double check widget state matches
      if (widget?.id === widgetId && !isWidgetLoading) {
        previousWidgetIdRef.current = widgetId;
        return;
      }
      // If widget state doesn't match, reset and reload
      loadedWidgetIdRef.current = null;
      setWidget(null);
    }
    
    // Skip if already loading this exact widgetId
    if (widgetLoadInProgressRef.current === widgetId) {
      return;
    }
    
    // Start loading
    widgetLoadInProgressRef.current = widgetId;
    retryCountRef.current = 0; // Reset retry count for new widgetId
    
    const load = async (attempt: number = 0): Promise<void> => {
      const currentWidgetId = widgetId; // Capture widgetId at start of load
      let willRetry = false;
      
      // Verify we're still loading the same widgetId
      if (params.id !== currentWidgetId || widgetLoadInProgressRef.current !== currentWidgetId) {
        return;
      }
      
      const abortController = new AbortController();
      const timeoutId = setTimeout(() => {
        abortController.abort();
      }, 10000); // 10s timeout (reduzido de 15s)
      
      widgetAbortControllerRef.current = abortController;
      
      try {
        setIsWidgetLoading(true);
        // Don't show error during retry attempts
        if (attempt === 0) {
          setWidgetError(null);
        }
        
        // Load widget via API route
        const url = `/api/widgets/${currentWidgetId}?t=${Date.now()}&attempt=${attempt}`;
        const res = await fetch(url, {
          signal: abortController.signal,
          cache: 'no-store',
          credentials: 'include',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          }
        });
        
        clearTimeout(timeoutId);
        
        // Verify widgetId hasn't changed during fetch
        if (params.id !== currentWidgetId || widgetLoadInProgressRef.current !== currentWidgetId) {
          return;
        }
        
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || `Failed to load widget: ${res.statusText}`);
        }
        
        const widgetData = await res.json();
        
        // Double check widgetId before updating state
        if (params.id === currentWidgetId && widgetLoadInProgressRef.current === currentWidgetId) {
          loadedWidgetIdRef.current = currentWidgetId;
          setWidget(widgetData);
          setWidgetError(null);
          retryCountRef.current = 0; // Reset retry count on success
          setIsWidgetLoading(false);
          widgetLoadInProgressRef.current = null;
        }
      } catch (error: any) {
        clearTimeout(timeoutId);
        
        // Verify widgetId before handling error
        if (params.id !== currentWidgetId || widgetLoadInProgressRef.current !== currentWidgetId) {
          return;
        }
        
        // If we haven't exceeded max retries, retry automatically
        if (attempt < MAX_RETRIES && error.name === 'AbortError') {
          willRetry = true;
          retryCountRef.current = attempt + 1;
          const retryDelay = Math.min(1000 * Math.pow(2, attempt), 3000); // Exponential backoff, max 3s
          
          // Keep loading state true during retry
          setIsWidgetLoading(true);
          
          // Schedule retry
          retryTimeoutRef.current = setTimeout(() => {
            // Verify widgetId hasn't changed before retrying
            if (params.id === currentWidgetId && widgetLoadInProgressRef.current === currentWidgetId) {
              load(attempt + 1);
            } else {
              // WidgetId changed, cancel retry
              setIsWidgetLoading(false);
              widgetLoadInProgressRef.current = null;
              retryTimeoutRef.current = null;
            }
          }, retryDelay);
          
          widgetAbortControllerRef.current = null;
          return; // Don't show error yet, don't update loading state
        }
        
        // Only show error after all retries failed or if it's not a timeout
        setIsWidgetLoading(false);
        if (error.name === 'AbortError') {
          setWidgetError('Timeout ao carregar widget. Verifique sua conexão.');
        } else {
          setWidgetError(error?.message || 'Erro ao carregar widget');
        }
        
        // Reset loadedWidgetIdRef on error to allow retry
        if (loadedWidgetIdRef.current === currentWidgetId) {
          loadedWidgetIdRef.current = null;
        }
        widgetLoadInProgressRef.current = null;
        widgetAbortControllerRef.current = null;
      } finally {
        // Only update loading state if we didn't handle it in catch
        if (!willRetry) {
          // Loading state is already handled in try/catch blocks
          widgetAbortControllerRef.current = null;
        }
      }
    };
    
    load();
    
    // Update previousWidgetIdRef
    previousWidgetIdRef.current = widgetId;
    
    // Cleanup: abort pending requests on unmount or widgetId change
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
      if (widgetAbortControllerRef.current) {
        widgetAbortControllerRef.current.abort();
        widgetAbortControllerRef.current = null;
      }
      // Only clear loading ref if it matches current widgetId
      if (widgetLoadInProgressRef.current === widgetId) {
        widgetLoadInProgressRef.current = null;
      }
    };
  }, [widgetId, user, userLoading, params.id]);

  // Reset rooms when widgetId changes
  useEffect(() => {
    if (previousWidgetIdRef.current !== widgetId && previousWidgetIdRef.current !== null) {
      resetRooms();
      setRealtimeRooms(new Map());
      setRoomsStats(null); // Reset stats when widget changes
    }
    previousWidgetIdRef.current = widgetId;
  }, [widgetId, resetRooms]);

  // Fetch stats when widgetId is available
  useEffect(() => {
    if (widgetId && !roomsStats) {
      fetch(`/api/widgets/${widgetId}/rooms?from=0&to=0`)
        .then(res => res.json())
        .then((data: { stats?: { open: number; closed: number; unread: number } }) => {
          if (data.stats) {
            setRoomsStats(data.stats);
          }
        })
        .catch(err => console.error('Error loading rooms stats:', err));
    }
  }, [widgetId, roomsStats]);

  // Infinite scroll observer for rooms
  useEffect(() => {
    if (!loadMoreRoomsRef.current || !hasMoreRooms || isRoomsFetching || isRoomsLoading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMoreRooms && !isRoomsFetching) {
          fetchNextRoomsPage();
        }
      },
      {
        rootMargin: '100px',
      }
    );

    observer.observe(loadMoreRoomsRef.current);

    return () => {
      observer.disconnect();
    };
  }, [hasMoreRooms, isRoomsFetching, isRoomsLoading, fetchNextRoomsPage]);

  // Subscribe to rooms updates (realtime)
  useEffect(() => {
    if (!widgetId) return;

    // Clean up previous subscription if exists
    if (roomsChannelRef.current) {
      supabase.removeChannel(roomsChannelRef.current);
      roomsChannelRef.current = null;
    }

    const channel = supabase
      .channel(`widget-rooms-${widgetId}`)
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'rooms',
          filter: `widget_id=eq.${widgetId}`,
        },
        (payload) => {
          console.log('⚡ [Inbox] Rooms Realtime event:', payload.eventType, payload);
          const updatedRoom = payload.new as Room;
          const oldRoom = payload.old as Partial<Room> | null;
          const roomId = oldRoom?.id || updatedRoom?.id;
          
          // Update realtime rooms state (merged with infinite query data)
          if (payload.eventType === 'INSERT' && updatedRoom) {
            console.log('➕ [Inbox] New room inserted:', updatedRoom.id);
            setRealtimeRooms(prev => {
              const newMap = new Map(prev);
              newMap.set(updatedRoom.id, updatedRoom);
              return newMap;
            });
            // Reset infinite query to reload and include new room
            resetRooms();
          } else if (payload.eventType === 'UPDATE' && updatedRoom) {
            console.log('🔄 [Inbox] Room updated:', updatedRoom.id, {
              oldLastMessage: oldRoom?.last_message_at,
              newLastMessage: updatedRoom.last_message_at,
              oldUnread: oldRoom?.unread_count,
              newUnread: updatedRoom.unread_count,
            });
            const roomId = updatedRoom.id;
            const now = Date.now();
            
            // Debounce: Ignore updates that are too close together (menos de 100ms)
            const lastUpdate = lastRoomUpdateRef.current[roomId] || 0;
            if (now - lastUpdate < 100) {
              return;
            }
            lastRoomUpdateRef.current[roomId] = now;
            
            // Update realtime rooms state
            setRealtimeRooms(prev => {
              const newMap = new Map(prev);
              newMap.set(updatedRoom.id, updatedRoom);
              return newMap;
            });
            
            // Update selectedRoom only if significant fields changed (not just unread_count from markAsRead)
            // Usar ref para evitar closure stale
            const currentSelectedRoom = selectedRoomRef.current;
            const oldRoomData = oldRoom as Room | undefined;
            if (currentSelectedRoom?.id === updatedRoom.id) {
              // Verificar se campos relevantes realmente mudaram
              const significantChange = 
                oldRoomData?.status !== updatedRoom.status ||
                oldRoomData?.last_message_at !== updatedRoom.last_message_at ||
                oldRoomData?.last_message_preview !== updatedRoom.last_message_preview ||
                (oldRoomData?.unread_count || 0) !== (updatedRoom.unread_count || 0);
              
              // Atualizar se houver mudança significativa
              if (significantChange) {
                setSelectedRoom(updatedRoom);
              }
            }
          } else if (payload.eventType === 'DELETE' && roomId) {
            setRealtimeRooms(prev => {
              const newMap = new Map(prev);
              newMap.delete(roomId);
              return newMap;
            });
            
            // Clear selection if deleted room was selected - usar ref
            const currentSelectedRoom = selectedRoomRef.current;
            if (currentSelectedRoom?.id === roomId) {
              setSelectedRoom(null);
              setSelectedRoomId(null);
            }
          }
        }
      )
      .subscribe((status) => {
        // Log subscription status para debug
        if (status === 'SUBSCRIBED') {
          console.log('✅ [Inbox] Rooms channel subscribed:', `widget-rooms-${widgetId}`);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error('❌ [Inbox] Rooms channel error:', status, `widget-rooms-${widgetId}`);
        }
      });

    roomsChannelRef.current = channel;

    return () => {
      if (roomsChannelRef.current) {
        supabase.removeChannel(roomsChannelRef.current);
        roomsChannelRef.current = null;
      }
    };
  }, [widgetId, supabase]); // CRITICAL: supabase is stable via useMemo

  // Debug: Monitor rooms and loading state changes
  useEffect(() => {
    console.log('📊 [Inbox] Rooms state changed:', rooms.length, rooms);
  }, [rooms]);
  
  useEffect(() => {
    console.log('🔄 [Inbox] isRoomsLoading changed:', isRoomsLoading);
  }, [isRoomsLoading]);

  // Merge infinite query rooms with realtime updates
  const mergedRooms = useMemo(() => {
    const roomsMap = new Map<string, Room>();
    
    // Add rooms from infinite query
    rooms.forEach(room => {
      roomsMap.set(room.id, room);
    });
    
    // Override with realtime updates (these are most recent)
    realtimeRooms.forEach((room, id) => {
      roomsMap.set(id, room);
    });
    
    // Convert back to array and sort by last_message_at
    return Array.from(roomsMap.values()).sort((a, b) => {
      const aTime = new Date(a.last_message_at || a.created_at).getTime();
      const bTime = new Date(b.last_message_at || b.created_at).getTime();
      return bTime - aTime;
    });
  }, [rooms, realtimeRooms]);

  // Filter rooms
  const filteredRooms = useMemo(() => {
    let filtered = mergedRooms;
    
    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(r => r.status === statusFilter);
    }
    
    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(r => 
        r.visitor_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.visitor_email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.last_message_preview?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    return filtered;
  }, [mergedRooms, searchQuery, statusFilter]);

  const subscribeToMessages = useCallback((roomId: string) => {
    if (messageChannelRef.current) {
      supabase.removeChannel(messageChannelRef.current);
      messageChannelRef.current = null;
    }

    const channel = supabase
      .channel(`room-messages-${roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          const newMessage = payload.new as Message;
          if (currentRoomIdRef.current !== roomId) return;
          
          const currentMessages = useInboxStore.getState().messages;
          if (currentMessages.some(m => m.id === newMessage.id)) return;
          
          addMessage(newMessage);
          
          if (newMessage.sender_type === 'visitor' && !newMessage.is_read && widgetId && selectedRoomId) {
            // Mark as read via API route
            fetch(`/api/widgets/${widgetId}/rooms/${selectedRoomId}/messages/${newMessage.id}/read`, {
              method: 'PATCH',
              credentials: 'include',
            }).catch((err) => {
              console.error('Error marking message as read:', err);
            });
          }
        }
      )
      .subscribe();

    messageChannelRef.current = channel;

    return () => {
      if (messageChannelRef.current) {
        supabase.removeChannel(messageChannelRef.current);
        messageChannelRef.current = null;
      }
    };
  }, [supabase, addMessage]);


  // Monitor selectedRoomId changes (disabled for performance)
  // useEffect(() => {
  //   console.log('🎯 selectedRoomId changed:', {
  //     old: currentRoomIdRef.current,
  //     new: selectedRoomId,
  //     hasRoom: !!selectedRoom
  //   });
  // }, [selectedRoomId]);

  // Setup Presence tracking for admin and listen for visitor presence
  useEffect(() => {
    if (!selectedRoom?.id || !user?.id) {
      // Clean up presence channel if room is deselected
      if (presenceChannelRef.current) {
        presenceChannelRef.current.untrack().catch(console.error);
        supabase.removeChannel(presenceChannelRef.current);
        presenceChannelRef.current = null;
      }
      setIsVisitorOnline(false);
      return;
    }

    const roomId = selectedRoom.id;
    
    // Clean up previous presence channel
    if (presenceChannelRef.current) {
      presenceChannelRef.current.untrack().catch(console.error);
      supabase.removeChannel(presenceChannelRef.current);
      presenceChannelRef.current = null;
    }

    const channelName = `presence:${roomId}`;
    console.log('📡 [Inbox] Setting up Presence channel for room:', roomId);

    const presenceChannel = supabase.channel(channelName, {
      config: {
        presence: {
          key: `agent:${user.id}`, // Unique key for this agent
        },
      },
    });

    // Listen to presence sync, join, and leave events
    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const presenceState = presenceChannel.presenceState();
        console.log('📡 [Inbox] Presence sync', presenceState);
        updateVisitorOnlineStatus(presenceState);
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        console.log('📡 [Inbox] Presence join', key, newPresences);
        updateVisitorOnlineStatus(presenceChannel.presenceState());
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        console.log('📡 [Inbox] Presence leave', key, leftPresences);
        updateVisitorOnlineStatus(presenceChannel.presenceState());
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ [Inbox] Presence channel subscribed');
          
          // Track agent as online
          const agentPresence = {
            user: 'agent',
            agent_id: user.id,
            agent_name: profile?.full_name || user.email?.split('@')[0] || 'Suporte',
            online_at: new Date().toISOString(),
          };
          
          const trackStatus = await presenceChannel.track(agentPresence);
          console.log('✅ [Inbox] Agent presence tracked', trackStatus);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error('❌ [Inbox] Presence channel error:', status);
        }
      });

    presenceChannelRef.current = presenceChannel;

    function updateVisitorOnlineStatus(presenceState: any) {
      // Check if any visitor is online
      let visitorFound = false;
      
      for (const key in presenceState) {
        const presences = presenceState[key];
        if (Array.isArray(presences)) {
          for (const presence of presences) {
            if (presence.user === 'visitor') {
              visitorFound = true;
              break;
            }
          }
        }
        if (visitorFound) break;
      }
      
      setIsVisitorOnline(visitorFound);
      console.log('📡 [Inbox] Visitor online status:', visitorFound);
    }

    return () => {
      if (presenceChannelRef.current) {
        presenceChannelRef.current.untrack().catch(console.error);
        supabase.removeChannel(presenceChannelRef.current);
        presenceChannelRef.current = null;
      }
      setIsVisitorOnline(false);
    };
  }, [selectedRoom?.id, user?.id, profile?.full_name, user?.email, supabase]);

  // Handle room selection
  useEffect(() => {
    if (!selectedRoom) {
      currentRoomIdRef.current = null;
      setSelectedRoomId(null);
      clearMessages();
      return;
    }

    const roomId = selectedRoom.id;
    if (currentRoomIdRef.current === roomId) return;

    currentRoomIdRef.current = roomId;
    setSelectedRoomId(roomId);
    setInputValue('');
    loadMessages(roomId);
    const cleanup = subscribeToMessages(roomId);
    
    return () => {
      cleanup();
      if (currentRoomIdRef.current === roomId) {
        currentRoomIdRef.current = null;
      }
    };
  }, [selectedRoom?.id, loadMessages, subscribeToMessages, clearMessages]);

  // Scroll to bottom when messages change or room changes
  useEffect(() => {
    // CRITICAL: Only scroll if room hasn't changed
    if (selectedRoomId && selectedRoomId === currentRoomIdRef.current && messages.length > 0 && !isMessagesLoading) {
      const container = messagesContainerRef.current;
      if (container) {
        requestAnimationFrame(() => {
          if (container && selectedRoomId === currentRoomIdRef.current) {
            container.scrollTop = container.scrollHeight;
          }
        });
      }
    }
  }, [selectedRoomId, messages.length, isMessagesLoading]);





  // Handler para clique na conversa - navegar para rota dinâmica
  const handleRoomClick = useCallback((room: Room) => {
    router.push(`/dashboard/widgets/${widgetId}/inbox/${room.id}`);
  }, [router, widgetId]);

  // Handler para clique na área de mensagens
  const handleMessagesAreaClick = useCallback(() => {
    // Não faz nada - markAsRead foi removido
  }, []);

  const sendMessage = useCallback(async () => {
    if (!inputValue.trim() || !selectedRoom || !widgetId) return;
    
    // CRITICAL: Capture room ID at the moment of sending
    const roomIdAtSend = selectedRoom.id;
    const messageContent = inputValue.trim();

    try {
      // Validate room hasn't changed before sending
      if (roomIdAtSend !== currentRoomIdRef.current) {
        return;
      }
      
      // Clear input immediately for better UX
      setInputValue('');
      
      console.log('📤 [Inbox] Sending message via API for roomId:', roomIdAtSend);

      // Send message via API route (server-side, more reliable)
      const res = await fetch(`/api/widgets/${widgetId}/rooms/${roomIdAtSend}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // CRITICAL: Include cookies for auth
        body: JSON.stringify({
          content: messageContent,
          sender_name: profile?.full_name || 'Suporte',
          sender_avatar: profile?.avatar_url || null,
          message_type: 'text',
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to send message: ${res.statusText}`);
      }

      const data = await res.json();
      console.log('✅ [Inbox] Message sent via API:', data.message?.id);
      
      // Message will be added via Realtime subscription
    } catch (error: any) {
      console.error('❌ [Inbox] Error sending message:', error);
      // Restore input value on error
      setInputValue(messageContent);
      showError(error.message || 'Erro ao enviar mensagem. Tente novamente.');
    }
  }, [inputValue, selectedRoom, widgetId, profile, showError]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }, [sendMessage]);

  const closeConversation = useCallback(async (roomId: string) => {
    const confirmed = await confirm('Deseja realmente fechar esta conversa?', 'Fechar Conversa');
    if (!confirmed) return;

    try {
      // CRITICAL: Verify room is still selected before proceeding
      if (roomId !== currentRoomIdRef.current || !widgetId) {
        return;
      }

      // Close conversation via API route (handles messages, storage, and room update)
      const res = await fetch(`/api/widgets/${widgetId}/rooms/${roomId}/close`, {
        method: 'PATCH',
        credentials: 'include',
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to close conversation: ${res.statusText}`);
      }

      // Verify again before updating UI
      if (roomId !== currentRoomIdRef.current) return;

      const data = await res.json();
      
      // Only refresh if still on same room
      if (roomId === currentRoomIdRef.current && data.room) {
        setSelectedRoom(data.room);
      }
    } catch (error: any) {
      console.error('Error closing conversation:', error);
      showError(error.message || 'Erro ao fechar conversa. Tente novamente.');
    }
  }, [confirm, showError, widgetId]);

  // Check visitor ban status
  const checkBanStatus = useCallback(async (visitorId: string) => {
    if (!visitorId) return;
    
    setCheckingBanStatus(true);
    try {
      const res = await fetch(`/api/visitor/track?visitor_id=${encodeURIComponent(visitorId)}`, {
        method: 'GET',
        credentials: 'include',
      });

      if (res.ok) {
        const data = await res.json();
        setIsVisitorBanned(data.banned || false);
      }
    } catch (error) {
      console.error('Error checking ban status:', error);
      setIsVisitorBanned(false);
    } finally {
      setCheckingBanStatus(false);
    }
  }, []);

  // Check ban status when room loads
  useEffect(() => {
    if (selectedRoom?.visitor_id) {
      checkBanStatus(selectedRoom.visitor_id);
    } else {
      setIsVisitorBanned(false);
    }
  }, [selectedRoom?.visitor_id, checkBanStatus]);

  const banVisitor = useCallback(async () => {
    if (!selectedRoom?.visitor_id) return;

    try {
      const res = await fetch(`/api/widgets/${widgetId}/visitors/${selectedRoom.visitor_id}/ban`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          banned: true,
          ban_reason: banReason.trim() || 'Banido pelo suporte durante a conversa',
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        const errorMessage = errorData.details 
          ? `${errorData.error}: ${errorData.details}` 
          : errorData.error || 'Failed to ban visitor';
        throw new Error(errorMessage);
      }

      showSuccess('Visitante banido com sucesso');
      setBanDialogOpen(false);
      setBanReason('');
      setIsVisitorBanned(true);
      
      // Optionally close the conversation as well
      if (selectedRoom.status === 'open') {
        await closeConversation(selectedRoom.id);
      }
    } catch (error: any) {
      console.error('Error banning visitor:', error);
      showError(error.message || 'Erro ao banir visitante. Tente novamente.');
    }
  }, [selectedRoom, widgetId, banReason, showError, showSuccess, closeConversation]);

  const unbanVisitor = useCallback(async () => {
    if (!selectedRoom?.visitor_id) return;

    const confirmed = await confirm(
      'Tem certeza que deseja desbanir este visitante? Ele poderá usar o widget novamente.',
      'Desbanir Visitante'
    );
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/widgets/${widgetId}/visitors/${selectedRoom.visitor_id}/ban`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          banned: false,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        const errorMessage = errorData.details 
          ? `${errorData.error}: ${errorData.details}` 
          : errorData.error || 'Failed to unban visitor';
        throw new Error(errorMessage);
      }

      showSuccess('Visitante desbanido com sucesso');
      setIsVisitorBanned(false);
    } catch (error: any) {
      console.error('Error unbanning visitor:', error);
      showError(error.message || 'Erro ao desbanir visitante. Tente novamente.');
    }
  }, [selectedRoom, widgetId, confirm, showError, showSuccess]);

  const reopenConversation = useCallback(async (roomId: string) => {
    try {
      // CRITICAL: Verify room is still selected
      if (roomId !== currentRoomIdRef.current || !widgetId) {
        return;
      }

      // Reopen conversation via API route
      const res = await fetch(`/api/widgets/${widgetId}/rooms/${roomId}/reopen`, {
        method: 'PATCH',
        credentials: 'include',
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to reopen conversation: ${res.statusText}`);
      }

      // Verify again before updating UI
      if (roomId !== currentRoomIdRef.current) return;

      const data = await res.json();
      
      // Only refresh if still on same room
      if (roomId === currentRoomIdRef.current && data.room) {
        setSelectedRoom(data.room);
      }
    } catch (error: any) {
      console.error('Error reopening conversation:', error);
      showError(error.message || 'Erro ao reabrir conversa. Tente novamente.');
    }
  }, [showError, widgetId]);

  // Retry function - MUST be defined before any conditional returns or renders
  const handleRetry = useCallback(() => {
    console.log('🔄 [Inbox] Manual retry triggered');
    // Clear any pending retry
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    // Reset state to trigger reload
    loadedWidgetIdRef.current = null;
    setWidget(null);
    setWidgetError(null);
    widgetLoadInProgressRef.current = null;
    retryCountRef.current = 0;
    // Force reload by updating previousWidgetIdRef
    previousWidgetIdRef.current = null;
  }, []);

  const getInitials = (name: string | null) => {
    if (!name) return 'V';
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };


  const formatTime = (date: string) => {
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) {
      return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } else if (days === 1) {
      return 'Ontem';
    } else if (days < 7) {
      return `${days}d atrás`;
    } else {
      return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    }
  };

  // Skeleton components
  const RoomSkeleton = () => (
    <div className="w-full p-3 sm:p-4">
      <div className="flex gap-2 sm:gap-3">
        <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-muted animate-pulse flex-shrink-0" />
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="h-4 bg-muted rounded animate-pulse w-32" />
            <div className="h-3 bg-muted rounded animate-pulse w-16" />
          </div>
          <div className="h-3 bg-muted rounded animate-pulse w-full" />
          <div className="flex items-center gap-2">
            <div className="h-5 bg-muted rounded-full animate-pulse w-16" />
            <div className="h-5 bg-muted rounded-full animate-pulse w-12" />
          </div>
        </div>
      </div>
    </div>
  );

  const MessageSkeleton = ({ isAgent }: { isAgent: boolean }) => (
    <div className={`flex gap-2 sm:gap-3 ${isAgent ? 'flex-row-reverse' : ''}`}>
      <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-muted animate-pulse flex-shrink-0" />
      <div className={`flex flex-col ${isAgent ? 'items-end' : 'items-start'} max-w-[75%] sm:max-w-[70%]`}>
        <div className={`rounded-2xl px-3 sm:px-4 py-2 sm:py-3 bg-muted animate-pulse ${
          isAgent ? 'rounded-tr-sm' : 'rounded-tl-sm'
        }`}>
          <div className="h-3 bg-muted-foreground/20 rounded w-20 mb-2" />
          <div className="space-y-2">
            <div className="h-3 bg-muted-foreground/20 rounded w-48" />
            <div className="h-3 bg-muted-foreground/20 rounded w-36" />
          </div>
        </div>
      </div>
    </div>
  );

  // Debug: Log render conditions
  useEffect(() => {
    console.log('🎨 [Inbox] Render check:', { 
      isWidgetLoading, 
      isRoomsLoading, 
      roomsLength: rooms.length,
      widgetError: !!widgetError 
    });
  }, [isWidgetLoading, isRoomsLoading, rooms.length, widgetError]);

  if (isWidgetLoading) {
    console.log('⏸️ [Inbox] Returning early - widget still loading');
    return (
      <DashboardLayout
        email={user?.email || ''}
        title="Carregando..."
        description="Carregando conversas"
      >
        <div className="min-h-[calc(100vh-140px)] flex items-center justify-center bg-background">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
            <p className="text-muted-foreground">Carregando conversas...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (widgetError && !isWidgetLoading) {
    return (
      <DashboardLayout
        email={user?.email || ''}
        title="Erro"
        description="Erro ao carregar widget"
      >
        <div className="min-h-[calc(100vh-140px)] flex items-center justify-center bg-background">
          <Card className="max-w-md w-full">
            <div className="p-6 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
                <X className="h-6 w-6 text-destructive" />
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2">Erro ao carregar widget</h3>
                <p className="text-sm text-muted-foreground mb-4">{widgetError}</p>
              </div>
              <div className="flex gap-2 justify-center">
                <Button onClick={() => router.push('/dashboard')} variant="outline">
                  Voltar ao Dashboard
                </Button>
                <Button onClick={handleRetry} variant="default" disabled={isWidgetLoading}>
                  {isWidgetLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Carregando...
                    </>
                  ) : (
                    'Tentar Novamente'
                  )}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  // Use stats from API if available (total counts), otherwise use loaded rooms
  const openCount = roomsStats?.open ?? mergedRooms.filter(r => r.status === 'open').length;
  const closedCount = roomsStats?.closed ?? mergedRooms.filter(r => r.status === 'closed').length;
  const totalUnread = roomsStats?.unread ?? mergedRooms.reduce((sum, r) => sum + (r.unread_count || 0), 0);

  return (
    <DashboardLayout
      email={user?.email || ''}
      title={widget?.name || 'Widget'}
      description="Gerencie suas conversas em tempo real"
    >
      <div className="space-y-6">
      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-5px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="stat-card">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Abertas</p>
                <p className="text-3xl font-bold text-primary">{openCount}</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                <CheckCircle2 className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="stat-card">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Fechadas</p>
                <p className="text-3xl font-bold">{closedCount}</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
                <X className="h-6 w-6 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="stat-card">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Não lidas</p>
                <p className="text-3xl font-bold text-destructive">{totalUnread}</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-destructive/10">
                <Mail className="h-6 w-6 text-destructive" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
          <Card className="p-3 sm:p-4 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar conversas..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>
            
            <div className="flex gap-2">
              <Button
                variant={statusFilter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('all')}
                className="flex-1 text-xs sm:text-sm"
              >
                Todas
              </Button>
              <Button
                variant={statusFilter === 'open' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('open')}
                className="flex-1 text-xs sm:text-sm"
              >
                Abertas
              </Button>
              <Button
                variant={statusFilter === 'closed' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('closed')}
                className="flex-1 text-xs sm:text-sm"
              >
                Fechadas
              </Button>
            </div>
          </Card>

      {/* Conversations List */}
      <Card>
        <CardContent className="p-0">
          <div>
              {isRoomsLoading ? (
                <div className="divide-y">
                  {[...Array(5)].map((_, i) => (
                    <RoomSkeleton key={i} />
                  ))}
                </div>
              ) : filteredRooms.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full p-6 sm:p-8 text-center">
                  <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                    <Search className="w-6 h-6 sm:w-8 sm:h-8 text-muted-foreground" />
                  </div>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    {searchQuery ? 'Nenhuma conversa encontrada' : 'Nenhuma conversa ainda'}
                  </p>
                </div>
              ) : (
                <>
                  <div className="divide-y">
                    {filteredRooms.map((room, index) => (
                      <Link
                        key={room.id}
                        href={`/dashboard/widgets/${widgetId}/inbox/${room.id}`}
                        className={`w-full p-3 sm:p-4 text-left hover:bg-accent transition-all duration-200 ease-in-out block ${
                          selectedRoom?.id === room.id ? 'bg-accent' : ''
                        }`}
                        style={{
                          animation: 'fadeIn 0.3s ease-in-out'
                        }}
                      >
                        <div className="flex gap-2 sm:gap-3">
                          <Avatar className="h-8 w-8 sm:h-10 sm:w-10 flex-shrink-0">
                            <AvatarFallback className="bg-primary text-primary-foreground text-xs sm:text-sm">
                              {getInitials(room.visitor_name || 'Visitante')}
                            </AvatarFallback>
                          </Avatar>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-semibold text-sm sm:text-base truncate">
                                    {room.visitor_name || 'Visitante'}
                                  </span>
                                </div>
                                {room.unread_count > 0 && (
                                  <Badge 
                                    variant="destructive" 
                                    className="rounded-full h-4 sm:h-5 min-w-[16px] sm:min-w-[20px] flex items-center justify-center px-1 sm:px-1.5 text-xs transition-all duration-300 animate-in fade-in slide-in-from-right-2"
                                  >
                                    {room.unread_count}
                                  </Badge>
                                )}
                              </div>
                              <span className="text-xs text-muted-foreground flex-shrink-0">
                                {formatTime(room.last_message_at || room.created_at)}
                              </span>
                            </div>
                            
                            {room.visitor_email && (
                              <div className="flex items-center gap-1 mb-1">
                                <Mail className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                <span className="text-xs text-muted-foreground truncate">
                                  {room.visitor_email}
                                </span>
                              </div>
                            )}
                            
                            {room.last_message_preview && (
                              <p className="text-xs sm:text-sm text-muted-foreground truncate mb-2">
                                {room.last_message_preview}
                              </p>
                            )}
                            
                            <div className="flex items-center gap-2">
                              <Badge variant={room.status === 'open' ? 'default' : 'secondary'} className="text-xs">
                                {room.status === 'open' ? (
                                  <>
                                    <CheckCircle2 className="h-3 w-3 mr-1" />
                                    Aberta
                                  </>
                                ) : (
                                  <>
                                    <X className="h-3 w-3 mr-1" />
                                    Fechada
                                  </>
                                )}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                  
                  {/* Load more trigger - Always render to allow infinite scroll */}
                  <div ref={loadMoreRoomsRef} style={{ height: '1px' }} />
                  
                  {/* Loading skeleton */}
                  {isRoomsFetching && (
                    <div className="divide-y">
                      {[...Array(3)].map((_, i) => (
                        <RoomSkeleton key={`skeleton-desktop-${i}`} />
                      ))}
                    </div>
                  )}
                  
                  {/* End message */}
                  {!hasMoreRooms && filteredRooms.length > 0 && (
                    <div className="text-center py-4 text-sm text-muted-foreground">
                      Você chegou ao fim da lista
                    </div>
                  )}
                </>
              )}
          </div>
        </CardContent>
      </Card>

        {/* Mobile Conversations Menu Sheet */}
        <Sheet open={isConversationsMenuOpen} onOpenChange={setIsConversationsMenuOpen}>
          <SheetContent side="left" className="p-0 w-full sm:w-[400px] overflow-hidden flex flex-col">
            <SheetTitle className="sr-only">Lista de Conversas</SheetTitle>
            {/* Mobile Conversations List */}
            <div className="flex flex-col h-full">
              {/* Header */}
              <div className="p-4 border-b flex-shrink-0">
                <div className="mb-4">
                  <h2 className="text-lg font-semibold">Conversas</h2>
                </div>
                
                {/* Stats Cards */}
                <div className="grid grid-cols-3 gap-2 mb-4">
                  <Card className="p-2">
                    <div className="text-xl font-bold text-primary">{openCount}</div>
                    <div className="text-xs text-muted-foreground">Abertas</div>
                  </Card>
                  <Card className="p-2">
                    <div className="text-xl font-bold">{closedCount}</div>
                    <div className="text-xs text-muted-foreground">Fechadas</div>
                  </Card>
                  <Card className="p-2">
                    <div className="text-xl font-bold text-destructive">{totalUnread}</div>
                    <div className="text-xs text-muted-foreground">Não lidas</div>
                  </Card>
                </div>

                {/* Search */}
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar conversas..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 h-9 text-sm"
                  />
                </div>
                
                {/* Filters */}
                <div className="flex gap-2">
                  <Button
                    variant={statusFilter === 'all' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setStatusFilter('all')}
                    className="flex-1 text-xs"
                  >
                    Todas
                  </Button>
                  <Button
                    variant={statusFilter === 'open' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setStatusFilter('open')}
                    className="flex-1 text-xs"
                  >
                    Abertas
                  </Button>
                  <Button
                    variant={statusFilter === 'closed' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setStatusFilter('closed')}
                    className="flex-1 text-xs"
                  >
                    Fechadas
                  </Button>
                </div>
              </div>

              {/* Conversations List */}
              <div className="flex-1 overflow-y-auto min-h-0">
                {isRoomsLoading ? (
                  <div className="divide-y">
                    {[...Array(5)].map((_, i) => (
                      <RoomSkeleton key={i} />
                    ))}
                  </div>
                ) : filteredRooms.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full p-6 text-center">
                    <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                      <Search className="w-6 h-6 text-muted-foreground" />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {searchQuery ? 'Nenhuma conversa encontrada' : 'Nenhuma conversa ainda'}
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="divide-y">
                      {filteredRooms.map((room) => (
                        <button
                          key={room.id}
                          onClick={() => {
                            handleRoomClick(room);
                            setIsConversationsMenuOpen(false);
                          }}
                          className={`w-full p-4 text-left hover:bg-accent transition-colors ${
                            selectedRoom?.id === room.id ? 'bg-accent' : ''
                          }`}
                      >
                        <div className="flex gap-3">
                          <Avatar className="h-10 w-10 flex-shrink-0">
                            <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                              {getInitials(room.visitor_name || 'Visitante')}
                            </AvatarFallback>
                          </Avatar>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <span className="font-semibold text-sm truncate">
                                  {room.visitor_name || 'Visitante'}
                                </span>
                                {room.unread_count > 0 && (
                                  <Badge variant="destructive" className="rounded-full h-5 min-w-[20px] flex items-center justify-center px-1.5 text-xs">
                                    {room.unread_count}
                                  </Badge>
                                )}
                              </div>
                              <span className="text-xs text-muted-foreground flex-shrink-0">
                                {formatTime(room.last_message_at || room.created_at)}
                              </span>
                            </div>
                            
                            {room.visitor_email && (
                              <div className="flex items-center gap-1 mb-1">
                                <Mail className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                <span className="text-xs text-muted-foreground truncate">
                                  {room.visitor_email}
                                </span>
                              </div>
                            )}
                            
                            {room.last_message_preview && (
                              <p className="text-xs text-muted-foreground truncate mb-2">
                                {room.last_message_preview}
                              </p>
                            )}
                            
                            <div className="flex items-center gap-2">
                              <Badge variant={room.status === 'open' ? 'default' : 'secondary'} className="text-xs">
                                {room.status === 'open' ? (
                                  <>
                                    <CheckCircle2 className="h-3 w-3 mr-1" />
                                    Aberta
                                  </>
                                ) : (
                                  <>
                                    <X className="h-3 w-3 mr-1" />
                                    Fechada
                                  </>
                                )}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                    </div>
                    
                    {/* Load more trigger */}
                    <div ref={loadMoreRoomsRef} style={{ height: '1px' }} />
                    
                    {/* Loading skeleton */}
                    {isRoomsFetching && (
                      <div className="divide-y">
                        {[...Array(3)].map((_, i) => (
                          <RoomSkeleton key={`skeleton-mobile-${i}`} />
                        ))}
                      </div>
                    )}
                    
                    {/* End message */}
                    {!hasMoreRooms && filteredRooms.length > 0 && (
                      <div className="text-center py-4 text-sm text-muted-foreground">
                        Você chegou ao fim da lista
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </SheetContent>
        </Sheet>


        {/* Mobile: Fixed fullscreen overlay, Desktop: Relative in layout */}
        {selectedRoom && (
          <div className={`flex flex-1 flex-col min-h-0 fixed lg:relative inset-0 lg:inset-auto z-50 lg:z-auto bg-background lg:bg-transparent`} style={{ height: 'padding-bottom:max(12px, env(safe-area-inset-bottom))' }}>
            <Card className="flex-1 flex flex-col min-h-0 h-full max-h-full border-0 lg:border rounded-none lg:rounded-lg shadow-none lg:shadow" style={{ display: 'flex', flexDirection: 'column' }}>
              {/* Chat Header - Fixed */}
              <div className="flex items-center justify-between p-4 border-b bg-background flex-shrink-0 z-10">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {/* Mobile Menu Button */}
                  <Sheet open={isConversationsMenuOpen} onOpenChange={setIsConversationsMenuOpen}>
                    <SheetTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="lg:hidden flex-shrink-0 h-9 w-9"
                      >
                        <Menu className="h-5 w-5" />
                      </Button>
                    </SheetTrigger>
                  </Sheet>
                  
                  {/* Desktop: Show back button only when needed */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="hidden lg:flex flex-shrink-0 h-9 w-9"
                    onClick={() => setSelectedRoom(null)}
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  
                  <Avatar className="h-8 w-8 sm:h-10 sm:w-10 flex-shrink-0">
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs sm:text-sm">
                      {getInitials(selectedRoom.visitor_name || 'Visitante')}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-sm sm:text-base truncate">
                        {selectedRoom.visitor_name || 'Visitante'}
                      </h3>
                      {isVisitorOnline && (
                        <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                          <span>Online</span>
                        </span>
                      )}
                      {!isVisitorOnline && selectedRoom && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <span className="w-2 h-2 bg-gray-400 rounded-full"></span>
                          <span>Offline</span>
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm text-muted-foreground">
                      {selectedRoom.visitor_email && (
                        <span className="flex items-center gap-1 truncate">
                          <Mail className="h-3 w-3 flex-shrink-0" />
                          <span className="truncate hidden sm:inline">{selectedRoom.visitor_email}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                  {selectedRoom.page_url && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => selectedRoom.page_url && window.open(selectedRoom.page_url, '_blank')}
                      className="text-muted-foreground h-8 w-8 sm:h-10 sm:w-10"
                      title="Ver página"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  )}
                  
                  {isVisitorBanned ? (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={unbanVisitor}
                      disabled={checkingBanStatus}
                      className="text-sm h-9 bg-green-600 hover:bg-green-700 text-white"
                      title="Desbanir visitante"
                    >
                      <RotateCcw className="h-4 w-4 sm:mr-2" />
                      <span className="hidden sm:inline">Desbanir</span>
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setBanDialogOpen(true)}
                      disabled={checkingBanStatus}
                      className="text-sm h-9 border-destructive/50 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                      title="Banir visitante"
                    >
                      <Ban className="h-4 w-4 sm:mr-2" />
                      <span className="hidden sm:inline">Banir</span>
                    </Button>
                  )}
                  
                  {/* Mobile: Close chat button */}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSelectedRoom(null)}
                    className="lg:hidden h-9 w-9"
                    title="Voltar para conversas"
                  >
                    <X className="h-5 w-5" />
                  </Button>
                  
                  {/* Desktop: Close/Reopen conversation button */}
                  {selectedRoom.status === 'open' ? (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => closeConversation(selectedRoom.id)}
                      className="hidden lg:flex text-sm h-9"
                    >
                      <X className="h-4 w-4 mr-2" />
                      Fechar
                    </Button>
                  ) : (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => reopenConversation(selectedRoom.id)}
                      className="hidden lg:flex text-sm h-9"
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Reabrir
                    </Button>
                  )}
                </div>
              </div>

              {/* Messages - Scrollable area */}
              <div
                ref={messagesContainerRef}
                id="messages-container"
                className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-6 space-y-3 sm:space-y-4 bg-muted/20 min-h-0"
                onClick={handleMessagesAreaClick}
                style={{
                  WebkitOverflowScrolling: 'touch',
                  overscrollBehavior: 'contain',
                  flex: '1 1 auto',
                  overflowY: 'auto'
                }}
              >
                {isMessagesLoading ? (
                  <>
                    {[...Array(4)].map((_, i) => (
                      <MessageSkeleton key={i} isAgent={i % 2 === 0} />
                    ))}
                  </>
                ) : (
                  <>
                    {messages.map((message, index) => {
                  const isAgent = message.sender_type === 'agent';
                  const isSystem = message.message_type === 'system';
                  
                  if (isSystem) {
                    return (
                      <div 
                        key={message.id}
                        className="flex justify-center"
                      >
                        <div className="bg-muted text-muted-foreground px-3 sm:px-4 py-2 rounded-full text-xs sm:text-sm max-w-md text-center">
                          {message.content}
                        </div>
                      </div>
                    );
                  }
                  
                  return (
                    <div
                      key={message.id}
                      className={`flex gap-2 sm:gap-3 ${isAgent ? 'flex-row-reverse' : ''}`}
                    >
                      <Avatar className="h-7 w-7 sm:h-8 sm:w-8 flex-shrink-0">
                        {message.sender_avatar && (
                          <AvatarImage src={message.sender_avatar} alt={message.sender_name || 'User'} />
                        )}
                        <AvatarFallback className={`${isAgent ? 'bg-primary text-primary-foreground' : 'bg-muted'} text-xs`}>
                          {getInitials(message.sender_name)}
                        </AvatarFallback>
                      </Avatar>
                      
                      <div className={`flex flex-col ${isAgent ? 'items-end' : 'items-start'} max-w-[75%] sm:max-w-[70%]`}>
                        <div
                          className={`rounded-2xl ${
                            message.image_url && !message.content
                              ? 'px-0 py-0' // Sem padding quando só tem imagem
                              : 'px-3 sm:px-4 py-2 sm:py-3' // Padding quando tem texto
                          } ${
                            // Aplicar background apenas se tiver conteúdo de texto
                            message.content
                              ? isAgent
                                ? 'bg-primary text-primary-foreground rounded-tr-sm'
                                : 'bg-background border rounded-tl-sm'
                              : '' // Sem background se só tiver imagem
                          }`}
                        >
                          {message.content && (
                            <>
                              <p className={`text-xs mb-1 ${isAgent ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                                {message.sender_name}
                              </p>
                              
                              <p className="text-xs sm:text-sm whitespace-pre-wrap break-words">
                                {message.content}
                              </p>
                            </>
                          )}
                          
                          {message.image_url && (
                            <div className={message.content ? 'mt-2' : ''}>
                              {!message.content && (
                                <p className={`text-xs mb-1 ${isAgent ? 'text-muted-foreground' : 'text-muted-foreground'}`}>
                                  {message.sender_name}
                                </p>
                              )}
                              <img
                                src={message.image_url}
                                alt={message.image_name || 'Imagem'}
                                className="rounded-lg max-w-full h-auto cursor-pointer hover:opacity-90 transition-opacity"
                                style={{ maxHeight: '200px' }}
                                onClick={() => message.image_url && window.open(message.image_url, '_blank')}
                              />
                              {message.image_name && (
                                <p className={`text-xs mt-1 ${isAgent && message.content ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                                  {message.image_name}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                        
                        <span className="text-xs text-muted-foreground mt-1">
                          {new Date(message.created_at).toLocaleTimeString('pt-BR', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    </div>
                  );
                })}
                  </>
                )}
              </div>

              {/* Input - Fixed at bottom */}
              <div className="p-3 sm:p-4 pb-safe border-t bg-background z-20 w-full" style={{ 
                paddingBottom: 'max(24px, calc(env(safe-area-inset-bottom) + 12px))',
                flexShrink: 0,
                flexGrow: 0,
                minHeight: 'auto'
              }}>
                {selectedRoom.status === 'closed' ? (
                  <div className="text-center py-3 sm:py-4 text-muted-foreground">
                    <p className="text-xs sm:text-sm">Esta conversa está fechada. Reabra para continuar.</p>
                  </div>
                ) : (
                  <div className="flex gap-2 sm:gap-3">
                    <Input
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="Digite sua mensagem..."
                      className="flex-1 h-9 sm:h-10 text-sm"
                    />
                    <Button
                      onClick={sendMessage}
                      disabled={!inputValue.trim()}
                      size="icon"
                      className="flex-shrink-0 h-9 w-9 sm:h-10 sm:w-10"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}
      </div>
      {AlertDialogComponent}
      {ToastContainer}

      {/* Ban Visitor Dialog */}
      {banDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-background rounded-lg border shadow-lg w-full max-w-md mx-4 p-6 space-y-4">
            <div>
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Ban className="h-5 w-5 text-destructive" />
                Banir Visitante
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Tem certeza que deseja banir este visitante? Ele não poderá mais usar o widget.
              </p>
              {selectedRoom && (
                <div className="mt-3 p-3 bg-muted rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">Visitante:</p>
                  <p className="text-sm font-medium">{selectedRoom.visitor_name || 'Visitante'}</p>
                  {selectedRoom.visitor_email && (
                    <p className="text-xs text-muted-foreground mt-1">{selectedRoom.visitor_email}</p>
                  )}
                </div>
              )}
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Motivo do banimento (opcional)</label>
              <textarea
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                placeholder="Ex: Comportamento inadequado, spam, etc..."
                className="w-full min-h-[80px] p-3 text-sm border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                maxLength={500}
              />
              <p className="text-xs text-muted-foreground">
                {banReason.length}/500 caracteres
              </p>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setBanDialogOpen(false);
                  setBanReason('');
                }}
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={banVisitor}
              >
                <Ban className="h-4 w-4 mr-2" />
                Banir Visitante
              </Button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

