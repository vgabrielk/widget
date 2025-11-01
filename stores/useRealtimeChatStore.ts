import { create } from 'zustand'
import type { ChatMessage } from '@/hooks/use-realtime-chat'

type RealtimeChatState = {
  messages: ChatMessage[]
  setMessages: (msgs: ChatMessage[]) => void
  addMessage: (msg: ChatMessage) => void
  clearMessages: () => void
}

export const useRealtimeChatStore = create<RealtimeChatState>((set) => ({
  messages: [],
  setMessages: (msgs) => set({ messages: msgs }),
  addMessage: (msg) => set((state) => ({ messages: [...state.messages, msg] })),
  clearMessages: () => set({ messages: [] }),
}))



