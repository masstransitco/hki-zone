"use client"

import { useState, useRef, useCallback, useEffect } from "react"

interface UseTextToSpeechProps {
  apiKey?: string
  language?: string
}

interface UseTextToSpeechReturn {
  isPlaying: boolean
  isPaused: boolean
  isLoading: boolean
  progress: number // 0-1 representing playback progress
  duration: number // Total duration in seconds
  currentTime: number // Current playback time in seconds
  audioData: number[] // Real-time audio visualization data
  speak: (text: string) => Promise<void>
  pause: () => void
  resume: () => void
  stop: () => void
}

// Professional broadcast voices optimized for news/authoritative delivery
const getLanguageConfig = (language: string) => {
  switch (language) {
    case 'en':
      return {
        languageCode: 'en-US',
        name: 'en-US-Studio-O', // Studio tier for broadcast/news narration
        ssmlGender: 'FEMALE'
      }
    case 'zh-TW': // Traditional Chinese (Cantonese)
      return {
        languageCode: 'yue-HK',
        name: 'yue-HK-Standard-B', // Warmest timbre for Cantonese
        ssmlGender: 'MALE'
      }
    case 'zh-CN': // Simplified Chinese (Mandarin)
      return {
        languageCode: 'cmn-CN',
        name: 'cmn-CN-Neural2-A', // Neural2 for richer prosody
        ssmlGender: 'FEMALE'
      }
    default:
      return {
        languageCode: 'en-US',
        name: 'en-US-Studio-O',
        ssmlGender: 'FEMALE'
      }
  }
}

// Fallback voices if primary choices fail
const getFallbackLanguageConfig = (language: string) => {
  switch (language) {
    case 'en':
      return {
        languageCode: 'en-US',
        name: 'en-US-News-L', // News voice fallback
        ssmlGender: 'FEMALE'
      }
    case 'zh-TW':
      return {
        languageCode: 'yue-HK',
        name: 'yue-HK-Standard-A',
        ssmlGender: 'FEMALE'
      }
    case 'zh-CN':
      return {
        languageCode: 'cmn-CN',
        name: 'cmn-CN-Wavenet-A',
        ssmlGender: 'FEMALE'
      }
    default:
      return {
        languageCode: 'en-US',
        name: 'en-US-News-L',
        ssmlGender: 'FEMALE'
      }
  }
}

// Browser speech synthesis language codes
const getBrowserLanguageCode = (language: string) => {
  switch (language) {
    case 'en':
      return 'en-US'
    case 'zh-TW':
      return 'zh-HK' // Cantonese
    case 'zh-CN':
      return 'zh-CN' // Mandarin
    default:
      return 'en-US'
  }
}

