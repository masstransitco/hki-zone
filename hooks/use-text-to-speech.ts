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
            sampleRateHertz: 48000, // FM/streaming quality
            speakingRate: 1.05, // ≈155 wpm - energetic yet clear
            pitch: -1.0, // Slightly deeper for more gravitas
            volumeGainDb: 0.0,
            effectsProfileId: ['large-home-entertainment-class-device'] // Full-range EQ
          }
        })
      })

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

        audio.onloadeddata = () => {
          if (currentChunkIndex === 0) {
            setIsLoading(false)
            setIsPlaying(true)
          }
          audio.play().catch(reject)
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