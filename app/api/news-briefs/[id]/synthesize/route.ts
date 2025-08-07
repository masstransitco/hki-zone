import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { googleCloudTTSService, TTSResult, SynthesisProgress, DialogueTTSResult, DialogueSegment } from '@/lib/google-cloud-tts'
import { processBriefContentForTTS, validateTTSContent } from '@/lib/tts-text-processor'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Missing Supabase environment variables')
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

// POST: Start Long Audio TTS synthesis
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const briefId = params.id
    console.log(`🎙️ Starting Google Cloud Long Audio TTS synthesis for news brief: ${briefId}`)

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

    // Check if synthesis is already in progress
    if (brief.tts_operation_name) {
      console.log(`🔄 Synthesis already in progress for brief ${briefId}`)
      
      // Check the current status
      const progress = await googleCloudTTSService.checkOperationStatus(brief.tts_operation_name, brief.tts_output_gcs_uri)
      
      if (progress.isDone && progress.audioUrl) {
        // Operation completed since last check - update the database
        await updateBriefWithCompletedAudio(briefId, progress.audioUrl, brief)
        
        return NextResponse.json({
          success: true,
          message: 'TTS synthesis completed',
          audioUrl: progress.audioUrl,
          operationName: brief.tts_operation_name
        })
      } else if (progress.error) {
        // Operation failed - clear the operation name so it can be retried
        await supabase
          .from('news_briefs')
          .update({ tts_operation_name: null })
          .eq('id', briefId)
      } else {
        // Still in progress
        return NextResponse.json({
          success: true,
          message: 'TTS synthesis in progress',
          operationName: brief.tts_operation_name,
          progress: progress.progressPercentage,
          inProgress: true
        })
      }
    }

    console.log(`📝 Starting synthesis for: "${brief.title}" (${brief.language})`)
    console.log(`📊 Raw content length: ${brief.content.length} characters`)

    // Check if this is a dialogue-based brief - these should use individual segment synthesis
    const hasDialogueSegments = brief.dialogue_segments && Array.isArray(brief.dialogue_segments) && brief.dialogue_segments.length > 0

    if (hasDialogueSegments) {
      return NextResponse.json({
        error: 'Dialogue briefs do not support bulk synthesis',
        details: 'Please use individual segment synthesis for dialogue-based news briefs. Use the 🎙️ button for each segment in the admin interface.',
        type: 'dialogue_not_supported'
      }, { status: 400 })
    }

    console.log(`🎙️ Single-voice synthesis (legacy mode)`)
    
    // Process content for TTS (remove markdown, replace placeholders, etc.)
    const processedContent = processBriefContentForTTS(brief.content, {
      language: brief.language,
      briefType: brief.category as 'morning' | 'afternoon' | 'evening',
      preservePauses: true
    })

    console.log(`✨ Processed content length: ${processedContent.length} characters`)

    // Validate processed content
    const validation = validateTTSContent(processedContent)
    if (!validation.isValid) {
      console.warn('⚠️ TTS content validation issues:', validation.issues)
      console.log('💡 Suggestions:', validation.suggestions)
    }

    // Validate content length for Long Audio API
    if (processedContent.length > 1000000) {
      return NextResponse.json({
        error: 'Content too long for Long Audio API',
        details: `Content is ${processedContent.length} characters, maximum is 1,000,000`
      }, { status: 400 })
    }

    // Start Long Audio synthesis with processed content
    const result: TTSResult = await googleCloudTTSService.synthesizeLongAudio(
      processedContent,
      brief.language,
      briefId
    )

    if (!result.success) {
      throw new Error(result.error || 'Failed to start synthesis')
    }

    console.log(`✅ Long Audio synthesis started: ${result.operationName}`)
    console.log(`💰 Estimated cost: $${result.cost?.toFixed(6) || '0.000000'}`)

    // Store the operation name and estimated values in the database
    const estimatedDuration = googleCloudTTSService.estimateAudioDuration(processedContent, brief.language)
    
    const { error: updateError } = await supabase
      .from('news_briefs')
      .update({
        tts_operation_name: result.operationName,
        tts_output_gcs_uri: result.outputGcsUri,
        tts_synthesis_cost_usd: result.cost || 0,
        estimated_duration_seconds: estimatedDuration,
        tts_synthesis_started_at: new Date().toISOString()
      })
      .eq('id', briefId)

    if (updateError) {
      console.error('Failed to update news brief with operation info:', updateError)
      throw new Error(`Failed to update news brief: ${updateError.message}`)
    }

    return NextResponse.json({
      success: true,
      type: 'single',
      message: 'Long Audio TTS synthesis started successfully',
      operationName: result.operationName,
      estimatedCost: result.cost,
      estimatedDuration: estimatedDuration,
      inProgress: true,
      language: brief.language
    })

  } catch (error) {
    console.error('❌ Error starting TTS synthesis:', error)
    return NextResponse.json({
      error: 'Failed to start TTS synthesis',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// GET: Check synthesis status or get existing audio info
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const briefId = params.id

    // Get the news brief with audio info
    const { data: brief, error } = await supabase
      .from('news_briefs')
      .select('*')
      .eq('id', briefId)
      .single()

    if (error || !brief) {
      return NextResponse.json(
        { error: 'News brief not found' },
        { status: 404 }
      )
    }

    // If audio already exists, return the info
    if (brief.audio_url) {
      return NextResponse.json({
        success: true,
        brief: {
          id: brief.id,
          title: brief.title,
          language: brief.language,
          hasAudio: true,
          audioUrl: brief.audio_url,
          duration: brief.audio_duration_seconds,
          synthesizedAt: brief.tts_synthesized_at,
          cost: brief.tts_synthesis_cost_usd,
          fileSize: brief.audio_file_size_bytes,
          completed: true
        }
      })
    }

    // If synthesis is in progress, check status
    if (brief.tts_operation_name) {
      console.log(`🔍 Checking synthesis status for brief ${briefId}`)
      
      const progress: SynthesisProgress = await googleCloudTTSService.checkOperationStatus(brief.tts_operation_name, brief.tts_output_gcs_uri)
      
      if (progress.isDone && progress.audioUrl && !progress.error) {
        // Synthesis completed - update database
        console.log(`✅ Synthesis completed for brief ${briefId}`)
        await updateBriefWithCompletedAudio(briefId, progress.audioUrl, brief)
        
        // Get updated brief info
        const { data: updatedBrief } = await supabase
          .from('news_briefs')
          .select('*')
          .eq('id', briefId)
          .single()

        return NextResponse.json({
          success: true,
          brief: {
            id: briefId,
            title: brief.title,
            language: brief.language,
            hasAudio: true,
            audioUrl: updatedBrief?.audio_url,
            duration: updatedBrief?.audio_duration_seconds,
            synthesizedAt: updatedBrief?.tts_synthesized_at,
            cost: updatedBrief?.tts_synthesis_cost_usd,
            fileSize: updatedBrief?.audio_file_size_bytes,
            completed: true
          }
        })
      } else if (progress.error) {
        // Synthesis failed
        console.error(`❌ Synthesis failed for brief ${briefId}: ${progress.error}`)
        
        // Clear the operation name so it can be retried
        await supabase
          .from('news_briefs')
          .update({ tts_operation_name: null })
          .eq('id', briefId)

        return NextResponse.json({
          success: false,
          error: 'TTS synthesis failed',
          details: progress.error,
          operationName: brief.tts_operation_name
        }, { status: 500 })
      } else {
        // Still in progress
        return NextResponse.json({
          success: true,
          brief: {
            id: briefId,
            title: brief.title,
            language: brief.language,
            hasAudio: false,
            inProgress: true,
            operationName: brief.tts_operation_name,
            progress: progress.progressPercentage,
            startedAt: brief.tts_synthesis_started_at,
            estimatedCost: brief.tts_synthesis_cost_usd,
            estimatedDuration: brief.estimated_duration_seconds
          }
        })
      }
    }

    // No synthesis started
    return NextResponse.json({
      success: true,
      brief: {
        id: brief.id,
        title: brief.title,
        language: brief.language,
        hasAudio: false,
        completed: false,
        inProgress: false
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

// DELETE: Remove audio file and clear database fields
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const briefId = params.id

    // Get the current audio info
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

    if (!brief.audio_url && !brief.tts_operation_name) {
      return NextResponse.json(
        { error: 'No audio file or synthesis operation to delete' },
        { status: 400 }
      )
    }

    // Note: Google Cloud Storage files are managed by the Long Audio API
    // and will be cleaned up automatically. We just need to clear our database fields.

    // Clear all TTS-related fields in database
    const { error: updateError } = await supabase
      .from('news_briefs')
      .update({
        audio_url: null,
        audio_file_path: null,
        audio_duration_seconds: null,
        tts_synthesized_at: null,
        tts_synthesis_cost_usd: null,
        audio_file_size_bytes: null,
        tts_operation_name: null,
        tts_synthesis_started_at: null,
        estimated_duration_seconds: null
      })
      .eq('id', briefId)

    if (updateError) {
      throw new Error(`Failed to clear audio info: ${updateError.message}`)
    }

    console.log(`🗑️ Cleared TTS data for brief ${briefId}`)

    return NextResponse.json({
      success: true,
      message: 'Audio file references deleted successfully'
    })

  } catch (error) {
    console.error('Error deleting TTS audio:', error)
    return NextResponse.json({
      error: 'Failed to delete TTS audio',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// Helper function to update brief with completed audio
async function updateBriefWithCompletedAudio(briefId: string, audioUrl: string, brief: any) {
  try {
    // Get audio metadata if possible
    const gcsUri = brief.tts_output_gcs_uri || audioUrl
    const audioMetadata = await googleCloudTTSService.getAudioMetadata(gcsUri)
    const estimatedDuration = googleCloudTTSService.estimateAudioDuration(brief.content, brief.language)

    const { error: updateError } = await supabase
      .from('news_briefs')
      .update({
        audio_url: audioUrl,
        audio_duration_seconds: estimatedDuration, // Use estimated duration
        tts_synthesized_at: new Date().toISOString(),
        audio_file_size_bytes: audioMetadata.size || null,
        tts_operation_name: null, // Clear operation name since it's complete
        tts_synthesis_started_at: null, // Clear start time
        tts_output_gcs_uri: null // Clear the GCS URI since we now have the signed URL
      })
      .eq('id', briefId)

    if (updateError) {
      console.error('Failed to update news brief with completed audio:', updateError)
      throw updateError
    }

    console.log(`✅ Updated brief ${briefId} with completed audio: ${audioUrl}`)
  } catch (error) {
    console.error('Error updating brief with completed audio:', error)
    throw error
  }
}