"use client"

import { useState, useRef, useCallback } from "react"

interface UseTextToSpeechProps {
  apiKey?: string
  language?: string
}

interface UseTextToSpeechReturn {
  isPlaying: boolean
  isPaused: boolean
  isLoading: boolean
  speak: (text: string) => Promise<void>
  pause: () => void
  resume: () => void
  stop: () => void
}

// Language mapping for Google TTS with high-quality voices
const getLanguageConfig = (language: string) => {
  switch (language) {
    case 'en':
      return {
        languageCode: 'en-US',
        name: 'en-US-Neural2-J', // High-quality neural voice
        ssmlGender: 'MALE'
      }
    case 'zh-TW': // Traditional Chinese (Cantonese)
      return {
        languageCode: 'yue-HK',
        name: 'yue-HK-Standard-A',
        ssmlGender: 'FEMALE'
      }
    case 'zh-CN': // Simplified Chinese (Mandarin)
      return {
        languageCode: 'cmn-CN',
        name: 'cmn-CN-Wavenet-A', // High-quality Wavenet voice
        ssmlGender: 'FEMALE'
      }
    default:
      return {
        languageCode: 'en-US',
        name: 'en-US-Neural2-J',
        ssmlGender: 'MALE'
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

export function useTextToSpeech({ apiKey, language = 'en' }: UseTextToSpeechProps = {}): UseTextToSpeechReturn {
  const [isPlaying, setIsPlaying] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const speechUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null)

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      audioRef.current = null
    }
    
    if (speechUtteranceRef.current) {
      speechSynthesis.cancel()
      speechUtteranceRef.current = null
    }
    
    setIsPlaying(false)
    setIsPaused(false)
    setIsLoading(false)
  }, [])

  const pause = useCallback(() => {
    if (audioRef.current && !audioRef.current.paused) {
      audioRef.current.pause()
      setIsPaused(true)
    } else if (speechSynthesis.speaking && !speechSynthesis.paused) {
      speechSynthesis.pause()
      setIsPaused(true)
    }
  }, [])

  const resume = useCallback(() => {
    if (audioRef.current && audioRef.current.paused) {
      audioRef.current.play()
      setIsPaused(false)
    } else if (speechSynthesis.paused) {
      speechSynthesis.resume()
      setIsPaused(false)
    }
  }, [])

  const speakWithGoogleTTS = useCallback(async (text: string) => {
    if (!apiKey) {
      throw new Error("Google Text-to-Speech API key is required")
    }

    const voiceConfig = getLanguageConfig(language)

    const response = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: { text },
        voice: voiceConfig,
        audioConfig: {
          audioEncoding: 'MP3',
          speakingRate: 0.95, // Slightly slower for better comprehension
          pitch: 0.0,
          volumeGainDb: 0.0,
          sampleRateHertz: 24000, // Higher quality audio
          effectsProfileId: ['telephony-class-application'] // Optimized for speech
        }
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Google TTS API error details:', errorText)
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

    // Create and play audio
    const audio = new Audio(audioUrl)
    audioRef.current = audio

    return new Promise<void>((resolve, reject) => {
      audio.onloadeddata = () => {
        setIsLoading(false)
        setIsPlaying(true)
        audio.play().catch(reject)
      }

      audio.onended = () => {
        setIsPlaying(false)
        setIsPaused(false)
        URL.revokeObjectURL(audioUrl)
        audioRef.current = null
        resolve()
      }

      audio.onerror = () => {
        setIsLoading(false)
        setIsPlaying(false)
        setIsPaused(false)
        URL.revokeObjectURL(audioUrl)
        audioRef.current = null
        reject(new Error("Audio playback failed"))
      }
    })
  }, [apiKey, language])

  const speakWithBrowserAPI = useCallback((text: string) => {
    return new Promise<void>((resolve, reject) => {
      if (!window.speechSynthesis) {
        reject(new Error("Speech synthesis not supported"))
        return
      }

      const utterance = new SpeechSynthesisUtterance(text)
      speechUtteranceRef.current = utterance

      // Set language for browser TTS
      utterance.lang = getBrowserLanguageCode(language)

      // Voice selection with better voice loading handling
      const selectVoice = () => {
        const voices = speechSynthesis.getVoices()
        if (voices.length === 0) {
          // Voices not loaded yet, use default voice
          return
        }

        const languageCode = getBrowserLanguageCode(language)
        const languageVoice = voices.find(voice => voice.lang.startsWith(languageCode))
        if (languageVoice) {
          utterance.voice = languageVoice
        }
      }

      // Try to select voice immediately
      selectVoice()

      // If voices aren't loaded yet, wait for them
      if (speechSynthesis.getVoices().length === 0) {
        const handleVoicesChanged = () => {
          selectVoice()
          speechSynthesis.removeEventListener('voiceschanged', handleVoicesChanged)
        }
        speechSynthesis.addEventListener('voiceschanged', handleVoicesChanged)
      }

      utterance.onstart = () => {
        setIsLoading(false)
        setIsPlaying(true)
      }

      utterance.onend = () => {
        setIsPlaying(false)
        setIsPaused(false)
        speechUtteranceRef.current = null
        resolve()
      }

      utterance.onerror = (event) => {
        setIsLoading(false)
        setIsPlaying(false)
        setIsPaused(false)
        speechUtteranceRef.current = null
        reject(new Error(`Speech synthesis error: ${event.error}`))
      }

      // Add some basic utterance settings for better quality
      utterance.rate = 0.9 // Slightly slower for better comprehension
      utterance.volume = 1.0
      utterance.pitch = 1.0

      speechSynthesis.speak(utterance)
    })
  }, [language])

  const speak = useCallback(async (text: string) => {
    stop() // Stop any current playback
    setIsLoading(true)

    try {
      // Try Google TTS first for better quality if API key is available
      if (apiKey) {
        await speakWithGoogleTTS(text)
      } else {
        // Fallback to browser API if no API key
        await speakWithBrowserAPI(text)
      }
    } catch (error) {
      console.warn("Primary TTS failed:", error)
      
      try {
        // Fallback: if Google TTS failed, try browser API
        if (apiKey) {
          console.log("Falling back to browser TTS...")
          await speakWithBrowserAPI(text)
        } else {
          // If browser API was primary and failed, no fallback available
          throw error
        }
      } catch (fallbackError) {
        console.error("Both TTS methods failed:", fallbackError)
        setIsLoading(false)
        setIsPlaying(false)
        setIsPaused(false)
        throw fallbackError
      }
    }
  }, [apiKey, speakWithGoogleTTS, speakWithBrowserAPI, stop])

  return {
    isPlaying,
    isPaused,
    isLoading,
    speak,
    pause,
    resume,
    stop
  }
}