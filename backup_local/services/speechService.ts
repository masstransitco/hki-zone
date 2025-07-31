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

// Mobile browser detection
const isMobile = () => {
  if (typeof window === 'undefined') return false
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
}

// Speech configuration interface
export interface SpeechConfig {
  language: string
  rate?: number
  pitch?: number
  volume?: number
}

// Speech service response interface
export interface SpeechServiceResponse {
  utterance: SpeechSynthesisUtterance
  isPlaying: boolean
}

// Browser Speech Synthesis Service
export class SpeechService {
  private currentUtterance: SpeechSynthesisUtterance | null = null
  private config: SpeechConfig
  private voicesLoaded: boolean = false
  private voiceLoadTimeout: NodeJS.Timeout | null = null
  
  constructor(config: SpeechConfig) {
    this.config = config
    this.initializeVoices()
  }
  
  // Initialize and load available voices
  private initializeVoices(): void {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      console.warn('🎵 Speech Service - Speech synthesis not supported')
      return
    }
    
    // Check if voices are already loaded
    const voices = speechSynthesis.getVoices()
    if (voices.length > 0) {
      this.voicesLoaded = true
      console.log(`🎵 Speech Service - ${voices.length} voices already loaded`)
      return
    }
    
    // Wait for voices to load
    const handleVoicesChanged = () => {
      const loadedVoices = speechSynthesis.getVoices()
      if (loadedVoices.length > 0) {
        this.voicesLoaded = true
        console.log(`🎵 Speech Service - ${loadedVoices.length} voices loaded`)
        speechSynthesis.removeEventListener('voiceschanged', handleVoicesChanged)
        
        if (this.voiceLoadTimeout) {
          clearTimeout(this.voiceLoadTimeout)
          this.voiceLoadTimeout = null
        }
      }
    }
    
    speechSynthesis.addEventListener('voiceschanged', handleVoicesChanged)
    
