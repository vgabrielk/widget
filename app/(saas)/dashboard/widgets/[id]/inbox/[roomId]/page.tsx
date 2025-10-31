'use client';

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Room, Message, Widget } from '@/lib/types/saas';
import { useParams, useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { 
  Send, 
  X, 
  CheckCircle2, 
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
import Link from 'next/link';

function MessageSkeleton({ isAgent }: { isAgent: boolean }) {
  return (
    <div className={`flex gap-2 sm:gap-3 ${isAgent ? 'flex-row-reverse' : ''}`}>
      <Skeleton className="h-7 w-7 sm:h-8 sm:w-8 rounded-full flex-shrink-0" />
      <div className={`flex flex-col ${isAgent ? 'items-end' : 'items-start'} flex-1 max-w-[75%] sm:max-w-[70%]`}>
        <Skeleton className="h-16 w-full rounded-2xl" />
        <Skeleton className="h-3 w-16 mt-1" />
      </div>
    </div>
  );
}

function getInitials(name: string): string {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}

export default function RoomDetailPage() {
  const params = useParams();
  const router = useRouter();
  const widgetId = params.id as string;
  const roomId = params.roomId as string;
  const { user, profile, loading: userLoading } = useUser();
  
  // Use refs to avoid causing re-renders when profile changes
  const profileAvatarRef = useRef<string | null>(null);
  
  // Memoize profile values to avoid re-renders - only update ref when avatar file path actually changes
  const avatarPathBase = useMemo(() => {
    return profile?.avatar_url?.split('?token=')[0] || null;
  }, [profile?.avatar_url?.split('?token=')[0]]);
  
  // Update avatar ref only when the actual file path changes (not just the token)
  useEffect(() => {
    if (avatarPathBase && profile?.avatar_url) {
      profileAvatarRef.current = profile.avatar_url;
    }
  }, [avatarPathBase, profile?.avatar_url]);
  
  const { messages, setMessages, addMessage, clearMessages } = useInboxStore();
  const { confirm, AlertDialogComponent } = useAlertDialog();
  const { error: showError, success: showSuccess, ToastContainer } = useToast();
  const [widget, setWidget] = useState<Widget | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [banDialogOpen, setBanDialogOpen] = useState(false);
  const [banReason, setBanReason] = useState('');
  const [isVisitorBanned, setIsVisitorBanned] = useState(false);
  const [checkingBanStatus, setCheckingBanStatus] = useState(false);
  const [isWidgetLoading, setIsWidgetLoading] = useState(true);
  const [isRoomLoading, setIsRoomLoading] = useState(true);
  const [isMessagesLoading, setIsMessagesLoading] = useState(false);
  const [widgetError, setWidgetError] = useState<string | null>(null);
  const [isVisitorOnline, setIsVisitorOnline] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const currentRoomIdRef = useRef<string | null>(null);
  const messageChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const presenceChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const widgetLoadingRef = useRef(false);
  const roomLoadingRef = useRef(false);
  const loadedWidgetIdRef = useRef<string | null>(null);
  const loadedRoomIdRef = useRef<string | null>(null);
  
  const supabase = useMemo(() => createClient(), []);

  // Reset refs when widgetId or roomId changes
  useEffect(() => {
    if (loadedWidgetIdRef.current !== widgetId) {
      loadedWidgetIdRef.current = null;
      widgetLoadingRef.current = false;
    }
    if (loadedRoomIdRef.current !== roomId) {
      loadedRoomIdRef.current = null;
      roomLoadingRef.current = false;
    }
  }, [widgetId, roomId]);

  // Load widget
  useEffect(() => {
    if (!widgetId || userLoading || !user) return;
    
    // Prevent multiple simultaneous loads
    if (widgetLoadingRef.current && loadedWidgetIdRef.current === widgetId) return;
    
    // Only reload if widgetId changed
    if (loadedWidgetIdRef.current === widgetId) return;
    
    widgetLoadingRef.current = true;
    loadedWidgetIdRef.current = widgetId;
    
    const loadWidget = async () => {
      try {
        setIsWidgetLoading(true);
        const res = await fetch(`/api/widgets/${widgetId}`, {
          credentials: 'include'
        });
        
        if (!res.ok) throw new Error('Failed to load widget');
        const widgetData = await res.json();
        
        // Only update if widgetId hasn't changed
        if (loadedWidgetIdRef.current === widgetId) {
          setWidget(widgetData);
        }
      } catch (error: any) {
        if (loadedWidgetIdRef.current === widgetId) {
          setWidgetError(error.message || 'Erro ao carregar widget');
        }
      } finally {
        if (loadedWidgetIdRef.current === widgetId) {
          setIsWidgetLoading(false);
          widgetLoadingRef.current = false;
        }
      }
    };
    
    loadWidget();
  }, [widgetId, userLoading, user]);

  // Load room
  useEffect(() => {
    if (!widgetId || !roomId || userLoading || !user) return;
    
    // Prevent multiple simultaneous loads
    if (roomLoadingRef.current && loadedRoomIdRef.current === roomId) return;
    
    // Only reload if roomId changed
    if (loadedRoomIdRef.current === roomId) return;
    
    roomLoadingRef.current = true;
    const currentRoomId = roomId;
    loadedRoomIdRef.current = currentRoomId;
    
    const loadRoom = async () => {
      try {
        setIsRoomLoading(true);
        const res = await fetch(`/api/widgets/${widgetId}/rooms`, {
          credentials: 'include'
        });
        
        if (!res.ok) throw new Error('Failed to load rooms');
        const data = await res.json();
        const room = data.rooms?.find((r: Room) => r.id === currentRoomId);
        
        // Only update if roomId hasn't changed
        if (loadedRoomIdRef.current === currentRoomId) {
          if (room) {
            // Only update if room actually changed (prevent unnecessary re-renders)
            setSelectedRoom((prev) => {
              if (prev?.id === room.id) {
                // Room ID is the same, only update if something else changed
                return prev;
              }
              return room;
            });
          } else {
            router.push(`/dashboard/widgets/${widgetId}/inbox`);
            return;
          }
        }
      } catch (error: any) {
        console.error('Error loading room:', error);
        if (loadedRoomIdRef.current === currentRoomId) {
          router.push(`/dashboard/widgets/${widgetId}/inbox`);
        }
      } finally {
        if (loadedRoomIdRef.current === currentRoomId) {
          setIsRoomLoading(false);
          roomLoadingRef.current = false;
        }
      }
    };
    
    loadRoom();
    
    // Cleanup if roomId changes
    return () => {
      if (loadedRoomIdRef.current !== currentRoomId) {
        roomLoadingRef.current = false;
      }
    };
  }, [widgetId, roomId, userLoading, user, router]);

  // Load messages
  const loadMessages = useCallback(async (roomId: string) => {
    if (!widgetId || !roomId) return;
    
    try {
      setIsMessagesLoading(true);
      const res = await fetch(`/api/widgets/${widgetId}/rooms/${roomId}/messages`, {
        credentials: 'include'
      });
      
      if (!res.ok) throw new Error('Failed to load messages');
      const data = await res.json();
      setMessages(data.messages || []);
      
      // Mark all unread messages as read when opening the conversation
      const unreadMessages = (data.messages || []).filter(
        (m: Message) => m.sender_type === 'visitor' && !m.is_read
      );
      
      if (unreadMessages.length > 0) {
        // Mark all messages as read via API
        try {
          await fetch(`/api/widgets/${widgetId}/rooms/${roomId}/messages/read`, {
            method: 'PATCH',
            credentials: 'include',
          });
        } catch (err) {
          console.error('Error marking messages as read:', err);
          // Don't block message loading if this fails
        }
      }
      
      // Scroll to bottom after messages are loaded
      setTimeout(() => {
        if (messagesContainerRef.current) {
          messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
        }
      }, 150);
    } catch (error: any) {
      console.error('Error loading messages:', error);
      setMessages([]);
    } finally {
      setIsMessagesLoading(false);
    }
  }, [widgetId, setMessages]);

  // Subscribe to messages
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
          
          // Scroll to bottom when new message arrives
          setTimeout(() => {
            if (messagesContainerRef.current) {
              messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
            }
          }, 50);
          
          if (newMessage.sender_type === 'visitor' && !newMessage.is_read && widgetId && roomId) {
            fetch(`/api/widgets/${widgetId}/rooms/${roomId}/messages/${newMessage.id}/read`, {
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
  }, [supabase, addMessage, widgetId]);

  // Setup presence - use refs to avoid dependency on profile which changes frequently
  const profileFullNameRef = useRef<string | null>(null);
  const userEmailRef = useRef<string | null>(null);
  
  useEffect(() => {
    if (profile?.full_name) profileFullNameRef.current = profile.full_name;
    if (user?.email) userEmailRef.current = user.email;
  }, [profile?.full_name, user?.email]);
  
  useEffect(() => {
    if (!selectedRoom?.id || !user?.id) {
      if (presenceChannelRef.current) {
        presenceChannelRef.current.untrack().catch(console.error);
        supabase.removeChannel(presenceChannelRef.current);
        presenceChannelRef.current = null;
      }
      setIsVisitorOnline(false);
      return;
    }

    const roomId = selectedRoom.id;
    const currentUserId = user.id;
    
    // Prevent re-setup if already set up for this room
    if (presenceChannelRef.current && currentRoomIdRef.current === roomId) {
      return;
    }
    
    if (presenceChannelRef.current) {
      presenceChannelRef.current.untrack().catch(console.error);
      supabase.removeChannel(presenceChannelRef.current);
      presenceChannelRef.current = null;
    }

    const channelName = `presence:${roomId}`;
    const presenceChannel = supabase.channel(channelName, {
      config: {
        presence: {
          key: `agent:${currentUserId}`,
        },
      },
    });

    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const presenceState = presenceChannel.presenceState();
        updateVisitorOnlineStatus(presenceState);
      })
      .on('presence', { event: 'join' }, () => {
        updateVisitorOnlineStatus(presenceChannel.presenceState());
      })
      .on('presence', { event: 'leave' }, () => {
        updateVisitorOnlineStatus(presenceChannel.presenceState());
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED' && currentRoomIdRef.current === roomId) {
          const agentPresence = {
            user: 'agent',
            agent_id: currentUserId,
            agent_name: profileFullNameRef.current || userEmailRef.current?.split('@')[0] || 'Suporte',
            online_at: new Date().toISOString(),
          };
          await presenceChannel.track(agentPresence);
        }
      });

    presenceChannelRef.current = presenceChannel;

    function updateVisitorOnlineStatus(presenceState: any) {
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
      if (currentRoomIdRef.current === roomId) {
        setIsVisitorOnline(visitorFound);
      }
    }

    return () => {
      if (presenceChannelRef.current) {
        presenceChannelRef.current.untrack().catch(console.error);
        supabase.removeChannel(presenceChannelRef.current);
        presenceChannelRef.current = null;
      }
      if (currentRoomIdRef.current === roomId) {
        setIsVisitorOnline(false);
      }
    };
  }, [selectedRoom?.id, user?.id, supabase]);

  // Handle room selection
  useEffect(() => {
    if (!selectedRoom) {
      currentRoomIdRef.current = null;
      clearMessages();
      return;
    }

    const roomId = selectedRoom.id;
    if (currentRoomIdRef.current === roomId) return;

    currentRoomIdRef.current = roomId;
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
    if (messages.length > 0 && !isMessagesLoading && messagesContainerRef.current && selectedRoom?.id === roomId) {
      // Use setTimeout to ensure DOM is fully rendered
      setTimeout(() => {
        if (messagesContainerRef.current) {
          messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
        }
      }, 100);
    }
  }, [messages.length, isMessagesLoading, selectedRoom?.id, roomId]);

  // Scroll to bottom immediately when room is first loaded
  useEffect(() => {
    if (selectedRoom?.id === roomId && !isMessagesLoading && messages.length > 0 && messagesContainerRef.current) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (messagesContainerRef.current) {
            messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
          }
        });
      });
    }
  }, [selectedRoom?.id, roomId]);

  const sendMessage = useCallback(async () => {
    if (!inputValue.trim() || !selectedRoom || !widgetId) return;
    
    const roomIdAtSend = selectedRoom.id;
    const messageContent = inputValue.trim();

    try {
      if (roomIdAtSend !== currentRoomIdRef.current) {
        return;
      }
      
      setInputValue('');
      
      // Use refs to avoid dependency on profile
      const senderName = profileFullNameRef.current || userEmailRef.current?.split('@')[0] || 'Suporte';
      const senderAvatar = profileAvatarRef.current || null; // Use ref to avoid re-renders
      
      const res = await fetch(`/api/widgets/${widgetId}/rooms/${roomIdAtSend}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          content: messageContent,
          sender_name: senderName,
          sender_avatar: senderAvatar,
          message_type: 'text',
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to send message: ${res.statusText}`);
      }
    } catch (error: any) {
      console.error('Error sending message:', error);
      setInputValue(messageContent);
      showError(error.message || 'Erro ao enviar mensagem. Tente novamente.');
    }
  }, [inputValue, selectedRoom, widgetId, showError]);

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
      const res = await fetch(`/api/widgets/${widgetId}/rooms/${roomId}/close`, {
        method: 'PATCH',
        credentials: 'include',
      });

      if (!res.ok) throw new Error('Failed to close conversation');
      const data = await res.json();
      
      if (data.room) {
        setSelectedRoom(data.room);
      }
    } catch (error: any) {
      console.error('Error closing conversation:', error);
      showError(error.message || 'Erro ao fechar conversa. Tente novamente.');
    }
  }, [widgetId, confirm, showError]);

  const reopenConversation = useCallback(async (roomId: string) => {
    try {
      const res = await fetch(`/api/widgets/${widgetId}/rooms/${roomId}/reopen`, {
        method: 'PATCH',
        credentials: 'include',
      });

      if (!res.ok) throw new Error('Failed to reopen conversation');
      const data = await res.json();
      
      if (data.room) {
        setSelectedRoom(data.room);
      }
    } catch (error: any) {
      console.error('Error reopening conversation:', error);
      showError(error.message || 'Erro ao reabrir conversa. Tente novamente.');
    }
  }, [widgetId, showError]);

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
      // Don't show error, just assume not banned
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

  // Memoize email to prevent re-renders when user object reference changes
  // Must be defined before any conditional returns
  const userEmail = useMemo(() => user?.email || '', [user?.email]);
  
  // Memoize avatar URL by file path (without token) to prevent re-renders when only token changes
  const avatarUrl = useMemo(() => {
    if (!profile?.avatar_url) return null;
    return profile.avatar_url;
  }, [profile?.avatar_url?.split('?token=')[0]]);

  if (isWidgetLoading || isRoomLoading) {
    return (
      <DashboardLayout
        email={userEmail}
        avatarUrl={avatarUrl}
        title={widget?.name || 'Widget'}
        description="Carregando..."
      >
        <div className="min-h-[calc(100vh-140px)] flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }
  
  if (widgetError || !selectedRoom) {
    return (
      <DashboardLayout
        email={userEmail}
        avatarUrl={avatarUrl}
        title="Erro"
        description="Erro ao carregar"
      >
        <div className="min-h-[calc(100vh-140px)] flex items-center justify-center">
          <Card className="max-w-md w-full">
            <div className="p-6 text-center space-y-4">
              <p className="text-muted-foreground">
                {widgetError || 'Sala não encontrada'}
              </p>
              <Link href={`/dashboard/widgets/${widgetId}/inbox`}>
                <Button>Voltar para Inbox</Button>
              </Link>
            </div>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      email={userEmail}
      avatarUrl={avatarUrl}
      title={widget?.name || 'Widget'}
      description="Gerencie suas conversas em tempo real"
    >
      <div className="-m-3 sm:-m-6 lg:-m-6 lg:-mb-8">
        <div className="flex flex-col lg:flex-row h-[calc(100vh-200px)] lg:h-[calc(100vh-180px)] gap-3 sm:gap-6 overflow-hidden relative">
          {/* Chat Area */}
          <div className="flex flex-1 flex-col min-h-0 relative bg-background">
            <Card className="flex-1 flex flex-col min-h-0 h-full max-h-full border-0 lg:border rounded-none lg:rounded-lg shadow-none lg:shadow" style={{ display: 'flex', flexDirection: 'column' }}>
              {/* Chat Header */}
              <div className="flex items-center justify-between p-4 border-b bg-background flex-shrink-0 z-10">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <Link href={`/dashboard/widgets/${widgetId}/inbox`}>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="flex-shrink-0 h-9 w-9"
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                  </Link>
                  
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
                      {!isVisitorOnline && (
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

              {/* Messages */}
              <div
                ref={messagesContainerRef}
                id="messages-container"
                className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-6 space-y-3 sm:space-y-4 bg-muted/20 min-h-0"
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
                    {messages.map((message) => {
                      const isAgent = message.sender_type === 'agent';
                      const isSystem = message.message_type === 'system';
                      
                      if (isSystem) {
                        return (
                          <div key={message.id} className="flex justify-center">
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

              {/* Input */}
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
        </div>
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

