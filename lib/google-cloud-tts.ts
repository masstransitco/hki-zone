import { TextToSpeechLongAudioSynthesizeClient } from '@google-cloud/text-to-speech'
import { Storage } from '@google-cloud/storage'

interface VoiceConfig {
  languageCode: string
  name: string
  ssmlGender: 'NEUTRAL' | 'FEMALE' | 'MALE'
}

interface DialogueSegment {
  id: string
  speaker: 'male' | 'female'
  content: string
  estimatedDuration: number
  wordCount: number
}

interface TTSResult {
  success: boolean
  operationName?: string
  outputGcsUri?: string
  audioUrl?: string
  duration?: number
  cost?: number
  error?: string
}

interface DialogueTTSResult {
  success: boolean
  segments: Array<{
    segmentId: string
    speaker: 'male' | 'female'
    operationName?: string
    outputGcsUri?: string
    audioUrl?: string
    duration?: number
    cost?: number
    error?: string
  }>
  totalCost?: number
  error?: string
}

interface SynthesisProgress {
  operationName: string
  isDone: boolean
  progressPercentage: number
  error?: string
  audioUrl?: string
}

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID!
const PROJECT_NUMBER = process.env.GOOGLE_CLOUD_PROJECT_NUMBER!
const BUCKET_NAME = process.env.GOOGLE_CLOUD_TTS_BUCKET!

if (!PROJECT_ID || !PROJECT_NUMBER || !BUCKET_NAME) {
  throw new Error('Missing required Google Cloud environment variables')
}

// Voice configurations optimized for news broadcasting
const VOICE_CONFIGS: Record<string, { male: VoiceConfig, female: VoiceConfig }> = {
  'en': {
    male: {
      languageCode: 'en-US',
      name: 'en-US-Studio-M', // Male studio voice for news
      ssmlGender: 'MALE'
    },
    female: {
      languageCode: 'en-US',
      name: 'en-US-Studio-O', // Female studio voice optimized for news reading
      ssmlGender: 'FEMALE'
    }
  },
  'zh-TW': {
    male: {
      languageCode: 'yue-HK', // Cantonese for Traditional Chinese
      name: 'yue-HK-Standard-B',
      ssmlGender: 'MALE'
    },
    female: {
      languageCode: 'yue-HK', // Cantonese for Traditional Chinese  
      name: 'yue-HK-Standard-A',
      ssmlGender: 'FEMALE'
    }
  },
  'zh-CN': {
    male: {
      languageCode: 'cmn-CN', // Mandarin for Simplified Chinese
      name: 'cmn-CN-Standard-B',
      ssmlGender: 'MALE'
    },
    female: {
      languageCode: 'cmn-CN', // Mandarin for Simplified Chinese
      name: 'cmn-CN-Standard-A',
      ssmlGender: 'FEMALE'
    }
  }
}

class GoogleCloudTTSService {
  private client: TextToSpeechLongAudioSynthesizeClient
  private storage: Storage

  constructor() {
    // Initialize the Long Audio TTS client
    this.client = new TextToSpeechLongAudioSynthesizeClient({
      keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
      projectId: PROJECT_ID
    })

    // Initialize Cloud Storage client
    this.storage = new Storage({
      keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
      projectId: PROJECT_ID
    })
  }

