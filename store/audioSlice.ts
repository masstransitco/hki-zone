import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'

// Audio Context States
export type AudioContextState = 'idle' | 'initializing' | 'ready' | 'suspended' | 'error'
export type AnalyserState = 'disconnected' | 'connected' | 'analyzing'

// Device Information
export interface DeviceInfo {
  isMobile: boolean
  isIOS: boolean
  isIOSChrome: boolean
  isIOSSafari: boolean
  isAndroid: boolean
}

// Audio Visualization Configuration
export interface VisualizationConfig {
  enabled: boolean
  fftSize: number
  smoothingTimeConstant: number
  frequencyBands: number
  updateInterval: number
}

// Audio State interface
export interface AudioState {
  // Audio Context state
  contextState: AudioContextState
  analyserState: AnalyserState
  
  // Visualization configuration and data
  visualization: {
    config: VisualizationConfig
    data: number[]
    previousData: number[]
    isAnimating: boolean
  }
  
  // Device capabilities
  device: DeviceInfo
  
  // Audio elements and references
  audioElement: {
    connected: boolean
    duration: number
    currentTime: number
    volume: number
    muted: boolean
  }
  
  // Error handling
  error: string | null
  initializationAttempts: number
  
  // Performance tracking
  lastUpdate: number | null
  frameRate: number
}

// Mobile browser detection utilities
const detectDevice = (): DeviceInfo => {
  if (typeof window === 'undefined') {
    return {
      isMobile: false,
      isIOS: false,
      isIOSChrome: false,
      isIOSSafari: false,
      isAndroid: false
    }
  }
  
  const userAgent = navigator.userAgent
  const isIOS = /iPhone|iPad|iPod/.test(userAgent)
  const isAndroid = /Android/.test(userAgent)
  const isMobile = isIOS || isAndroid || /webOS|BlackBerry|IEMobile|Opera Mini/i.test(userAgent)
  
  return {
    isMobile,
    isIOS,
    isIOSChrome: /CriOS/i.test(userAgent) || 
                  (isIOS && /Chrome/i.test(userAgent)),
    isIOSSafari: isIOS && 
                 /Safari/i.test(userAgent) && 
                 !/Chrome|CriOS|FxiOS|EdgiOS/i.test(userAgent),
    isAndroid
  }
}

// Default visualization configuration
const defaultVisualizationConfig: VisualizationConfig = {
  enabled: true,
  fftSize: 256,
  smoothingTimeConstant: 0.8,
  frequencyBands: 6,
  updateInterval: 16 // ~60fps
}

// Initial state
const initialState: AudioState = {
  // Audio Context state
  contextState: 'idle',
  analyserState: 'disconnected',
  
  // Visualization
  visualization: {
    config: defaultVisualizationConfig,
    data: Array(6).fill(0),
    previousData: Array(6).fill(0),
    isAnimating: false
  },
  
  // Device detection
  device: detectDevice(),
  
  // Audio element state
  audioElement: {
    connected: false,
    duration: 0,
    currentTime: 0,
    volume: 1.0,
    muted: false
  },
  
  // Error handling
  error: null,
  initializationAttempts: 0,
  
  // Performance
  lastUpdate: null,
  frameRate: 60
}

// Async thunk for initializing Audio Context
export const initializeAudioContext = createAsyncThunk(
  'audio/initializeContext',
  async (_, { getState, rejectWithValue }) => {
    try {
      const state = getState() as { audio: AudioState }
      const { device } = state.audio
      
      
      // Check for AudioContext support
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
      if (!AudioContextClass) {
        throw new Error('Web Audio API not supported')
      }
      
      // For mobile browsers, especially iOS, we need to handle suspended contexts
      const contextInitialized = Date.now()
      
      
      return {
        contextInitialized,
        supportsWebAudio: true,
        device
      }
    } catch (error) {
      console.error('AudioContext initialization failed:', error)
      return rejectWithValue(error instanceof Error ? error.message : 'AudioContext initialization failed')
    }
  }
)

