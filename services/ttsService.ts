import { TTSConfig } from '@/store/ttsSlice'

// Professional broadcast voices optimized for radio news delivery
const getLanguageConfig = (language: string) => {
  switch (language) {
    case 'en':
      return {
        languageCode: 'en-US',
        name: 'en-US-Studio-Q', // Male Studio voice - authoritative radio news anchor
        ssmlGender: 'MALE'
      }
    case 'zh-TW': // Traditional Chinese (Cantonese) - Radio news voice
      return {
        languageCode: 'yue-HK',
        name: 'yue-HK-Standard-B', // Male Cantonese voice for authoritative news
        ssmlGender: 'MALE'
      }
    case 'zh-CN': // Simplified Chinese (Mandarin) - News anchor voice
      return {
        languageCode: 'cmn-CN',
        name: 'cmn-CN-Wavenet-C', // Male Wavenet voice for authoritative news
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

// Enhanced fallback voices for radio broadcast style
const getFallbackLanguageConfig = (language: string) => {
  switch (language) {
    case 'en':
      return {
        languageCode: 'en-US',
        name: 'en-US-Neural2-D', // Male Neural2 for consistent news tone
        ssmlGender: 'MALE'
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
        name: 'cmn-CN-Wavenet-B', // Alternative male Wavenet voice
        ssmlGender: 'MALE'
      }
    default:
      return {
        languageCode: 'en-US',
        name: 'en-US-Neural2-D',
        ssmlGender: 'MALE'
      }
  }
}

// Final fallback for basic compatibility - radio news style
const getBasicFallbackConfig = (language: string) => {
  switch (language) {
    case 'en':
      return {
        languageCode: 'en-US',
        name: 'en-US-Standard-D', // Male standard voice for consistency
        ssmlGender: 'MALE'
      }
    case 'zh-TW':
      return {
        languageCode: 'yue-HK',
        name: 'yue-HK-Standard-A', // Female Cantonese voice as final fallback
        ssmlGender: 'FEMALE'
      }
    case 'zh-CN':
      return {
        languageCode: 'cmn-CN',
        name: 'cmn-CN-Standard-C', // Male Mandarin voice for authoritative delivery
        ssmlGender: 'MALE'
      }
    default:
      return {
        languageCode: 'en-US',
        name: 'en-US-Standard-D',
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

// Enhanced SSML preprocessing for professional news broadcast delivery
const preprocessTextToSSML = (text: string, voiceName: string, language: string): string => {
  // Clean HTML tags and normalize whitespace
  let cleanText = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  
  // Remove common article artifacts
  cleanText = cleanText.replace(/^(By\s+[\w\s]+\||\w+\s+\w+\s+\|\s*)/i, '') // Remove bylines
  cleanText = cleanText.replace(/\(Photo[^)]*\)/gi, '') // Remove photo captions
  cleanText = cleanText.replace(/\[Advertisement\]/gi, '') // Remove ad markers
  
  // Simple and direct section header removal for radio broadcast
  // Remove the three specific section headers that appear in all articles
  // Handle them with bold markdown formatting (most common case)
  cleanText = cleanText.replace(/\*\*Summary\*\*/gi, '')
  cleanText = cleanText.replace(/\*\*Key Points\*\*/gi, '')
  cleanText = cleanText.replace(/\*\*Why It Matters\*\*/gi, '')
  
  // Handle them without markdown formatting (in case markdown was already stripped)
  cleanText = cleanText.replace(/^Summary$/gmi, '')
  cleanText = cleanText.replace(/^Key Points$/gmi, '')
  cleanText = cleanText.replace(/^Why It Matters$/gmi, '')
  
  // Handle them at the beginning of lines with optional whitespace
  cleanText = cleanText.replace(/^\s*Summary\s*$/gmi, '')
  cleanText = cleanText.replace(/^\s*Key Points\s*$/gmi, '')
  cleanText = cleanText.replace(/^\s*Why It Matters\s*$/gmi, '')
  
  // Handle them after line breaks in the middle of text
  cleanText = cleanText.replace(/\n\s*\*\*Summary\*\*\s*/gi, '\n')
  cleanText = cleanText.replace(/\n\s*\*\*Key Points\*\*\s*/gi, '\n')
  cleanText = cleanText.replace(/\n\s*\*\*Why It Matters\*\*\s*/gi, '\n')
  
  // Handle standalone headers on their own lines
  cleanText = cleanText.replace(/\nSummary\n/gi, '\n')
  cleanText = cleanText.replace(/\nKey Points\n/gi, '\n')
  cleanText = cleanText.replace(/\nWhy It Matters\n/gi, '\n')
  
  // Finance & HK units normalization - read naturally, not symbolically
  cleanText = cleanText
    // HK$ → Hong Kong dollars; keep number as digits (fast to parse for listeners)
    .replace(/HK\$\s?([\d,\.]+)\s?(bn|b|million|mn|m|k)?/gi, (_, n, u) => {
      const unit = (u || '').toLowerCase()
      const spokenUnit =
        unit.startsWith('bn') || unit === 'b' ? ' billion' :
        unit.startsWith('m') ? ' million' :
        unit === 'k' ? ' thousand' : ''
      return `Hong Kong dollars ${n}${spokenUnit}`
    })
    // % and percentage points
    .replace(/([\d.,]+)\s?%/g, '$1 percent')
    .replace(/([\d.,]+)\s?bps\b/gi, '$1 basis points')
    // Year-on-year / month-on-month
    .replace(/\bYoY\b/gi, 'year on year')
    .replace(/\bMoM\b/gi, 'month on month')
    // Dashes and ranges
    .replace(/[–—]/g, '-')                // unify
    .replace(/(\d)\s*-\s*(\d)\s*(AM|PM)/gi, '$1 to $2 $3')

  // Remove numbered citations and references
  cleanText = cleanText.replace(/\[\d+\]/g, '') // [1], [2], etc.
  cleanText = cleanText.replace(/\(Source:.*?\)/gi, '') // Source attribution
  
  // Remove formatting artifacts
  cleanText = cleanText.replace(/\*+/g, '') // Asterisks
  cleanText = cleanText.replace(/#+/g, '') // Hash marks
  cleanText = cleanText.replace(/_{2,}/g, '') // Multiple underscores
  
  // Enhanced whitespace and formatting normalization for radio broadcast
  cleanText = cleanText.replace(/\n\s*\n\s*\n/g, '\n\n') // Triple+ line breaks to double
  cleanText = cleanText.replace(/\n\s*\n/g, '. ') // Double line breaks to sentence breaks
  cleanText = cleanText.replace(/\s+/g, ' ').trim() // Normalize whitespace
  
  // Radio-specific text improvements
  // Remove common web/app interface elements that don't belong in audio
  cleanText = cleanText.replace(/\b(Read more|Continue reading|Click here|Tap to|Swipe to|Share this|Subscribe|Follow us)\b[^.]*?[.!?]/gi, '')
  cleanText = cleanText.replace(/\b(Photo|Image|Video):?\s*[^.!?]*[.!?]/gi, '') // Remove media captions
  cleanText = cleanText.replace(/\([Cc]redit:?[^)]*\)/gi, '') // Remove photo credits
  
  // Fix common abbreviations for better pronunciation
  cleanText = cleanText.replace(/\bUS\b/g, 'United States')
  cleanText = cleanText.replace(/\bUK\b/g, 'United Kingdom') 
  cleanText = cleanText.replace(/\bEU\b/g, 'European Union')
  cleanText = cleanText.replace(/\bUN\b/g, 'United Nations')
  cleanText = cleanText.replace(/\bWHO\b/g, 'World Health Organization')
  cleanText = cleanText.replace(/\bCEO\b/g, 'C E O')
  cleanText = cleanText.replace(/\bCFO\b/g, 'C F O')
  cleanText = cleanText.replace(/\bIPO\b/g, 'I P O')
  
  // Improve time/date pronunciation
  cleanText = cleanText.replace(/(\d{1,2})\/(\d{1,2})\/(\d{4})/g, '$2/$1/$3') // MM/DD/YYYY format
  cleanText = cleanText.replace(/\b(\d{1,2}):(\d{2})\s*(AM|PM)\b/gi, '$1:$2 $3')
  
  // Fix common measurement units
  cleanText = cleanText.replace(/(\d+)\s*km\b/gi, '$1 kilometers')
  cleanText = cleanText.replace(/(\d+)\s*ft\b/gi, '$1 feet')
  cleanText = cleanText.replace(/(\d+)\s*lb\b/gi, '$1 pounds')
  
  // Split into sentences with improved pattern for multi-language support
  const sentencePattern = language.startsWith('zh') 
    ? /(?<=[。！？])\s*|(?<=[.!?])\s+/ // Chinese and English punctuation
    : /(?<=[.!?])\s+/ // English only
  const sentences = cleanText.split(sentencePattern).filter(s => s.trim().length > 0)
  
  // Enhanced voice capability detection
  const isStudioVoice = voiceName.includes('Studio')
  const isNeural2Voice = voiceName.includes('Neural2')
  const isChirpVoice = voiceName.includes('Chirp')
  
  // Enhanced sentence processing with radio broadcast SSML markup
  const processedSentences = sentences.map((sentence, index) => {
    let processed = sentence.trim()
    
    // Radio-style emphasis for key information
    if (!isStudioVoice && !isChirpVoice) { // Studio and Chirp voices handle emphasis differently
      // Financial amounts with better pattern matching - more emphasis for radio
      processed = processed.replace(/(\$[\d,]+(?:\.\d+)?(?:\s*(?:billion|million|thousand|万|億|万亿))?)/gi, 
        '<emphasis level="strong">$1</emphasis>')
      // Percentages and statistics - stronger emphasis for radio clarity
      processed = processed.replace(/(\d+(?:\.\d+)?(?:\s*(?:percent|%|％)))/gi, 
        '<emphasis level="strong">$1</emphasis>')
      // Dates and times for better clarity - moderate emphasis
      processed = processed.replace(/(\d{1,2}:\d{2}(?:\s*(?:AM|PM|am|pm))?)/gi,
        '<emphasis level="moderate">$1</emphasis>')
      processed = processed.replace(/(\d{4}年\d{1,2}月\d{1,2}日|\d{1,2}\/\d{1,2}\/\d{4})/gi,
        '<emphasis level="moderate">$1</emphasis>')
      
      // Key people and organizations - radio news style
      processed = processed.replace(/\b(President|Prime Minister|CEO|Director|Minister|Secretary)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/gi,
        '<emphasis level="moderate">$1 $2</emphasis>')
      
      // Remove generic number emphasis to reduce SSML verbosity for more natural sound
      // processed = processed.replace(/\b(\d{1,3}(?:,\d{3})*(?:\.\d+)?)\b/g,
      //   '<emphasis level="reduced">$1</emphasis>')
    }
    
    // Language-specific pronunciation improvements
    if (language === 'zh-TW' || language === 'en') {
      // Hong Kong specific terms
      processed = processed.replace(/\bLegCo\b/g, '<sub alias="Legislative Council">LegCo</sub>')
      processed = processed.replace(/\bCE\b/g, '<sub alias="Chief Executive">CE</sub>')
      processed = processed.replace(/\bHK\b/g, '<sub alias="Hong Kong">HK</sub>')
      processed = processed.replace(/\bHKD\b/g, '<sub alias="Hong Kong Dollars">HKD</sub>')
      processed = processed.replace(/\bMTR\b/g, '<sub alias="Mass Transit Railway">MTR</sub>')
      
      // Additional HK institutions and acronyms for stronger consistency
      processed = processed.replace(/\bHKI\b/g, '<say-as interpret-as="characters">H K I</say-as>')
      processed = processed.replace(/\bExCo\b/g, '<sub alias="Executive Council">ExCo</sub>')
      processed = processed.replace(/\bDoJ\b/g, '<sub alias="Department of Justice">DoJ</sub>')
      processed = processed.replace(/\bHA\b/g, '<sub alias="Hospital Authority">HA</sub>')
      processed = processed.replace(/\bICAC\b/g, '<sub alias="I C A C">ICAC</sub>')
    }
    
    if (language === 'zh-CN') {
      // Mainland China specific terms
      processed = processed.replace(/\bRMB\b/g, '<sub alias="人民币">RMB</sub>')
      processed = processed.replace(/\bCCP\b/g, '<sub alias="中国共产党">CCP</sub>')
    }
    
    // Enhanced emotional tone for premium voices - radio broadcast style
    if (isNeural2Voice || isChirpVoice) {
      if (language === 'en') {
        // Breaking news emphasis with radio urgency
        if (/\b(breaking|urgent|alert|warning|developing)\b/i.test(processed)) {
          processed = `<prosody rate="1.15" pitch="+1st" volume="+3dB">${processed}</prosody>`
        }
        // Key facts and headlines - punchy delivery
        else if (index === 0 || /^(\d+\.|•|-)\s*/.test(processed)) {
          processed = `<prosody rate="1.05" pitch="+0.5st" volume="+1dB">${processed}</prosody>`
        }
        // Authoritative statements - maintain pace
        else if (/\b(announced|declared|confirmed|stated|reported)\b/i.test(processed)) {
          processed = `<prosody rate="1.0" pitch="-0.5st">${processed}</prosody>`
        }
      }
    }
    
    // Smart pauses by sentence length and punctuation for better flow
    const endPunct = /[。！？.!?]$/.test(processed)
    const longSentence = processed.length > 140
    const pauseMs =
      index === 0 ? 120 :               // snappier start
      longSentence ? 380 :
      endPunct ? 260 : 200

    // Studio voice SSML: keep it ultra-minimal - Studio voices are sensitive to markup
    if (isStudioVoice) {
      // Strip ALL advanced SSML for Studio voices to avoid synthesis issues
      processed = processed
        .replace(/<\/?emphasis[^>]*>/g, '') // Remove emphasis tags
        .replace(/<sub[^>]*>([^<]*)<\/sub>/g, '$1') // Keep content, remove sub tags
        .replace(/<prosody[^>]*>([^<]*)<\/prosody>/g, '$1') // Remove prosody tags but keep content
        .replace(/<\/?prosody[^>]*>/g, '') // Remove any remaining prosody tags
        .replace(/<say-as[^>]*>([^<]*)<\/say-as>/g, '$1') // Remove say-as tags but keep content
    }

    // Apply SSML safety escaping to processed text before wrapping
    const safeProcessed = escapeForSSML(processed)
    return `<p><s>${safeProcessed}</s><break time="${pauseMs}ms"/></p>`
  })
  
  // Join with appropriate breaks between paragraphs - radio style
  // Radio news uses minimal paragraph breaks to maintain momentum
  const ssmlContent = processedSentences.join('<break time="300ms"/>')
  
  // Structural wrapper - minimal for Studio voices, enhanced for others
  if (isStudioVoice) {
    // Studio voices: minimal wrapper, no prosody attributes that cause errors
    return `<speak>${ssmlContent}</speak>`
  } else {
    // Other voices: enhanced prosody wrapper
    return `<speak><prosody rate="1.0" pitch="+0st" volume="+1dB">${ssmlContent}</prosody></speak>`
  }
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
              // Device-aware effects profile for better timbre
              effectsProfileId: getDeviceInfo().isMobile
                ? ['handset-class-device'] // Better for phones/earbuds
                : ['large-home-entertainment-class-device'], // Better for desktop/speakers
              // Content-aware speaking rate with device considerations
              speakingRate: this.getOptimalSpeakingRate(this.config.language, isStudioVoice) * this.nudgeForContent(text),
              pitch: this.getOptimalPitch(this.config.language, voiceConfig.ssmlGender),
              volumeGainDb: 0.0, // Prevent clipping; apply gain client-side if needed
              // Let Google pick native sample rate unless required
              // sampleRateHertz: getDeviceInfo().isMobile ? 44100 : 48000
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