import { useSelector, useDispatch } from 'react-redux'
import { useCallback } from 'react'
import { 
  playArticle,
  pausePlayback,
  resumePlayback,
  stopPlayback,
  initializeTTS,
  selectTTS,
  selectTTSCurrentArticle,
  selectTTSPlaybackState,
  selectTTSProgress,
  selectTTSAudioData,
  selectTTSConfig,
  selectTTSError,
  selectTTSQueue,
  selectTTSIsInitialized,
  selectTTSIsVisible,
  selectTTSCanPlay,
  updateConfig,
  clearError,
  addToQueue,
  removeFromQueue,
  clearQueue
} from '@/store/ttsSlice'
import { 
  selectAudio,
  selectAudioIsReady,
  selectVisualizationIsActive
} from '@/store/audioSlice'
import type { AppDispatch } from '@/store'
import type { Article } from '@/lib/types'
import type { TTSConfig } from '@/store/ttsSlice'

// Main TTS hook that provides all TTS functionality
export function useTTS() {
  const dispatch = useDispatch<AppDispatch>()
  
  // Selectors
  const ttsState = useSelector(selectTTS)
  const currentArticle = useSelector(selectTTSCurrentArticle)
  const playbackState = useSelector(selectTTSPlaybackState)
  const progress = useSelector(selectTTSProgress)
  const audioData = useSelector(selectTTSAudioData)
  const config = useSelector(selectTTSConfig)
  const error = useSelector(selectTTSError)
  const queue = useSelector(selectTTSQueue)
  const isInitialized = useSelector(selectTTSIsInitialized)
  const isVisible = useSelector(selectTTSIsVisible)
  const canPlay = useSelector(selectTTSCanPlay)
  
  // Audio state
  const audioState = useSelector(selectAudio)
  const audioIsReady = useSelector(selectAudioIsReady)
  const visualizationActive = useSelector(selectVisualizationIsActive)

  // Actions
  const actions = {
    // Playback control
    play: useCallback((article: Article) => {
      dispatch(playArticle(article))
    }, [dispatch]),
    
    pause: useCallback(() => {
      dispatch(pausePlayback())
    }, [dispatch]),
    
    resume: useCallback(() => {
      dispatch(resumePlayback())
    }, [dispatch]),
    
    stop: useCallback(() => {
      dispatch(stopPlayback())
    }, [dispatch]),
    
    // Configuration
    initialize: useCallback((config?: Partial<TTSConfig>) => {
      dispatch(initializeTTS(config || {}))
    }, [dispatch]),
    
    updateConfig: useCallback((config: Partial<TTSConfig>) => {
      dispatch(updateConfig(config))
    }, [dispatch]),
    
    // Error handling
    clearError: useCallback(() => {
      dispatch(clearError())
    }, [dispatch]),
    
    // Queue management
    addToQueue: useCallback((article: Article) => {
      dispatch(addToQueue(article))
    }, [dispatch]),
    
    removeFromQueue: useCallback((articleId: string) => {
      dispatch(removeFromQueue(articleId))
    }, [dispatch]),
    
    clearQueue: useCallback(() => {
      dispatch(clearQueue())
    }, [dispatch])
  }

  return {
    // State
    ...playbackState,
    ...progress,
    currentArticle,
    audioData,
    config,
    error,
    queue,
    isInitialized,
    isVisible,
    canPlay,
    
    // Audio state
    audioState,
    audioIsReady,
    visualizationActive,
    
    // Actions
    ...actions,
    
    // Raw state for advanced usage
    ttsState
  }
}

// Hook specifically for TTS playback state
export function useTTSPlayback() {
  const dispatch = useDispatch<AppDispatch>()
  const playbackState = useSelector(selectTTSPlaybackState)
  const currentArticle = useSelector(selectTTSCurrentArticle)
  const progress = useSelector(selectTTSProgress)
  
  const play = useCallback((article: Article) => {
    dispatch(playArticle(article))
  }, [dispatch])
  
  const pause = useCallback(() => {
    dispatch(pausePlayback())
  }, [dispatch])
  
  const resume = useCallback(() => {
    dispatch(resumePlayback())
  }, [dispatch])
  
  const stop = useCallback(() => {
    dispatch(stopPlayback())
  }, [dispatch])

  return {
    ...playbackState,
    ...progress,
    currentArticle,
    play,
    pause,
    resume,
    stop
  }
}

