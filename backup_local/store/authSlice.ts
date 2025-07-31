import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import { Session, AuthError, User } from '@supabase/supabase-js'
import { supabaseAuth, UserProfile, AuthUser } from '@/lib/supabase-auth'

// Enhanced auth state interface
interface AuthState {
  user: AuthUser | null
  session: Session | null
  profile: UserProfile | null
  loading: boolean
  initializing: boolean
  error: string | null
  lastActivity: number | null
  retryCount: number
  sessionValid: boolean
}

// Initial state with better error handling
const initialState: AuthState = {
  user: null,
  session: null,
  profile: null,
  loading: false,
  initializing: true,
  error: null,
  lastActivity: null,
  retryCount: 0,
  sessionValid: false
}

// Helper function to add timeout to promises
const withTimeout = <T>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => 
      setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs)
    )
  ])
}

// Simplified auth initialization that doesn't hang
export const initializeAuth = createAsyncThunk(
  'auth/initialize',
  async (_, { rejectWithValue }) => {
    try {
      console.log('🔄 Starting simplified auth initialization...')
      
      // Just return a clean state - let the auth state listener handle the real session
      console.log('✅ Auth initialization complete - relying on auth state listener')
      return {
        session: null,
        user: null,
        profile: null
      }
    } catch (error) {
      console.error('❌ Error initializing auth:', error)
      return rejectWithValue(error instanceof Error ? error.message : 'Unknown error')
    }
  }
)

// Async thunk for user sign up
export const signUp = createAsyncThunk(
  'auth/signUp',
  async ({ email, password, username }: { email: string; password: string; username: string }, { rejectWithValue }) => {
    try {
      // Check username availability first
      const { data: existingUser } = await supabaseAuth
        .from('user_profiles')
        .select('username')
        .eq('username', username.startsWith('@') ? username.slice(1) : username)
        .single()

      if (existingUser) {
        return rejectWithValue('Username is already taken')
      }

      // Sign up user
      const { data, error } = await supabaseAuth.auth.signUp({
        email,
        password,
      })

      if (error) {
        return rejectWithValue(error.message)
      }

      // Create user profile if signup successful
      if (data.user && data.session) {
        const { error: profileError } = await supabaseAuth
          .from('user_profiles')
          .insert([
            {
              user_id: data.user.id,
              username: username.startsWith('@') ? username.slice(1) : username,
              email,
            }
          ])

        if (profileError) {
          console.error('Error creating user profile:', profileError)
        }

        const userData: AuthUser = {
          id: data.user.id,
          email: data.user.email!,
          profile: profileError ? undefined : {
            id: data.user.id,
            username: username.startsWith('@') ? username.slice(1) : username,
            email,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          } as UserProfile
        }

        return {
          session: data.session,
          user: userData,
          profile: userData.profile || null
        }
      }

      return {
        session: null,
        user: null,
        profile: null
      }
    } catch (error) {
      console.error('Error in signUp:', error)
      return rejectWithValue(error instanceof Error ? error.message : 'Unknown error')
    }
  }
)

// Async thunk for user sign in
export const signIn = createAsyncThunk(
  'auth/signIn',
  async ({ email, password }: { email: string; password: string }, { rejectWithValue }) => {
    try {
      const { data, error } = await supabaseAuth.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        return rejectWithValue(error.message)
      }

      if (data.session?.user) {
        // Fetch user profile with timeout
        let profile = null
        let profileError = null
        
        try {
          const profileResult = await withTimeout(
            supabaseAuth
              .from('user_profiles')
              .select('*')
              .eq('user_id', data.session.user.id)
              .single(),
            5000 // 5 second timeout for profile fetch
          )
          
          profile = profileResult.data
          profileError = profileResult.error
        } catch (timeoutError) {
          console.warn('⏰ Profile fetch timed out during sign in')
          profileError = { message: 'Profile fetch timeout' }
        }

        const userData: AuthUser = {
          id: data.session.user.id,
          email: data.session.user.email!,
          profile: profileError ? undefined : profile
        }

        return {
          session: data.session,
          user: userData,
          profile: profileError ? null : profile
        }
      }

      return {
        session: null,
        user: null,
        profile: null
      }
    } catch (error) {
      console.error('Error in signIn:', error)
      return rejectWithValue(error instanceof Error ? error.message : 'Unknown error')
    }
  }
)

