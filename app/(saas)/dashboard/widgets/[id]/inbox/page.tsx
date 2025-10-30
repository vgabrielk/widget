'use client';

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Room, Message, Widget } from '@/lib/types/saas';
import { useParams, useRouter } from 'next/navigation';
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
  ArrowLeft
} from 'lucide-react';
import { useUser } from '@/lib/contexts/user-context';
import { Skeleton } from '@/components/ui/skeleton';

export default function InboxPage() {
  const params = useParams();
  const router = useRouter();
  const widgetId = params.id as string;
  const { user, profile } = useUser();
  
  const [widget, setWidget] = useState<Widget | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [filteredRooms, setFilteredRooms] = useState<Room[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'closed'>('all');
  const [isWidgetLoading, setIsWidgetLoading] = useState(true);
  const [isRoomsLoading, setIsRoomsLoading] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isMessagesLoading, setIsMessagesLoading] = useState(false);
  const [userEmail, setUserEmail] = useState<string>('');
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const currentRoomIdRef = useRef<string | null>(null);
  
  // CRITICAL: Create supabase client only once with useMemo to prevent infinite loops
  const supabase = useMemo(() => createClient(), []);

  // Load rooms
  const loadRooms = useCallback(async () => {
    try {
      setIsRoomsLoading(true);
      const { data, error } = await supabase
        .from('rooms')
        .select('*')
        .eq('widget_id', widgetId)
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setRooms(data || []);
    } catch (error) {
      console.error('Error loading rooms:', error);
    } finally {
      setIsRoomsLoading(false);
    }
  }, [widgetId, supabase]);

  // Load messages for selected room
  const loadMessages = useCallback(async (roomId: string) => {
    try {
      setIsMessagesLoading(true);
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: true })
        .limit(200);

      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setIsMessagesLoading(false);
    }
  }, [supabase]);

  // Load user email
  useEffect(() => {
    const loadUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        setUserEmail(user.email);
      }
    };
    loadUser();
  }, [supabase]);

  // Load rooms on mount
  useEffect(() => {
    loadRooms();
  }, [loadRooms]);


  // Load widget
  useEffect(() => {
    loadWidget();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [widgetId]);

  // Subscribe to rooms updates (realtime)
  useEffect(() => {
    if (!widgetId) return;

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
          const updatedRoom = payload.new as Room;
          const oldRoom = payload.old as Partial<Room> | null;
          const roomId = oldRoom?.id || updatedRoom?.id;
          
          // Update rooms optimistically
          if (payload.eventType === 'INSERT' && updatedRoom) {
            setRooms(prev => {
              // Check if already exists
              if (prev.some(r => r.id === updatedRoom.id)) return prev;
              // Add at beginning (most recent)
              return [updatedRoom, ...prev];
            });
          } else if (payload.eventType === 'UPDATE' && updatedRoom) {
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
                newRooms.splice(index, 1);
                newRooms.unshift(updatedRoom);
              }
              
              return newRooms;
            });
            
            // Update selectedRoom if it's the one being updated
            if (selectedRoom?.id === updatedRoom.id) {
              setSelectedRoom(updatedRoom);
            }
          } else if (payload.eventType === 'DELETE' && roomId) {
            setRooms(prev => prev.filter(r => r.id !== roomId));
            
            // Clear selection if deleted room was selected
            if (selectedRoom?.id === roomId) {
              setSelectedRoom(null);
              setSelectedRoomId(null);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [widgetId]); // Removed selectedRoom from deps - causes unnecessary reconnections

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
    
    setFilteredRooms(filtered);
  }, [rooms, searchQuery, statusFilter]);

  // Monitor selectedRoomId changes (disabled for performance)
  // useEffect(() => {
  //   console.log('🎯 selectedRoomId changed:', {
  //     old: currentRoomIdRef.current,
  //     new: selectedRoomId,
  //     hasRoom: !!selectedRoom
  //   });
  // }, [selectedRoomId]);

  // Handle room selection
  useEffect(() => {
    if (selectedRoom) {
      currentRoomIdRef.current = selectedRoom.id;
      setSelectedRoomId(selectedRoom.id);
      setInputValue('');
      
      // Load messages
      loadMessages(selectedRoom.id);
      
      // Mark as read
      markAsRead(selectedRoom.id);
      
      // Subscribe to new messages
      const cleanup = subscribeToMessages(selectedRoom.id);
      
      return () => {
        cleanup();
      };
    } else {
      currentRoomIdRef.current = null;
      setSelectedRoomId(null);
      setMessages([]);
      setInputValue('');
    }
  }, [selectedRoom?.id, loadMessages]);

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



  const loadWidget = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('widgets')
        .select('*')
        .eq('id', widgetId)
        .single();

      if (error) throw error;
      if (!data) {
        router.push('/dashboard');
        return;
      }

      setWidget(data);
    } catch (error) {
      console.error('Error loading widget:', error);
      router.push('/dashboard');
    } finally {
      setIsWidgetLoading(false);
    }
  }, [widgetId, supabase, router]);

  const subscribeToMessages = useCallback((roomId: string) => {
    console.log('📡 Subscribing to messages for room:', roomId);
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
        async (payload) => {
          const newMessage = payload.new as Message;
          
          // CRITICAL: Only add message if it's for the currently selected room
          // This prevents race condition when switching rooms quickly
          if (currentRoomIdRef.current !== roomId) {
            return;
          }
          
          // Only add if not already in the list (prevent duplicates)
          setMessages((prev) => {
            // Double-check room hasn't changed while setState was queued
            if (currentRoomIdRef.current !== roomId) return prev;
            
            const exists = prev.some(m => m.id === newMessage.id);
            if (exists) return prev;
            return [...prev, newMessage];
          });
          
          // Se a conversa está aberta, marcar mensagem como lida automaticamente
          if (newMessage.sender_type === 'visitor' && !newMessage.is_read) {
            // Marcar como lida no banco (sem await para não bloquear UI)
            supabase
              .from('messages')
              .update({ is_read: true, read_at: new Date().toISOString() })
              .eq('id', newMessage.id)
              .then(({ error }) => {
                if (error) console.error('Error auto-marking message as read:', error);
              });
          }
          
          // Scroll is handled by useEffect that watches messages.length
          // NOTA: Notificações são gerenciadas pelo NotificationBell globalmente
          // para evitar duplicação. Aqui apenas atualizamos a UI.
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  const markAsRead = useCallback(async (roomId: string) => {
    try {
      // CRITICAL: Only mark as read if room is still selected
      if (roomId !== currentRoomIdRef.current) {
        return;
      }
      
      // Atualização otimista - UI primeiro
      setRooms(prev => 
        prev.map(r => r.id === roomId ? { ...r, unread_count: 0 } : r)
      );
      
      // 1. Marcar todas as mensagens como lidas
      const { error: messagesError } = await supabase
        .from('messages')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('room_id', roomId)
        .eq('is_read', false);
      
      if (messagesError) {
        console.error('Error marking messages as read:', messagesError);
      }
      
      // 2. Zerar contador de não lidas da room
      const { error: roomError } = await supabase
        .from('rooms')
        .update({ unread_count: 0 })
        .eq('id', roomId);
        
      if (roomError) {
        console.error('Error updating room unread count:', roomError);
      }
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  }, [supabase]);

  // Handler para clique na conversa - garante visualização
  const handleRoomClick = useCallback((room: Room) => {
    // Atualização otimista IMEDIATA do badge
    if (room.unread_count > 0) {
      setRooms(prev => 
        prev.map(r => r.id === room.id ? { ...r, unread_count: 0 } : r)
      );
    }
    
    // Selecionar a room (isso vai triggar markAsRead via useEffect)
    setSelectedRoom(room);
  }, []);

  // Handler para clique na área de mensagens - garante que está marcado como lido
  const handleMessagesAreaClick = useCallback(() => {
    if (selectedRoom && selectedRoom.unread_count > 0) {
      // Atualização otimista
      setRooms(prev => 
        prev.map(r => r.id === selectedRoom.id ? { ...r, unread_count: 0 } : r)
      );
      
      // Marcar como lido (função já tem proteção de duplicação)
      markAsRead(selectedRoom.id);
    }
  }, [selectedRoom, markAsRead]);

  const sendMessage = useCallback(async () => {
    if (!inputValue.trim() || !selectedRoom) return;
    
    // CRITICAL: Capture room ID at the moment of sending
    const roomIdAtSend = selectedRoom.id;

    try {
      // Validate room hasn't changed before sending
      if (roomIdAtSend !== currentRoomIdRef.current) {
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      const messageContent = inputValue.trim();
      
      // Clear input immediately for better UX
      setInputValue('');

      await supabase.from('messages').insert({
        room_id: roomIdAtSend,
        sender_type: 'agent',
        sender_id: user?.id || 'agent',
        sender_name: profile?.full_name || user?.email?.split('@')[0] || 'Suporte',
        sender_avatar: profile?.avatar_url || null,
        content: messageContent,
        message_type: 'text',
      });

      // Only update room if still on same room
      if (roomIdAtSend === currentRoomIdRef.current) {
        await supabase
          .from('rooms')
          .update({
            last_message_at: new Date().toISOString(),
            last_message_preview: messageContent.substring(0, 100),
          })
          .eq('id', roomIdAtSend);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      // Restore input value on error
      setInputValue(inputValue);
    }
  }, [inputValue, selectedRoom, supabase, profile]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }, [sendMessage]);

  const closeConversation = useCallback(async (roomId: string) => {
    if (!confirm('Deseja realmente fechar esta conversa?')) return;

    try {
      // CRITICAL: Verify room is still selected before proceeding
      if (roomId !== currentRoomIdRef.current) {
        return;
      }

      // 1. Buscar todas as mensagens com imagens
      const { data: messagesWithImages } = await supabase
        .from('messages')
        .select('image_url')
        .eq('room_id', roomId)
        .not('image_url', 'is', null);

      // 2. Deletar imagens do storage
      if (messagesWithImages && messagesWithImages.length > 0) {
        const imagePaths = messagesWithImages
          .map(m => {
            const match = m.image_url?.match(/chat-images\/(.+)$/);
            return match ? match[1] : null;
          })
          .filter(Boolean) as string[];

        if (imagePaths.length > 0) {
          await supabase.storage
            .from('chat-images')
            .remove(imagePaths);
        }
      }

      // Verify again before continuing
      if (roomId !== currentRoomIdRef.current) return;

      // 3. Adicionar mensagem de sistema
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('messages').insert({
        room_id: roomId,
        sender_type: 'agent',
        sender_id: user?.id || 'system',
        sender_name: 'Sistema',
        content: 'Conversa encerrada pelo suporte.',
        message_type: 'system',
      });

      // Verify again before continuing
      if (roomId !== currentRoomIdRef.current) return;

      // 4. Fechar a conversa
      await supabase
        .from('rooms')
        .update({ status: 'closed' })
        .eq('id', roomId);
      
      // Only refresh if still on same room
      if (roomId === currentRoomIdRef.current) {
        const { data: updatedRoom } = await supabase
          .from('rooms')
          .select('*')
          .eq('id', roomId)
          .single();
        
        if (updatedRoom) {
          setSelectedRoom(updatedRoom);
        }
      }
    } catch (error) {
      console.error('Error closing conversation:', error);
      alert('Erro ao fechar conversa. Tente novamente.');
    }
  }, [supabase]);

  const reopenConversation = useCallback(async (roomId: string) => {
    try {
      // CRITICAL: Verify room is still selected
      if (roomId !== currentRoomIdRef.current) {
        return;
      }

      await supabase
        .from('rooms')
        .update({ status: 'open' })
        .eq('id', roomId);
      
      // Only refresh if still on same room
      if (roomId === currentRoomIdRef.current) {
        const { data: updatedRoom } = await supabase
          .from('rooms')
          .select('*')
          .eq('id', roomId)
          .single();
        
        if (updatedRoom) {
          setSelectedRoom(updatedRoom);
        }
      }
    } catch (error) {
      console.error('Error reopening conversation:', error);
    }
  }, [supabase]);

  const getInitials = (name: string | null) => {
    if (!name) return 'V';
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Check if visitor is online (activity within last 3 minutes)
  const isVisitorOnline = (lastActivity: string | null): boolean => {
    if (!lastActivity) return false;
    const now = new Date();
    const lastActivityTime = new Date(lastActivity);
    const diffMinutes = (now.getTime() - lastActivityTime.getTime()) / (1000 * 60);
    return diffMinutes < 3;
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

  if (isWidgetLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const openCount = rooms.filter(r => r.status === 'open').length;
  const closedCount = rooms.filter(r => r.status === 'closed').length;
  const totalUnread = rooms.reduce((sum, r) => sum + (r.unread_count || 0), 0);

  return (
    <DashboardLayout
      email={userEmail}
      title={widget?.name || 'Widget'}
      description="Gerencie suas conversas em tempo real"
    >
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
      <div className="flex flex-col lg:flex-row h-[calc(100vh-140px)] sm:h-[calc(100vh-180px)] gap-3 sm:gap-6">
        {/* Sidebar - Lista de Conversas */}
        <div className={`${selectedRoom ? 'hidden lg:flex' : 'flex'} w-full lg:w-[380px] flex-col gap-3 sm:gap-4`}>
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
          <Card className="flex-1 overflow-hidden">
            <div className="h-full overflow-y-auto">
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
                      <button
                        key={room.id}
                        // No ref needed - no infinite scroll
                        onClick={() => handleRoomClick(room)}
                        className={`w-full p-3 sm:p-4 text-left hover:bg-accent transition-all duration-200 ease-in-out ${
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
                                  <div className={`h-2 w-2 rounded-full flex-shrink-0 ${
                                    isVisitorOnline(room.last_activity) 
                                      ? 'bg-green-500 animate-pulse' 
                                      : 'bg-gray-400'
                                  }`} title={isVisitorOnline(room.last_activity) ? 'Online' : 'Offline'} />
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
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </Card>
        </div>

        {/* Main Chat Area */}
        <div className={`${selectedRoom ? 'flex' : 'hidden lg:flex'} flex-1 flex-col`}>
          {selectedRoom ? (
            <Card className="flex-1 flex flex-col overflow-hidden">
              {/* Chat Header */}
              <div className="flex items-center justify-between p-3 sm:p-4 border-b">
                <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                  {/* Mobile Back Button */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="lg:hidden flex-shrink-0 h-8 w-8"
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
                      <Badge 
                        variant={isVisitorOnline(selectedRoom.last_activity) ? 'default' : 'secondary'} 
                        className="h-4 sm:h-5 text-xs flex items-center gap-1"
                      >
                        <div className={`h-1.5 w-1.5 rounded-full ${
                          isVisitorOnline(selectedRoom.last_activity) ? 'bg-green-500' : 'bg-gray-400'
                        }`} />
                        {isVisitorOnline(selectedRoom.last_activity) ? 'Online' : 'Offline'}
                      </Badge>
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
                  
                  {selectedRoom.status === 'open' ? (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => closeConversation(selectedRoom.id)}
                      className="text-xs sm:text-sm h-8 sm:h-9"
                    >
                      <X className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
                      <span className="hidden sm:inline">Fechar</span>
                    </Button>
                  ) : (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => reopenConversation(selectedRoom.id)}
                      className="text-xs sm:text-sm h-8 sm:h-9"
                    >
                      <CheckCircle2 className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
                      <span className="hidden sm:inline">Reabrir</span>
                    </Button>
                  )}
                </div>
              </div>

              {/* Messages */}
              <div
                ref={messagesContainerRef}
                id="messages-container"
                className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-6 space-y-3 sm:space-y-4 bg-muted/20"
                onClick={handleMessagesAreaClick}
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
                          className={`rounded-2xl px-3 sm:px-4 py-2 sm:py-3 ${
                            isAgent
                              ? 'bg-primary text-primary-foreground rounded-tr-sm'
                              : 'bg-background border rounded-tl-sm'
                          }`}
                        >
                          <p className={`text-xs mb-1 ${isAgent ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                            {message.sender_name}
                          </p>
                          
                          {message.content && (
                            <p className="text-xs sm:text-sm whitespace-pre-wrap break-words">
                              {message.content}
                            </p>
                          )}
                          
                          {message.image_url && (
                            <div className="mt-2">
                              <img
                                src={message.image_url}
                                alt={message.image_name || 'Imagem'}
                                className="rounded-lg max-w-full h-auto cursor-pointer hover:opacity-90 transition-opacity"
                                style={{ maxHeight: '200px' }}
                                onClick={() => message.image_url && window.open(message.image_url, '_blank')}
                              />
                              {message.image_name && (
                                <p className={`text-xs mt-1 ${isAgent ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
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
              <div className="p-3 sm:p-4 pb-safe border-t bg-background" style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
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
    </DashboardLayout>
  );
}