// SSML preprocessing for professional broadcast delivery
const preprocessTextToSSML = (text: string, voiceName: string, language: string): string => {
  // Clean HTML tags and normalize whitespace
  let cleanText = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  
  // Remove common article artifacts
  cleanText = cleanText.replace(/^(By\s+[\w\s]+\||\w+\s+\w+\s+\|\s*)/i, '') // Remove bylines
  cleanText = cleanText.replace(/\(Photo[^)]*\)/gi, '') // Remove photo captions
  cleanText = cleanText.replace(/\[Advertisement\]/gi, '') // Remove ad markers
  
  // Remove AI-enhanced article structure elements
  // Remove section headers (English, Traditional Chinese, Simplified Chinese)
  cleanText = cleanText.replace(/^(Summary|Key Points|What it matters|摘要|重點|為什麼重要|摘要|要点|为什么重要)[\s]*:?[\s]*/gmi, '')
  cleanText = cleanText.replace(/\n(Summary|Key Points|What it matters|摘要|重點|為什麼重要|摘要|要点|为什么重要)[\s]*:?[\s]*/gmi, '\n')
  
  // Remove numbered citations in square brackets [1], [2], etc.
  cleanText = cleanText.replace(/\[\d+\]/g, '')
  
  // Remove asterisks used for emphasis or bullet points
  cleanText = cleanText.replace(/\*+/g, '')
  
  // Remove multiple line breaks and normalize spacing
  cleanText = cleanText.replace(/\n\s*\n\s*\n/g, '\n\n') // Triple+ line breaks to double
  cleanText = cleanText.replace(/\n\s*\n/g, '. ') // Double line breaks to sentence breaks
  cleanText = cleanText.replace(/\s+/g, ' ').trim() // Normalize whitespace
  
  // Split into sentences for better pacing
  const sentences = cleanText.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 0)
  
  // Check if this is a Studio voice (which ignores some SSML tags)
  const isStudioVoice = voiceName.includes('Studio')
  const isNeural2Voice = voiceName.includes('Neural2')
  
  // Process sentences with SSML markup
  const processedSentences = sentences.map((sentence, index) => {
    let processed = sentence.trim()
    
    // Emphasize numbers and monetary amounts
    if (!isStudioVoice) {
      processed = processed.replace(/(\$[\d,]+(?:\.\d{2})?(?:\s*(?:billion|million|thousand))?)/gi, 
        '<emphasis level="moderate">$1</emphasis>')
      processed = processed.replace(/(\d{1,3}(?:,\d{3})*(?:\.\d+)?(?:\s*(?:percent|%)))/gi, 
        '<emphasis level="moderate">$1</emphasis>')
    }
    
    // Add pronunciation fixes for common Hong Kong terms
    processed = processed.replace(/\bLegCo\b/g, '<sub alias="Legislative Council">LegCo</sub>')
    processed = processed.replace(/\bCE\b/g, '<sub alias="Chief Executive">CE</sub>')
    processed = processed.replace(/\bHK\b/g, '<sub alias="Hong Kong">HK</sub>')
    processed = processed.replace(/\bHKD\b/g, '<sub alias="Hong Kong Dollars">HKD</sub>')
    
    // Add emotional tone for Neural2 voices on authoritative statements
    if (isNeural2Voice && language === 'en') {
      if (/\b(said|announced|declared|stated|confirmed|warned|urged)\b/i.test(processed)) {
        processed = `<google:emotion name="firm">${processed}</google:emotion>`
      }
    }
    
    return `<p>${processed}</p>`
  })
  
  // Join with appropriate breaks between paragraphs
  const ssmlContent = processedSentences.join('<break time="400ms"/>')
  
  return `<speak>${ssmlContent}</speak>`
}

// Chunk text for Studio voices (≤5000 bytes limit)
const chunkTextForStudio = (text: string, maxBytes: number = 4500): string[] => {
  const sentences = text.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 0)
  const chunks: string[] = []
  let currentChunk = ''
  
  for (const sentence of sentences) {
    const testChunk = currentChunk + (currentChunk ? ' ' : '') + sentence
    if (Buffer.byteLength(testChunk, 'utf8') > maxBytes && currentChunk) {
      chunks.push(currentChunk)
      currentChunk = sentence
    } else {
      currentChunk = testChunk
    }
  }
  
  if (currentChunk) {
    chunks.push(currentChunk)
  }
  
  return chunks.length > 0 ? chunks : [text]
}

// Mobile browser detection utilities
const isMobile = () => {
  if (typeof window === 'undefined') return false
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
}

const isIOSChrome = () => {
  if (typeof window === 'undefined') return false
  return /CriOS/i.test(navigator.userAgent) || 
         (/iPhone|iPad|iPod/.test(navigator.userAgent) && /Chrome/i.test(navigator.userAgent))
}

const isIOSSafari = () => {
  if (typeof window === 'undefined') return false
  return /iPhone|iPad|iPod/.test(navigator.userAgent) && 
         /Safari/i.test(navigator.userAgent) && 
         !/Chrome|CriOS|FxiOS|EdgiOS/i.test(navigator.userAgent)
}