  /**
   * Start Long Audio synthesis for a news brief
   */
  async synthesizeLongAudio(
    text: string,
    language: string,
    briefId: string
  ): Promise<TTSResult> {
    try {
      console.log(`🎙️ Starting Long Audio TTS synthesis for brief ${briefId} in ${language}`)
      console.log(`📝 Text length: ${text.length} characters`)

      // Validate input length (up to 1MB)
      if (text.length > 1000000) {
        throw new Error(`Text too long: ${text.length} characters (max 1MB)`)
      }

      // Get voice configuration (default to female for backward compatibility)
      const voiceConfigs = VOICE_CONFIGS[language]
      if (!voiceConfigs) {
        throw new Error(`Unsupported language: ${language}`)
      }
      const voiceConfig = voiceConfigs.female // Use female voice as default

      // Generate unique filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const filename = `brief-${briefId}-${language}-${timestamp}.wav`
      const outputUri = `gs://${BUCKET_NAME}/${filename}`

      console.log(`🎯 Voice: ${voiceConfig.name} (${voiceConfig.languageCode})`)
      console.log(`📁 Output: ${outputUri}`)

      // Prepare the synthesis request
      const request = {
        parent: `projects/${PROJECT_NUMBER}/locations/global`,
        input: {
          text: text
        },
        voice: {
          languageCode: voiceConfig.languageCode,
          name: voiceConfig.name,
          ssmlGender: voiceConfig.ssmlGender
        },
        audioConfig: {
          audioEncoding: 'LINEAR16' as const,
          sampleRateHertz: 24000, // High quality audio
          effectsProfileId: ['headphone-class-device'], // Optimize for broadcast
        },
        outputGcsUri: outputUri
      }

      // Start the long-running operation
      console.log(`🚀 Submitting Long Audio synthesis request...`)
      const [operation] = await this.client.synthesizeLongAudio(request)
      
      if (!operation.name) {
        throw new Error('Failed to start synthesis operation')
      }

      console.log(`✅ Long Audio synthesis started: ${operation.name}`)

      return {
        success: true,
        operationName: operation.name,
        outputGcsUri: outputUri,
        cost: this.estimateCost(text.length, voiceConfig.name)
      }

    } catch (error) {
      console.error(`❌ Long Audio synthesis failed:`, error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Synthesize dialogue segments with appropriate male/female voices
   */
  async synthesizeDialogueSegments(
    segments: DialogueSegment[],
    language: string,
    briefId: string
  ): Promise<DialogueTTSResult> {
    try {
      console.log(`🎭 Starting dialogue TTS synthesis for brief ${briefId} in ${language}`)
      console.log(`🗣️ ${segments.length} segments (${segments.filter(s => s.speaker === 'male').length} male, ${segments.filter(s => s.speaker === 'female').length} female)`)

      // Get voice configurations
      const voiceConfigs = VOICE_CONFIGS[language]
      if (!voiceConfigs) {
        throw new Error(`Unsupported language: ${language}`)
      }

      const results: DialogueTTSResult['segments'] = []
      let totalCost = 0

      // Process each segment
      for (const segment of segments) {
        const voiceConfig = segment.speaker === 'male' ? voiceConfigs.male : voiceConfigs.female
        
        console.log(`🎙️ Processing segment ${segment.id} with ${segment.speaker} voice (${voiceConfig.name})`)

        // Validate segment length
        if (segment.content.length > 100000) { // Shorter limit for individual segments
          console.warn(`⚠️ Segment ${segment.id} is very long: ${segment.content.length} characters`)
        }

        // Generate unique filename for this segment
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
        const filename = `dialogue-${briefId}-${segment.id}-${language}-${timestamp}.wav`
        const outputUri = `gs://${BUCKET_NAME}/${filename}`

        try {
          // Prepare the synthesis request
          const request = {
            parent: `projects/${PROJECT_NUMBER}/locations/global`,
            input: {
              text: segment.content
            },
            voice: {
              languageCode: voiceConfig.languageCode,
              name: voiceConfig.name,
              ssmlGender: voiceConfig.ssmlGender
            },
            audioConfig: {
              audioEncoding: 'LINEAR16' as const,
              sampleRateHertz: 24000,
              effectsProfileId: ['headphone-class-device'],
            },
            outputGcsUri: outputUri
          }

          // Start the synthesis
          const [operation] = await this.client.synthesizeLongAudio(request)
          
          if (!operation.name) {
            throw new Error(`Failed to start synthesis for segment ${segment.id}`)
          }

          const segmentCost = this.estimateCost(segment.content.length, voiceConfig.name)
          totalCost += segmentCost

          results.push({
            segmentId: segment.id,
            speaker: segment.speaker,
            operationName: operation.name,
            outputGcsUri: outputUri,
            duration: segment.estimatedDuration,
            cost: segmentCost
          })

          console.log(`✅ Segment ${segment.id} synthesis started: ${operation.name}`)

        } catch (error) {
          console.error(`❌ Failed to synthesize segment ${segment.id}:`, error)
          results.push({
            segmentId: segment.id,
            speaker: segment.speaker,
            error: error instanceof Error ? error.message : 'Unknown error'
          })
        }

        // Small delay between requests to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      console.log(`🎯 Dialogue synthesis initiated: ${results.length} segments, $${totalCost.toFixed(6)} estimated cost`)

      return {
        success: true,
        segments: results,
        totalCost
      }

    } catch (error) {
      console.error(`❌ Dialogue synthesis failed:`, error)
      return {
        success: false,
        segments: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Check the status of a Long Audio synthesis operation
   */
  async checkOperationStatus(operationName: string, expectedGcsUri?: string): Promise<SynthesisProgress> {
    try {
      console.log(`🔍 Checking operation status: ${operationName}`)

      // Use the checkSynthesizeLongAudioProgress method
      const operation = await this.client.checkSynthesizeLongAudioProgress(operationName)
      
      const isDone = operation.done || false
      let progressPercentage = 0
      let audioUrl: string | undefined

      // Extract progress from metadata
      if (operation.metadata) {
        const metadata = operation.metadata as any
        progressPercentage = metadata.progressPercentage || 0
      }

      // If operation is complete, get the audio URL
      if (isDone && !operation.error) {
        console.log(`✅ Synthesis completed successfully`)
        console.log(`📄 Operation metadata:`, JSON.stringify(operation.metadata, null, 2))
        console.log(`📄 Operation response:`, JSON.stringify(operation.response, null, 2))
        
        // The audio file should be in the GCS bucket
        // Extract the GCS URI from the operation
        let outputUri: string | undefined
        
        // Try different ways to get the output URI
        if (operation.metadata && typeof operation.metadata === 'object') {
          const metadata = operation.metadata as any
          outputUri = metadata.outputGcsUri || metadata.output_gcs_uri
        }
        
        if (!outputUri && operation.response && typeof operation.response === 'object') {
          const response = operation.response as any
          outputUri = response.outputGcsUri || response.output_gcs_uri
        }
        
        // If we still don't have it, use the expected GCS URI if provided
        if (!outputUri && expectedGcsUri) {
          console.log(`🎯 Using expected GCS URI: ${expectedGcsUri}`)
          outputUri = expectedGcsUri
        }
        
        // Last resort: try to construct it from the original request
        if (!outputUri) {
          console.log(`⚠️ Could not find output GCS URI in operation, attempting to construct it`)
          // Extract brief ID from operation name for fallback
          const briefIdMatch = operationName.match(/brief-([^-]+)/)
          if (briefIdMatch) {
            const briefId = briefIdMatch[1]
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
            outputUri = `gs://${BUCKET_NAME}/brief-${briefId}-en-${timestamp}.wav`
          }
        }
        
        if (outputUri && typeof outputUri === 'string') {
          console.log(`📁 Found output URI: ${outputUri}`)
          try {
            audioUrl = await this.generateSignedUrl(outputUri)
            console.log(`🔗 Generated signed URL: ${audioUrl.substring(0, 100)}...`)
          } catch (urlError) {
            console.error(`❌ Failed to generate signed URL:`, urlError)
          }
        } else {
          console.error(`❌ No output GCS URI found in operation`)
        }
      }

      const result: SynthesisProgress = {
        operationName,
        isDone,
        progressPercentage,
        audioUrl
      }

      if (operation.error) {
        result.error = operation.error.message || 'Synthesis failed'
        console.error(`❌ Synthesis failed: ${result.error}`)
      }

      console.log(`📊 Progress: ${progressPercentage}% ${isDone ? '(Complete)' : '(In Progress)'}`)

      return result

    } catch (error) {
      console.error(`❌ Failed to check operation status:`, error)
      return {
        operationName,
        isDone: false,
        progressPercentage: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Generate a signed URL for accessing the audio file
   */
  private async generateSignedUrl(gcsUri: string): Promise<string> {
    try {
      // Parse the GCS URI: gs://bucket-name/file-name
      const match = gcsUri.match(/^gs:\/\/([^\/]+)\/(.+)$/)
      if (!match) {
        throw new Error(`Invalid GCS URI: ${gcsUri}`)
      }

      const [, bucketName, fileName] = match
      const bucket = this.storage.bucket(bucketName)
      const file = bucket.file(fileName)

      // Generate a signed URL valid for 24 hours
      const [signedUrl] = await file.getSignedUrl({
        action: 'read',
        expires: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
      })

      console.log(`🔗 Generated signed URL for ${fileName}`)
      return signedUrl

    } catch (error) {
      console.error(`❌ Failed to generate signed URL:`, error)
      throw error
    }
  }

  /**
   * Get audio file metadata (duration, size)
   */
  async getAudioMetadata(gcsUri: string): Promise<{ duration?: number; size?: number }> {
    try {
      const match = gcsUri.match(/^gs:\/\/([^\/]+)\/(.+)$/)
      if (!match) {
        throw new Error(`Invalid GCS URI: ${gcsUri}`)
      }

      const [, bucketName, fileName] = match
      const bucket = this.storage.bucket(bucketName)
      const file = bucket.file(fileName)

      const [metadata] = await file.getMetadata()
      
      return {
        size: metadata.size ? parseInt(metadata.size) : undefined,
        // Duration would need to be calculated from audio file analysis
        // For now, we'll estimate based on text length and speaking rate
      }

    } catch (error) {
      console.error(`❌ Failed to get audio metadata:`, error)
      return {}
    }
  }

  /**
   * Estimate synthesis cost based on character count and voice type
   */
  private estimateCost(characterCount: number, voiceName: string): number {
    // Google Cloud TTS pricing (as of 2025):
    // Standard voices: $4.00 per 1M characters
    // WaveNet voices: $16.00 per 1M characters  
    // Studio voices: $16.00 per 1M characters

    const isStudioVoice = voiceName.includes('Studio')
    const isWaveNetVoice = voiceName.includes('WaveNet')
    
    let pricePerMillion: number
    if (isStudioVoice || isWaveNetVoice) {
      pricePerMillion = 16.00
    } else {
      pricePerMillion = 4.00
    }

    return (characterCount / 1000000) * pricePerMillion
  }

  /**
   * Estimate audio duration based on text length and speaking rate
   */
  estimateAudioDuration(text: string, language: string): number {
    // Average speaking rates (words per minute)
    const speakingRates: Record<string, number> = {
      'en': 150,     // English: 150 WPM
      'zh-TW': 200,  // Cantonese: faster pace
      'zh-CN': 180   // Mandarin: moderate pace
    }

    const wpm = speakingRates[language] || 150
    const wordCount = text.split(/\s+/).length
    const durationMinutes = wordCount / wpm
    const durationSeconds = Math.round(durationMinutes * 60)

    return durationSeconds
  }

  /**
   * Clean up old audio files in the bucket
   */
  async cleanupOldFiles(maxAgeHours: number = 168): Promise<number> { // Default: 7 days
    try {
      const bucket = this.storage.bucket(BUCKET_NAME)
      const [files] = await bucket.getFiles()
      
      let deletedCount = 0
      const cutoffTime = Date.now() - (maxAgeHours * 60 * 60 * 1000)

      for (const file of files) {
        const [metadata] = await file.getMetadata()
        const createdTime = new Date(metadata.timeCreated).getTime()
        
        if (createdTime < cutoffTime) {
          await file.delete()
          deletedCount++
          console.log(`🗑️ Deleted old file: ${file.name}`)
        }
      }

      console.log(`✅ Cleanup completed: ${deletedCount} files deleted`)
      return deletedCount

    } catch (error) {
      console.error(`❌ Cleanup failed:`, error)
      return 0
    }
  }
}

// Export singleton instance
export const googleCloudTTSService = new GoogleCloudTTSService()
export type { TTSResult, SynthesisProgress, DialogueTTSResult, DialogueSegment }