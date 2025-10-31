'use client';

import { useState, useRef, useEffect } from 'react';
import { useChatWidget } from '@/lib/chat/useChatWidget';
import { Send, X, MessageCircle, Minus } from 'lucide-react';

interface ChatWidgetProps {
  position?: 'bottom-right' | 'bottom-left';
  brandColor?: string;
  welcomeMessage?: string;
}

export function ChatWidget({
  position = 'bottom-right',
  brandColor = '#6366f1',
  welcomeMessage = 'Olá! Como posso ajudar você hoje?',
}: ChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [showWelcome, setShowWelcome] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const {
    messages,
    isLoading,
    unreadCount,
    sendMessage,
    markAsRead,
  } = useChatWidget();

  // Auto scroll to bottom when new messages arrive
  useEffect(() => {
    if (isOpen && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, isOpen]); // Only depend on length, not full array

  // Mark messages as read when opening chat or when new admin messages arrive
  useEffect(() => {
    if (isOpen) {
      // Update welcome state
      setShowWelcome(messages.length === 0);
      
      // Mark as read if there are unread admin messages
      if (unreadCount > 0) {
        markAsRead();
      }
    }
    // Only depend on isOpen and unreadCount to avoid unnecessary re-runs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, unreadCount]);

  const handleSend = async () => {
    if (!inputValue.trim()) return;
    
    try {
      await sendMessage(inputValue);
      setInputValue('');
      setShowWelcome(false);
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const toggleOpen = () => {
    setIsOpen(!isOpen);
    setIsMinimized(false);
  };

  const positionClasses = position === 'bottom-right' 
    ? 'right-6 bottom-6' 
    : 'left-6 bottom-6';

  return (
    <>
      {/* Chat Window */}
      {isOpen && (
        <div
          className={`fixed ${positionClasses} z-50 flex flex-col bg-white dark:bg-gray-900 rounded-2xl shadow-2xl transition-all duration-300 ${
            isMinimized ? 'h-16' : 'h-[600px]'
          } w-[400px] max-w-[calc(100vw-3rem)]`}
          style={{ borderTop: `4px solid ${brandColor}` }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between p-4 border-b dark:border-gray-800"
            style={{ backgroundColor: brandColor }}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                <MessageCircle className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Chat de Suporte</h3>
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
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {isLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-white"></div>
                  </div>
                ) : (
                  <>
                    {/* Welcome Message */}
                    {showWelcome && (
                      <div className="flex gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: `${brandColor}20` }}
                        >
                          <MessageCircle className="w-4 h-4" style={{ color: brandColor }} />
                        </div>
                        <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl rounded-tl-none p-3 max-w-[80%]">
                          <p className="text-sm text-gray-900 dark:text-gray-100">
                            {welcomeMessage}
                          </p>
                          <span className="text-xs text-gray-500 dark:text-gray-400 mt-1 block">
                            Agora
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Messages */}
                    {messages.map((message) => {
                      const isVisitor = message.sender_type === 'visitor';
                      return (
                        <div
                          key={message.id}
                          className={`flex gap-3 ${isVisitor ? 'flex-row-reverse' : ''}`}
                        >
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
                            <p className={`text-sm ${isVisitor ? 'text-white' : 'text-gray-900 dark:text-gray-100'}`}>
                              {message.content}
                            </p>
                            <span className={`text-xs mt-1 block ${
                              isVisitor ? 'text-white/70' : 'text-gray-500 dark:text-gray-400'
                            }`}>
                              {new Date(message.created_at).toLocaleTimeString('pt-BR', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>

              {/* Input Area */}
              <div className="p-4 border-t dark:border-gray-800">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Digite sua mensagem..."
                    className="flex-1 px-4 py-2 border dark:border-gray-700 rounded-full focus:outline-none focus:ring-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  />
                  <button
                    onClick={handleSend}
                    disabled={!inputValue.trim()}
                    className="p-2 rounded-full text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-105"
                    style={{ backgroundColor: brandColor }}
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-2">
                  Powered by Realtime Chat Widget
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {/* Floating Button */}
      {!isOpen && (
        <button
          onClick={toggleOpen}
          style={{ backgroundColor: brandColor }}
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
  );
}