// Async thunk for connecting audio analysis
export const connectAudioAnalysis = createAsyncThunk(
  'audio/connectAnalysis',
  async (audioElement: HTMLAudioElement, { getState, rejectWithValue }) => {
    try {
      const state = getState() as { audio: AudioState }
      const { contextState, device } = state.audio
      
      if (contextState !== 'ready') {
        throw new Error('AudioContext not ready')
      }
      
      
      // Basic audio element information
      const audioInfo = {
        duration: audioElement.duration || 0,
        currentTime: audioElement.currentTime || 0,
        volume: audioElement.volume || 1.0,
        muted: audioElement.muted || false,
        readyState: audioElement.readyState,
        paused: audioElement.paused
      }
      
      
      // On mobile browsers, especially iOS Chrome, connection might fail
      // Provide graceful degradation
      if (device.isMobile) {
      }
      
      return {
        audioInfo,
        connected: true,
        timestamp: Date.now()
      }
    } catch (error) {
      console.error('Audio analysis connection failed:', error)
      return rejectWithValue(error instanceof Error ? error.message : 'Audio analysis connection failed')
    }
  }
)

// Async thunk for starting visualization updates
export const startVisualization = createAsyncThunk(
  'audio/startVisualization',
  async (_, { getState, rejectWithValue }) => {
    try {
      const state = getState() as { audio: AudioState }
      const { analyserState, visualization } = state.audio
      
      if (analyserState !== 'connected') {
        // Analyser not connected, will use mock or no visualization
      }
      
      
      return {
        started: true,
        timestamp: Date.now(),
        config: visualization.config
      }
    } catch (error) {
      console.error('Visualization start failed:', error)
      return rejectWithValue(error instanceof Error ? error.message : 'Visualization start failed')
    }
  }
)

// Async thunk for stopping visualization
export const stopVisualization = createAsyncThunk(
  'audio/stopVisualization',
  async (_, { rejectWithValue }) => {
    try {
      
      return {
        stopped: true,
        timestamp: Date.now()
      }
    } catch (error) {
      console.error('Visualization stop failed:', error)
      return rejectWithValue(error instanceof Error ? error.message : 'Visualization stop failed')
    }
  }
)

