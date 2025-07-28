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

// Mobile browser detection
const isMobile = () => {
  if (typeof window === 'undefined') return false
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
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
  
  // Main method to synthesize speech using Google TTS
  async synthesizeSpeech(text: string, isRetry: boolean = false): Promise<TTSServiceResponse> {
    if (!this.config.apiKey) {
      throw new Error("Google Text-to-Speech API key is required")
    }

    const voiceConfig = isRetry ? getFallbackLanguageConfig(this.config.language) : getLanguageConfig(this.config.language)
    const isStudioVoice = voiceConfig.name.includes('Studio')
    
    console.log(`🎵 TTS Service - Using voice: ${voiceConfig.name} (${voiceConfig.languageCode})`)
    
    // Preprocess text into professional SSML
    const ssmlText = preprocessTextToSSML(text, voiceConfig.name, this.config.language)
    
    // Handle Studio voice chunking if needed
    const textChunks = isStudioVoice ? chunkTextForStudio(text) : [text]
    const audioUrls: string[] = []
    let totalDuration = 0
    
    console.log(`🎵 TTS Service - Processing ${textChunks.length} chunk(s)`)
    
    for (let i = 0; i < textChunks.length; i++) {
      const chunk = textChunks[i]
      const chunkSSML = textChunks.length > 1 
        ? preprocessTextToSSML(chunk, voiceConfig.name, this.config.language)
        : ssmlText
      
      console.log(`🎵 TTS Service - Making API request for chunk ${i + 1}/${textChunks.length}`)
      
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
        
        console.log(`🎵 TTS Service - API response status: ${response.status}`)

        if (!response.ok) {
          const errorText = await response.text()
          console.error('🎵 TTS Service - API error details:', errorText)
          
          // Try fallback voice if this is first attempt and it's a voice-related error
          if (!isRetry && (response.status === 400 || response.status === 404)) {
            console.log('🎵 TTS Service - Trying fallback voice...')
            return await this.synthesizeSpeech(text, true)
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

    console.log(`🎵 TTS Service - Successfully synthesized ${audioUrls.length} audio chunks`)
    
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
  isMobile 
}