import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { googleCloudTTSService } from '@/lib/google-cloud-tts'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Missing Supabase environment variables')
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const briefId = params.id
    console.log(`🎙️ Starting expanded content TTS synthesis for brief ${briefId}`)

    // 1. Get the news brief with expanded content
    const { data: brief, error: briefError } = await supabase
      .from('news_briefs')
      .select('*')
      .eq('id', briefId)
      .single()

    if (briefError || !brief) {
      console.error('Error fetching brief:', briefError)
      return NextResponse.json({
        error: 'Brief not found',
        details: briefError?.message
      }, { status: 404 })
    }

    if (!brief.expanded_content || !Array.isArray(brief.expanded_content) || brief.expanded_content.length === 0) {
      return NextResponse.json({
        error: 'No expanded content available for synthesis',
        details: 'This brief does not have expanded content from Step 1'
      }, { status: 400 })
    }

    console.log(`📝 Found ${brief.expanded_content.length} expanded articles for synthesis`)

    // 2. Combine all expanded articles into one continuous text
    const combinedText = brief.expanded_content
      .map((article: any, index: number) => {
        // Add article separator and title for better audio flow
        const separator = index === 0 ? '' : '\n\n'
        const titlePrefix = brief.language === 'en' 
          ? `Article ${index + 1}: ${article.title}. ` 
          : brief.language === 'zh-TW'
            ? `第${index + 1}篇文章：${article.title}。`
            : `第${index + 1}篇文章：${article.title}。`
        
        return `${separator}${titlePrefix}${article.expandedContent}`
      })
      .join('')

    console.log(`📊 Combined text length: ${combinedText.length} characters`)
    console.log(`🎯 Language: ${brief.language}`)

    // 3. Estimate duration
    const estimatedDuration = googleCloudTTSService.estimateAudioDuration(combinedText, brief.language)
    console.log(`⏱️ Estimated duration: ${Math.round(estimatedDuration / 60)} minutes`)

    // 4. Start TTS synthesis using Google Cloud Long Audio API
    const synthesisResult = await googleCloudTTSService.synthesizeLongAudio(
      combinedText,
      brief.language,
      briefId
    )

    if (!synthesisResult.success) {
      console.error('TTS synthesis failed:', synthesisResult.error)
      return NextResponse.json({
        error: 'TTS synthesis failed',
        details: synthesisResult.error
      }, { status: 500 })
    }

    console.log(`✅ TTS synthesis started successfully`)
    console.log(`🔧 Operation: ${synthesisResult.operationName}`)
    console.log(`📁 Output URI: ${synthesisResult.outputGcsUri}`)
    console.log(`💰 Estimated cost: $${synthesisResult.cost?.toFixed(6)}`)

    // 5. Update the news brief with synthesis information
    const { error: updateError } = await supabase
      .from('news_briefs')
      .update({
        expanded_tts_operation: synthesisResult.operationName,
        expanded_tts_cost: synthesisResult.cost,
        tts_started_at: new Date().toISOString()
      })
      .eq('id', briefId)

    if (updateError) {
      console.error('Error updating brief with TTS info:', updateError)
      // Don't fail the request, just log the error
    }

    return NextResponse.json({
      success: true,
      operationName: synthesisResult.operationName,
      outputGcsUri: synthesisResult.outputGcsUri,
      estimatedDuration,
      estimatedCost: synthesisResult.cost,
      totalCharacters: combinedText.length,
      totalArticles: brief.expanded_content.length,
      message: 'Expanded content TTS synthesis started successfully'
    })

  } catch (error) {
    console.error('❌ Expanded content TTS synthesis failed:', error)
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}