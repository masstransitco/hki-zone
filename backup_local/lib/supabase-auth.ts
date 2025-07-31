import { createClient } from "@supabase/supabase-js"

// Simplified storage adapter that doesn't interfere with Supabase
const customStorage = {
  getItem: (key: string) => {
    if (typeof window === 'undefined') return null
    try {
      const item = localStorage.getItem(key)
      console.log('📥 Storage getItem:', key, item ? 'FOUND' : 'NOT_FOUND')
      return item
    } catch (error) {
      console.warn('❌ Storage getItem failed:', key, error)
      return null
    }
  },
  setItem: (key: string, value: string) => {
    if (typeof window === 'undefined') return
    try {
      localStorage.setItem(key, value)
      console.log('📤 Storage setItem:', key, 'SUCCESS')
    } catch (error) {
      console.warn('❌ Storage setItem failed:', key, error)
    }
  },
  removeItem: (key: string) => {
    if (typeof window === 'undefined') return
    try {
      localStorage.removeItem(key)
      console.log('🗑️ Storage removeItem:', key, 'SUCCESS')
    } catch (error) {
      console.warn('❌ Storage removeItem failed:', key, error)
    }
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable')
}

if (!supabaseAnonKey) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable')
}

// Create client for authentication with minimal config
export const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    // Use default storage and minimal config
  },
  db: {
    schema: 'public'
  }
})

// Database types for user profiles
export interface UserProfile {
  id: string
  username: string
  email: string
  avatar_url?: string
  created_at: string
  updated_at: string
}

export interface AuthUser {
  id: string
  email: string
  profile?: UserProfile
}