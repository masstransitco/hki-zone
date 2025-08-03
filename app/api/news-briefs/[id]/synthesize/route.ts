import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { TTSService, getStudioVoiceConfig } from '@/services/ttsService'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const googleTTSApiKey = process.env.NEXT_PUBLIC_GOOGLE_TEXT_TO_SPEECH_API_KEY

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Missing Supabase environment variables')
}

if (!googleTTSApiKey) {
  throw new Error('Missing Google TTS API key')
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

interface TTSSynthesisResult {
  audioContent: string
  chunks: number
  estimatedDuration: number
  synthesisTime: number
  cost: number
}

// Estimate cost based on character count and voice type
function estimateTTSCost(characterCount: number, isStudioVoice: boolean): number {
  // Google TTS pricing (as of 2024):
  // Standard voices: $4 per 1M characters
  // WaveNet voices: $16 per 1M characters  
  // Neural2/Studio voices: $16 per 1M characters
  const pricePerMillion = isStudioVoice ? 16 : 4
  return (characterCount / 1000000) * pricePerMillion
}

// Enhanced TTS synthesis specifically for news briefs
async function synthesizeNewsBrief(content: string, language: string): Promise<TTSSynthesisResult> {
  const startTime = Date.now()
  
  // Initialize TTS service with news-optimized settings
  const ttsService = new TTSService({
    apiKey: googleTTSApiKey,
    language: language,
    voice: getStudioVoiceConfig(language),
    audioConfig: {
      audioEncoding: 'MP3',
      sampleRateHertz: 24000, // High quality for archival
      speakingRate: 1.1, // Slightly faster for news delivery
      pitch: -0.5, // Professional news anchor tone
      volumeGainDb: 2.0, // Slightly boosted for clear broadcast
      effectsProfileId: ['large-home-entertainment-class-device']
    }
  })

  // Synthesize the speech
  const response = await ttsService.synthesizeSpeech(content)
  
  // Since we're dealing with blob URLs, we need to convert to base64 for storage
  // Get the first audio URL and convert it to base64
  if (response.audioUrls.length === 0) {
    throw new Error('No audio generated from TTS service')
  }

  // For multiple chunks, we'll need to concatenate them
  // For now, let's handle single chunk case
  const audioUrl = response.audioUrls[0]
  const audioResponse = await fetch(audioUrl)
  const audioBlob = await audioResponse.blob()
  const arrayBuffer = await audioBlob.arrayBuffer()
  const audioContent = Buffer.from(arrayBuffer).toString('base64')

  // Clean up blob URLs
  TTSService.cleanupAudioUrls(response.audioUrls)

  const synthesisTime = Date.now() - startTime
  const voiceInfo = TTSService.getVoiceInfo(language)
  const cost = estimateTTSCost(content.length, voiceInfo.isStudioVoice)

  return {
    audioContent,
    chunks: response.chunks,
    estimatedDuration: response.totalDuration,
    synthesisTime,
    cost
  }
}

// Upload audio to Supabase Storage
async function uploadAudioToSupabase(audioContent: string, briefId: string, language: string): Promise<{ publicUrl: string; filePath: string; fileSize: number }> {
  const audioBuffer = Buffer.from(audioContent, 'base64')
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const filePath = `news-briefs/${briefId}/audio-${language}-${timestamp}.mp3`

  const { error: uploadError } = await supabase.storage
    .from('audio-files')
    .upload(filePath, audioBuffer, {
      contentType: 'audio/mpeg',
      cacheControl: '3600',
      upsert: false,
      duplex: 'half'
    })

  if (uploadError) {
    console.error('Supabase storage upload error:', uploadError)
    throw new Error(`Failed to upload audio: ${uploadError.message}`)
  }

  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from('audio-files')
    .getPublicUrl(filePath)

  return {
    publicUrl,
    filePath,
    fileSize: audioBuffer.length
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const briefId = params.id
    console.log(`🎙️ Starting TTS synthesis for news brief: ${briefId}`)

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

    // Check if already synthesized
    if (brief.audio_url) {
      return NextResponse.json({
        success: true,
        message: 'Audio already exists for this news brief',
        audioUrl: brief.audio_url,
        synthesizedAt: brief.tts_synthesized_at,
        duration: brief.audio_duration_seconds
      })
    }

    console.log(`📝 Synthesizing TTS for: "${brief.title}" (${brief.language})`)
    console.log(`📊 Content length: ${brief.content.length} characters`)

    // Synthesize the audio
    const synthesisResult = await synthesizeNewsBrief(brief.content, brief.language)
    
    console.log(`✅ TTS synthesis completed in ${synthesisResult.synthesisTime}ms`)
    console.log(`💰 Estimated cost: $${synthesisResult.cost.toFixed(6)}`)

    // Upload to Supabase Storage
    console.log(`☁️ Uploading audio to Supabase Storage...`)
    const uploadResult = await uploadAudioToSupabase(
      synthesisResult.audioContent, 
      briefId, 
      brief.language
    )

    console.log(`✅ Audio uploaded: ${uploadResult.publicUrl}`)
    console.log(`📦 File size: ${(uploadResult.fileSize / 1024).toFixed(1)} KB`)

    // Update the news brief with audio information
    const { error: updateError } = await supabase
      .from('news_briefs')
      .update({
        audio_url: uploadResult.publicUrl,
        audio_file_path: uploadResult.filePath,
        audio_duration_seconds: Math.round(synthesisResult.estimatedDuration),
        tts_synthesized_at: new Date().toISOString(),
        tts_synthesis_cost_usd: synthesisResult.cost,
        audio_file_size_bytes: uploadResult.fileSize
      })
      .eq('id', briefId)

    if (updateError) {
      console.error('Failed to update news brief with audio info:', updateError)
      // Try to clean up uploaded file
      await supabase.storage
        .from('audio-files')
        .remove([uploadResult.filePath])
      
      throw new Error(`Failed to update news brief: ${updateError.message}`)
    }

    console.log(`✅ News brief updated with audio information`)

    return NextResponse.json({
      success: true,
      message: 'TTS synthesis completed successfully',
      audioUrl: uploadResult.publicUrl,
      duration: Math.round(synthesisResult.estimatedDuration),
      fileSize: uploadResult.fileSize,
      synthesisTime: synthesisResult.synthesisTime,
      cost: synthesisResult.cost,
      chunks: synthesisResult.chunks,
      language: brief.language,
      voiceInfo: TTSService.getVoiceInfo(brief.language)
    })

  } catch (error) {
    console.error('❌ Error in TTS synthesis:', error)
    return NextResponse.json({
      error: 'Failed to synthesize TTS audio',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const briefId = params.id

    // Get the news brief with audio info
    const { data: brief, error } = await supabase
      .from('news_briefs')
      .select('id, title, language, audio_url, audio_duration_seconds, tts_synthesized_at, tts_synthesis_cost_usd, audio_file_size_bytes')
      .eq('id', briefId)
      .single()

    if (error || !brief) {
      return NextResponse.json(
        { error: 'News brief not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      brief: {
        id: brief.id,
        title: brief.title,
        language: brief.language,
        hasAudio: !!brief.audio_url,
        audioUrl: brief.audio_url,
        duration: brief.audio_duration_seconds,
        synthesizedAt: brief.tts_synthesized_at,
        cost: brief.tts_synthesis_cost_usd,
        fileSize: brief.audio_file_size_bytes
      }
    })

  } catch (error) {
    console.error('Error getting TTS info:', error)
    return NextResponse.json({
      error: 'Failed to get TTS information',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const briefId = params.id

    // Get the current audio info
    const { data: brief, error: briefError } = await supabase
      .from('news_briefs')
      .select('audio_file_path, audio_url')
      .eq('id', briefId)
      .single()

    if (briefError || !brief) {
      return NextResponse.json(
        { error: 'News brief not found' },
        { status: 404 }
      )
    }

    if (!brief.audio_url) {
      return NextResponse.json(
        { error: 'No audio file to delete' },
        { status: 400 }
      )
    }

    // Delete from Supabase Storage
    if (brief.audio_file_path) {
      const { error: deleteError } = await supabase.storage
        .from('audio-files')
        .remove([brief.audio_file_path])

      if (deleteError) {
        console.warn('Failed to delete audio file from storage:', deleteError)
      }
    }

    // Clear audio fields in database
    const { error: updateError } = await supabase
      .from('news_briefs')
      .update({
        audio_url: null,
        audio_file_path: null,
        audio_duration_seconds: null,
        tts_synthesized_at: null,
        tts_synthesis_cost_usd: null,
        audio_file_size_bytes: null
      })
      .eq('id', briefId)

    if (updateError) {
      throw new Error(`Failed to clear audio info: ${updateError.message}`)
    }

    return NextResponse.json({
      success: true,
      message: 'Audio file deleted successfully'
    })

  } catch (error) {
    console.error('Error deleting TTS audio:', error)
    return NextResponse.json({
      error: 'Failed to delete TTS audio',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}