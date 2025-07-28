import { Middleware } from '@reduxjs/toolkit'
import { 
  playArticle, 
  pausePlayback, 
  resumePlayback, 
  stopPlayback,
  setPlaying,
  setCurrentAudioElement,
  updateProgress,
  updateAudioData
} from '../ttsSlice'
import { 
  initializeAudioContext,
  connectAudioAnalysis,
  startVisualization,
  stopVisualization,
  updateVisualizationData
} from '../audioSlice'
import { TTSService } from '@/services/ttsService'
import { SpeechService } from '@/services/speechService'

// TTS Middleware to handle side effects and service coordination
export const ttsMiddleware: Middleware = (store) => (next) => (action) => {
  const result = next(action)
  const state = store.getState()

  // Handle playArticle fulfillment - start actual playback
  if (playArticle.fulfilled.match(action)) {
    const { tts, audio } = state
    const { services, currentAudioUrls } = tts
    const playbackMethod = action.payload.playbackMethod
    
    // Clear visualization data during loading
    const loadingData = Array(6).fill(0)
    store.dispatch(updateAudioData(loadingData))
    
    // Start playback based on method
    if (playbackMethod === 'google' && currentAudioUrls.length > 0) {
      startGoogleTTSPlayback(store, currentAudioUrls, services?.audioService)
    } else if (playbackMethod === 'browser' && services?.speechService) {
      startBrowserTTSPlayback(store, action.payload.textToSpeak, services.speechService)
    }
    
    // Note: Visualization is started AFTER audio analysis is properly connected
  }

  // Handle pause fulfillment - stop visualization
  if (pausePlayback.fulfilled.match(action)) {
    const { tts } = state
    if (tts.services?.audioService) {
      store.dispatch(stopVisualization())
    }
  }

  // Handle resume fulfillment - restart visualization
  if (resumePlayback.fulfilled.match(action)) {
    const { tts } = state
    if (tts.services?.audioService && tts.isPlaying) {
      store.dispatch(startVisualization())
    }
  }

  // Handle stop fulfillment - cleanup
  if (stopPlayback.fulfilled.match(action)) {
    const { tts } = state
    
    // Stop all visualization
    if (tts.services?.audioService) {
      store.dispatch(stopVisualization())
    }
    
    // Clear visualization data
    const idleData = Array(6).fill(0)
    store.dispatch(updateAudioData(idleData))
  }

  // Handle audio context initialization
  if (initializeAudioContext.fulfilled.match(action)) {
    console.log('🎵 Middleware - Audio context initialized, ready for TTS')
  }

  return result
}