// Audio slice
const audioSlice = createSlice({
  name: 'audio',
  initialState,
  reducers: {
    // Update visualization data
    updateVisualizationData: (state, action: PayloadAction<number[]>) => {
      state.visualization.previousData = [...state.visualization.data]
      state.visualization.data = action.payload
      state.lastUpdate = Date.now()
    },
    
    // Update audio element state
    updateAudioElement: (state, action: PayloadAction<Partial<AudioState['audioElement']>>) => {
      state.audioElement = { ...state.audioElement, ...action.payload }
    },
    
    // Set context state manually
    setContextState: (state, action: PayloadAction<AudioContextState>) => {
      state.contextState = action.payload
    },
    
    // Set analyser state manually
    setAnalyserState: (state, action: PayloadAction<AnalyserState>) => {
      state.analyserState = action.payload
    },
    
    // Update visualization configuration
    updateVisualizationConfig: (state, action: PayloadAction<Partial<VisualizationConfig>>) => {
      state.visualization.config = { ...state.visualization.config, ...action.payload }
    },
    
    // Clear error state
    clearError: (state) => {
      state.error = null
    },
    
    // Reset initialization attempts
    resetInitializationAttempts: (state) => {
      state.initializationAttempts = 0
    },
    
    // Generate mock visualization data for when analyser is not available
    generateMockVisualization: (state, action: PayloadAction<{ 
      intensity?: number
      type?: 'playing' | 'loading' | 'paused' | 'idle' 
    }>) => {
      const { intensity = 0.5, type = 'idle' } = action.payload
      const { frequencyBands } = state.visualization.config
      
      let newData: number[]
      
      switch (type) {
        case 'playing':
          // Generate dynamic data for playing state
          newData = Array.from({ length: frequencyBands }, (_, i) => {
            const baseEnergy = Math.random() * intensity
            const frequencyBand = i / frequencyBands
            const frequencyWeight = 1 - frequencyBand * 0.6 // Lower frequencies have more energy
            return Math.min(1, baseEnergy * frequencyWeight)
          })
          break
          
        case 'loading':
          // Shimmer effect during loading
          newData = Array.from({ length: frequencyBands }, () => Math.random() * 0.4 + 0.1)
          break
          
        case 'paused':
          // Gentle breathing animation when paused
          const time = Date.now() * 0.001
          newData = Array.from({ length: frequencyBands }, () => 0.05 + Math.sin(time * 0.5) * 0.03)
          break
          
        case 'idle':
        default:
          // Minimal activity for idle state
          newData = Array.from({ length: frequencyBands }, () => 0.02)
          break
      }
      
      state.visualization.data = newData
    },
    
    // Update frame rate tracking
    updateFrameRate: (state, action: PayloadAction<number>) => {
      state.frameRate = action.payload
    }
  },
  extraReducers: (builder) => {
    // Initialize AudioContext
    builder
      .addCase(initializeAudioContext.pending, (state) => {
        state.contextState = 'initializing'
        state.error = null
        state.initializationAttempts += 1
      })
      .addCase(initializeAudioContext.fulfilled, (state, action) => {
        state.contextState = 'ready'
        state.device = action.payload.device
        state.error = null
      })
      .addCase(initializeAudioContext.rejected, (state, action) => {
        state.contextState = 'error'
        state.error = action.payload as string
      })

    // Connect audio analysis
    builder
      .addCase(connectAudioAnalysis.pending, (state) => {
        state.analyserState = 'connected'
        state.error = null
      })
      .addCase(connectAudioAnalysis.fulfilled, (state, action) => {
        state.analyserState = 'analyzing'
        state.audioElement = {
          ...state.audioElement,
          ...action.payload.audioInfo,
          connected: action.payload.connected
        }
      })
      .addCase(connectAudioAnalysis.rejected, (state, action) => {
        state.analyserState = 'disconnected'
        state.error = action.payload as string
        // Still allow basic functionality without analysis
        state.audioElement.connected = false
      })

    // Start visualization
    builder
      .addCase(startVisualization.pending, (state) => {
        state.visualization.isAnimating = true
      })
      .addCase(startVisualization.fulfilled, (state) => {
        state.visualization.isAnimating = true
        state.error = null
      })
      .addCase(startVisualization.rejected, (state, action) => {
        state.visualization.isAnimating = false
        state.error = action.payload as string
      })

    // Stop visualization
    builder
      .addCase(stopVisualization.pending, (state) => {
        // Keep animating until confirmed stopped
      })
      .addCase(stopVisualization.fulfilled, (state) => {
        state.visualization.isAnimating = false
        state.visualization.data = Array(state.visualization.config.frequencyBands).fill(0)
      })
      .addCase(stopVisualization.rejected, (state, action) => {
        state.error = action.payload as string
        // Force stop even if there was an error
        state.visualization.isAnimating = false
      })
  },
})

// Export actions
export const {
  updateVisualizationData,
  updateAudioElement,
  setContextState,
  setAnalyserState,
  updateVisualizationConfig,
  clearError,
  resetInitializationAttempts,
  generateMockVisualization,
  updateFrameRate
} = audioSlice.actions

// Selectors
export const selectAudio = (state: { audio: AudioState }) => state.audio
export const selectAudioContextState = (state: { audio: AudioState }) => state.audio.contextState
export const selectAnalyserState = (state: { audio: AudioState }) => state.audio.analyserState
export const selectVisualizationData = (state: { audio: AudioState }) => state.audio.visualization.data
export const selectVisualizationConfig = (state: { audio: AudioState }) => state.audio.visualization.config
export const selectAudioElement = (state: { audio: AudioState }) => state.audio.audioElement
export const selectDeviceInfo = (state: { audio: AudioState }) => state.audio.device
export const selectAudioError = (state: { audio: AudioState }) => state.audio.error

// Complex selectors
export const selectAudioIsReady = (state: { audio: AudioState }) => {
  return state.audio.contextState === 'ready'
}

export const selectVisualizationIsActive = (state: { audio: AudioState }) => {
  return state.audio.visualization.isAnimating && state.audio.visualization.config.enabled
}

export const selectAudioSupportsAnalysis = (state: { audio: AudioState }) => {
  return state.audio.contextState === 'ready' && state.audio.analyserState !== 'disconnected'
}

export default audioSlice.reducer