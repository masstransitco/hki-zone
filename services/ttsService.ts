import { TTSConfig } from '@/store/ttsSlice'

// Studio voices only - highest quality for ultra-realistic TTS
const getStudioVoiceConfig = (language: string) => {
  switch (language) {
    case 'en':
      return {
        languageCode: 'en-US',
        name: 'en-US-Studio-Q', // Male Studio voice - authoritative radio news anchor
        ssmlGender: 'MALE'
      }
    case 'zh-TW': // Traditional Chinese (Cantonese) - Use best available Studio voice
      return {
        languageCode: 'yue-HK',
        name: 'yue-HK-Standard-B', // Best Cantonese voice (no Studio available for Cantonese)
        ssmlGender: 'MALE'
      }
    case 'zh-CN': // Simplified Chinese (Mandarin) - Use Studio voice if available
      return {
        languageCode: 'cmn-CN',
        name: 'cmn-CN-Wavenet-C', // Best Mandarin voice
        ssmlGender: 'MALE'
      }
    default:
      return {
        languageCode: 'en-US',
        name: 'en-US-Studio-Q',
        ssmlGender: 'MALE'
      }
  }
}

// Device detection for audio optimization
const getDeviceInfo = () => {
  if (typeof window === 'undefined') return { isMobile: false, isTablet: false, isDesktop: true }
  const userAgent = navigator.userAgent
  const isMobile = /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent)
  const isTablet = /iPad|Android(?=.*\bMobile\b)|Android(?=.*\bTablet\b)/i.test(userAgent)
  return {
    isMobile,
    isTablet,
    isDesktop: !isMobile && !isTablet
  }
}

// SSML safety utility - escape stray characters without touching SSML tags
const escapeForSSML = (s: string) =>
  s
    // ignore sequences already part of known entities
    .replace(/&(?!amp;|lt;|gt;|quot;|apos;)/g, 'and')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

// Pronunciation lexicon for HK proper nouns and tricky terms
const PRONUNCIATION_LEXICON = [
  { re: /\bTsim Sha Tsui\b/gi, studio: 'Jim Sha Jui', ipa: 'tsɪm saː tsɵy' },
  { re: /\bTsuen Wan\b/gi, studio: 'Chuen Wan', ipa: 'tsyœːn waːn' },
  { re: /\bCheung Chau\b/gi, studio: 'Cheung Chow', ipa: 'tsœːŋ tsʰɑːu' },
  { re: /\bSha Tin\b/gi, studio: 'Sha Teen', ipa: 'saː tʰin' },
  { re: /\bTai Po\b/gi, studio: 'Tie Po', ipa: 'tʰɐi poː' },
  { re: /\bYuen Long\b/gi, studio: 'Yuen Long', ipa: 'jyœːn loŋ' },
  { re: /\bTung Chung\b/gi, studio: 'Tung Chung', ipa: 'tʰʊŋ tsʰʊŋ' },
  { re: /\bHKO\b/g, studio: 'Hong Kong Observatory', ipa: null },
  { re: /\bIPCC\b/g, studio: 'I P C C', ipa: null },
  { re: /\bWTO\b/g, studio: 'W T O', ipa: null },
  { re: /\bCarrie Lam\b/gi, studio: 'Carrie Lam', ipa: 'kʰæri læm' },
  { re: /\bJohn Lee\b/gi, studio: 'John Lee', ipa: 'd͡ʒɒn liː' }
]

// Subtle randomness for natural speech rhythm
const jitter = (ms: number, index: number): number => {
  const variance = ((index * 137) % 7) - 3 // -3 to +3
  return Math.max(80, ms + variance * 7) // minimum 80ms, max variance ±21ms
}

