import { createSlice, createAsyncThunk, PayloadAction, createSelector } from '@reduxjs/toolkit'
import { Article } from '@/lib/types'
import { TTSService, TTSServiceResponse } from '@/services/ttsService'
import { SpeechService, createSpeechService } from '@/services/speechService'
import { AudioService, createAudioService } from '@/services/audioService'

// TTS Configuration interface
export interface TTSConfig {
  apiKey?: string
  language: string
  voice?: {
    languageCode: string
    name: string
    ssmlGender: string
  }
  audioConfig?: {
    audioEncoding: string
    sampleRateHertz: number
    speakingRate: number
    pitch: number
    volumeGainDb: number
    effectsProfileId: string[]
  }
}

// TTS State interface
export interface TTSState {
  // Playback state
  isPlaying: boolean
  isPaused: boolean
  isLoading: boolean
  
  // Content management
  currentArticle: Article | null
  queue: Article[]
  
  // Progress tracking
  progress: number // 0-1 representing playback progress
  duration: number // Total duration in seconds
  currentTime: number // Current playback time in seconds
  
  // Audio visualization data
  audioData: number[] // Real-time audio visualization data (6 frequency bands)
  
  // Configuration
  language: string
  config: TTSConfig
  
  // Error handling
  error: string | null
  retryCount: number
  
  // System state
  isInitialized: boolean
  lastActivity: number | null
  
  // Service instances (not serialized)
  services?: {
    ttsService: TTSService | null
    speechService: SpeechService | null
    audioService: AudioService | null
  }
  
  // Current audio playback
  currentAudioUrls: string[]
  currentAudioElement: HTMLAudioElement | null
}

// Initial state
const initialState: TTSState = {
  // Playback state
  isPlaying: false,
  isPaused: false,
  isLoading: false,
  
  // Content management
  currentArticle: null,
  queue: [],
  
  // Progress tracking
  progress: 0,
  duration: 0,
  currentTime: 0,
  
  // Audio visualization
  audioData: Array(6).fill(0),
  
  // Configuration
  language: 'en',
  config: {
    language: 'en',
    apiKey: undefined,
  },
  
  // Error handling
  error: null,
  retryCount: 0,
  
  // System state
  isInitialized: false,
  lastActivity: null,
  
  // Service instances
  services: {
    ttsService: null,
    speechService: null,
    audioService: null
  },
  
  // Current audio
  currentAudioUrls: [],
  currentAudioElement: null,
}

// Helper function to create clean text for TTS
const createTTSText = (article: Article): string => {
  let textToSpeak = article.title
  if (article.content) {
    // Remove HTML tags and clean up content
    const cleanContent = article.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
    textToSpeak += '. ' + cleanContent
  } else if (article.summary) {
    const cleanSummary = article.summary.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
    textToSpeak += '. ' + cleanSummary
  }
  return textToSpeak
}

// Async thunk for TTS initialization
export const initializeTTS = createAsyncThunk(
  'tts/initialize',
  async (config: Partial<TTSConfig>, { rejectWithValue }) => {
    try {
      console.log('🎵 TTS Redux - Initializing TTS system...')
      
      // Get API key from environment or config
      const apiKey = config.apiKey || process.env.NEXT_PUBLIC_GOOGLE_TEXT_TO_SPEECH_API_KEY
      const language = config.language || 'en'
      
      const ttsConfig: TTSConfig = {
        apiKey,
        language,
        ...config
      }
      
      // Initialize services
      const ttsService = apiKey ? new TTSService(ttsConfig) : null
      const speechService = createSpeechService({ language })
      const audioService = createAudioService()
      
      console.log('🎵 TTS Redux - Services created:', {
        hasTTSService: !!ttsService,
        hasSpeechService: !!speechService,
        hasAudioService: !!audioService,
        apiKey: apiKey ? 'present' : 'missing'
      })
      
      // Initialize audio service (don't let it block TTS initialization)
      let audioInitialized = false
      try {
        audioInitialized = await Promise.race([
          audioService.initializeAudioContext(),
          new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 2000)) // 2 second timeout
        ])
        console.log('🎵 TTS Redux - Audio service initialized:', audioInitialized)
      } catch (error) {
        console.warn('🎵 TTS Redux - Audio service initialization failed, continuing without it:', error)
        audioInitialized = false
      }
      
      console.log('🎵 TTS Redux - All services initialized successfully')
      return { 
        config: ttsConfig,
        services: {
          ttsService,
          speechService,
          audioService
        },
        audioInitialized
      }
    } catch (error) {
      console.error('🎵 TTS Redux - Initialization failed:', error)
      return rejectWithValue(error instanceof Error ? error.message : 'TTS initialization failed')
    }
  }
)

