'use client'

import { useState, useEffect } from 'react'
import { useChatStore } from '@/src/stores/useChatStore'
import { useWidgetStore } from '@/src/stores/useWidgetStore'
import { ChatService } from '@/src/services/chatService'
import { MessageList } from './MessageList'
import { MessageInput } from './MessageInput'
import { WidgetLoader } from '@/src/components/loading/WidgetLoader'
import { Send, X, MessageCircle, Minus } from 'lucide-react'
import { useChatWidgetInit } from '@/src/hooks/useChatWidgetInit'

interface ChatWidgetProps {
  publicKey?: string
  position?: 'bottom-right' | 'bottom-left'
  brandColor?: string
  welcomeMessage?: string
}

export function ChatWidget({
  publicKey,
  position,
  brandColor,
  welcomeMessage,
}: ChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)

  // Initialize widget and chat
  useChatWidgetInit(publicKey)

  // Get state from stores
  const { messages, isLoading, unreadCount, roomId, visitorId } = useChatStore()
  const { config: widgetConfig, isLoading: widgetLoading } = useWidgetStore()

  // Use props if provided, otherwise fall back to widget config
  const finalBrandColor = brandColor || widgetConfig?.brandColor || '#6366f1'
  const finalPosition = position || widgetConfig?.position || 'bottom-right'
  const finalWelcomeMessage =
    welcomeMessage || widgetConfig?.welcomeMessage || 'Olá! Como posso ajudar você hoje?'

  const isReady = !!roomId && !!visitorId && !widgetLoading
  const showLoader = isLoading || widgetLoading || !isReady

  // Mark messages as read when opening chat
  useEffect(() => {
    if (isOpen && roomId && unreadCount > 0) {
      ChatService.markAsRead(roomId)
    }
  }, [isOpen, roomId, unreadCount])

  const handleSend = async (content: string) => {
    if (!roomId || !visitorId) {
      console.error('Cannot send message: room or visitor not initialized')
      return
    }

    try {
      await ChatService.sendMessage(roomId, visitorId, content)
    } catch (error) {
      console.error('Failed to send message:', error)
      throw error
    }
  }

  const toggleOpen = () => {
    setIsOpen(!isOpen)
    setIsMinimized(false)
  }

  const positionClasses =
    finalPosition === 'bottom-right' ? 'right-6 bottom-6' : 'left-6 bottom-6'

  return (
    <>
      {/* Chat Window */}
      {isOpen && (
        <div
          className={`fixed ${positionClasses} z-50 flex flex-col bg-white dark:bg-gray-900 rounded-2xl shadow-2xl transition-all duration-300 ${
            isMinimized ? 'h-16' : 'h-[600px]'
          } w-[400px] max-w-[calc(100vw-3rem)]`}
          style={{ borderTop: `4px solid ${finalBrandColor}` }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between p-4 border-b dark:border-gray-800"
            style={{ backgroundColor: finalBrandColor }}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                <MessageCircle className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-white">
                  {widgetConfig?.companyName || 'Chat de Suporte'}
                </h3>
                <p className="text-xs text-white/80">Estamos online!</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setIsMinimized(!isMinimized)}
                className="text-white/80 hover:text-white transition-colors p-1"
              >
                <Minus className="w-5 h-5" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="text-white/80 hover:text-white transition-colors p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Messages Area */}
          {!isMinimized && (
            <>
              {showLoader ? (
                <WidgetLoader />
              ) : (
                <MessageList brandColor={finalBrandColor} welcomeMessage={finalWelcomeMessage} />
              )}

              {/* Input Area */}
              {!showLoader && (
                <MessageInput
                  onSend={handleSend}
                  disabled={!isReady}
                  brandColor={finalBrandColor}
                />
              )}
            </>
          )}
        </div>
      )}

      {/* Floating Button */}
      {!isOpen && (
        <button
          onClick={toggleOpen}
          style={{ backgroundColor: finalBrandColor }}
          className={`fixed ${positionClasses} z-50 rounded-full p-4 text-white shadow-2xl hover:scale-110 transition-all duration-300 group`}
        >
          <MessageCircle className="w-6 h-6" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center animate-pulse">
              {unreadCount}
            </span>
          )}
        </button>
      )}
    </>
  )
}