export function useTextToSpeech({ apiKey, language = 'en' }: UseTextToSpeechProps = {}): UseTextToSpeechReturn {
  const [isPlaying, setIsPlaying] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [audioData, setAudioData] = useState<number[]>(Array(6).fill(0))
  
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const speechUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationFrameRef = useRef<number>()
  const audioContextRef = useRef<AudioContext | null>(null)
  const audioContextInitializedRef = useRef<boolean>(false)
  const userGestureRequiredRef = useRef<boolean>(false)

  // Initialize AudioContext with proper user gesture handling for mobile
  const initializeAudioContext = useCallback(async () => {
    try {
      if (!audioContextRef.current) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
        if (!AudioContextClass) {
          console.warn('🎵 Web Audio API not supported')
          return null
        }
        
        audioContextRef.current = new AudioContextClass()
        console.log('🎵 Created new AudioContext, state:', audioContextRef.current.state)
        
        // Track if this is a mobile environment that requires user gestures
        if (isMobile()) {
          userGestureRequiredRef.current = true
          console.log('🎵 Mobile environment detected, user gesture required')
        }
      }
      
      const audioContext = audioContextRef.current
      
      // Handle suspended AudioContext (common on mobile browsers)
      if (audioContext.state === 'suspended') {
        console.log('🎵 AudioContext suspended, attempting to resume...')
        
        // For iOS Chrome, we need to be more aggressive about resumption
        if (isIOSChrome()) {
          console.log('🎵 iOS Chrome detected, using enhanced resumption strategy')
          
          // Try multiple times with delays for iOS Chrome
          for (let attempt = 0; attempt < 3; attempt++) {
            try {
              await audioContext.resume()
              if (audioContext.state === 'running') {
                console.log('🎵 AudioContext resumed successfully on attempt', attempt + 1)
                break
              }
              await new Promise(resolve => setTimeout(resolve, 100))
            } catch (resumeError) {
              console.warn(`🎵 Resume attempt ${attempt + 1} failed:`, resumeError)
            }
          }
        } else {
          // Standard resumption for other browsers
          await audioContext.resume()
        }
        
        console.log('🎵 AudioContext final state:', audioContext.state)
      }
      
      audioContextInitializedRef.current = true
      return audioContext
    } catch (error) {
      console.error('🎵 Failed to initialize AudioContext:', error)
      return null
    }
  }, [])

  // Initialize Web Audio API for visualization
  const initializeAudioAnalysis = useCallback(async (audioElement: HTMLAudioElement) => {
    try {
      // Initialize AudioContext first
      const audioContext = await initializeAudioContext()
      if (!audioContext) {
        console.log('🎵 Skipping audio analysis - AudioContext unavailable')
        return null
      }
      
      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 256
      analyser.smoothingTimeConstant = 0.8
      
      console.log('🎵 Creating MediaElementSource...')
      let source
      try {
        source = audioContext.createMediaElementSource(audioElement)
        console.log('🎵 MediaElementSource created successfully')
      } catch (sourceError) {
        console.error('🎵 Failed to create MediaElementSource:', sourceError)
        
        // On mobile browsers, especially iOS Chrome, this can fail
        // Provide graceful degradation
        if (isMobile()) {
          console.log('🎵 Mobile browser - gracefully degrading without visualization')
        } else {
          console.log('🎵 Falling back to audio without visualization')
        }
        return null
      }
      
      console.log('🎵 Connecting audio graph: source -> analyser -> destination')
      try {
        source.connect(analyser)
        analyser.connect(audioContext.destination)
        
        analyserRef.current = analyser
        console.log('🎵 Audio analysis initialized successfully')
        return analyser
      } catch (connectionError) {
        console.error('🎵 Failed to connect audio graph:', connectionError)
        
        // On some mobile browsers, connection might fail
        // Still allow audio to play without visualization
        try {
          source.connect(audioContext.destination) // Direct connection for audio playback
          console.log('🎵 Using direct audio connection without analysis')
        } catch (directConnectionError) {
          console.error('🎵 Even direct connection failed:', directConnectionError)
        }
        return null
      }
    } catch (error) {
      console.error('🎵 Failed to initialize audio analysis:', error)
      return null
    }
  }, [initializeAudioContext])

  // Previous audio data for smoothing
  const previousDataRef = useRef<number[]>(Array(6).fill(0))
  const smoothingFactor = 0.3 // Lower = more responsive to changes

  // Real-time audio analysis for visualization
  const updateAudioVisualization = useCallback(() => {
    if (!analyserRef.current || !isPlaying) {
      // Generate subtle breathing animation when not playing
      if (!isPlaying) {
        const time = Date.now() / 1000
        setAudioData(Array(6).fill(0).map((_, i) => {
          const offset = i * 0.2
          return Math.sin(time + offset) * 0.05 + 0.05
        }))
      }
      return
    }
    
    console.log('🎵 Updating audio visualization frame')

    const analyser = analyserRef.current
    const bufferLength = analyser.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)
    analyser.getByteFrequencyData(dataArray)
    
    // Debug: Check if we're getting any frequency data
    const maxFreq = Math.max(...dataArray)
    if (maxFreq > 0) {
      console.log('🎵 Got frequency data, max:', maxFreq)
    }

    // Speech-optimized frequency bands (FFT size 256 = 128 bins, ~172Hz per bin at 44.1kHz)
    // Human speech: 85-255Hz (fundamental), 700-3000Hz (formants), 3000-8000Hz (clarity)
    const speechBands = [
      { start: 0, end: 2, weight: 1.5 },    // 0-344Hz: Voice fundamental
      { start: 2, end: 4, weight: 1.3 },    // 344-688Hz: Lower harmonics
      { start: 4, end: 8, weight: 1.2 },    // 688-1376Hz: First formant
      { start: 8, end: 15, weight: 1.0 },   // 1376-2580Hz: Second formant
      { start: 15, end: 25, weight: 0.8 },  // 2580-4300Hz: Higher formants
      { start: 25, end: 40, weight: 0.6 }   // 4300-6880Hz: Consonants/clarity
    ]

    const newAudioData = speechBands.map((band, i) => {
      let sum = 0
      let count = 0

      // Calculate weighted average for this frequency band
      for (let j = band.start; j < band.end && j < bufferLength; j++) {
        sum += dataArray[j] * band.weight
        count++
      }

      // Normalize the frequency data
      const average = count > 0 ? sum / count : 0
      const normalized = average / 255
      
      // Apply exponential smoothing for natural motion
      const previousValue = previousDataRef.current[i] || 0
      const smoothed = previousValue * smoothingFactor + normalized * (1 - smoothingFactor)
      
      // Amplify for better visual impact
      return Math.min(1, smoothed * 2.0)
    })

    // Store for next frame smoothing
    previousDataRef.current = newAudioData
    
    // Debug: log the processed values
    console.log('🎵 Processed audio data:', newAudioData.map(v => v.toFixed(2)).join(', '))
    
    setAudioData(newAudioData)
  }, [isPlaying])

  // Start/stop animation loop based on playing state
  useEffect(() => {
    if (isPlaying) {
      console.log('🎵 Starting audio visualization loop')
      // Start the animation loop
      const animate = () => {
        updateAudioVisualization()
        if (isPlaying) {
          animationFrameRef.current = requestAnimationFrame(animate)
        }
      }
      animate()
    } else {
      console.log('🎵 Stopping audio visualization loop')
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = undefined
      }
    }
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = undefined
      }
    }
  }, [isPlaying, updateAudioVisualization])

  const stop = useCallback(() => {
    console.log('🎵 TTS Hook - Stop called, cleaning up resources')
    
    // Clean up audio element
    if (audioRef.current) {
      try {
        audioRef.current.pause()
        audioRef.current.currentTime = 0
        // Remove event listeners to prevent memory leaks
        audioRef.current.onloadeddata = null
        audioRef.current.ontimeupdate = null
        audioRef.current.onended = null
        audioRef.current.onerror = null
        audioRef.current = null
        console.log('🎵 Audio element cleaned up')
      } catch (audioCleanupError) {
        console.warn('🎵 Error cleaning up audio element:', audioCleanupError)
      }
    }
    
    // Clean up speech synthesis
    if (speechUtteranceRef.current) {
      try {
        speechSynthesis.cancel()
        speechUtteranceRef.current = null
        console.log('🎵 Speech synthesis cancelled')
      } catch (speechCleanupError) {
        console.warn('🎵 Error cleaning up speech synthesis:', speechCleanupError)
      }
    }

    // Clean up animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = undefined
      console.log('🎵 Animation frame cancelled')
    }
    
    // Clean up audio analysis
    if (analyserRef.current) {
      analyserRef.current = null
      console.log('🎵 Audio analyser cleared')
    }
    
    // Reset all state
    setIsPlaying(false)
    setIsPaused(false)
    setIsLoading(false)
    setProgress(0)
    setCurrentTime(0)
    setDuration(0)
    setAudioData(Array(6).fill(0))
    
    console.log('🎵 TTS Hook - Stop completed, all resources cleaned up')
  }, [])

  const pause = useCallback(() => {
    console.log('🎵 TTS Hook - Pause called', {
      hasAudioRef: !!audioRef.current,
      audioRefPaused: audioRef.current?.paused,
      speechSynthesisSpeaking: speechSynthesis.speaking,
      speechSynthesisPaused: speechSynthesis.paused,
      currentIsPlaying: isPlaying,
      currentIsPaused: isPaused
    })

    let paused = false

    if (audioRef.current && !audioRef.current.paused) {
      console.log('🎵 TTS Hook - Pausing audio element')
      audioRef.current.pause()
      paused = true
    } else if (speechSynthesis.speaking && !speechSynthesis.paused) {
      console.log('🎵 TTS Hook - Pausing speech synthesis')
      speechSynthesis.pause()
      paused = true
    }

    if (paused) {
      console.log('🎵 TTS Hook - Setting paused state')
      setIsPlaying(false)  // Stop playing state
      setIsPaused(true)    // Set paused state
      
      // Stop audio visualization
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    } else {
      console.warn('🎵 TTS Hook - Nothing to pause')
    }
  }, [isPlaying, isPaused])

  const resume = useCallback(() => {
    console.log('🎵 TTS Hook - Resume called', {
      hasAudioRef: !!audioRef.current,
      audioRefPaused: audioRef.current?.paused,
      speechSynthesisSpeaking: speechSynthesis.speaking,
      speechSynthesisPaused: speechSynthesis.paused,
      currentIsPlaying: isPlaying,
      currentIsPaused: isPaused
    })

    let resumed = false

    if (audioRef.current && audioRef.current.paused) {
      console.log('🎵 TTS Hook - Resuming audio element')
      audioRef.current.play()
        .then(() => {
          console.log('🎵 TTS Hook - Audio resume successful')
        })
        .catch((error) => {
          console.error('🎵 TTS Hook - Audio resume failed:', error)
        })
      resumed = true
    } else if (speechSynthesis.paused) {
      console.log('🎵 TTS Hook - Resuming speech synthesis')
      speechSynthesis.resume()
      resumed = true
    }

    if (resumed) {
      console.log('🎵 TTS Hook - Setting resumed state')
      setIsPlaying(true)   // Set playing state
      setIsPaused(false)   // Clear paused state
      
      // Visualization will restart automatically via useEffect
    } else {
      console.warn('🎵 TTS Hook - Nothing to resume')
    }
  }, [isPlaying, isPaused, updateAudioVisualization])

  const speakWithGoogleTTS = useCallback(async (text: string, isRetry: boolean = false) => {
    if (!apiKey) {
      throw new Error("Google Text-to-Speech API key is required")
    }

    const voiceConfig = isRetry ? getFallbackLanguageConfig(language) : getLanguageConfig(language)
    const isStudioVoice = voiceConfig.name.includes('Studio')
    
    // Preprocess text into professional SSML
    const ssmlText = preprocessTextToSSML(text, voiceConfig.name, language)
    
    // Handle Studio voice chunking if needed
    const textChunks = isStudioVoice ? chunkTextForStudio(text) : [text]
    const audioUrls: string[] = []
    
    for (let i = 0; i < textChunks.length; i++) {
      const chunk = textChunks[i]
      const chunkSSML = textChunks.length > 1 
        ? preprocessTextToSSML(chunk, voiceConfig.name, language)
        : ssmlText
      
      console.log(`🎵 Google TTS - Making API request for chunk ${i + 1}/${textChunks.length}`)
      
      const response = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: { ssml: chunkSSML },
          voice: voiceConfig,
          audioConfig: {
            audioEncoding: 'MP3',
            // Mobile-optimized audio settings
            sampleRateHertz: isMobile() ? 44100 : 48000, // Standard rate for mobile
            speakingRate: isMobile() ? 0.95 : 1.05, // Slower on mobile for better comprehension
            pitch: isMobile() ? -0.5 : -1.0, // Less deep pitch on mobile for clarity
            volumeGainDb: 0.0,
            effectsProfileId: isMobile() 
              ? ['telephony-class-application'] // Better for mobile speakers
              : ['large-home-entertainment-class-device'] // Full-range EQ for desktop
          }
        })
      })
      
      console.log(`🎵 Google TTS - API response status:`, response.status)

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Google TTS API error details:', errorText)
        
        // Try fallback voice if this is first attempt and it's a voice-related error
        if (!isRetry && (response.status === 400 || response.status === 404)) {
          console.log('Trying fallback voice...')
          return await speakWithGoogleTTS(text, true)
        }
        
        throw new Error(`Google TTS API error: ${response.status} - ${errorText}`)
      }

      const data = await response.json()
      
      if (!data.audioContent) {
        throw new Error('No audio content received from Google TTS API')
      }
      
      const audioContent = data.audioContent

      // Convert base64 to blob and create audio URL
      const audioBlob = new Blob([Uint8Array.from(atob(audioContent), c => c.charCodeAt(0))], { type: 'audio/mp3' })
      const audioUrl = URL.createObjectURL(audioBlob)
      audioUrls.push(audioUrl)
    }

    // Play audio chunks sequentially
    return new Promise<void>((resolve, reject) => {
      let currentChunkIndex = 0
      
      const playNextChunk = () => {
        if (currentChunkIndex >= audioUrls.length) {
          setIsPlaying(false)
          setIsPaused(false)
          audioRef.current = null
          // Clean up all URLs
          audioUrls.forEach(url => URL.revokeObjectURL(url))
          resolve()
          return
        }

        const audio = new Audio(audioUrls[currentChunkIndex])
        audioRef.current = audio

        audio.onloadedmetadata = () => {
          if (currentChunkIndex === 0) {
            // Set total duration for all chunks (estimate)
            setDuration(audio.duration * audioUrls.length)
          }
        }

        audio.onloadeddata = async () => {
          if (currentChunkIndex === 0) {
            console.log('🎵 Audio loaded, starting playback...')
            
            // Initialize audio analysis first (gracefully handle failures)
            try {
              await initializeAudioAnalysis(audio)
            } catch (analysisError) {
              console.warn('🎵 Audio analysis initialization failed, continuing without visualization:', analysisError)
            }
            
            // Set playing state before stopping loading to avoid visibility gap
            setIsPlaying(true)
            setIsLoading(false)
            
            // Visualization will start automatically via useEffect
          }
          
          console.log('🎵 Audio element state before play:', {
            readyState: audio.readyState,
            paused: audio.paused,
            ended: audio.ended,
            muted: audio.muted,
            volume: audio.volume,
            duration: audio.duration,
            currentTime: audio.currentTime
          })
          
          console.log('🎵 Playing audio chunk:', currentChunkIndex + 1, 'of', audioUrls.length)
          
          // Improved play() with better error handling and mobile compatibility
          const playAudio = async () => {
            try {
              // For mobile browsers, especially iOS, we might need to handle play promises differently
              const playPromise = audio.play()
              
              if (playPromise !== undefined) {
                await playPromise
                console.log('🎵 Audio play() successful for chunk:', currentChunkIndex + 1)
                console.log('🎵 Audio state after play:', {
                  paused: audio.paused,
                  currentTime: audio.currentTime,
                  volume: audio.volume
                })
              }
            } catch (playError) {
              console.error('🎵 Audio play() failed:', playError)
              
              // For mobile browsers, retry once after a short delay
              if (isMobile() && currentChunkIndex === 0) {
                console.log('🎵 Mobile browser detected, retrying play after delay...')
                try {
                  await new Promise(resolve => setTimeout(resolve, 200))
                  await audio.play()
                  console.log('🎵 Audio play retry successful')
                } catch (retryError) {
                  console.error('🎵 Audio play retry also failed:', retryError)
                  reject(playError)
                }
              } else {
                reject(playError)
              }
            }
          }
          
          await playAudio()
        }

        audio.ontimeupdate = () => {
          const chunkProgress = currentChunkIndex / audioUrls.length
          const currentChunkProgress = (audio.currentTime / audio.duration) / audioUrls.length
          setProgress(chunkProgress + currentChunkProgress)
          setCurrentTime((currentChunkIndex * (audio.duration || 0)) + audio.currentTime)
          
          // Log audio progress periodically
          if (Math.floor(audio.currentTime) % 2 === 0 && audio.currentTime % 1 < 0.1) {
            console.log('🎵 Audio playing:', {
              currentTime: Math.round(audio.currentTime * 10) / 10,
              duration: Math.round(audio.duration * 10) / 10,
              volume: audio.volume,
              paused: audio.paused
            })
          }
        }

        audio.onended = () => {
          currentChunkIndex++
          playNextChunk()
        }

        audio.onerror = () => {
          setIsLoading(false)
          setIsPlaying(false)
          setIsPaused(false)
          audioRef.current = null
          if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current)
          }
          // Clean up all URLs
          audioUrls.forEach(url => URL.revokeObjectURL(url))
          reject(new Error("Audio playback failed"))
        }
      }

      playNextChunk()
    })
  }, [apiKey, language])

  const speakWithBrowserAPI = useCallback((text: string) => {
    return new Promise<void>((resolve, reject) => {
      if (!window.speechSynthesis) {
        reject(new Error("Speech synthesis not supported"))
        return
      }

      console.log('🎵 Browser TTS - Starting speech synthesis')
      
      // On some mobile browsers, we need to cancel any existing utterances first
      if (isMobile()) {
        try {
          speechSynthesis.cancel()
          console.log('🎵 Browser TTS - Cancelled any existing utterances (mobile)')
        } catch (cancelError) {
          console.warn('🎵 Browser TTS - Error cancelling existing utterances:', cancelError)
        }
      }

      const utterance = new SpeechSynthesisUtterance(text)
      speechUtteranceRef.current = utterance

      // Set language for browser TTS
      utterance.lang = getBrowserLanguageCode(language)

      // Voice selection with better voice loading handling
      const selectVoice = () => {
        const voices = speechSynthesis.getVoices()
        console.log(`🎵 Browser TTS - Available voices: ${voices.length}`)
        
        if (voices.length === 0) {
          // Voices not loaded yet, use default voice
          console.log('🎵 Browser TTS - No voices loaded, using default')
          return
        }

        const languageCode = getBrowserLanguageCode(language)
        const languageVoice = voices.find(voice => voice.lang.startsWith(languageCode))
        if (languageVoice) {
          utterance.voice = languageVoice
          console.log(`🎵 Browser TTS - Selected voice: ${languageVoice.name} (${languageVoice.lang})`)
        } else {
          console.log(`🎵 Browser TTS - No voice found for ${languageCode}, using default`)
        }
      }

      // Try to select voice immediately
      selectVoice()

      // If voices aren't loaded yet, wait for them (with timeout for mobile)
      if (speechSynthesis.getVoices().length === 0) {
        console.log('🎵 Browser TTS - Waiting for voices to load...')
        
        let voiceTimeout: NodeJS.Timeout | null = null
        
        const handleVoicesChanged = () => {
          console.log('🎵 Browser TTS - Voices changed event fired')
          selectVoice()
          speechSynthesis.removeEventListener('voiceschanged', handleVoicesChanged)
          if (voiceTimeout) {
            clearTimeout(voiceTimeout)
            voiceTimeout = null
          }
        }
        
        speechSynthesis.addEventListener('voiceschanged', handleVoicesChanged)
        
        // Set timeout for mobile browsers that might not fire the event
        if (isMobile()) {
          voiceTimeout = setTimeout(() => {
            console.log('🎵 Browser TTS - Voice loading timeout, proceeding with default')
            speechSynthesis.removeEventListener('voiceschanged', handleVoicesChanged)
            selectVoice() // Try once more
          }, 1000)
        }
      }

      utterance.onstart = () => {
        console.log('🎵 Browser TTS - Speech started')
        setIsLoading(false)
        setIsPlaying(true)
      }

      utterance.onend = () => {
        console.log('🎵 Browser TTS - Speech ended')
        setIsPlaying(false)
        setIsPaused(false)
        speechUtteranceRef.current = null
        resolve()
      }

      utterance.onerror = (event) => {
        console.error('🎵 Browser TTS - Speech error:', event.error)
        setIsLoading(false)
        setIsPlaying(false)
        setIsPaused(false)
        speechUtteranceRef.current = null
        reject(new Error(`Speech synthesis error: ${event.error}`))
      }

      // Add some basic utterance settings for better quality
      // Mobile browsers might be more sensitive to these settings
      if (isMobile()) {
        utterance.rate = 0.85 // Slower for mobile for better reliability
        utterance.volume = 1.0
        utterance.pitch = 1.0
        console.log('🎵 Browser TTS - Applied mobile-optimized settings')
      } else {
        utterance.rate = 0.9 // Slightly slower for better comprehension
        utterance.volume = 1.0
        utterance.pitch = 1.0
      }

      console.log('🎵 Browser TTS - Starting speech utterance')
      try {
        speechSynthesis.speak(utterance)
      } catch (speakError) {
        console.error('🎵 Browser TTS - Error starting speech:', speakError)
        setIsLoading(false)
        setIsPlaying(false)
        setIsPaused(false)
        speechUtteranceRef.current = null
        reject(speakError)
      }
    })
  }, [language])

  const speak = useCallback(async (text: string) => {
    console.log('🎵 TTS Hook - Starting speak request, text length:', text.length)
    
    stop() // Stop any current playback
    setIsLoading(true)
    
    console.log('🎵 TTS Hook - State set to loading')
    
    // Initialize AudioContext on user gesture for mobile compatibility
    if (!audioContextInitializedRef.current && userGestureRequiredRef.current) {
      console.log('🎵 TTS Hook - Initializing AudioContext on user gesture')
      await initializeAudioContext()
    }

    try {
      // Try Google TTS first for better quality if API key is available
      if (apiKey) {
        console.log('🎵 TTS Hook - Using Google TTS')
        await speakWithGoogleTTS(text)
      } else {
        console.log('🎵 TTS Hook - Using Browser TTS')
        // Fallback to browser API if no API key
        await speakWithBrowserAPI(text)
      }
      console.log('🎵 TTS Hook - Speech completed successfully')
    } catch (error) {
      console.warn("🎵 TTS Hook - Primary TTS failed:", error)
      
      try {
        // Fallback: if Google TTS failed, try browser API
        if (apiKey) {
          console.log("🎵 TTS Hook - Falling back to browser TTS...")
          await speakWithBrowserAPI(text)
        } else {
          // If browser API was primary and failed, no fallback available
          throw error
        }
      } catch (fallbackError) {
        console.error("🎵 TTS Hook - Both TTS methods failed:", fallbackError)
        setIsLoading(false)
        setIsPlaying(false)
        setIsPaused(false)
        throw fallbackError
      }
    }
  }, [apiKey, speakWithGoogleTTS, speakWithBrowserAPI, stop, initializeAudioContext])

  return {
    isPlaying,
    isPaused,
    isLoading,
    progress,
    duration,
    currentTime,
    audioData,
    speak,
    pause,
    resume,
    stop
  }
}