import { getSupabaseClient } from './supabaseClient'
import type { RealtimeChannel } from '@supabase/supabase-js'
import type { Message } from '@/lib/chat/types'

type MessageCallback = (message: Message) => void
type ErrorCallback = (error: Error) => void

/**
 * Centralized Realtime Manager
 * CRITICAL: Manages all Realtime subscriptions to prevent duplicates and leaks
 */
class RealtimeManager {
  private channels: Map<string, RealtimeChannel> = new Map()
  private callbacks: Map<string, Set<MessageCallback>> = new Map()
  private errorCallbacks: Map<string, Set<ErrorCallback>> = new Map()

  /**
   * Subscribe to messages for a specific room
   * @param roomId - The room ID to subscribe to
   * @param onMessage - Callback when a new message arrives
   * @param onError - Optional error callback
   * @returns Unsubscribe function
   */
  subscribeToMessages(
    roomId: string,
    onMessage: MessageCallback,
    onError?: ErrorCallback
  ): () => void {
    console.log(`🔔 Subscribing to room:${roomId}`)

    // Check if channel already exists
    let channel = this.channels.get(roomId)

    if (!channel) {
      // Create new channel
      const supabase = getSupabaseClient()
      channel = supabase
        .channel(`room:${roomId}`, {
          config: {
            broadcast: { self: false },
          },
        })
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `room_id=eq.${roomId}`,
          },
          (payload) => {
            console.log('⚡ Message INSERT event:', payload)
            const newMessage = payload.new as Message
            this.notifyCallbacks(roomId, newMessage)
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'messages',
            filter: `room_id=eq.${roomId}`,
          },
          (payload) => {
            console.log('⚡ Message UPDATE event:', payload)
            const updatedMessage = payload.new as Message
            this.notifyCallbacks(roomId, updatedMessage)
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'DELETE',
            schema: 'public',
            table: 'messages',
            filter: `room_id=eq.${roomId}`,
          },
          (payload) => {
            console.log('⚡ Message DELETE event:', payload)
            // You can handle deletes here if needed
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log(`✅ Subscribed to room:${roomId}`)
          } else if (status === 'CLOSED') {
            console.log(`❌ Subscription closed for room:${roomId}`)
          } else if (status === 'CHANNEL_ERROR') {
            console.error(`❌ Channel error for room:${roomId}`)
            if (onError) {
              this.notifyErrorCallbacks(roomId, new Error(`Channel error: ${status}`))
            }
          }
        })

      this.channels.set(roomId, channel)
    }

    // Add callback
    if (!this.callbacks.has(roomId)) {
      this.callbacks.set(roomId, new Set())
    }
    this.callbacks.get(roomId)!.add(onMessage)

    if (onError) {
      if (!this.errorCallbacks.has(roomId)) {
        this.errorCallbacks.set(roomId, new Set())
      }
      this.errorCallbacks.get(roomId)!.add(onError)
    }

    // Return unsubscribe function
    return () => {
      console.log(`🔕 Unsubscribing from room:${roomId}`)
      this.unsubscribe(roomId, onMessage)
    }
  }

  /**
   * Unsubscribe a specific callback from a room
   */
  private unsubscribe(roomId: string, callback: MessageCallback): void {
    const callbacks = this.callbacks.get(roomId)
    if (callbacks) {
      callbacks.delete(callback)

      // If no more callbacks, remove the channel
      if (callbacks.size === 0) {
        const channel = this.channels.get(roomId)
        if (channel) {
          console.log(`🗑️ Removing channel for room:${roomId}`)
          const supabase = getSupabaseClient()
          supabase.removeChannel(channel)
          this.channels.delete(roomId)
          this.callbacks.delete(roomId)
          this.errorCallbacks.delete(roomId)
        }
      }
    }
  }

  /**
   * Notify all callbacks for a room
   */
  private notifyCallbacks(roomId: string, message: Message): void {
    const callbacks = this.callbacks.get(roomId)
    if (callbacks) {
      callbacks.forEach((callback) => {
        try {
          callback(message)
        } catch (error) {
          console.error('Error in message callback:', error)
        }
      })
    }
  }

  /**
   * Notify all error callbacks for a room
   */
  private notifyErrorCallbacks(roomId: string, error: Error): void {
    const callbacks = this.errorCallbacks.get(roomId)
    if (callbacks) {
      callbacks.forEach((callback) => {
        try {
          callback(error)
        } catch (err) {
          console.error('Error in error callback:', err)
        }
      })
    }
  }

  /**
   * Unsubscribe from all rooms and cleanup
   */
  unsubscribeAll(): void {
    console.log('🗑️ Unsubscribing from all channels')
    const supabase = getSupabaseClient()
    
    this.channels.forEach((channel, roomId) => {
      console.log(`🗑️ Removing channel for room:${roomId}`)
      supabase.removeChannel(channel)
    })

    this.channels.clear()
    this.callbacks.clear()
    this.errorCallbacks.clear()
  }

  /**
   * Get the number of active subscriptions
   */
  getActiveSubscriptionsCount(): number {
    return this.channels.size
  }
}

// Export singleton instance
export const realtimeManager = new RealtimeManager()