// Helper function to start Google TTS playback
async function startGoogleTTSPlayback(
  store: any, 
  audioUrls: string[], 
  audioService: any
) {
  if (audioUrls.length === 0) return

  let currentChunkIndex = 0
  
  const playNextChunk = async () => {
    if (currentChunkIndex >= audioUrls.length) {
      // Playback completed
      store.dispatch(setPlaying(false))
      store.dispatch(stopVisualization())
      store.dispatch(setCurrentAudioElement(null))
      console.log('🎵 Middleware - Google TTS playback completed')
      return
    }

    const audio = new Audio(audioUrls[currentChunkIndex])
    store.dispatch(setCurrentAudioElement(audio))
    
    console.log('🎵 Middleware - Created audio element for chunk', currentChunkIndex + 1)

    // Set up audio event handlers
    audio.onloadedmetadata = () => {
      if (currentChunkIndex === 0) {
        // Estimate total duration for all chunks
        const estimatedTotalDuration = audio.duration * audioUrls.length
        store.dispatch(updateProgress({ 
          progress: 0, 
          currentTime: 0,
          duration: estimatedTotalDuration 
        }))
      }
    }

    audio.onloadeddata = async () => {
      if (currentChunkIndex === 0) {
        console.log('🎵 Middleware - First chunk loaded, starting playback')
        
        // Set playing state first
        store.dispatch(setPlaying(true))
        
        // Try to connect audio analysis
        if (audioService) {
          try {
            await audioService.setupAudioAnalysis(audio)
            console.log('🎵 Middleware - Audio analysis connected successfully')
            
            // Now start the real-time visualization since audio analysis is connected
            store.dispatch(startVisualization())
          } catch (analysisError) {
            console.warn('🎵 Middleware - Audio analysis failed, using mock visualization:', analysisError)
            // Still start visualization but it will use mock data
            store.dispatch(startVisualization())
          }
        } else {
          console.log('🎵 Middleware - No audio service available, using mock visualization')
          store.dispatch(startVisualization())
        }
      }
      
      try {
        await audio.play()
        console.log(`🎵 Middleware - Playing chunk ${currentChunkIndex + 1}/${audioUrls.length}`)
      } catch (playError) {
        console.error('🎵 Middleware - Audio play failed:', playError)
        // Try next chunk
        currentChunkIndex++
        playNextChunk()
      }
    }

    audio.ontimeupdate = () => {
      const chunkProgress = currentChunkIndex / audioUrls.length
      const currentChunkProgress = (audio.currentTime / audio.duration) / audioUrls.length
      const totalProgress = chunkProgress + currentChunkProgress
      const totalCurrentTime = (currentChunkIndex * audio.duration) + audio.currentTime

      store.dispatch(updateProgress({
        progress: totalProgress,
        currentTime: totalCurrentTime
      }))
    }

    audio.onended = () => {
      console.log(`🎵 Middleware - Chunk ${currentChunkIndex + 1} ended`)
      currentChunkIndex++
      playNextChunk()
    }

    audio.onerror = (error) => {
      console.error(`🎵 Middleware - Audio error in chunk ${currentChunkIndex + 1}:`, error)
      // Try next chunk
      currentChunkIndex++
      playNextChunk()
    }
  }

  // Start playback
  playNextChunk()
}

// Helper function to start browser TTS playback
async function startBrowserTTSPlayback(
  store: any,
  text: string,
  speechService: SpeechService
) {
  try {
    console.log('🎵 Middleware - Starting browser TTS playback')
    
    // Set playing state
    store.dispatch(setPlaying(true))
    
    // Browser TTS doesn't have real audio data, so no visualization
    console.log('🎵 Middleware - Browser TTS: No audio visualization available')
    
    // Start speech
    await speechService.speak(text)
    
    // Clean up
    store.dispatch(setPlaying(false))
    const idleData = Array(6).fill(0)
    store.dispatch(updateAudioData(idleData))
    
    console.log('🎵 Middleware - Browser TTS playback completed')
  } catch (error) {
    console.error('🎵 Middleware - Browser TTS playback failed:', error)
    store.dispatch(setPlaying(false))
    const idleData = Array(6).fill(0)
    store.dispatch(updateAudioData(idleData))
  }
}

// Visualization update middleware
export const visualizationMiddleware: Middleware = (store) => (next) => (action) => {
  const result = next(action)
  const state = store.getState()

  // Handle visualization start - begin animation loop
  if (startVisualization.fulfilled.match(action)) {
    const { tts, audio } = state
    
    if (tts.services?.audioService && tts.isPlaying) {
      // Start real-time visualization loop with actual audio data
      tts.services.audioService.startVisualizationLoop(
        (data: number[]) => {
          // Update both audio slice and TTS slice for consistency
          store.dispatch(updateVisualizationData(data))
          store.dispatch(updateAudioData(data))
        },
        'playing'
      )
      console.log('🎵 Visualization Middleware - Started real-time audio visualization')
    } else {
      console.log('🎵 Visualization Middleware - No audio service or not playing, skipping visualization')
    }
  }

  // Handle visualization stop
  if (stopVisualization.fulfilled.match(action)) {
    const { tts } = state
    
    if (tts.services?.audioService) {
      tts.services.audioService.stopVisualizationLoop()
    }
    
    console.log('🎵 Visualization Middleware - Stopped visualization')
  }

  return result
}


export default ttsMiddleware