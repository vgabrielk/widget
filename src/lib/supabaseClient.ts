import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Singleton Supabase client instance
 * CRITICAL: This ensures only ONE client is created and reused across the entire app
 */
let supabaseClientInstance: SupabaseClient | null = null

interface SupabaseCredentials {
  url?: string
  key?: string
}

/**
 * Get or create Supabase client
 * Can be initialized with credentials from widget config or uses env vars
 */
export function getSupabaseClient(credentials?: SupabaseCredentials): SupabaseClient {
  // If credentials provided, recreate client (for widget-specific configs)
  if (credentials?.url && credentials?.key) {
    if (supabaseClientInstance) {
      console.log('🔄 Recreating Supabase client with new credentials')
    }
    supabaseClientInstance = createBrowserClient(credentials.url, credentials.key)
    console.log('✅ Supabase client created with widget config')
    return supabaseClientInstance
  }

  // Otherwise use singleton with env vars
  if (!supabaseClientInstance) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase environment variables')
    }

    supabaseClientInstance = createBrowserClient(supabaseUrl, supabaseKey)
    console.log('✅ Supabase client created (singleton)')
  }

  return supabaseClientInstance
}

