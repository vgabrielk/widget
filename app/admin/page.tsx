'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Room, Message } from '@/lib/chat/types';
import { MessageCircle, Send, Users, Clock, Loader2 } from 'lucide-react';
import { useInfiniteQuery } from '@/lib/hooks/use-infinite-query';
import { useAdminStore } from '@/stores/useAdminStore';

export default function AdminPage() {
  const router = useRouter();
  const { messages, setMessages, addMessage, clearMessages } = useAdminStore();
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [user, setUser] = useState<any>(null);
  const [widgetIds, setWidgetIds] = useState<string[]>([]);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const currentRoomIdRef = useRef<string | null>(null); // Prevent race conditions
  const supabase = createClient();

  // SEGURANÇA: Verificar autenticação e carregar widgets do usuário
  useEffect(() => {
    const loadUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.push('/auth/login');
        return;
      }

      setUser(user);

      // Get user's widgets
      const { data: widgets } = await supabase
        .from('widgets')
        .select('id')
        .eq('user_id', user.id);

      setWidgetIds(widgets?.map(w => w.id) || []);
      setIsLoadingUser(false);
    };

    loadUser();
  }, [router]);

  // Use infinite query for rooms
  const { 
    data: rooms, 
    isLoading, 
    isFetching, 
    hasMore, 
    fetchNextPage,
    count 
  } = useInfiniteQuery<Room, 'rooms'>({
    tableName: 'rooms',
    pageSize: 20,
    trailingQuery: (query) => {
      let q = query;
      if (widgetIds.length > 0) {
        // SEGURANÇA: Só busca rooms dos widgets do usuário autenticado
        q = q.in('widget_id', widgetIds);
      } else {
        // CRÍTICO: Se não tem widgetIds ainda, retornar vazio (filtro impossível)
        // Isso previne carregar TODAS as rooms antes da autenticação
        q = q.eq('widget_id', '00000000-0000-0000-0000-000000000000');
      }
      return q
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });
    }
  });

  // Infinite scroll observer
  const observerRef = useRef<IntersectionObserver | null>(null);
  const lastRoomRef = useCallback((node: HTMLDivElement | null) => {
    if (isLoading || isFetching) return;
    if (observerRef.current) observerRef.current.disconnect();
    
    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        fetchNextPage();
      }
    });
    
    if (node) observerRef.current.observe(node);
  }, [isLoading, isFetching, hasMore, fetchNextPage]);

  const loadMessages = useCallback(async (roomId: string) => {
    try {
      // Verify room hasn't changed
      if (roomId !== currentRoomIdRef.current) {
        console.log('⚠️ Room changed, aborting load');
        return;
      }

      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      
      // Only update if room still the same
      if (roomId === currentRoomIdRef.current) {
        setMessages(data || []);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  }, [supabase, setMessages]);

  // Load messages when room is selected
  useEffect(() => {
    if (selectedRoom) {
      // Update ref immediately
      currentRoomIdRef.current = selectedRoom.id;
      
      // Clear messages and input
      clearMessages();
      setInputValue('');
      
      loadMessages(selectedRoom.id);
      
      // Subscribe to new messages
      const messagesChannel = supabase
        .channel(`admin-messages-${selectedRoom.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `room_id=eq.${selectedRoom.id}`,
          },
          (payload) => {
            const newMessage = payload.new as Message;
            
            // CRITICAL: Only add if room hasn't changed
            if (currentRoomIdRef.current !== selectedRoom.id) {
              return;
            }
            
            // Check if message already exists using Zustand store
            const currentMessages = useAdminStore.getState().messages;
            const exists = currentMessages.some(m => m.id === newMessage.id);
            if (exists) return;
            
            addMessage(newMessage);
            
            // Auto scroll to bottom
            requestAnimationFrame(() => {
              const messagesContainer = document.getElementById('messages-container');
              if (messagesContainer && currentRoomIdRef.current === selectedRoom.id) {
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
              }
            });
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(messagesChannel);
      };
    } else {
      currentRoomIdRef.current = null;
      clearMessages();
      setInputValue('');
    }
  }, [selectedRoom?.id, clearMessages, loadMessages, supabase, addMessage]);

  const sendMessage = async () => {
    if (!selectedRoom || !inputValue.trim()) return;
    
    const roomIdAtSend = selectedRoom.id;
    const messageContent = inputValue.trim();

    try {
      // Verify room hasn't changed
      if (roomIdAtSend !== currentRoomIdRef.current) {
        console.warn('⚠️ Room changed, aborting send');
        return;
      }

      // Clear input immediately
      setInputValue('');

      const { error } = await supabase.from('messages').insert({
        room_id: roomIdAtSend,
        sender_type: 'admin',
        sender_id: 'admin',
        sender_name: 'Suporte',
        content: messageContent,
      });

      if (error) throw error;
      
      // Only update if room still the same
      if (roomIdAtSend === currentRoomIdRef.current) {
        // Reset unread count
        await supabase
          .from('rooms')
          .update({ unread_count: 0 })
          .eq('id', roomIdAtSend);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      // Restore input on error
      setInputValue(messageContent);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (isLoadingUser || (widgetIds.length === 0 && isLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 sticky top-0 z-10">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center">
                <MessageCircle className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Painel Admin - Chat
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Gerencie todas as conversas em tempo real
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                <Users className="w-5 h-5" />
                <span className="font-semibold">{rooms.length}</span>
                <span className="text-sm">conversas</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="flex h-[calc(100vh-88px)]">
        {/* Rooms List */}
        <div className="w-80 bg-white dark:bg-gray-800 border-r dark:border-gray-700 overflow-y-auto">
          <div className="p-4 border-b dark:border-gray-700">
            <h2 className="font-semibold text-gray-900 dark:text-white">Conversas Ativas</h2>
          </div>
          
          {rooms.length === 0 ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Nenhuma conversa ainda</p>
              <p className="text-sm mt-1">Aguardando visitantes...</p>
            </div>
          ) : (
            <div className="divide-y dark:divide-gray-700">
              {rooms.map((room) => (
                <button
                  key={room.id}
                  onClick={() => setSelectedRoom(room)}
                  className={`w-full p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                    selectedRoom?.id === room.id ? 'bg-indigo-50 dark:bg-indigo-900/20' : ''
                  }`}
                >
                  <div className="flex items-start justify-between mb-1">
                    <span className="font-medium text-gray-900 dark:text-white">
                      {room.visitor_name || 'Visitante'}
                    </span>
                    {room.unread_count > 0 && (
                      <span className="bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                        {room.unread_count}
                      </span>
                    )}
                  </div>
                  {room.visitor_email && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                      {room.visitor_email}
                    </p>
                  )}
                  <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                    <Clock className="w-3 h-3" />
                    {room.last_message_at
                      ? new Date(room.last_message_at).toLocaleString('pt-BR')
                      : new Date(room.created_at).toLocaleString('pt-BR')}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col bg-gray-50 dark:bg-gray-900">
          {selectedRoom ? (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {messages.map((message) => {
                  const isAdmin = message.sender_type === 'admin';
                  return (
                    <div
                      key={message.id}
                      className={`flex gap-3 ${isAdmin ? 'flex-row-reverse' : ''}`}
                    >
                      <div
                        className={`rounded-2xl p-4 max-w-[70%] ${
                          isAdmin
                            ? 'bg-indigo-600 text-white rounded-tr-none'
                            : 'bg-white dark:bg-gray-800 rounded-tl-none'
                        }`}
                      >
                        <p className={`text-sm font-medium mb-1 ${
                          isAdmin ? 'text-white/80' : 'text-gray-500 dark:text-gray-400'
                        }`}>
                          {message.sender_name}
                        </p>
                        <p className={isAdmin ? 'text-white' : 'text-gray-900 dark:text-gray-100'}>
                          {message.content}
                        </p>
                        <span className={`text-xs mt-2 block ${
                          isAdmin ? 'text-white/70' : 'text-gray-500 dark:text-gray-400'
                        }`}>
                          {new Date(message.created_at).toLocaleString('pt-BR')}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Input */}
              <div className="p-6 bg-white dark:bg-gray-800 border-t dark:border-gray-700">
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Digite sua resposta..."
                    className="flex-1 px-4 py-3 border dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!inputValue.trim()}
                    className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                  >
                    <Send className="w-5 h-5" />
                    Enviar
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400">
              <div className="text-center">
                <MessageCircle className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg">Selecione uma conversa para começar</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

