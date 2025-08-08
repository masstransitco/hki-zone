import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { googleCloudTTSService } from '@/lib/google-cloud-tts'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Missing Supabase environment variables')
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const briefId = params.id
    console.log(`🔍 Checking expanded content TTS status for brief ${briefId}`)

    // 1. Get the news brief with TTS operation info
    const { data: brief, error: briefError } = await supabase
      .from('news_briefs')
      .select('*')
      .eq('id', briefId)
      .single()

    if (briefError || !brief) {
      return NextResponse.json({
        error: 'Brief not found',
        details: briefError?.message
      }, { status: 404 })
    }

    if (!brief.expanded_tts_operation) {
      return NextResponse.json({
        error: 'No expanded content TTS operation found',
        details: 'No synthesis operation has been started for this brief'
      }, { status: 400 })
    }

    console.log(`🎙️ Checking operation: ${brief.expanded_tts_operation}`)

    // 2. Check the status with Google Cloud TTS
    const statusResult = await googleCloudTTSService.checkOperationStatus(
      brief.expanded_tts_operation,
      brief.expanded_tts_output_uri // Pass the expected output URI
    )

    console.log(`📊 Operation status: ${statusResult.isDone ? 'Complete' : 'In Progress'} (${statusResult.progressPercentage}%)`)

    // 3. If complete and we have an audio URL, update the database
    if (statusResult.isDone && statusResult.audioUrl && !statusResult.error) {
      console.log(`✅ TTS synthesis completed, updating database`)
      
      // Get audio metadata for duration
      const duration = brief.estimated_duration_seconds || 300 // fallback estimate
      
      const { error: updateError } = await supabase
        .from('news_briefs')
        .update({
          expanded_audio_url: statusResult.audioUrl,
          expanded_audio_duration: duration,
          tts_synthesized_at: new Date().toISOString()
        })
        .eq('id', briefId)

      if (updateError) {
        console.error('Error updating brief with audio URL:', updateError)
        return NextResponse.json({
          error: 'Failed to update brief with audio URL',
          details: updateError.message
        }, { status: 500 })
      }

      console.log(`🎵 Database updated with audio URL: ${statusResult.audioUrl}`)
    }

    return NextResponse.json({
      success: true,
      operationName: brief.expanded_tts_operation,
      isDone: statusResult.isDone,
      progressPercentage: statusResult.progressPercentage,
      audioUrl: statusResult.audioUrl,
      error: statusResult.error,
      estimatedCost: brief.expanded_tts_cost
    })

  } catch (error) {
    console.error('❌ Error checking expanded content TTS status:', error)
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}