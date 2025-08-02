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
  updateVisualizationData,
  setAnalyserState
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
    // Audio context ready for TTS
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
      return
    }

    const audio = new Audio(audioUrls[currentChunkIndex])
    store.dispatch(setCurrentAudioElement(audio))
    

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
        
        // Set playing state first
        store.dispatch(setPlaying(true))
        
        // Connect audio analysis for visualization and audio output
        if (audioService) {
          try {
            // Ensure AudioContext is initialized and running
            const audioContext = audioService.getAudioContext()
            if (!audioContext) {
              // Initialize AudioContext within user interaction context (audio.play() call)
              const initialized = await audioService.initializeAudioContext()
              if (!initialized) {
                // Continue to play audio even without visualization
              }
            }
            
            // Ensure AudioContext is in running state (might be suspended on mobile)
            const currentContext = audioService.getAudioContext()
            if (currentContext && currentContext.state === 'suspended') {
              try {
                await currentContext.resume()
              } catch (resumeError) {
                console.error('AudioContext resume failed:', resumeError)
                // Continue to play audio even without AudioContext
              }
            }
            
            // Try to setup audio analysis for visualization
            try {
              const analysisConnected = await audioService.setupAudioAnalysis(audio)
              
              if (analysisConnected) {
                // Update Redux state to reflect successful audio analysis connection
                store.dispatch(setAnalyserState('analyzing'))
                store.dispatch(connectAudioAnalysis(audio))
                store.dispatch(startVisualization())
              } else {
                // Set analyser state to disconnected when setup fails  
                store.dispatch(setAnalyserState('disconnected'))
              }
            } catch (analysisError) {
              console.error('Audio analysis setup failed:', analysisError)
              store.dispatch(setAnalyserState('disconnected'))
            }
          } catch (audioServiceError) {
            console.error('Audio service setup failed:', audioServiceError)
          }
        }
      }
      
      try {
        await audio.play()
      } catch (playError) {
        console.error('Audio play failed:', playError)
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
      currentChunkIndex++
      playNextChunk()
    }

    audio.onerror = (error) => {
      console.error(`Audio error in chunk ${currentChunkIndex + 1}:`, error)
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
    
    // Set playing state
    store.dispatch(setPlaying(true))
    
    // Browser TTS doesn't have real audio data, so no visualization
    
    // Start speech
    await speechService.speak(text)
    
    // Clean up
    store.dispatch(setPlaying(false))
    const idleData = Array(6).fill(0)
    store.dispatch(updateAudioData(idleData))
    
  } catch (error) {
    console.error('Browser TTS playback failed:', error)
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
    } else {
    }
  }

  // Handle visualization stop
  if (stopVisualization.fulfilled.match(action)) {
    const { tts } = state
    
    if (tts.services?.audioService) {
      tts.services.audioService.stopVisualizationLoop()
    }
    
  }

  return result
}


export default ttsMiddleware