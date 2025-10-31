import { create } from 'zustand'

type WidgetConfig = {
  id: string | null
  name: string | null
  brandColor: string
  position: 'bottom-right' | 'bottom-left'
  welcomeMessage: string
  companyName: string | null
  publicKey: string | null
  supabaseUrl: string | null
  supabaseKey: string | null
}

type WidgetStore = {
  config: WidgetConfig | null
  isLoading: boolean
  error: Error | null

  // Actions
  setConfig: (config: WidgetConfig) => void
  setIsLoading: (isLoading: boolean) => void
  setError: (error: Error | null) => void
  reset: () => void
}

const defaultConfig: WidgetConfig = {
  id: null,
  name: null,
  brandColor: '#6366f1',
  position: 'bottom-right',
  welcomeMessage: 'Olá! Como posso ajudar você hoje?',
  companyName: null,
  publicKey: null,
  supabaseUrl: null,
  supabaseKey: null,
}

/**
 * Global widget store using Zustand
 * Manages widget configuration (colors, position, messages, etc.)
 */
export const useWidgetStore = create<WidgetStore>((set) => ({
  config: null,
  isLoading: true,
  error: null,

  setConfig: (config) => {
    console.log('⚙️ Setting widget config:', config)
    set({ config, error: null })
  },

  setIsLoading: (isLoading) => {
    set({ isLoading })
  },

  setError: (error) => {
    set({ error })
    if (error) {
      console.error('❌ Widget store error:', error)
    }
  },

  reset: () => {
    console.log('🔄 Resetting widget store')
    set({
      config: null,
      isLoading: true,
      error: null,
    })
  },
}))