// Async thunk for playing an article
export const playArticle = createAsyncThunk(
  'tts/playArticle',
  async (article: Article, { getState, rejectWithValue, dispatch }) => {
    try {
      const state = getState() as { tts: TTSState, audio: any }
      const { currentArticle, isPlaying, isPaused, services } = state.tts
      
      console.log('🎵 TTS Redux - Play article requested:', {
        articleId: article.id,
        articleTitle: article.title,
        currentlyPlaying: currentArticle?.id || 'none',
        isCurrentlyPlaying: isPlaying,
        isCurrentlyPaused: isPaused,
        currentTTSLanguage: state.tts.language,
        ttsConfig: state.tts.config
      })
      
      if (!services?.ttsService && !services?.speechService) {
        throw new Error('TTS services not initialized')
      }
      
      // If there's a different article currently playing or paused, stop it first
      if (currentArticle && currentArticle.id !== article.id && (isPlaying || isPaused)) {
        console.log('🎵 TTS Redux - Stopping previous article:', currentArticle.title)
        dispatch(stopPlayback())
        // Small delay to ensure cleanup completes
        await new Promise(resolve => setTimeout(resolve, 100))
      }
      
      // Prepare text for TTS
      const textToSpeak = createTTSText(article)
      console.log('🎵 TTS Redux - Text prepared, length:', textToSpeak.length)
      
      let audioUrls: string[] = []
      let totalDuration = 0
      let playbackMethod: 'google' | 'browser' = 'browser'
      
      try {
        // Try Google TTS first if available
        if (services?.ttsService) {
          console.log('🎵 TTS Redux - Using Google TTS service')
          const response = await services.ttsService.synthesizeSpeech(textToSpeak)
          audioUrls = response.audioUrls
          totalDuration = response.totalDuration
          playbackMethod = 'google'
        } else if (services?.speechService) {
          console.log('🎵 TTS Redux - Using browser speech synthesis')
          playbackMethod = 'browser'
          // Browser API doesn't return URLs, will be handled in playback
        } else {
          throw new Error('No TTS service available')
        }
        
        return {
          article,
          textToSpeak,
          audioUrls,
          totalDuration,
          playbackMethod,
          timestamp: Date.now()
        }
      } catch (ttsError) {
        console.warn('🎵 TTS Redux - Primary TTS failed, trying fallback:', ttsError)
        
        // Fallback to browser speech if Google TTS failed
        if (playbackMethod === 'google' && services?.speechService) {
          console.log('🎵 TTS Redux - Falling back to browser speech')
          return {
            article,
            textToSpeak,
            audioUrls: [],
            totalDuration: 0,
            playbackMethod: 'browser' as const,
            timestamp: Date.now()
          }
        }
        
        throw ttsError
      }
    } catch (error) {
      console.error('🎵 TTS Redux - Play article failed:', error)
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to play article')
    }
  }
)

// Async thunk for pausing playback
export const pausePlayback = createAsyncThunk(
  'tts/pause',
  async (_, { getState, rejectWithValue }) => {
    try {
      const state = getState() as { tts: TTSState }
      const { isPlaying, services, currentAudioElement } = state.tts
      
      if (!isPlaying) {
        console.warn('🎵 TTS Redux - Cannot pause: not currently playing')
        return rejectWithValue('Not currently playing')
      }
      
      console.log('🎵 TTS Redux - Pausing playback')
      
      let paused = false
      
      // Try to pause audio element first
      if (currentAudioElement && !currentAudioElement.paused) {
        currentAudioElement.pause()
        paused = true
        console.log('🎵 TTS Redux - Paused audio element')
      }
      // Fallback to speech service
      else if (services?.speechService) {
        paused = services.speechService.pause()
        console.log('🎵 TTS Redux - Paused speech synthesis:', paused)
      }
      
      if (!paused) {
        throw new Error('Unable to pause playback')
      }
      
      return { timestamp: Date.now() }
    } catch (error) {
      console.error('🎵 TTS Redux - Pause failed:', error)
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to pause')
    }
  }
)

// Async thunk for resuming playback
export const resumePlayback = createAsyncThunk(
  'tts/resume',
  async (_, { getState, rejectWithValue }) => {
    try {
      const state = getState() as { tts: TTSState }
      const { isPaused, services, currentAudioElement } = state.tts
      
      if (!isPaused) {
        console.warn('🎵 TTS Redux - Cannot resume: not currently paused')
        return rejectWithValue('Not currently paused')
      }
      
      console.log('🎵 TTS Redux - Resuming playback')
      
      let resumed = false
      
      // Try to resume audio element first
      if (currentAudioElement && currentAudioElement.paused) {
        try {
          await currentAudioElement.play()
          resumed = true
          console.log('🎵 TTS Redux - Resumed audio element')
        } catch (playError) {
          console.error('🎵 TTS Redux - Failed to resume audio element:', playError)
        }
      }
      // Fallback to speech service
      else if (services?.speechService) {
        resumed = services.speechService.resume()
        console.log('🎵 TTS Redux - Resumed speech synthesis:', resumed)
      }
      
      if (!resumed) {
        throw new Error('Unable to resume playback')
      }
      
      return { timestamp: Date.now() }
    } catch (error) {
      console.error('🎵 TTS Redux - Resume failed:', error)
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to resume')
    }
  }
)

