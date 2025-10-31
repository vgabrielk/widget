'use client'

import { useRef, useEffect } from 'react'
import { useChatStore } from '@/src/stores/useChatStore'
import { MessageCircle } from 'lucide-react'

interface MessageListProps {
  brandColor?: string
  welcomeMessage?: string
}

export function MessageList({ brandColor = '#6366f1', welcomeMessage }: MessageListProps) {
  const { messages } = useChatStore()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages.length])

  const showWelcome = messages.length === 0 && welcomeMessage

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {/* Welcome Message */}
      {showWelcome && (
        <div className="flex gap-3">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: `${brandColor}20` }}
          >
            <MessageCircle className="w-4 h-4" style={{ color: brandColor }} />
          </div>
          <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl rounded-tl-none p-3 max-w-[80%]">
            <p className="text-sm text-gray-900 dark:text-gray-100">{welcomeMessage}</p>
            <span className="text-xs text-gray-500 dark:text-gray-400 mt-1 block">Agora</span>
          </div>
        </div>
      )}

      {/* Messages */}
      {messages.map((message) => {
        const isVisitor = message.sender_type === 'visitor'
        return (
          <div key={message.id} className={`flex gap-3 ${isVisitor ? 'flex-row-reverse' : ''}`}>
            {!isVisitor && (
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: `${brandColor}20` }}
              >
                <MessageCircle className="w-4 h-4" style={{ color: brandColor }} />
              </div>
            )}
            <div
              className={`rounded-2xl p-3 max-w-[80%] ${
                isVisitor
                  ? 'rounded-tr-none text-white'
                  : 'rounded-tl-none bg-gray-100 dark:bg-gray-800'
              }`}
              style={isVisitor ? { backgroundColor: brandColor } : {}}
            >
              <p
                className={`text-sm ${
                  isVisitor ? 'text-white' : 'text-gray-900 dark:text-gray-100'
                }`}
              >
                {message.content}
              </p>
              <span
                className={`text-xs mt-1 block ${
                  isVisitor ? 'text-white/70' : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                {new Date(message.created_at).toLocaleTimeString('pt-BR', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
          </div>
        )
      })}
      <div ref={messagesEndRef} />
    </div>
  )
}


