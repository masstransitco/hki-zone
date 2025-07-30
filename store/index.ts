import { configureStore, combineReducers } from '@reduxjs/toolkit'
import { persistStore, persistReducer, createTransform } from 'redux-persist'
import { FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER } from 'redux-persist'
import authReducer from './authSlice'
import ttsReducer from './ttsSlice'
import audioReducer from './audioSlice'
import languageReducer from './languageSlice'
import { ttsMiddleware, visualizationMiddleware } from './middleware/ttsMiddleware'

// Custom storage implementation with better error handling
const createRobustStorage = () => {
  return {
    getItem: async (key: string): Promise<string | null> => {
      if (typeof window === 'undefined') return null
      
      try {
        const item = localStorage.getItem(key)
        return item
      } catch (error) {
        console.warn(`Failed to get item from localStorage: ${key}`, error)
        return null
      }
    },
    
    setItem: async (key: string, value: string): Promise<void> => {
      if (typeof window === 'undefined') return
      
      try {
        localStorage.setItem(key, value)
      } catch (error) {
        console.warn(`Failed to set item in localStorage: ${key}`, error)
        // Attempt to clear some space and retry
        try {
          localStorage.clear()
          localStorage.setItem(key, value)
        } catch (retryError) {
          console.error(`Failed to set item in localStorage after clearing: ${key}`, retryError)
        }
      }
    },
    
    removeItem: async (key: string): Promise<void> => {
      if (typeof window === 'undefined') return
      
      try {
        localStorage.removeItem(key)
      } catch (error) {
        console.warn(`Failed to remove item from localStorage: ${key}`, error)
      }
    }
  }
}

// Transform to handle sensitive data and optimize storage
const authTransform = createTransform(
  // Transform state on its way to being serialized and persisted
  (inboundState: any) => {
    // Only persist essential auth data
    return {
      user: inboundState.user,
      profile: inboundState.profile,
      sessionValid: inboundState.sessionValid,
      lastActivity: inboundState.lastActivity,
      // Don't persist: session (security), loading states, errors
    }
  },
  // Transform state on its way back from storage
  (outboundState: any) => {
    // Restore state with safe defaults
    return {
      ...outboundState,
      session: null, // Always start with null session for security
      loading: false,
      initializing: true, // Will be set to false after auth initialization
      error: null,
      retryCount: 0,
    }
  },
  { whitelist: ['auth'] } // Only apply to auth slice
)

// Persist configuration
const persistConfig = {
  key: 'panora-auth-v2', // Updated key to avoid conflicts
  storage: createRobustStorage(),
  transforms: [authTransform],
  whitelist: ['auth', 'language'], // Persist auth and language slices
  timeout: 10000, // 10 second timeout for storage operations
  throttle: 1000, // Throttle persistence to avoid excessive writes
}

// Root reducer
const rootReducer = combineReducers({
  auth: authReducer,
  tts: ttsReducer,
  audio: audioReducer,
  language: languageReducer,
})

// Persisted reducer
const persistedReducer = persistReducer(persistConfig, rootReducer)

// Configure store with enhanced middleware
export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore redux-persist actions
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER, 'tts/initialize/fulfilled', 'tts/initialize/pending', 'tts/setCurrentAudioElement'],
        // Ignore all non-serializable values in TTS/audio state 
        ignoredActionsPaths: [
          'payload.session', 
          'payload.user.profile', 
          'payload.audioElement', 
          'payload.services',
          'payload.services.ttsService', 
          'payload.services.speechService', 
          'payload.services.audioService',
          'payload.currentAudioElement'
        ],
        ignoredPaths: [
          'auth.session', 
          'audio.audioElement', 
          'tts.services', 
          'tts.currentAudioElement', 
          'tts.services.ttsService', 
          'tts.services.speechService', 
          'tts.services.audioService'
        ],
      },
      // Enable additional middleware for development
      immutableCheck: process.env.NODE_ENV === 'development',
      actionCreatorCheck: process.env.NODE_ENV === 'development',
    }).concat([
      // Add TTS middleware
      ttsMiddleware,
      visualizationMiddleware,
      // Add custom middleware for auth monitoring
      (store) => (next) => (action: any) => {
        // Log auth and TTS actions in development (excluding high-frequency updates)
        if (process.env.NODE_ENV === 'development') {
          if (action.type?.startsWith('auth/')) {
            console.log('Auth Action:', action.type, action.payload)
          } else if (action.type?.startsWith('tts/') || action.type?.startsWith('audio/')) {
            // Filter out high-frequency visualization updates
            const isHighFrequency = action.type === 'tts/updateAudioData' || 
                                   action.type === 'audio/updateVisualizationData' ||
                                   action.type === 'tts/updateProgress'
            if (!isHighFrequency) {
              console.log('TTS/Audio Action:', action.type, action.payload)
            }
          }
        }
        
        // Handle errors globally
        if (action.type?.endsWith('/rejected')) {
          if (action.type.startsWith('auth/')) {
            console.error('Auth Error:', action.type, action.payload)
          } else if (action.type.startsWith('tts/') || action.type.startsWith('audio/')) {
            console.error('TTS/Audio Error:', action.type, action.payload)
          }
        }
        
        return next(action)
      }
    ]),
  devTools: process.env.NODE_ENV === 'development' && {
    name: 'Panora Redux Store',
    trace: true,
    traceLimit: 25,
  },
})

// Create persistor
export const persistor = persistStore(store)

// Infer types
export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch

// Enhanced store utilities
export const getAuthState = () => store.getState().auth
export const isAuthReady = () => !store.getState().auth?.initializing

// Store health check
export const performStoreHealthCheck = () => {
  try {
    const state = store.getState()
    const isHealthy = {
      storeExists: !!state,
      authSliceExists: !!state.auth,
      hasValidStructure: typeof state.auth?.loading === 'boolean',
      persistenceWorking: typeof window !== 'undefined' && !!localStorage.getItem('persist:panora-auth-v2')
    }
    
    console.log('Store Health Check:', isHealthy)
    return Object.values(isHealthy).every(Boolean)
  } catch (error) {
    console.error('Store health check failed:', error)
    return false
  }
}

// Emergency reset function
export const emergencyResetAuth = () => {
  try {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('persist:panora-auth-v2')
      localStorage.removeItem('panora-auth-token')
    }
    
    // Reset store state
    store.dispatch({ type: 'auth/signOut/fulfilled' })
    
    console.log('Emergency auth reset completed')
  } catch (error) {
    console.error('Emergency reset failed:', error)
  }
}