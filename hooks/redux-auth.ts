import { useSelector, useDispatch } from 'react-redux'
import { useCallback, useEffect } from 'react'
import type { RootState, AppDispatch } from '@/store'
import {
  initializeAuth,
  signUp,
  signIn,
  signOut,
  checkUsernameAvailable,
  resetPassword,
  clearError,
  updateSession,
  updateProfile,
  selectAuth,
  selectUser,
  selectSession,
  selectProfile,
  selectLoading,
  selectInitializing,
  selectError,
  selectSessionValid,
  selectAuthReady
} from '@/store/authSlice'
import { supabaseAuth } from '@/lib/supabase-auth'

// Typed hooks
export const useAppDispatch = () => useDispatch<AppDispatch>()
export const useAppSelector = <T>(selector: (state: RootState) => T) => useSelector(selector)

// Global auth listener management to prevent multiple listeners
let globalAuthListener: any = null
let globalAuthInitialized = false

// Cleanup function for auth listener
export const cleanupAuthListener = () => {
  if (globalAuthListener) {
    globalAuthListener.unsubscribe()
    globalAuthListener = null
  }
  globalAuthInitialized = false
}

// Auth-specific hooks
export const useAuth = () => {
  const dispatch = useAppDispatch()
  const auth = useAppSelector(selectAuth)
  
  // Initialize auth on first use with guard (only once globally)
  useEffect(() => {
    if (!globalAuthInitialized && auth.initializing && !auth.loading) {
      console.log('🚀 Starting auth initialization...')
      globalAuthInitialized = true
      dispatch(initializeAuth())
    }
  }, [dispatch, auth.initializing, auth.loading])

  // Set up auth state change listener (only once globally)
  useEffect(() => {
    if (globalAuthListener) {
      return // Listener already exists
    }

    let isProcessing = false
    let lastEvent = ''
    let lastTimestamp = 0
    
    const { data: { subscription } } = supabaseAuth.auth.onAuthStateChange(
      async (event, session) => {
        const currentTimestamp = Date.now()
        const currentUserId = session?.user?.id || 'no-user'
        const eventKey = `${event}-${currentUserId}`
        
        // Skip if we're already processing or duplicate event within 100ms
        if (isProcessing || (lastEvent === eventKey && currentTimestamp - lastTimestamp < 100)) {
          return
        }
        
        // Skip excessive INITIAL_SESSION events after sign out
        if (event === 'INITIAL_SESSION' && !session?.user && lastEvent.includes('INITIAL_SESSION')) {
          return
        }
        
        isProcessing = true
        lastEvent = eventKey
        lastTimestamp = currentTimestamp
        
        // Only log meaningful auth events
        if (session?.user || event === 'SIGNED_OUT') {
          console.log('Auth state changed:', {
            event,
            userId: session?.user?.id,
            email: session?.user?.email,
            hasSession: !!session,
            timestamp: new Date().toISOString()
          })
        }
        
        // Update session in Redux
        dispatch(updateSession({ 
          session, 
          user: session?.user 
        }))
        
        // Create a basic profile if user exists but profile is missing
        if (session?.user) {
          const currentAuth = auth || {}
          if (!currentAuth.profile) {
            console.log('👤 Creating basic profile for user (skipping database)')
            const basicProfile = {
              id: session.user.id,
              username: session.user.email?.split('@')[0] || `user_${session.user.id.slice(0, 8)}`,
              email: session.user.email || '',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }
            dispatch(updateProfile(basicProfile))
          }
        } else if (event === 'SIGNED_OUT') {
          // Only clear profile on explicit sign out, not on initial session checks
          console.log('🚪 Clearing user profile - explicit sign out')
          dispatch(updateProfile(null))
        }
        
        // Reset processing flag
        setTimeout(() => {
          isProcessing = false
        }, 50)
      }
    )

    globalAuthListener = subscription
    
    // Cleanup function
    return () => {
      if (globalAuthListener === subscription) {
        globalAuthListener.unsubscribe()
        globalAuthListener = null
      }
    }
  }, [dispatch]) // Only depend on dispatch

  // Action creators with error handling
  const handleSignUp = useCallback(async (email: string, password: string, username: string) => {
    try {
      const result = await dispatch(signUp({ email, password, username }))
      return { error: result.type.includes('rejected') ? new Error(result.payload as string) : null }
    } catch (error) {
      return { error: error as Error }
    }
  }, [dispatch])

  const handleSignIn = useCallback(async (email: string, password: string) => {
    try {
      const result = await dispatch(signIn({ email, password }))
      return { error: result.type.includes('rejected') ? new Error(result.payload as string) : null }
    } catch (error) {
      return { error: error as Error }
    }
  }, [dispatch])

  const handleSignOut = useCallback(async () => {
    try {
      const result = await dispatch(signOut())
      if (result.type.includes('rejected')) {
        const errorMessage = result.payload as string
        // Don't treat session missing as an error for the user
        if (errorMessage.includes('Auth session missing') || errorMessage.includes('session_not_found')) {
          console.log('Sign out completed - session was already cleared')
          return { error: null }
        }
        return { error: new Error(errorMessage) }
      }
      return { error: null }
    } catch (error) {
      return { error: error as Error }
    }
  }, [dispatch])

  const handleResetPassword = useCallback(async (email: string) => {
    try {
      const result = await dispatch(resetPassword(email))
      return { error: result.type.includes('rejected') ? new Error(result.payload as string) : null }
    } catch (error) {
      return { error: error as Error }
    }
  }, [dispatch])

  const handleCheckUsername = useCallback(async (username: string) => {
    try {
      const result = await dispatch(checkUsernameAvailable(username))
      return result.type.includes('fulfilled') ? (result.payload as boolean) : false
    } catch (error) {
      console.error('Error checking username:', error)
      return false
    }
  }, [dispatch])

  const handleClearError = useCallback(() => {
    dispatch(clearError())
  }, [dispatch])

  return {
    // State
    user: auth.user,
    session: auth.session,
    profile: auth.profile,
    loading: auth.loading,
    initializing: auth.initializing,
    error: auth.error,
    sessionValid: auth.sessionValid,
    isReady: !auth.initializing,
    
    // Actions
    signUp: handleSignUp,
    signIn: handleSignIn,
    signOut: handleSignOut,
    resetPassword: handleResetPassword,
    checkUsernameAvailable: handleCheckUsername,
    clearError: handleClearError,
  }
}

