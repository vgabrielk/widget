import { getSupabaseClient } from '@/src/lib/supabaseClient'
import { useChatStore } from '@/src/stores/useChatStore'
import { realtimeManager } from '@/src/lib/realtimeManager'
import type { Message, Room } from '@/lib/chat/types'

/**
 * Chat Service
 * Handles all chat-related operations (rooms, messages, realtime subscriptions)
 */
export class ChatService {
  /**
   * Initialize visitor ID (from localStorage or create new)
   */
  static getOrCreateVisitorId(): string {
    if (typeof window === 'undefined') {
      return `visitor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }

    let visitorId = localStorage.getItem('chat_visitor_id')
    if (!visitorId) {
      visitorId = `visitor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      localStorage.setItem('chat_visitor_id', visitorId)
    }

    useChatStore.getState().setVisitorId(visitorId)
    return visitorId
  }

  /**
   * Initialize or get existing room for visitor
   */
  static async initializeRoom(visitorId: string): Promise<Room | null> {
    const { setRoomId, setIsLoading, setError } = useChatStore.getState()

    setIsLoading(true)
    setError(null)

    try {
      console.log('🏠 Initializing room for visitor:', visitorId)

      const supabase = getSupabaseClient()

      // Try to find existing active room
      const { data: existingRooms, error: fetchError } = await supabase
        .from('rooms')
        .select('*')
        .eq('visitor_id', visitorId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)

      if (fetchError) throw fetchError

      if (existingRooms && existingRooms.length > 0) {
        const room = existingRooms[0]
        setRoomId(room.id)
        setIsLoading(false)
        console.log('✅ Found existing room:', room.id)
        return room
      }

      // Create new room
      const { data: newRoom, error: createError } = await supabase
        .from('rooms')
        .insert({
          visitor_id: visitorId,
          visitor_name:
            (typeof window !== 'undefined'
              ? localStorage.getItem('chat_visitor_name')
              : null) || 'Visitante',
        })
        .select()
        .single()

      if (createError) throw createError

      setRoomId(newRoom.id)
      setIsLoading(false)
      console.log('✅ Created new room:', newRoom.id)

      return newRoom
    } catch (error) {
      console.error('❌ Error initializing room:', error)
      setError(error instanceof Error ? error : new Error('Unknown error'))
      setIsLoading(false)
      return null
    }
  }

  /**
   * Load messages for a room
   */
  static async loadMessages(roomId: string): Promise<void> {
    const { setMessages, setIsLoading, setError } = useChatStore.getState()

    setIsLoading(true)
    setError(null)

    try {
      console.log('📨 Loading messages for room:', roomId)

      const supabase = getSupabaseClient()

      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: true })

      if (error) throw error

      setMessages(data || [])
      setIsLoading(false)

      console.log('✅ Loaded messages:', data?.length || 0)
    } catch (error) {
      console.error('❌ Error loading messages:', error)
      setError(error instanceof Error ? error : new Error('Unknown error'))
      setIsLoading(false)
    }
  }

  /**
   * Subscribe to realtime updates for a room
   */
  static subscribeToMessages(roomId: string): () => void {
    console.log('🔔 Subscribing to realtime messages for room:', roomId)

    const unsubscribe = realtimeManager.subscribeToMessages(
      roomId,
      (message) => {
        console.log('⚡ New message received:', message.id)
        const { addMessage } = useChatStore.getState()
        
        // Check if message already exists to prevent duplicates
        const currentMessages = useChatStore.getState().messages
        const exists = currentMessages.some((m) => m.id === message.id)
        
        if (!exists) {
          addMessage(message)
        }
      },
      (error) => {
        console.error('❌ Realtime error:', error)
        useChatStore.getState().setError(error)
      }
    )

    return unsubscribe
  }

  /**
   * Send a message
   */
  static async sendMessage(roomId: string, visitorId: string, content: string): Promise<void> {
    const { setError } = useChatStore.getState()

    try {
      console.log('📤 Sending message:', content.substring(0, 50))

      const supabase = getSupabaseClient()

      const { error } = await supabase.from('messages').insert({
        room_id: roomId,
        sender_type: 'visitor',
        sender_id: visitorId,
        sender_name:
          (typeof window !== 'undefined'
            ? localStorage.getItem('chat_visitor_name')
            : null) || 'Visitante',
        content: content.trim(),
      })

      if (error) throw error

      console.log('✅ Message sent successfully')
    } catch (error) {
      console.error('❌ Error sending message:', error)
      setError(error instanceof Error ? error : new Error('Unknown error'))
      throw error
    }
  }

  /**
   * Mark messages as read
   */
  static async markAsRead(roomId: string): Promise<void> {
    const { resetUnreadCount, setError } = useChatStore.getState()

    try {
      console.log('✅ Marking messages as read for room:', roomId)

      const supabase = getSupabaseClient()

      const { error } = await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('room_id', roomId)
        .eq('sender_type', 'admin')
        .eq('is_read', false)

      if (error) throw error

      resetUnreadCount()
      console.log('✅ Messages marked as read')
    } catch (error) {
      console.error('❌ Error marking messages as read:', error)
      setError(error instanceof Error ? error : new Error('Unknown error'))
    }
  }

  /**
   * Initialize chat (visitor ID + room + messages + subscription)
   * Can optionally use widget config credentials for Supabase
   */
  static async initialize(widgetConfig?: { supabaseUrl?: string; supabaseKey?: string }): Promise<void> {
    // Initialize Supabase client with widget config if provided
    if (widgetConfig?.supabaseUrl && widgetConfig?.supabaseKey) {
      getSupabaseClient({
        url: widgetConfig.supabaseUrl,
        key: widgetConfig.supabaseKey,
      })
    }

    const visitorId = this.getOrCreateVisitorId()
    const room = await this.initializeRoom(visitorId)

    if (room) {
      await this.loadMessages(room.id)
      this.subscribeToMessages(room.id)
    }
  }

  /**
   * Cleanup (unsubscribe from realtime)
   */
  static cleanup(): void {
    console.log('🧹 Cleaning up chat service')
    realtimeManager.unsubscribeAll()
    useChatStore.getState().clearMessages()
    useChatStore.getState().setRoomId(null)
  }
}