// Studio-optimized SSML preprocessing for ultra-realistic TTS
const preprocessTextForStudio = (text: string, language: string): string => {
  // Clean HTML tags and normalize whitespace
  let cleanText = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  
  // Remove common article artifacts
  cleanText = cleanText.replace(/^(By\s+[\w\s]+\||\w+\s+\w+\s+\|\s*)/i, '') // Remove bylines
  cleanText = cleanText.replace(/\(Photo[^)]*\)/gi, '') // Remove photo captions
  cleanText = cleanText.replace(/\[Advertisement\]/gi, '') // Remove ad markers
  
  // Remove section headers (simple approach for Studio voices)
  cleanText = cleanText.replace(/\*\*(Summary|Key Points|Why It Matters)\*\*/gi, '')
  cleanText = cleanText.replace(/^(Summary|Key Points|Why It Matters)$/gmi, '')
  cleanText = cleanText.replace(/\n\s*(Summary|Key Points|Why It Matters)\s*\n/gi, '\n')
  
  // Studio-optimized text normalization (minimal processing)
  cleanText = cleanText
    // Finance normalization - simple approach for Studio voices
    .replace(/HK\$\s?([\d,\.]+)\s?(bn|b|million|mn|m|k)?/gi, (_, n, u) => {
      const unit = (u || '').toLowerCase()
      const spokenUnit =
        unit.startsWith('bn') || unit === 'b' ? ' billion' :
        unit.startsWith('m') ? ' million' :
        unit === 'k' ? ' thousand' : ''
      return language.startsWith('zh') ? `港元 ${n}${spokenUnit}` : `Hong Kong dollars ${n}${spokenUnit}`
    })
    // Simple percentage handling
    .replace(/([\d.,]+)\s?%/g, language.startsWith('zh') ? '百分之 $1' : '$1 percent')
    // Remove citations and formatting
    .replace(/\[\d+\]/g, '') // [1], [2], etc.
    .replace(/\*+/g, '') // Asterisks
    .replace(/#+/g, '') // Hash marks
    // Clean up whitespace
    .replace(/\n\s*\n/g, '. ') // Line breaks to sentence breaks
    .replace(/\s+/g, ' ').trim() // Normalize whitespace
    // Basic abbreviations
    .replace(/\bCEO\b/g, 'C E O')
    .replace(/\bHK\b/g, 'Hong Kong')
  
  // Simple sentence processing for Studio voices
  const sentences = cleanText.split(/[.!?]+/).filter(s => s.trim().length > 0)
  
  // Ultra-simple processing optimized for Studio voices
  const processedSentences = sentences.map((sentence, index) => {
    let processed = sentence.trim()
    
    // Only apply essential improvements that work with Studio voices
    // Add natural pauses with subtle jitter
    const pauseMs = jitter(index === 0 ? 150 : 250, index)
    
    return `${processed}<break time="${pauseMs}ms"/>`
  })
  
  // Join sentences with minimal breaks
  const ssmlContent = processedSentences.join(' ')
  
  // Minimal SSML wrapper for Studio voices
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

// TTS Service interface
export interface TTSServiceResponse {
  audioUrls: string[]
  totalDuration: number
  chunks: number
}

// TTS Service class
export class TTSService {
  private config: TTSConfig
  
  constructor(config: TTSConfig) {
    this.config = config
  }
  
  // Update configuration
  updateConfig(newConfig: Partial<TTSConfig>) {
    this.config = { ...this.config, ...newConfig }
  }

  // Content-aware pace nudge for better delivery
  private nudgeForContent(text: string): number {
    const digits = (text.match(/\d/g) || []).length
    const breaking = /\b(breaking|urgent|developing)\b/i.test(text)
    if (digits > 80) return 0.96 // Slower for number-heavy content
    if (breaking && text.length < 600) return 1.04 // Faster for short breaking news
    return 1.0
  }
  
  // Get optimal speaking rate for news delivery by language and voice type
  private getOptimalSpeakingRate(language: string, isStudioVoice: boolean): number {
    // Radio news broadcasts typically run at 160-180 words per minute
    // Google TTS baseline is ~150 wpm at 1.0x
    const baseRate = isStudioVoice ? 1.18 : 1.22 // Increased baseline for faster news pacing
    
    switch (language) {
      case 'en':
        return baseRate // English news anchor pace (175-185 wpm)
      case 'zh-TW': // Cantonese radio news pace - still needs clarity
        return baseRate * 0.90 // ~160-170 wpm for tonal clarity
      case 'zh-CN': // Mandarin news broadcast pace
        return baseRate * 0.93 // ~165-175 wpm
      default:
        return baseRate
    }
  }
  
  // Get optimal pitch for professional news delivery
  private getOptimalPitch(language: string, gender: string): number {
    const isFemale = gender.toUpperCase() === 'FEMALE'
    
    // Radio news broadcasts use more neutral pitch for clarity and urgency
    // Smaller shifts for Chinese languages to preserve tones
    switch (language) {
      case 'en':
        return isFemale ? -0.5 : -0.8 // Less dramatic pitch shift for radio clarity
      case 'zh-TW': // Cantonese tone preservation - reduced magnitude
        return isFemale ? -0.2 : -0.4 // Smaller shifts for better tone preservation
      case 'zh-CN': // Mandarin tone preservation - reduced magnitude
        return isFemale ? -0.3 : -0.5 // Smaller shifts for better tone preservation
      default:
        return isFemale ? -0.5 : -0.8
    }
  }
  
  // Studio-only TTS synthesis for ultra-realistic speech
  async synthesizeSpeech(text: string): Promise<TTSServiceResponse> {
    if (!this.config.apiKey) {
      throw new Error("Google Text-to-Speech API key is required")
    }

    // Use Studio voices only for highest quality
    const voiceConfig = getStudioVoiceConfig(this.config.language)
    const isStudioVoice = voiceConfig.name.includes('Studio')
    
    // Preprocess text with Studio-optimized approach
    const ssmlText = preprocessTextForStudio(text, this.config.language)
    
    // Handle Studio voice chunking if needed
    const textChunks = isStudioVoice ? chunkTextForStudio(text) : [text]
    const audioUrls: string[] = []
    let totalDuration = 0
    
    for (let i = 0; i < textChunks.length; i++) {
      const chunk = textChunks[i]
      const chunkSSML = textChunks.length > 1 
        ? preprocessTextForStudio(chunk, this.config.language)
        : ssmlText
      
      try {
        const response = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${this.config.apiKey}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            input: { ssml: chunkSSML },
            voice: voiceConfig,
            audioConfig: {
              audioEncoding: 'MP3',
              // Studio voice optimized settings
              effectsProfileId: getDeviceInfo().isMobile
                ? ['handset-class-device'] 
                : ['large-home-entertainment-class-device'],
              speakingRate: this.getOptimalSpeakingRate(this.config.language, isStudioVoice) * this.nudgeForContent(text),
              pitch: this.getOptimalPitch(this.config.language, voiceConfig.ssmlGender),
              volumeGainDb: 0.0
            }
          })
        })

        if (!response.ok) {
          const errorText = await response.text()
          console.error('TTS API error:', response.status, errorText)
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
        
        // Estimate duration (rough calculation based on text length and speaking rate)
        const estimatedDuration = chunk.length * 0.08 // ~80ms per character
        totalDuration += estimatedDuration
        
      } catch (error) {
        console.error(`TTS chunk ${i + 1} failed:`, error)
        // Clean up any successful URLs
        audioUrls.forEach(url => URL.revokeObjectURL(url))
        throw error
      }
    }

    
    return {
      audioUrls,
      totalDuration,
      chunks: audioUrls.length
    }
  }
  
  // Clean up method to revoke object URLs
  static cleanupAudioUrls(audioUrls: string[]) {
    audioUrls.forEach(url => {
      try {
        URL.revokeObjectURL(url)
      } catch (error) {
        console.warn('Failed to revoke TTS URL:', error)
      }
    })
  }
  
  // Validate TTS configuration
  static validateConfig(config: TTSConfig): boolean {
    if (!config.apiKey) {
      console.warn('TTS: No API key provided')
      return false
    }
    
    if (!['en', 'zh-TW', 'zh-CN'].includes(config.language)) {
      console.warn('TTS: Unsupported language:', config.language)
      return false
    }
    
    return true
  }
  
  // Get supported languages
  static getSupportedLanguages(): string[] {
    return ['en', 'zh-TW', 'zh-CN']
  }
  
  // Get voice information for a language
  static getVoiceInfo(language: string) {
    const primary = getStudioVoiceConfig(language)
    
    return {
      primary,
      isStudioVoice: primary.name.includes('Studio'),
      supportsSSML: !primary.name.includes('Studio') // Studio voices have limited SSML support
    }
  }
}

// Export utility functions for use in other services
export { 
  preprocessTextForStudio, 
  chunkTextForStudio, 
  getStudioVoiceConfig,
  getDeviceInfo 
}