import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { TextToSpeechClient } from '@google-cloud/text-to-speech'
import { Storage } from '@google-cloud/storage'
import { processBriefContentForTTS } from '@/lib/tts-text-processor'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Missing Supabase environment variables')
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

// POST: Synthesize individual dialogue segment
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const briefId = params.id
    const requestBody = await request.json()
    const { segmentId } = requestBody

    if (!segmentId) {
      return NextResponse.json(
        { error: 'Segment ID is required' },
        { status: 400 }
      )
    }

    console.log(`🎙️ Starting individual segment synthesis: ${segmentId} for brief ${briefId}`)

    // Get the news brief
    const { data: brief, error: briefError } = await supabase
      .from('news_briefs')
      .select('*')
      .eq('id', briefId)
      .single()

    if (briefError || !brief) {
      return NextResponse.json(
        { error: 'News brief not found' },
        { status: 404 }
      )
    }

    // Find the specific dialogue segment
    const dialogueSegments = brief.dialogue_segments || []
    const segment = dialogueSegments.find((s: any) => s.id === segmentId)

    if (!segment) {
      return NextResponse.json(
        { error: 'Dialogue segment not found' },
        { status: 404 }
      )
    }

    // Process content for TTS
    const processedContent = processBriefContentForTTS(segment.content, {
      language: brief.language,
      briefType: brief.category as 'morning' | 'afternoon' | 'evening',
      preservePauses: true
    })

    console.log(`📝 Processing segment: ${segment.speaker} voice, ${processedContent.length} chars`)

    // Initialize Google Cloud clients
    const ttsClient = new TextToSpeechClient({
      keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    })

    const storage = new Storage({
      keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    })

    // Get voice configurations
    const voiceConfigs = {
      'en': {
        male: { languageCode: 'en-US', name: 'en-US-Studio-M', ssmlGender: 'MALE' as const },
        female: { languageCode: 'en-US', name: 'en-US-Studio-O', ssmlGender: 'FEMALE' as const }
      },
      'zh-TW': {
        male: { languageCode: 'yue-HK', name: 'yue-HK-Standard-B', ssmlGender: 'MALE' as const },
        female: { languageCode: 'yue-HK', name: 'yue-HK-Standard-A', ssmlGender: 'FEMALE' as const }
      },
      'zh-CN': {
        male: { languageCode: 'cmn-CN', name: 'cmn-CN-Standard-B', ssmlGender: 'MALE' as const },
        female: { languageCode: 'cmn-CN', name: 'cmn-CN-Standard-A', ssmlGender: 'FEMALE' as const }
      }
    }

    const languageVoices = voiceConfigs[brief.language as keyof typeof voiceConfigs]
    if (!languageVoices) {
      return NextResponse.json(
        { error: `Unsupported language: ${brief.language}` },
        { status: 400 }
      )
    }

    const voiceConfig = segment.speaker === 'male' ? languageVoices.male : languageVoices.female

    // Synthesize audio using regular TTS API (synchronous)
    console.log(`🎙️ Synthesizing with voice: ${voiceConfig.name}`)
    
    const ttsRequest = {
      input: { text: processedContent },
      voice: {
        languageCode: voiceConfig.languageCode,
        name: voiceConfig.name,
        ssmlGender: voiceConfig.ssmlGender,
      },
      audioConfig: {
        audioEncoding: 'LINEAR16' as const,
        sampleRateHertz: 24000,
        effectsProfileId: ['headphone-class-device'],
      },
    }

    const [response] = await ttsClient.synthesizeSpeech(ttsRequest)
    
    if (!response.audioContent) {
      throw new Error('No audio content received from TTS')
    }

    // Upload audio to Google Cloud Storage
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filename = `dialogue-${briefId}-${segmentId}-${brief.language}-${timestamp}.wav`
    const bucket = storage.bucket(process.env.GOOGLE_CLOUD_TTS_BUCKET!)
    const file = bucket.file(filename)

    console.log(`☁️ Uploading audio to: ${filename}`)
    
    // Upload the audio content
    await file.save(response.audioContent as Buffer, {
      metadata: {
        contentType: 'audio/wav',
        metadata: {
          briefId,
          segmentId,
          speaker: segment.speaker,
          language: brief.language
        }
      }
    })

    // Generate signed URL for download
    const [signedUrl] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
    })

    // Calculate cost (rough estimate for regular TTS)
    const characterCount = processedContent.length
    const cost = Math.max(0.000016 * characterCount, 0.000001) // $16 per 1M chars, min $0.000001

    console.log(`✅ Individual segment synthesis complete: ${signedUrl}`)

    // Update the specific segment operation in the database
    let dialogueOperations = brief.tts_dialogue_operations || []
    
    // Find existing operation for this segment or create new one
    const existingOpIndex = dialogueOperations.findIndex((op: any) => op.segmentId === segmentId)
    
    const newOperation = {
      segmentId,
      speaker: segment.speaker,
      audioUrl: signedUrl,
      outputGcsUri: `gs://${process.env.GOOGLE_CLOUD_TTS_BUCKET}/${filename}`,
      duration: segment.estimatedDuration,
      cost: cost
    }

    if (existingOpIndex >= 0) {
      dialogueOperations[existingOpIndex] = newOperation
    } else {
      dialogueOperations.push(newOperation)
    }

    // Update database
    const { error: updateError } = await supabase
      .from('news_briefs')
      .update({
        tts_dialogue_operations: dialogueOperations,
        tts_started_at: new Date().toISOString()
      })
      .eq('id', briefId)

    if (updateError) {
      console.error('Failed to update dialogue operations:', updateError)
    }

    return NextResponse.json({
      success: true,
      message: `Synthesis complete for segment ${segmentId}`,
      segmentId,
      audioUrl: signedUrl,
      estimatedCost: cost,
      speaker: segment.speaker
    })

  } catch (error) {
    console.error('❌ Error synthesizing individual segment:', error)
    return NextResponse.json({
      error: 'Failed to synthesize segment',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// GET: Check individual segment synthesis status
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const briefId = params.id
    const { searchParams } = new URL(request.url)
    const segmentId = searchParams.get('segmentId')

    if (!segmentId) {
      return NextResponse.json(
        { error: 'Segment ID is required' },
        { status: 400 }
      )
    }

    // Get the news brief
    const { data: brief, error: briefError } = await supabase
      .from('news_briefs')
      .select('tts_dialogue_operations')
      .eq('id', briefId)
      .single()

    if (briefError || !brief) {
      return NextResponse.json(
        { error: 'News brief not found' },
        { status: 404 }
      )
    }

    // Find the operation for this segment
    const dialogueOperations = brief.tts_dialogue_operations || []
    const operation = dialogueOperations.find((op: any) => op.segmentId === segmentId)

    if (!operation) {
      return NextResponse.json({
        status: 'not_started',
        message: 'Synthesis not started for this segment'
      })
    }

    // Since we're using synchronous TTS, if operation exists it should be completed
    return NextResponse.json({
      status: operation.audioUrl ? 'completed' : 'not_started',
      audioUrl: operation.audioUrl,
      cost: operation.cost,
      duration: operation.duration
    })

  } catch (error) {
    console.error('❌ Error checking segment status:', error)
    return NextResponse.json({
      error: 'Failed to check segment status',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}