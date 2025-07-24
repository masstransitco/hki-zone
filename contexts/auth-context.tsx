"use client"

import React, { createContext, useContext, useEffect, useState } from 'react'
import { User, Session, AuthError } from '@supabase/supabase-js'
import { supabaseAuth, UserProfile, AuthUser } from '@/lib/supabase-auth'

interface AuthContextType {
  user: AuthUser | null
  session: Session | null
  loading: boolean
  signUp: (email: string, password: string, username: string) => Promise<{ error: AuthError | null }>
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>
  signOut: () => Promise<{ error: AuthError | null }>
  resetPassword: (email: string) => Promise<{ error: AuthError | null }>
  checkUsernameAvailable: (username: string) => Promise<boolean>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    let isMounted = true

    const initializeAuth = async () => {
      try {
        // Get initial session
        const { data: { session }, error } = await supabaseAuth.auth.getSession()
        
        if (error) {
          console.error('Error getting session:', error)
        }

        if (isMounted) {
          setSession(session)
          if (session?.user) {
            await fetchUserProfile(session.user)
          } else {
            setUser(null)
          }
          setLoading(false)
          setInitialized(true)
        }
      } catch (error) {
        console.error('Error initializing auth:', error)
        if (isMounted) {
          setLoading(false)
          setInitialized(true)
        }
      }
    }

    initializeAuth()

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabaseAuth.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', {
        event,
        userId: session?.user?.id,
        email: session?.user?.email,
        hasSession: !!session,
        timestamp: new Date().toISOString()
      })
      
      if (isMounted) {
        setSession(session)
        
        if (session?.user) {
          await fetchUserProfile(session.user)
        } else {
          setUser(null)
        }
        
        if (initialized) {
          setLoading(false)
        }
      }
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  const fetchUserProfile = async (authUser: User) => {
    try {
      const { data: profile, error } = await supabaseAuth
        .from('user_profiles')
        .select('*')
        .eq('user_id', authUser.id)
        .single()

      const userData = {
        id: authUser.id,
        email: authUser.email!,
        profile: error ? undefined : profile
      }

      setUser(userData)

      if (error && error.code !== 'PGRST116') {
        // Log errors other than "no rows returned"
        console.error('Error fetching user profile:', error)
      }
    } catch (error) {
      console.error('Error in fetchUserProfile:', error)
      // Still set the user with basic auth info
      setUser({
        id: authUser.id,
        email: authUser.email!,
        profile: undefined
      })
    }
  }

  const signUp = async (email: string, password: string, username: string) => {
    try {
      // First check if username is available
      const isAvailable = await checkUsernameAvailable(username)
      if (!isAvailable) {
        return { error: { message: 'Username is already taken' } as AuthError }
      }

      // Sign up user
      const { data, error } = await supabaseAuth.auth.signUp({
        email,
        password,
      })

      if (error) return { error }

      // Create user profile if signup successful
      if (data.user && data.session) {
        // Wait a moment for the session to be fully established
        await new Promise(resolve => setTimeout(resolve, 100))
        
        const { error: profileError } = await supabaseAuth
          .from('user_profiles')
          .insert([
            {
              user_id: data.user.id,
              username,
              email,
            }
          ])

        if (profileError) {
          console.error('Error creating user profile:', profileError)
          // Don't return error here as the user is created, just the profile failed
        }
      }

      return { error: null }
    } catch (error) {
      console.error('Error in signUp:', error)
      return { error: error as AuthError }
    }
  }

  const signIn = async (email: string, password: string) => {
    const { error } = await supabaseAuth.auth.signInWithPassword({
      email,
      password,
    })
    return { error }
  }

  const signOut = async () => {
    const { error } = await supabaseAuth.auth.signOut()
    return { error }
  }

  const resetPassword = async (email: string) => {
    const { error } = await supabaseAuth.auth.resetPasswordForUser(email)
    return { error }
  }

  const checkUsernameAvailable = async (username: string): Promise<boolean> => {
    try {
      // Remove @ prefix if present
      const cleanUsername = username.startsWith('@') ? username.slice(1) : username
      
      const { data, error } = await supabaseAuth
        .from('user_profiles')
        .select('username')
        .eq('username', cleanUsername)
        .maybeSingle()

      // If error, log it but assume username is available for now
      if (error) {
        console.error('Error checking username availability:', error)
        return true
      }

      // If data exists, username is taken
      return !data
    } catch (error) {
      console.error('Error checking username availability:', error)
      return true // Assume available on error to allow user to proceed
    }
  }

  const value = {
    user,
    session,
    loading,
    signUp,
    signIn,
    signOut,
    resetPassword,
    checkUsernameAvailable,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}