// Async thunk for stopping playback
export const stopPlayback = createAsyncThunk(
  'tts/stop',
  async (_, { getState, rejectWithValue }) => {
    try {
      console.log('🎵 TTS Redux - Stopping playback and cleaning up resources')
      
      const state = getState() as { tts: TTSState }
      const { services, currentAudioElement, currentAudioUrls } = state.tts
      
      // Stop audio element
      if (currentAudioElement) {
        try {
          currentAudioElement.pause()
          currentAudioElement.currentTime = 0
          // Remove event listeners to prevent memory leaks
          currentAudioElement.onloadeddata = null
          currentAudioElement.ontimeupdate = null
          currentAudioElement.onended = null
          currentAudioElement.onerror = null
          console.log('🎵 TTS Redux - Stopped and cleaned up audio element')
        } catch (audioError) {
          console.warn('🎵 TTS Redux - Error stopping audio element:', audioError)
        }
      }
      
      // Stop speech synthesis
      if (services?.speechService) {
        try {
          services.speechService.stop()
          console.log('🎵 TTS Redux - Stopped speech synthesis')
        } catch (speechError) {
          console.warn('🎵 TTS Redux - Error stopping speech synthesis:', speechError)
        }
      }
      
      // Stop audio visualization
      if (services?.audioService) {
        try {
          services.audioService.stopVisualizationLoop()
          console.log('🎵 TTS Redux - Stopped audio visualization')
        } catch (audioServiceError) {
          console.warn('🎵 TTS Redux - Error stopping audio service:', audioServiceError)
        }
      }
      
      // Clean up audio URLs
      if (currentAudioUrls.length > 0) {
        currentAudioUrls.forEach(url => {
          try {
            URL.revokeObjectURL(url)
          } catch (urlError) {
            console.warn('🎵 TTS Redux - Error revoking URL:', url, urlError)
          }
        })
        console.log('🎵 TTS Redux - Cleaned up audio URLs')
      }
      
      return { timestamp: Date.now() }
    } catch (error) {
      console.error('🎵 TTS Redux - Stop failed:', error)
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to stop')
    }
  }
)