// Selector hooks for specific parts of auth state
export const useAuthUser = () => useAppSelector(selectUser)
export const useAuthSession = () => useAppSelector(selectSession)
export const useAuthProfile = () => useAppSelector(selectProfile)
export const useAuthLoading = () => useAppSelector(selectLoading)
export const useAuthInitializing = () => useAppSelector(selectInitializing)
export const useAuthError = () => useAppSelector(selectError)
export const useAuthReady = () => useAppSelector(selectAuthReady)
export const useSessionValid = () => useAppSelector(selectSessionValid)

// Combined selectors for common use cases
export const useIsAuthenticated = () => {
  const user = useAuthUser()
  const sessionValid = useSessionValid()
  return !!user && sessionValid
}

export const useAuthStatus = () => {
  const loading = useAuthLoading()
  const initializing = useAuthInitializing()
  const error = useAuthError()
  const isAuthenticated = useIsAuthenticated()
  
  return {
    loading,
    initializing,
    error,
    isAuthenticated,
    isReady: !initializing,
    hasError: !!error
  }
}

// Utility hook for auth-dependent operations
export const useAuthGuard = () => {
  const isAuthenticated = useIsAuthenticated()
  const isReady = useAuthReady()
  
  const requireAuth = useCallback((callback: () => void) => {
    if (!isReady) {
      console.warn('Auth not ready yet')
      return false
    }
    
    if (!isAuthenticated) {
      console.warn('User not authenticated')
      return false
    }
    
    callback()
    return true
  }, [isAuthenticated, isReady])
  
  return {
    isAuthenticated,
    isReady,
    requireAuth
  }
}