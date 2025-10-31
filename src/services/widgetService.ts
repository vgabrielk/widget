import { useWidgetStore } from '@/src/stores/useWidgetStore'
import type { WidgetConfig } from '@/src/stores/useWidgetStore'

/**
 * Widget Service
 * Handles fetching widget configuration from the API
 */
export class WidgetService {
  /**
   * Load widget configuration by public key
   */
  static async loadConfig(publicKey: string): Promise<void> {
    const { setIsLoading, setConfig, setError } = useWidgetStore.getState()

    setIsLoading(true)
    setError(null)

    try {
      console.log('📡 Loading widget config for:', publicKey)

      // Determine the API URL based on environment
      const apiUrl =
        typeof window !== 'undefined'
          ? `/api/widget/${publicKey}`
          : `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/widget/${publicKey}`

      const response = await fetch(apiUrl)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(
          errorData.error || `Failed to load widget: ${response.statusText}`
        )
      }

      const data = await response.json()
      const { widget, supabase } = data

      if (!widget || !supabase) {
        throw new Error('Invalid widget configuration received')
      }

      const config: WidgetConfig = {
        id: widget.id,
        name: widget.name,
        brandColor: widget.brand_color || '#6366f1',
        position: widget.position || 'bottom-right',
        welcomeMessage: widget.welcome_message || 'Olá! Como posso ajudar você hoje?',
        companyName: widget.company_name,
        publicKey: widget.public_key,
        supabaseUrl: supabase.url,
        supabaseKey: supabase.key,
      }

      setConfig(config)
      setIsLoading(false)

      console.log('✅ Widget config loaded successfully')
    } catch (error) {
      console.error('❌ Error loading widget config:', error)
      setError(error instanceof Error ? error : new Error('Unknown error'))
      setIsLoading(false)
    }
  }
}