    // Set timeout for mobile browsers that might not fire the event
    if (isMobile()) {
      this.voiceLoadTimeout = setTimeout(() => {
        console.log('🎵 Speech Service - Voice loading timeout, proceeding with available voices')
        speechSynthesis.removeEventListener('voiceschanged', handleVoicesChanged)
        this.voicesLoaded = true
      }, 1000)
    }
  }
  
  // Get the best available voice for the current language
  private selectVoice(): SpeechSynthesisVoice | null {
    if (!this.voicesLoaded) {
      console.log('🎵 Speech Service - Voices not loaded yet, using default')
      return null
    }
    
    const voices = speechSynthesis.getVoices()
    if (voices.length === 0) {
      console.log('🎵 Speech Service - No voices available')
      return null
    }
    
    const languageCode = getBrowserLanguageCode(this.config.language)
    
    // Try to find exact language match
    let voice = voices.find(v => v.lang === languageCode)
    if (voice) {
      console.log(`🎵 Speech Service - Selected exact match voice: ${voice.name} (${voice.lang})`)
      return voice
    }
    
    // Try to find language prefix match (e.g., 'en' matches 'en-US')
    const langPrefix = languageCode.split('-')[0]
    voice = voices.find(v => v.lang.startsWith(langPrefix))
    if (voice) {
      console.log(`🎵 Speech Service - Selected prefix match voice: ${voice.name} (${voice.lang})`)
      return voice
    }
    
    // Fallback to first available voice
    voice = voices[0]
    console.log(`🎵 Speech Service - Using fallback voice: ${voice.name} (${voice.lang})`)
    return voice
  }
  
  // Create and configure speech utterance
  private createUtterance(text: string): SpeechSynthesisUtterance {
    const utterance = new SpeechSynthesisUtterance(text)
    
    // Set language
    utterance.lang = getBrowserLanguageCode(this.config.language)
    
    // Set voice
    const selectedVoice = this.selectVoice()
    if (selectedVoice) {
      utterance.voice = selectedVoice
    }
    
    // Configure speech parameters based on device
    if (isMobile()) {
      // Mobile-optimized settings for better reliability
      utterance.rate = this.config.rate || 0.85 // Slower for mobile
      utterance.volume = this.config.volume || 1.0
      utterance.pitch = this.config.pitch || 1.0
      console.log('🎵 Speech Service - Applied mobile-optimized settings')
    } else {
      // Desktop settings
      utterance.rate = this.config.rate || 0.9 // Slightly slower for better comprehension
      utterance.volume = this.config.volume || 1.0
      utterance.pitch = this.config.pitch || 1.0
    }
    
    console.log('🎵 Speech Service - Created utterance with settings:', {
      lang: utterance.lang,
      rate: utterance.rate,
      volume: utterance.volume,
      pitch: utterance.pitch,
      voice: utterance.voice?.name || 'default'
    })
    
    return utterance
  }
  
  // Main method to speak text using browser API
  async speak(text: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (!window.speechSynthesis) {
        reject(new Error("Speech synthesis not supported"))
        return
      }

      console.log('🎵 Speech Service - Starting speech synthesis')
      
      // On some mobile browsers, we need to cancel any existing utterances first
      if (isMobile()) {
        try {
          speechSynthesis.cancel()
          console.log('🎵 Speech Service - Cancelled any existing utterances (mobile)')
        } catch (cancelError) {
          console.warn('🎵 Speech Service - Error cancelling existing utterances:', cancelError)
        }
      }

      // Create utterance
      const utterance = this.createUtterance(text)
      this.currentUtterance = utterance

      // Set up event handlers
      utterance.onstart = () => {
        console.log('🎵 Speech Service - Speech started')
      }

      utterance.onend = () => {
        console.log('🎵 Speech Service - Speech ended')
        this.currentUtterance = null
        resolve()
      }

      utterance.onerror = (event) => {
        console.error('🎵 Speech Service - Speech error:', event.error)
        this.currentUtterance = null
        reject(new Error(`Speech synthesis error: ${event.error}`))
      }

      utterance.onpause = () => {
        console.log('🎵 Speech Service - Speech paused')
      }

      utterance.onresume = () => {
        console.log('🎵 Speech Service - Speech resumed')
      }

      // Start speech synthesis
      console.log('🎵 Speech Service - Starting speech utterance')
      try {
        speechSynthesis.speak(utterance)
      } catch (speakError) {
        console.error('🎵 Speech Service - Error starting speech:', speakError)
        this.currentUtterance = null
        reject(speakError)
      }
    })
  }
  
  // Pause current speech
  pause(): boolean {
    if (!window.speechSynthesis) {
      console.warn('🎵 Speech Service - Speech synthesis not supported')
      return false
    }
    
    if (speechSynthesis.speaking && !speechSynthesis.paused) {
      console.log('🎵 Speech Service - Pausing speech synthesis')
      try {
        speechSynthesis.pause()
        return true
      } catch (error) {
        console.error('🎵 Speech Service - Error pausing speech:', error)
        return false
      }
    } else {
      console.warn('🎵 Speech Service - No active speech to pause')
      return false
    }
  }
  
  // Resume paused speech
  resume(): boolean {
    if (!window.speechSynthesis) {
      console.warn('🎵 Speech Service - Speech synthesis not supported')
      return false
    }
    
    if (speechSynthesis.paused) {
      console.log('🎵 Speech Service - Resuming speech synthesis')
      try {
        speechSynthesis.resume()
        return true
      } catch (error) {
        console.error('🎵 Speech Service - Error resuming speech:', error)
        return false
      }
    } else {
      console.warn('🎵 Speech Service - No paused speech to resume')
      return false
    }
  }
  
  // Stop current speech
  stop(): boolean {
    if (!window.speechSynthesis) {
      console.warn('🎵 Speech Service - Speech synthesis not supported')
      return false
    }
    
    console.log('🎵 Speech Service - Stopping speech synthesis')
    try {
      speechSynthesis.cancel()
      this.currentUtterance = null
      return true
    } catch (error) {
      console.error('🎵 Speech Service - Error stopping speech:', error)
      return false
    }
  }
  
  // Update configuration
  updateConfig(newConfig: Partial<SpeechConfig>): void {
    this.config = { ...this.config, ...newConfig }
  }
  
  // Get current speech state
  getState() {
    return {
      isSupported: !!window.speechSynthesis,
      isPlaying: window.speechSynthesis ? speechSynthesis.speaking && !speechSynthesis.paused : false,
      isPaused: window.speechSynthesis ? speechSynthesis.paused : false,
      voicesLoaded: this.voicesLoaded,
      hasCurrentUtterance: !!this.currentUtterance,
      config: this.config
    }
  }
  
  // Get available voices for current language
  getAvailableVoices(): SpeechSynthesisVoice[] {
    if (!window.speechSynthesis || !this.voicesLoaded) {
      return []
    }
    
    const voices = speechSynthesis.getVoices()
    const languageCode = getBrowserLanguageCode(this.config.language)
    const langPrefix = languageCode.split('-')[0]
    
    // Filter voices by language
    return voices.filter(voice => 
      voice.lang === languageCode || voice.lang.startsWith(langPrefix)
    )
  }
  
  // Get all available voices
  getAllVoices(): SpeechSynthesisVoice[] {
    if (!window.speechSynthesis || !this.voicesLoaded) {
      return []
    }
    
    return speechSynthesis.getVoices()
  }
  
  // Check if speech synthesis is supported
  static isSupported(): boolean {
    return typeof window !== 'undefined' && !!window.speechSynthesis
  }
  
  // Get supported languages
  static getSupportedLanguages(): string[] {
    return ['en', 'zh-TW', 'zh-CN']
  }
  
  // Clean up resources
  cleanup(): void {
    console.log('🎵 Speech Service - Cleaning up resources')
    
    if (this.voiceLoadTimeout) {
      clearTimeout(this.voiceLoadTimeout)
      this.voiceLoadTimeout = null
    }
    
    this.stop()
    this.currentUtterance = null
  }
}

// Factory function to create SpeechService
export const createSpeechService = (config: SpeechConfig): SpeechService => {
  return new SpeechService(config)
}

// Utility functions
export const speechUtils = {
  // Clean text for better speech synthesis
  cleanTextForSpeech(text: string): string {
    // Remove HTML tags
    let cleanText = text.replace(/<[^>]*>/g, ' ')
    
    // Remove common artifacts
    cleanText = cleanText.replace(/\[Advertisement\]/gi, '')
    cleanText = cleanText.replace(/\(Photo[^)]*\)/gi, '')
    
    // Normalize whitespace
    cleanText = cleanText.replace(/\s+/g, ' ').trim()
    
    return cleanText
  },
  
  // Estimate speech duration based on text length and rate
  estimateDuration(text: string, rate: number = 1.0): number {
    // Average speaking rate is about 150-160 words per minute
    // Adjust for speech rate
    const wordsPerMinute = 155 / rate
    const wordCount = text.split(/\s+/).length
    return (wordCount / wordsPerMinute) * 60 // Return duration in seconds
  },
  
  // Check if text is suitable for speech synthesis
  isTextSuitableForSpeech(text: string): boolean {
    const cleanedText = speechUtils.cleanTextForSpeech(text)
    return cleanedText.length > 10 && cleanedText.length < 32000 // Browser limits
  }
}