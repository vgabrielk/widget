'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Message, Room } from './types';

export function useChatWidget() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [room, setRoom] = useState<Room | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [visitorId, setVisitorId] = useState<string>('');
  const [unreadCount, setUnreadCount] = useState(0);
  const supabase = createClient();

  // Initialize visitor ID from localStorage or create new one
  useEffect(() => {
    let id = localStorage.getItem('chat_visitor_id');
    if (!id) {
      id = `visitor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('chat_visitor_id', id);
    }
    setVisitorId(id);
  }, []);

  // Initialize or get existing room
  const initializeRoom = useCallback(async () => {
    if (!visitorId) return;

    try {
      // Try to find existing active room
      const { data: existingRooms } = await supabase
        .from('rooms')
        .select('*')
        .eq('visitor_id', visitorId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1);

      if (existingRooms && existingRooms.length > 0) {
        setRoom(existingRooms[0]);
        return existingRooms[0];
      }

      // Create new room
      const { data: newRoom, error } = await supabase
        .from('rooms')
        .insert({
          visitor_id: visitorId,
          visitor_name: localStorage.getItem('chat_visitor_name') || 'Visitante',
        })
        .select()
        .single();

      if (error) throw error;
      setRoom(newRoom);
      return newRoom;
    } catch (error) {
      console.error('Error initializing room:', error);
      return null;
    }
  }, [visitorId, supabase]);

  // Load messages for the room
  const loadMessages = useCallback(async (roomId: string) => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);
      
      // Count unread admin messages
      const unread = data?.filter(m => 
        m.sender_type === 'admin' && !m.is_read
      ).length || 0;
      setUnreadCount(unread);
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  // Initialize room and messages
  useEffect(() => {
    if (!visitorId) return;

    const init = async () => {
      const currentRoom = await initializeRoom();
      if (currentRoom) {
        await loadMessages(currentRoom.id);
      }
    };

    init();
  }, [visitorId, initializeRoom, loadMessages]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!room?.id) return;

    const channel = supabase
      .channel(`room:${room.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `room_id=eq.${room.id}`,
        },
        (payload) => {
          const newMessage = payload.new as Message;
          setMessages((prev) => [...prev, newMessage]);
          
          // Increment unread count if admin message
          if (newMessage.sender_type === 'admin') {
            setUnreadCount((prev) => prev + 1);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [room?.id, supabase]);

  // Send message
  const sendMessage = async (content: string) => {
    if (!room?.id || !content.trim()) return;

    try {
      const { error } = await supabase.from('messages').insert({
        room_id: room.id,
        sender_type: 'visitor',
        sender_id: visitorId,
        sender_name: localStorage.getItem('chat_visitor_name') || 'Visitante',
        content: content.trim(),
      });

      if (error) throw error;
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  };

  // Mark messages as read
  const markAsRead = useCallback(async () => {
    if (!room?.id) return;

    try {
      // Mark all admin messages as read
      await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('room_id', room.id)
        .eq('sender_type', 'admin')
        .eq('is_read', false);

      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  }, [room?.id, supabase]);

  // Update visitor info
  const updateVisitorInfo = async (name: string, email?: string) => {
    if (!room?.id) return;

    try {
      await supabase
        .from('rooms')
        .update({
          visitor_name: name,
          visitor_email: email,
        })
        .eq('id', room.id);

      localStorage.setItem('chat_visitor_name', name);
      if (email) {
        localStorage.setItem('chat_visitor_email', email);
      }
    } catch (error) {
      console.error('Error updating visitor info:', error);
    }
  };

  return {
    messages,
    room,
    isLoading,
    unreadCount,
    sendMessage,
    markAsRead,
    updateVisitorInfo,
  };
}

