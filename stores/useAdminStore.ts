import { create } from 'zustand'
import type { Message } from '@/lib/chat/types'

type AdminState = {
  messages: Message[]
  setMessages: (msgs: Message[]) => void
  addMessage: (msg: Message) => void
  clearMessages: () => void
}

export const useAdminStore = create<AdminState>((set) => ({
  messages: [],
  setMessages: (msgs) => set({ messages: msgs }),
  addMessage: (msg) => set((state) => ({ messages: [...state.messages, msg] })),
  clearMessages: () => set({ messages: [] }),
}))