// Hook for TTS audio visualization
export function useTTSVisualization() {
  const audioData = useSelector(selectTTSAudioData)
  const visualizationActive = useSelector(selectVisualizationIsActive)
  const playbackState = useSelector(selectTTSPlaybackState)
  
  return {
    audioData,
    isActive: visualizationActive,
    isPlaying: playbackState.isPlaying,
    isLoading: playbackState.isLoading,
    isPaused: playbackState.isPaused
  }
}

// Hook for TTS configuration and settings
export function useTTSConfig() {
  const dispatch = useDispatch<AppDispatch>()
  const config = useSelector(selectTTSConfig)
  const isInitialized = useSelector(selectTTSIsInitialized)
  const error = useSelector(selectTTSError)
  
  const updateConfig = useCallback((newConfig: Partial<TTSConfig>) => {
    dispatch(updateConfig(newConfig))
  }, [dispatch])
  
  const initialize = useCallback((config?: Partial<TTSConfig>) => {
    dispatch(initializeTTS(config || {}))
  }, [dispatch])
  
  const clearError = useCallback(() => {
    dispatch(clearError())
  }, [dispatch])

  return {
    config,
    isInitialized,
    error,
    updateConfig,
    initialize,
    clearError
  }
}

// Hook for TTS queue management
export function useTTSQueue() {
  const dispatch = useDispatch<AppDispatch>()
  const queue = useSelector(selectTTSQueue)
  
  const addToQueue = useCallback((article: Article) => {
    dispatch(addToQueue(article))
  }, [dispatch])
  
  const removeFromQueue = useCallback((articleId: string) => {
    dispatch(removeFromQueue(articleId))
  }, [dispatch])
  
  const clearQueue = useCallback(() => {
    dispatch(clearQueue())
  }, [dispatch])

  return {
    queue,
    addToQueue,
    removeFromQueue,
    clearQueue,
    hasItems: queue.length > 0,
    count: queue.length
  }
}

// Hook for checking if an article is currently playing
export function useTTSCurrentArticle(articleId?: string) {
  const currentArticle = useSelector(selectTTSCurrentArticle)
  const playbackState = useSelector(selectTTSPlaybackState)
  
  const isCurrentArticle = articleId ? currentArticle?.id === articleId : false
  const isCurrentlyPlaying = isCurrentArticle && playbackState.isPlaying
  const isCurrentlyPaused = isCurrentArticle && playbackState.isPaused
  const isCurrentlyLoading = isCurrentArticle && playbackState.isLoading
  
  return {
    currentArticle,
    isCurrentArticle,
    isCurrentlyPlaying,
    isCurrentlyPaused,
    isCurrentlyLoading,
    playbackState: isCurrentArticle ? playbackState : { isPlaying: false, isPaused: false, isLoading: false }
  }
}

// Hook for TTS status and capabilities
export function useTTSStatus() {
  const isInitialized = useSelector(selectTTSIsInitialized)
  const canPlay = useSelector(selectTTSCanPlay)
  const isVisible = useSelector(selectTTSIsVisible) 
  const audioIsReady = useSelector(selectAudioIsReady)
  const error = useSelector(selectTTSError)
  
  return {
    isInitialized,
    canPlay,
    isVisible,
    audioIsReady,
    error,
    hasError: !!error,
    isReady: isInitialized && canPlay
  }
}

// Utility hook for TTS context migration (backward compatibility)
// This allows components to gradually migrate from Context to Redux
export function useTTSContext() {
  console.warn('useTTSContext is deprecated. Use useTTS() instead for Redux-based TTS.')
  return useTTS()
}