// TTS slice
const ttsSlice = createSlice({
  name: 'tts',
  initialState,
  reducers: {
    // Update progress information
    updateProgress: (state, action: PayloadAction<{ 
      progress: number
      currentTime: number
      duration?: number 
    }>) => {
      state.progress = action.payload.progress
      state.currentTime = action.payload.currentTime
      if (action.payload.duration !== undefined) {
        state.duration = action.payload.duration
      }
      state.lastActivity = Date.now()
    },
    
    // Update audio visualization data
    updateAudioData: (state, action: PayloadAction<number[]>) => {
      state.audioData = action.payload
    },
    
    // Clear error state
    clearError: (state) => {
      state.error = null
      state.retryCount = 0
    },
    
    // Update configuration
    updateConfig: (state, action: PayloadAction<Partial<TTSConfig>>) => {
      state.config = { ...state.config, ...action.payload }
      if (action.payload.language) {
        state.language = action.payload.language
      }
    },
    
    // Set loading state manually (for external operations)
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload
    },
    
    // Set playing state manually (for external operations)
    setPlaying: (state, action: PayloadAction<boolean>) => {
      state.isPlaying = action.payload
      if (action.payload) {
        state.lastActivity = Date.now()
      }
    },
    
    // Add article to queue
    addToQueue: (state, action: PayloadAction<Article>) => {
      const exists = state.queue.find(article => article.id === action.payload.id)
      if (!exists) {
        state.queue.push(action.payload)
      }
    },
    
    // Remove article from queue
    removeFromQueue: (state, action: PayloadAction<string>) => {
      state.queue = state.queue.filter(article => article.id !== action.payload)
    },
    
    // Clear queue
    clearQueue: (state) => {
      state.queue = []
    },
    
    // Reset retry count
    resetRetryCount: (state) => {
      state.retryCount = 0
    },
    
    // Set current audio element
    setCurrentAudioElement: (state, action: PayloadAction<HTMLAudioElement | null>) => {
      state.currentAudioElement = action.payload
    },
    
    // Set current audio URLs
    setCurrentAudioUrls: (state, action: PayloadAction<string[]>) => {
      state.currentAudioUrls = action.payload
    },
    
    // Update services
    updateServices: (state, action: PayloadAction<Partial<TTSState['services']>>) => {
      if (state.services) {
        state.services = { ...state.services, ...action.payload }
      }
    }
  },
  extraReducers: (builder) => {
    // Initialize TTS
    builder
      .addCase(initializeTTS.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(initializeTTS.fulfilled, (state, action) => {
        state.isLoading = false
        state.isInitialized = true
        state.config = action.payload.config
        state.language = action.payload.config.language
        state.services = action.payload.services
        state.retryCount = 0
      })
      .addCase(initializeTTS.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload as string
        state.retryCount += 1
      })

    // Play article
    builder
      .addCase(playArticle.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(playArticle.fulfilled, (state, action) => {
        state.isLoading = false
        state.currentArticle = action.payload.article
        state.currentAudioUrls = action.payload.audioUrls
        state.progress = 0
        state.currentTime = 0
        state.duration = action.payload.totalDuration
        state.lastActivity = action.payload.timestamp
        state.retryCount = 0
        // Note: isPlaying will be set when actual playback starts
      })
      .addCase(playArticle.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload as string
        state.retryCount += 1
      })

    // Pause playback
    builder
      .addCase(pausePlayback.pending, (state) => {
        // Don't set loading for pause/resume operations
      })
      .addCase(pausePlayback.fulfilled, (state, action) => {
        state.isPlaying = false
        state.isPaused = true
        state.lastActivity = action.payload.timestamp
      })
      .addCase(pausePlayback.rejected, (state, action) => {
        state.error = action.payload as string
      })

    // Resume playback
    builder
      .addCase(resumePlayback.pending, (state) => {
        // Don't set loading for pause/resume operations
      })
      .addCase(resumePlayback.fulfilled, (state, action) => {
        state.isPlaying = true
        state.isPaused = false
        state.lastActivity = action.payload.timestamp
      })
      .addCase(resumePlayback.rejected, (state, action) => {
        state.error = action.payload as string
      })

    // Stop playback
    builder
      .addCase(stopPlayback.pending, (state) => {
        // Don't set loading for stop operation
      })
      .addCase(stopPlayback.fulfilled, (state) => {
        // Reset all playback state
        state.isPlaying = false
        state.isPaused = false
        state.isLoading = false
        state.currentArticle = null
        state.currentAudioElement = null
        state.currentAudioUrls = []
        state.progress = 0
        state.currentTime = 0
        state.duration = 0
        state.audioData = Array(6).fill(0)
        state.error = null
        state.lastActivity = null
      })
      .addCase(stopPlayback.rejected, (state, action) => {
        state.error = action.payload as string
        // Still try to reset state even if stop failed
        state.isPlaying = false
        state.isPaused = false
        state.isLoading = false
      })
  },
})

// Export actions
export const {
  updateProgress,
  updateAudioData,
  clearError,
  updateConfig,
  setLoading,
  setPlaying,
  addToQueue,
  removeFromQueue,
  clearQueue,
  resetRetryCount,
  setCurrentAudioElement,
  setCurrentAudioUrls,
  updateServices
} = ttsSlice.actions

// Selectors
export const selectTTS = (state: { tts: TTSState }) => state.tts
export const selectTTSCurrentArticle = (state: { tts: TTSState }) => state.tts.currentArticle
export const selectTTSPlaybackState = createSelector(
  [(state: { tts: TTSState }) => state.tts],
  (tts) => ({
    isPlaying: tts.isPlaying,
    isPaused: tts.isPaused,
    isLoading: tts.isLoading
  })
)
export const selectTTSProgress = createSelector(
  [(state: { tts: TTSState }) => state.tts],
  (tts) => ({
    progress: tts.progress,
    duration: tts.duration,
    currentTime: tts.currentTime
  })
)
export const selectTTSAudioData = (state: { tts: TTSState }) => state.tts.audioData
export const selectTTSConfig = (state: { tts: TTSState }) => state.tts.config
export const selectTTSError = (state: { tts: TTSState }) => state.tts.error
export const selectTTSQueue = (state: { tts: TTSState }) => state.tts.queue
export const selectTTSIsInitialized = (state: { tts: TTSState }) => state.tts.isInitialized

// Complex selectors
export const selectTTSIsVisible = (state: { tts: TTSState }) => {
  const { currentArticle, isPlaying, isLoading, isPaused } = state.tts
  return Boolean(currentArticle && (isPlaying || isLoading || isPaused))
}

export const selectTTSCanPlay = (state: { tts: TTSState }) => {
  const { isInitialized, isLoading, services } = state.tts
  // Can play if initialized, not loading, and at least one service is available
  const hasServices = services?.ttsService || services?.speechService
  return isInitialized && !isLoading && hasServices
}

export default ttsSlice.reducer