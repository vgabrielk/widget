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
import { Card } from '@/components/ui/card';
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
  Menu
} from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import { useUser } from '@/lib/contexts/user-context';
import { Skeleton } from '@/components/ui/skeleton';
import { useInboxStore } from '@/stores/useInboxStore';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { useToast } from '@/components/ui/toast';

export default function InboxPage() {
  const params = useParams();
  const router = useRouter();
  const widgetId = params.id as string;
  const { user, profile, loading: userLoading } = useUser();
  
  // Track if this is the initial mount - helps with navigation detection
  const isInitialMountRef = useRef(true);
  
  const { messages, setMessages, addMessage, clearMessages } = useInboxStore();
  const { confirm, AlertDialogComponent } = useAlertDialog();
  const { error: showError, ToastContainer } = useToast();
  const [widget, setWidget] = useState<Widget | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [filteredRooms, setFilteredRooms] = useState<Room[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'closed'>('all');
  const [isWidgetLoading, setIsWidgetLoading] = useState(true);
  const [isRoomsLoading, setIsRoomsLoading] = useState(false);
  const [isMessagesLoading, setIsMessagesLoading] = useState(false);
  const [widgetError, setWidgetError] = useState<string | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const currentRoomIdRef = useRef<string | null>(null);
  const messageChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const roomsChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const presenceChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const roomsLoadedRef = useRef(false);
  const roomsLoadingRef = useRef(false); // Guard para prevenir múltiplas chamadas simultâneas
  const loadRoomsAbortControllerRef = useRef<AbortController | null>(null);
  const lastRoomUpdateRef = useRef<{ [roomId: string]: number }>({});
  const selectedRoomRef = useRef<Room | null>(null);
  const previousWidgetIdRef = useRef<string | null>(null);
  const [isVisitorOnline, setIsVisitorOnline] = useState(false);
  const [isConversationsMenuOpen, setIsConversationsMenuOpen] = useState(false);
  
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

  // Load initial rooms via API route (server-side, more reliable)
  useEffect(() => {
    const currentWidgetId = widgetId; // Capture widgetId at start of effect
    const widgetIdChanged = previousWidgetIdRef.current !== widgetId;
    
    console.log('🔄 [Inbox] useEffect widgetId check:', { 
      widgetId: currentWidgetId, 
      previousWidgetId: previousWidgetIdRef.current,
      widgetIdChanged,
      roomsLoaded: roomsLoadedRef.current,
      roomsLoading: roomsLoadingRef.current
    });
    
    // Reset flags only if widgetId actually changed
    if (widgetIdChanged && previousWidgetIdRef.current !== null) {
      console.log('🔄 [Inbox] WidgetId changed, resetting flags');
      // Abort pending room requests for old widgetId
      if (loadRoomsAbortControllerRef.current) {
        console.log('🚫 [Inbox] Aborting rooms request for old widgetId');
        loadRoomsAbortControllerRef.current.abort();
        loadRoomsAbortControllerRef.current = null;
      }
      roomsLoadedRef.current = false;
      roomsLoadingRef.current = false;
      setRooms([]);
    }
    
    // Update previous widgetId
    previousWidgetIdRef.current = widgetId;
    
    // ⚠️ CRITICAL: Don't load until user is authenticated and loaded
    if (userLoading || !user) {
      console.log('⏸️ [Inbox] Waiting for user authentication before loading rooms', { userLoading, hasUser: !!user });
      return;
    }
    
    // Only load if widgetId exists and we haven't loaded yet
    if (currentWidgetId && !roomsLoadedRef.current && !roomsLoadingRef.current) {
      console.log('🚀 [Inbox] Loading rooms via API for widgetId:', currentWidgetId);
      roomsLoadedRef.current = true;
      roomsLoadingRef.current = true;
      setIsRoomsLoading(true);
      
      // Load via API route (server-side, avoids client query hanging)
      const abortController = new AbortController();
      const timeoutId = setTimeout(() => {
        console.error('⏰ [Inbox] Rooms fetch timeout, aborting...');
        abortController.abort();
      }, 15000); // 15s timeout
      loadRoomsAbortControllerRef.current = abortController;
      
      fetch(`/api/widgets/${currentWidgetId}/rooms?t=${Date.now()}`, { 
        signal: abortController.signal,
        cache: 'no-store', // Prevent caching issues
        credentials: 'include' // CRITICAL: Include cookies for auth
      })
        .then(res => {
          clearTimeout(timeoutId);
          
          // Verify widgetId hasn't changed during fetch
          if (params.id !== currentWidgetId) {
            console.log('⚠️ [Inbox] WidgetId changed during rooms fetch, ignoring response');
            return;
          }
          
          console.log('📡 [Inbox] Rooms fetch response:', res.status, res.statusText);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          return res.json();
        })
        .then((data: { rooms: Room[] } | void) => {
          // Verify widgetId hasn't changed before updating state
          if (!data || params.id !== currentWidgetId) {
            console.log('⚠️ [Inbox] WidgetId changed after rooms fetch, not updating state');
            return;
          }
          
          console.log('✅ [Inbox] Rooms loaded via API:', data.rooms.length);
          setRooms(data.rooms || []);
          console.log('✅ [Inbox] Setting isRoomsLoading to false');
          setIsRoomsLoading(false);
          roomsLoadingRef.current = false;
          console.log('✅ [Inbox] Loading flags reset');
        })
        .catch((err) => {
          clearTimeout(timeoutId);
          
          // Only handle error if widgetId hasn't changed
          if (params.id !== currentWidgetId) {
            console.log('⚠️ [Inbox] WidgetId changed during rooms fetch error, ignoring');
            return;
          }
          
          if (err.name === 'AbortError') {
            console.error('⏰ [Inbox] Rooms loading timeout or aborted');
            // Don't show error if it was aborted due to navigation
            if (params.id === currentWidgetId) {
              roomsLoadedRef.current = false; // Allow retry only if still same widgetId
            }
          } else {
            console.error('❌ [Inbox] Error loading rooms via API:', err);
            roomsLoadedRef.current = false; // Allow retry
          }
          setIsRoomsLoading(false);
          roomsLoadingRef.current = false;
        })
        .finally(() => {
          // Only clear abort controller if this request was for current widgetId
          if (loadRoomsAbortControllerRef.current === abortController && params.id === currentWidgetId) {
            loadRoomsAbortControllerRef.current = null;
          }
        });
    }
    
    // Cleanup: abort pending requests ONLY if widgetId changed or component unmounting
    return () => {
      // Only abort if widgetId actually changed (not just pathname navigation to same widgetId)
      if (loadRoomsAbortControllerRef.current && params.id !== currentWidgetId) {
        console.log('🧹 [Inbox] Cleanup: aborting rooms request for different widgetId');
        loadRoomsAbortControllerRef.current.abort();
        loadRoomsAbortControllerRef.current = null;
      }
    };
  }, [widgetId, user, userLoading, params.id]);

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
          
          // Update rooms optimistically
          if (payload.eventType === 'INSERT' && updatedRoom) {
            console.log('➕ [Inbox] New room inserted:', updatedRoom.id);
            setRooms(prev => {
              // Check if already exists
              if (prev.some(r => r.id === updatedRoom.id)) return prev;
              // Add at beginning (most recent)
              return [updatedRoom, ...prev];
            });
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
            
            const oldRoomData = oldRoom as Room | undefined;
            
            // Ignore updates que foram causados por markAsRead (unread_count mudou para 0 mas não há mudança em last_message_at)
            if (oldRoomData && 
                oldRoomData.unread_count > 0 && 
                updatedRoom.unread_count === 0 &&
                oldRoomData.last_message_at === updatedRoom.last_message_at) {
              // Este update foi causado por markAsRead, não por nova mensagem
              // Apenas atualizar a lista mas não o selectedRoom para evitar loop
              setRooms(prev => 
                prev.map(r => r.id === roomId ? { ...r, unread_count: 0 } : r)
              );
              return;
            }
            
            setRooms(prev => {
              const index = prev.findIndex(r => r.id === updatedRoom.id);
              if (index === -1) {
                // Room not in list, add it
                return [updatedRoom, ...prev];
              }
              // Update existing room and move to top if last_message_at changed
              const newRooms = [...prev];
              const oldRoom = newRooms[index];
              newRooms[index] = updatedRoom;
              
              // If last_message_at changed, move to top
              if (oldRoom.last_message_at !== updatedRoom.last_message_at) {
                console.log('📤 [Inbox] Moving room to top (new message):', roomId);
                newRooms.splice(index, 1);
                newRooms.unshift(updatedRoom);
              } else {
                console.log('📝 [Inbox] Updating room in place:', roomId);
              }
              
              return newRooms;
            });
            
            // Update selectedRoom only if significant fields changed (not just unread_count from markAsRead)
            // Usar ref para evitar closure stale
            const currentSelectedRoom = selectedRoomRef.current;
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
            setRooms(prev => prev.filter(r => r.id !== roomId));
            
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

  // Filter rooms
  useEffect(() => {
    let filtered = rooms;
    
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
    
    console.log('🔍 [Inbox] Filtered rooms:', filtered.length, 'from', rooms.length);
    setFilteredRooms(filtered);
  }, [rooms, searchQuery, statusFilter]);

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
        description="Carregando widget"
      >
        <div className="min-h-[calc(100vh-140px)] flex items-center justify-center bg-background">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
            <p className="text-muted-foreground">Carregando widget...</p>
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

  const openCount = rooms.filter(r => r.status === 'open').length;
  const closedCount = rooms.filter(r => r.status === 'closed').length;
  const totalUnread = rooms.reduce((sum, r) => sum + (r.unread_count || 0), 0);

  return (
    <DashboardLayout
      email={user?.email || ''}
      title={widget?.name || 'Widget'}
      description="Gerencie suas conversas em tempo real"
    >
      <div className="overflow-hidden flex flex-col -m-3 sm:-m-6 lg:-m-6 lg:-mb-8" style={{ minHeight: 'calc(100vh - 180px)' }}>
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
      {/* Mobile: Fullscreen chat when room selected, otherwise show conversations */}
      {/* Desktop: Split view */}
      <div className={`flex flex-col lg:flex-row flex-1 min-h-0 gap-3 sm:gap-6 overflow-hidden`}>
        {/* Sidebar - Lista de Conversas - Desktop always visible, Mobile in Sheet */}
        {/* Desktop Sidebar */}
        <div className="hidden lg:flex w-[380px] flex-shrink-0 flex-col gap-3 sm:gap-4 min-h-0" style={{ width: '380px', minWidth: '380px', maxWidth: '380px' }}>
          {/* Stats Cards */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <Card className="p-2 sm:p-3 transition-all duration-200">
              <div className="text-xl sm:text-2xl font-bold text-primary transition-all duration-300">{openCount}</div>
              <div className="text-xs text-muted-foreground">Abertas</div>
            </Card>
            <Card className="p-2 sm:p-3 transition-all duration-200">
              <div className="text-xl sm:text-2xl font-bold transition-all duration-300">{closedCount}</div>
              <div className="text-xs text-muted-foreground">Fechadas</div>
            </Card>
            <Card className="p-2 sm:p-3 transition-all duration-200">
              <div className="text-xl sm:text-2xl font-bold text-destructive transition-all duration-300">{totalUnread}</div>
              <div className="text-xs text-muted-foreground">Não lidas</div>
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
          <Card className="flex-1 overflow-hidden min-h-0 flex flex-col" style={{ maxHeight: 'calc(100vh - 380px)' }}>
            <div className="flex-1 overflow-y-auto min-h-0" style={{ maxHeight: 'calc(100vh - 380px)' }}>
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
                </>
              )}
            </div>
          </Card>
        </div>

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
                )}
              </div>
            </div>
          </SheetContent>
        </Sheet>

        {/* Main Chat Area - Mobile: Fullscreen when room selected, Desktop: Split */}
        {/* Mobile: Show conversations list when no room selected */}
        {!selectedRoom && (
          <div className="lg:hidden flex-1 flex flex-col min-h-0">
            <Card className="flex-1 flex flex-col overflow-hidden min-h-0">
              {/* Mobile Conversations Header */}
              <div className="p-4 border-b flex-shrink-0">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-semibold">Conversas</h2>
                    <p className="text-xs text-muted-foreground">Toque em uma conversa para abrir</p>
                  </div>
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
                  <div className="divide-y">
                    {filteredRooms.map((room) => (
                      <Link
                        key={room.id}
                        href={`/dashboard/widgets/${widgetId}/inbox/${room.id}`}
                        className="w-full p-4 text-left hover:bg-accent transition-colors block"
                        onClick={() => setIsConversationsMenuOpen(false)}
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
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}

        {/* Desktop: Empty state quando nenhuma sala selecionada */}
        {/* Mobile: Fixed fullscreen overlay, Desktop: Relative in layout */}
        <div className={`${selectedRoom ? 'flex' : 'hidden lg:flex'} flex-1 flex-col min-h-0 fixed lg:relative inset-0 lg:inset-auto z-50 lg:z-auto bg-background lg:bg-transparent`} style={{ height: selectedRoom ? 'padding-bottom:max(12px, env(safe-area-inset-bottom))' : undefined }}>
          {selectedRoom ? (
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
          ) : (
            <Card className="flex-1 hidden lg:flex items-center justify-center">
              <div className="text-center p-4">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                  <Clock className="w-8 h-8 sm:w-10 sm:h-10 text-muted-foreground" />
                </div>
                <h3 className="text-base sm:text-lg font-semibold mb-2">
                  Selecione uma conversa
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground max-w-sm">
                  Escolha uma conversa da lista ao lado para começar a responder
                </p>
              </div>
            </Card>
          )}
        </div>
      </div>
      </div>
      {AlertDialogComponent}
      {ToastContainer}
    </DashboardLayout>
  );
}

