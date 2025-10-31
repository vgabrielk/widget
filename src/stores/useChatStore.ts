import { create } from 'zustand'
import type { Message } from '@/lib/chat/types'

type ChatStore = {
  messages: Message[]
  roomId: string | null
  visitorId: string | null
  isLoading: boolean
  unreadCount: number
  error: Error | null

  // Actions
  setMessages: (messages: Message[]) => void
  addMessage: (message: Message) => void
  updateMessage: (messageId: string, updates: Partial<Message>) => void
  clearMessages: () => void
  setRoomId: (roomId: string | null) => void
  setVisitorId: (visitorId: string | null) => void
  setIsLoading: (isLoading: boolean) => void
  setUnreadCount: (count: number) => void
  incrementUnreadCount: () => void
  resetUnreadCount: () => void
  setError: (error: Error | null) => void
}

/**
 * Global chat store using Zustand
 * Manages all chat-related state (messages, room, visitor, loading, errors)
 */
export const useChatStore = create<ChatStore>((set) => ({
  messages: [],
  roomId: null,
  visitorId: null,
  isLoading: true,
  unreadCount: 0,
  error: null,

  setMessages: (messages) => {
    console.log('📦 Setting messages:', messages.length)
    set({ messages })
    
    // Update unread count based on admin messages
    const unread = messages.filter(
      (m) => m.sender_type === 'admin' && !m.is_read
    ).length
    set({ unreadCount: unread })
  },

  addMessage: (message) => {
    set((state) => {
      // Prevent duplicates
      const exists = state.messages.some((m) => m.id === message.id)
      if (exists) {
        console.log('⚠️ Duplicate message ignored:', message.id)
        return state
      }

      console.log('➕ Adding message:', message.id)
      const newMessages = [...state.messages, message]

      // Update unread count if admin message
      let newUnreadCount = state.unreadCount
      if (message.sender_type === 'admin' && !message.is_read) {
        newUnreadCount = state.unreadCount + 1
      }

      return {
        messages: newMessages,
        unreadCount: newUnreadCount,
      }
    })
  },

  updateMessage: (messageId, updates) => {
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === messageId ? { ...m, ...updates } : m
      ),
    }))
  },

  clearMessages: () => {
    console.log('🗑️ Clearing messages')
    set({ messages: [], unreadCount: 0 })
  },

  setRoomId: (roomId) => {
    console.log('🏠 Setting room ID:', roomId)
    set({ roomId })
  },

  setVisitorId: (visitorId) => {
    console.log('👤 Setting visitor ID:', visitorId)
    set({ visitorId })
  },

  setIsLoading: (isLoading) => {
    set({ isLoading })
  },

  setUnreadCount: (count) => {
    set({ unreadCount: count })
  },

  incrementUnreadCount: () => {
    set((state) => ({ unreadCount: state.unreadCount + 1 }))
  },

  resetUnreadCount: () => {
    console.log('✅ Resetting unread count')
    set({ unreadCount: 0 })
  },

  setError: (error) => {
    set({ error })
    if (error) {
      console.error('❌ Chat store error:', error)
    }
  },
}))


