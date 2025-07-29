import { TTSConfig } from '@/store/ttsSlice'

// Professional broadcast voices optimized for news/authoritative delivery
const getLanguageConfig = (language: string) => {
  switch (language) {
    case 'en':
      return {
        languageCode: 'en-US',
        name: 'en-US-Studio-O', // Studio tier for broadcast/news narration
        ssmlGender: 'FEMALE'
      }
    case 'zh-TW': // Traditional Chinese (Cantonese) - Using male voice
      return {
        languageCode: 'yue-HK',
        name: 'yue-HK-Standard-B', // Male Cantonese voice
        ssmlGender: 'MALE'
      }
    case 'zh-CN': // Simplified Chinese (Mandarin) - Using correct language code
      return {
        languageCode: 'cmn-CN',
        name: 'cmn-CN-Wavenet-A', // Premium Wavenet voice for Mainland Chinese
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

// Enhanced fallback voices with premium alternatives
const getFallbackLanguageConfig = (language: string) => {
  switch (language) {
    case 'en':
      return {
        languageCode: 'en-US',
        name: 'en-US-Neural2-C', // Neural2 fallback instead of News-L
        ssmlGender: 'FEMALE'
      }
    case 'zh-TW':
      return {
        languageCode: 'yue-HK',
        name: 'yue-HK-Standard-D', // Alternative male Cantonese voice
        ssmlGender: 'MALE'
      }
    case 'zh-CN':
      return {
        languageCode: 'cmn-CN',
        name: 'cmn-CN-Wavenet-B', // Alternative premium Wavenet voice
        ssmlGender: 'MALE'
      }
    default:
      return {
        languageCode: 'en-US',
        name: 'en-US-Neural2-C',
        ssmlGender: 'FEMALE'
      }
  }
}

// Final fallback for basic compatibility
const getBasicFallbackConfig = (language: string) => {
  switch (language) {
    case 'en':
      return {
        languageCode: 'en-US',
        name: 'en-US-Standard-C',
        ssmlGender: 'FEMALE'
      }
    case 'zh-TW':
      return {
        languageCode: 'yue-HK',
        name: 'yue-HK-Standard-C', // Female Cantonese voice as final fallback
        ssmlGender: 'FEMALE'
      }
    case 'zh-CN':
      return {
        languageCode: 'cmn-CN',
        name: 'cmn-CN-Standard-A', // Basic fallback for compatibility
        ssmlGender: 'FEMALE'
      }
    default:
      return {
        languageCode: 'en-US',
        name: 'en-US-Standard-C',
        ssmlGender: 'FEMALE'
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

// Enhanced SSML preprocessing for professional news broadcast delivery
const preprocessTextToSSML = (text: string, voiceName: string, language: string): string => {
  // Clean HTML tags and normalize whitespace
  let cleanText = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  
  // Remove common article artifacts
  cleanText = cleanText.replace(/^(By\s+[\w\s]+\||\w+\s+\w+\s+\|\s*)/i, '') // Remove bylines
  cleanText = cleanText.replace(/\(Photo[^)]*\)/gi, '') // Remove photo captions
  cleanText = cleanText.replace(/\[Advertisement\]/gi, '') // Remove ad markers
  
  // Enhanced AI-enhanced article structure cleanup
  // Remove section headers with better patterns for all three languages
  const sectionHeaders = {
    en: /^(Summary|Key Points|What it matters|Breaking|Update|Analysis)[\s]*:?[\s]*/gmi,
    zhTW: /^(摘要|重點|為什麼重要|突發|更新|分析)[\s]*:?[\s]*/gmi,
    zhCN: /^(摘要|要点|为什么重要|突发|更新|分析)[\s]*:?[\s]*/gmi
  }
  
  Object.values(sectionHeaders).forEach(pattern => {
    cleanText = cleanText.replace(pattern, '')
  })
  
  // Remove numbered citations and references
  cleanText = cleanText.replace(/\[\d+\]/g, '') // [1], [2], etc.
  cleanText = cleanText.replace(/\(Source:.*?\)/gi, '') // Source attribution
  
  // Remove formatting artifacts
  cleanText = cleanText.replace(/\*+/g, '') // Asterisks
  cleanText = cleanText.replace(/#+/g, '') // Hash marks
  cleanText = cleanText.replace(/_{2,}/g, '') // Multiple underscores
  
  // Enhanced whitespace normalization
  cleanText = cleanText.replace(/\n\s*\n\s*\n/g, '\n\n') // Triple+ line breaks to double
  cleanText = cleanText.replace(/\n\s*\n/g, '. ') // Double line breaks to sentence breaks
  cleanText = cleanText.replace(/\s+/g, ' ').trim() // Normalize whitespace
  
  // Split into sentences with improved pattern for multi-language support
  const sentencePattern = language.startsWith('zh') 
    ? /(?<=[。！？])\s*|(?<=[.!?])\s+/ // Chinese and English punctuation
    : /(?<=[.!?])\s+/ // English only
  const sentences = cleanText.split(sentencePattern).filter(s => s.trim().length > 0)
  
  // Enhanced voice capability detection
  const isStudioVoice = voiceName.includes('Studio')
  const isNeural2Voice = voiceName.includes('Neural2')
  const isChirpVoice = voiceName.includes('Chirp')
  
  // Enhanced sentence processing with professional SSML markup
  const processedSentences = sentences.map((sentence, index) => {
    let processed = sentence.trim()
    
    // Enhanced number and financial emphasis for news content
    if (!isStudioVoice && !isChirpVoice) { // Studio and Chirp voices handle emphasis differently
      // Financial amounts with better pattern matching
      processed = processed.replace(/(\$[\d,]+(?:\.\d+)?(?:\s*(?:billion|million|thousand|万|億|万亿))?)/gi, 
        '<emphasis level="moderate">$1</emphasis>')
      // Percentages and statistics
      processed = processed.replace(/(\d+(?:\.\d+)?(?:\s*(?:percent|%|％)))/gi, 
        '<emphasis level="moderate">$1</emphasis>')
      // Dates and times for better clarity
      processed = processed.replace(/(\d{1,2}:\d{2}(?:\s*(?:AM|PM|am|pm))?)/gi,
        '<emphasis level="moderate">$1</emphasis>')
      processed = processed.replace(/(\d{4}年\d{1,2}月\d{1,2}日|\d{1,2}\/\d{1,2}\/\d{4})/gi,
        '<emphasis level="moderate">$1</emphasis>')
    }
    
    // Language-specific pronunciation improvements
    if (language === 'zh-TW' || language === 'en') {
      // Hong Kong specific terms
      processed = processed.replace(/\bLegCo\b/g, '<sub alias="Legislative Council">LegCo</sub>')
      processed = processed.replace(/\bCE\b/g, '<sub alias="Chief Executive">CE</sub>')
      processed = processed.replace(/\bHK\b/g, '<sub alias="Hong Kong">HK</sub>')
      processed = processed.replace(/\bHKD\b/g, '<sub alias="Hong Kong Dollars">HKD</sub>')
      processed = processed.replace(/\bMTR\b/g, '<sub alias="Mass Transit Railway">MTR</sub>')
    }
    
    if (language === 'zh-CN') {
      // Mainland China specific terms
      processed = processed.replace(/\bRMB\b/g, '<sub alias="人民币">RMB</sub>')
      processed = processed.replace(/\bCCP\b/g, '<sub alias="中国共产党">CCP</sub>')
    }
    
    // Enhanced emotional tone for premium voices
    if (isNeural2Voice || isChirpVoice) {
      if (language === 'en') {
        // Authoritative statements
        if (/\b(announced|declared|confirmed|stated)\b/i.test(processed)) {
          processed = `<prosody rate="0.95" pitch="-1st">${processed}</prosody>`
        }
        // Urgent/breaking news tone
        if (/\b(breaking|urgent|alert|warning)\b/i.test(processed)) {
          processed = `<prosody rate="1.1" pitch="+1st">${processed}</prosody>`
        }
      }
    }
    
    // Add appropriate pauses for sentence structure
    const pauseDuration = index === 0 ? '300ms' : '400ms' // Shorter pause for first sentence
    return `<p><break time="${pauseDuration}"/>${processed}</p>`
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
  
  // Get optimal speaking rate for news delivery by language and voice type
  private getOptimalSpeakingRate(language: string, isStudioVoice: boolean): number {
    const baseRate = isStudioVoice ? 1.0 : 1.05 // Studio voices work best at normal rate
    
    switch (language) {
      case 'en':
        return baseRate // English news anchor pace
      case 'zh-TW': // Cantonese needs slower rate for tonal clarity and naturalness
        return baseRate * 0.90 // Slower for better Cantonese pronunciation
      case 'zh-CN': // Mandarin optimal pace
        return baseRate * 0.98
      default:
        return baseRate
    }
  }
  
  // Get optimal pitch for professional news delivery
  private getOptimalPitch(language: string, gender: string): number {
    const isFemale = gender.toUpperCase() === 'FEMALE'
    
    switch (language) {
      case 'en':
        return isFemale ? -0.8 : -1.2 // Professional authority range
      case 'zh-TW': // Cantonese tonal considerations
        return isFemale ? -0.6 : -1.0 // Less pitch adjustment for tonal languages
      case 'zh-CN': // Mandarin tonal considerations  
        return isFemale ? -0.7 : -1.1
      default:
        return isFemale ? -0.8 : -1.2
    }
  }
  
  // Main method to synthesize speech using Google TTS with enhanced fallback
  async synthesizeSpeech(text: string, fallbackLevel: number = 0): Promise<TTSServiceResponse> {
    if (!this.config.apiKey) {
      throw new Error("Google Text-to-Speech API key is required")
    }

    // Enhanced fallback system: Primary -> Premium Fallback -> Basic Fallback
    let voiceConfig
    switch (fallbackLevel) {
      case 0:
        voiceConfig = getLanguageConfig(this.config.language)
        break
      case 1:
        voiceConfig = getFallbackLanguageConfig(this.config.language)
        break
      case 2:
        voiceConfig = getBasicFallbackConfig(this.config.language)
        break
      default:
        throw new Error('All voice options exhausted')
    }
    
    const isStudioVoice = voiceConfig.name.includes('Studio')
    const isNeural2Voice = voiceConfig.name.includes('Neural2')
    
    
    // Preprocess text into professional SSML
    const ssmlText = preprocessTextToSSML(text, voiceConfig.name, this.config.language)
    
    // Handle Studio voice chunking if needed
    const textChunks = isStudioVoice ? chunkTextForStudio(text) : [text]
    const audioUrls: string[] = []
    let totalDuration = 0
    
    
    for (let i = 0; i < textChunks.length; i++) {
      const chunk = textChunks[i]
      const chunkSSML = textChunks.length > 1 
        ? preprocessTextToSSML(chunk, voiceConfig.name, this.config.language)
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
              // Professional news-anchor quality audio settings
              sampleRateHertz: 48000, // High quality for all devices
              speakingRate: this.getOptimalSpeakingRate(this.config.language, isStudioVoice),
              pitch: this.getOptimalPitch(this.config.language, voiceConfig.ssmlGender),
              volumeGainDb: 0.0,
              effectsProfileId: ['large-home-entertainment-class-device'] // Studio quality for all
            }
          })
        })
        

        if (!response.ok) {
          const errorText = await response.text()
          console.error('🎵 TTS Service - API error details:', errorText)
          
          // Enhanced fallback system - try next tier if voice-related error
          if (fallbackLevel < 2 && (response.status === 400 || response.status === 404)) {
            console.warn(`🎵 TTS Service - Voice tier ${fallbackLevel} failed, trying fallback tier ${fallbackLevel + 1}`)
            return await this.synthesizeSpeech(text, fallbackLevel + 1)
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
        
        // Estimate duration (rough calculation based on text length and speaking rate)
        const estimatedDuration = chunk.length * 0.08 // ~80ms per character
        totalDuration += estimatedDuration
        
      } catch (error) {
        console.error(`🎵 TTS Service - Chunk ${i + 1} failed:`, error)
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
        console.warn('🎵 TTS Service - Failed to revoke URL:', url, error)
      }
    })
  }
  
  // Validate TTS configuration
  static validateConfig(config: TTSConfig): boolean {
    if (!config.apiKey) {
      console.warn('🎵 TTS Service - No API key provided')
      return false
    }
    
    if (!['en', 'zh-TW', 'zh-CN'].includes(config.language)) {
      console.warn('🎵 TTS Service - Unsupported language:', config.language)
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
    const primary = getLanguageConfig(language)
    const fallback = getFallbackLanguageConfig(language)
    
    return {
      primary,
      fallback,
      isStudioVoice: primary.name.includes('Studio'),
      isNeural2Voice: primary.name.includes('Neural2'),
      supportsSSML: !primary.name.includes('Studio') // Studio voices have limited SSML support
    }
  }
}

// Export utility functions for use in other services
export { 
  preprocessTextToSSML, 
  chunkTextForStudio, 
  getLanguageConfig, 
  getFallbackLanguageConfig,
  getBasicFallbackConfig,
  getDeviceInfo 
}