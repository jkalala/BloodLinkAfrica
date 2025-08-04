import { createClient } from "@supabase/supabase-js"
import type { Database } from "../types/supabase"
import { getEnvironmentConfig } from "./env-validation"

// Get validated environment configuration
const { NEXT_PUBLIC_SUPABASE_URL: supabaseUrl, NEXT_PUBLIC_SUPABASE_ANON_KEY: supabaseAnonKey } = getEnvironmentConfig()

// Create a singleton instance for client-side usage
let supabaseInstance: ReturnType<typeof createClient<Database>> | null = null

interface SupabaseOptions {
  auth?: {
    persistSession?: boolean
  }
}

const createSupabaseClient = (options: SupabaseOptions = {}) => {
  return createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
      persistSession: options.auth?.persistSession ?? true
    },
    global: {
      headers: {
        'x-client-info': 'bloodlink-africa',
        'Content-Type': 'application/json'
      }
    },
    db: {
      schema: 'public'
    },
    realtime: {
      params: {
        eventsPerSecond: 10
      }
    }
  })
}

export const getSupabase = () => {
  try {
    if (typeof window === "undefined") {
      // Server-side - create a new instance
      console.log("Creating server-side Supabase client")
      return createSupabaseClient({ 
        auth: { persistSession: false }
      })
    }

    if (!supabaseInstance) {
      console.log("Creating client-side Supabase instance")
      supabaseInstance = createSupabaseClient({
        auth: { persistSession: true }
      })
    }
    return supabaseInstance
  } catch (error) {
    console.error("Error creating Supabase client:", error)
    throw error
  }
}

// For server components
export const createServerSupabaseClient = () => {
  try {
    console.log("Creating server component Supabase client")
    return createSupabaseClient({
      auth: { persistSession: false }
    })
  } catch (error) {
    console.error("Error creating server Supabase client:", error)
    throw error
  }
}

// For server-side API routes with authentication
export const createAuthenticatedServerClient = (accessToken: string) => {
  try {
    console.log("Creating authenticated server Supabase client")
    return createClient<Database>(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false
      },
      global: {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'x-client-info': 'bloodlink-africa',
          'Content-Type': 'application/json'
        }
      },
      db: {
        schema: 'public'
      }
    })
  } catch (error) {
    console.error("Error creating authenticated server Supabase client:", error)
    throw error
  }
}
