'use client'

import { useEffect, useRef } from 'react'
import { useChatStore } from '@/src/stores/useChatStore'
import { useWidgetStore } from '@/src/stores/useWidgetStore'
import { ChatService } from '@/src/services/chatService'
import { WidgetService } from '@/src/services/widgetService'

/**
 * Hook to initialize chat widget
 * CRITICAL: This hook manages initialization only, no state updates from here
 */
export function useChatWidgetInit(publicKey?: string) {
  const { roomId, visitorId } = useChatStore()
  const { config, isLoading: widgetLoading } = useWidgetStore()
  const initializedRef = useRef(false)
  const unsubscribeRef = useRef<(() => void) | null>(null)

  // Load widget config
  useEffect(() => {
    if (publicKey && !config && !widgetLoading && !initializedRef.current) {
      console.log('📡 Initializing widget with publicKey:', publicKey)
      WidgetService.loadConfig(publicKey)
    }
  }, [publicKey, config, widgetLoading])

  // Initialize chat once widget config is loaded
  useEffect(() => {
    if (
      config &&
      !roomId &&
      !initializedRef.current &&
      typeof window !== 'undefined'
    ) {
      console.log('🚀 Initializing chat...')
      initializedRef.current = true

      // Initialize chat (visitor + room + messages + subscription)
      ChatService.initialize({
        supabaseUrl: config.supabaseUrl || undefined,
        supabaseKey: config.supabaseKey || undefined,
      })
        .then(() => {
          console.log('✅ Chat initialized successfully')
        })
        .catch((error) => {
          console.error('❌ Chat initialization error:', error)
          initializedRef.current = false
        })
    }
  }, [config, roomId])

  // Subscribe to realtime updates when room is available
  useEffect(() => {
    if (roomId && !unsubscribeRef.current) {
      console.log('🔔 Setting up realtime subscription for room:', roomId)
      unsubscribeRef.current = ChatService.subscribeToMessages(roomId)
    }

    // Cleanup subscription
    return () => {
      if (unsubscribeRef.current) {
        console.log('🧹 Cleaning up realtime subscription')
        unsubscribeRef.current()
        unsubscribeRef.current = null
      }
    }
  }, [roomId])

  // Global cleanup on unmount
  useEffect(() => {
    return () => {
      console.log('🧹 Global cleanup')
      if (unsubscribeRef.current) {
        unsubscribeRef.current()
      }
      ChatService.cleanup()
      initializedRef.current = false
    }
  }, [])

  return {
    isReady: !!config && !!roomId,
    isLoading: widgetLoading || !roomId,
  }
}

