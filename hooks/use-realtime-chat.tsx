'use client'

import { createClient } from '@/lib/supabase/client'
import { useCallback, useEffect, useState, useMemo } from 'react'
import { useRealtimeChatStore } from '@/stores/useRealtimeChatStore'

interface UseRealtimeChatProps {
  roomName: string
  username: string
}

export interface ChatMessage {
  id: string
  content: string
  user: {
    name: string
  }
  createdAt: string
}

const EVENT_MESSAGE_TYPE = 'message'

export function useRealtimeChat({ roomName, username }: UseRealtimeChatProps) {
  // CRITICAL: Create supabase client only once to prevent infinite loops
  const supabase = useMemo(() => createClient(), [])
  const { messages, addMessage } = useRealtimeChatStore()
  const [channel, setChannel] = useState<ReturnType<typeof supabase.channel> | null>(null)
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    const newChannel = supabase.channel(roomName)

    newChannel
      .on('broadcast', { event: EVENT_MESSAGE_TYPE }, (payload) => {
        addMessage(payload.payload as ChatMessage)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          setIsConnected(true)
        } else {
          setIsConnected(false)
        }
      })

    setChannel(newChannel)

    return () => {
      supabase.removeChannel(newChannel)
    }
    // CRITICAL: Only depend on roomName and username, supabase is stable via useMemo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomName, username])

  const sendMessage = useCallback(
    async (content: string) => {
      if (!channel || !isConnected) return

      const message: ChatMessage = {
        id: crypto.randomUUID(),
        content,
        user: {
          name: username,
        },
        createdAt: new Date().toISOString(),
      }

      // Update local state immediately for the sender
      addMessage(message)

      await channel.send({
        type: 'broadcast',
        event: EVENT_MESSAGE_TYPE,
        payload: message,
      })
    },
    [channel, isConnected, username, addMessage]
  )

  return { messages, sendMessage, isConnected }
}