// Async thunk for user sign out
export const signOut = createAsyncThunk(
  'auth/signOut',
  async (_, { rejectWithValue, getState }) => {
    try {
      const { error } = await supabaseAuth.auth.signOut()
      if (error) {
        // If session is missing, we should still clear the local state
        if (error.message.includes('Auth session missing') || error.message.includes('session_not_found')) {
          console.warn('Session already missing during sign out, clearing local state anyway')
          // Clear any auth-related localStorage items
          if (typeof window !== 'undefined') {
            try {
              localStorage.removeItem('sb-egyuetfeubznhcvmtary-auth-token')
              localStorage.removeItem('supabase.auth.token')
            } catch (storageError) {
              console.warn('Failed to clear auth tokens from localStorage:', storageError)
            }
          }
          return true
        }
        return rejectWithValue(error.message)
      }
      return true
    } catch (error) {
      console.error('Error in signOut:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      
      // If session is missing, we should still clear the local state
      if (errorMessage.includes('Auth session missing') || errorMessage.includes('session_not_found')) {
        console.warn('Session already missing during sign out, clearing local state anyway')
        // Clear any auth-related localStorage items
        if (typeof window !== 'undefined') {
          try {
            localStorage.removeItem('sb-egyuetfeubznhcvmtary-auth-token')
            localStorage.removeItem('supabase.auth.token')
          } catch (storageError) {
            console.warn('Failed to clear auth tokens from localStorage:', storageError)
          }
        }
        return true
      }
      
      return rejectWithValue(errorMessage)
    }
  }
)

// Async thunk for checking username availability
export const checkUsernameAvailable = createAsyncThunk(
  'auth/checkUsername',
  async (username: string, { rejectWithValue }) => {
    try {
      const cleanUsername = username.startsWith('@') ? username.slice(1) : username
      
      const { data, error } = await supabaseAuth
        .from('user_profiles')
        .select('username')
        .eq('username', cleanUsername)
        .maybeSingle()

      if (error) {
        console.error('Error checking username availability:', error)
        return rejectWithValue(error.message)
      }

      return !data // true if available (no data found)
    } catch (error) {
      console.error('Error checking username availability:', error)
      return rejectWithValue(error instanceof Error ? error.message : 'Unknown error')
    }
  }
)

// Async thunk for resetting password
export const resetPassword = createAsyncThunk(
  'auth/resetPassword',
  async (email: string, { rejectWithValue }) => {
    try {
      const { error } = await supabaseAuth.auth.resetPasswordForUser(email)
      if (error) {
        return rejectWithValue(error.message)
      }
      return true
    } catch (error) {
      console.error('Error in resetPassword:', error)
      return rejectWithValue(error instanceof Error ? error.message : 'Unknown error')
    }
  }
)

// Auth slice with improved state management
const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    // Clear error state
    clearError: (state) => {
      state.error = null
    },
    
    // Update session from auth state change listener
    updateSession: (state, action: PayloadAction<{ session: Session | null; user?: User }>) => {
      const { session, user } = action.payload
      state.session = session
      state.sessionValid = !!session
      state.lastActivity = Date.now()
      
      if (user && session) {
        state.user = {
          id: user.id,
          email: user.email!,
          profile: state.profile
        }
      } else {
        state.user = null
        state.profile = null
      }
    },
    
    // Update user profile
    updateProfile: (state, action: PayloadAction<UserProfile | null>) => {
      state.profile = action.payload
      if (state.user && action.payload) {
        state.user.profile = action.payload
      }
    },
    
    // Reset retry count
    resetRetryCount: (state) => {
      state.retryCount = 0
    },
    
    // Increment retry count
    incrementRetryCount: (state) => {
      state.retryCount += 1
    },
    
    // Set loading state manually (for external operations)
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload
    }
  },
  extraReducers: (builder) => {
    // Initialize auth
    builder
      .addCase(initializeAuth.pending, (state) => {
        state.initializing = true
        state.loading = true
        state.error = null
      })
      .addCase(initializeAuth.fulfilled, (state, action) => {
        state.initializing = false
        state.loading = false
        state.session = action.payload.session
        state.user = action.payload.user
        state.profile = action.payload.profile
        state.sessionValid = !!action.payload.session
        state.lastActivity = Date.now()
        state.retryCount = 0
      })
      .addCase(initializeAuth.rejected, (state, action) => {
        state.initializing = false
        state.loading = false
        state.error = action.payload as string
        state.retryCount += 1
      })

    // Sign up
    builder
      .addCase(signUp.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(signUp.fulfilled, (state, action) => {
        state.loading = false
        state.session = action.payload.session
        state.user = action.payload.user
        state.profile = action.payload.profile
        state.sessionValid = !!action.payload.session
        state.lastActivity = Date.now()
      })
      .addCase(signUp.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload as string
      })

    // Sign in
    builder
      .addCase(signIn.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(signIn.fulfilled, (state, action) => {
        state.loading = false
        state.session = action.payload.session
        state.user = action.payload.user
        state.profile = action.payload.profile
        state.sessionValid = !!action.payload.session
        state.lastActivity = Date.now()
      })
      .addCase(signIn.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload as string
      })

    // Sign out
    builder
      .addCase(signOut.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(signOut.fulfilled, (state) => {
        state.loading = false
        state.session = null
        state.user = null
        state.profile = null
        state.sessionValid = false
        state.lastActivity = null
        state.error = null // Clear any previous errors on successful sign out
      })
      .addCase(signOut.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload as string
      })

    // Username availability check
    builder
      .addCase(checkUsernameAvailable.pending, (state) => {
        // Don't set global loading for username checks
        state.error = null
      })
      .addCase(checkUsernameAvailable.fulfilled, (state) => {
        // Username check completed - no state changes needed
      })
      .addCase(checkUsernameAvailable.rejected, (state, action) => {
        state.error = action.payload as string
      })

    // Password reset
    builder
      .addCase(resetPassword.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(resetPassword.fulfilled, (state) => {
        state.loading = false
      })
      .addCase(resetPassword.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload as string
      })
  },
})

// Export actions
export const {
  clearError,
  updateSession,
  updateProfile,
  resetRetryCount,
  incrementRetryCount,
  setLoading
} = authSlice.actions

// Selectors
export const selectAuth = (state: { auth: AuthState }) => state.auth
export const selectUser = (state: { auth: AuthState }) => state.auth.user
export const selectSession = (state: { auth: AuthState }) => state.auth.session
export const selectProfile = (state: { auth: AuthState }) => state.auth.profile
export const selectLoading = (state: { auth: AuthState }) => state.auth.loading
export const selectInitializing = (state: { auth: AuthState }) => state.auth.initializing
export const selectError = (state: { auth: AuthState }) => state.auth.error
export const selectSessionValid = (state: { auth: AuthState }) => state.auth.sessionValid
export const selectAuthReady = (state: { auth: AuthState }) => !state.auth.initializing

export default authSlice.reducer