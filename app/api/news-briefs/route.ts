import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Missing Supabase environment variables')
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const language = searchParams.get('language') || 'en'
    const category = searchParams.get('category') // morning, afternoon, evening
    const limit = parseInt(searchParams.get('limit') || '20')
    const days = parseInt(searchParams.get('days') || '7')
    
    // Calculate date range
    const since = new Date()
    since.setDate(since.getDate() - days)
    
    let query = supabase
      .from('news_briefs')
      .select(`
        id,
        title,
        content,
        expanded_content,
        expanded_audio_url,
        expanded_audio_duration,
        expanded_tts_cost,
        expanded_tts_operation,
        expanded_tts_output_uri,
        dialogue_segments,
        tts_dialogue_operations,
        language,
        category,
        estimated_duration_seconds,
        actual_word_count,
        openai_model_used,
        generation_cost_usd,
        created_at,
        audio_url,
        audio_duration_seconds,
        tts_synthesized_at,
        tts_synthesis_cost_usd,
        audio_file_size_bytes,
        news_brief_articles!inner(
          article_id,
          inclusion_reason,
          article_weight,
          articles(
            id,
            title,
            category,
            source
          )
        )
      `)
      .eq('language', language)
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: false })
      .limit(limit)
    
    if (category) {
      query = query.eq('category', category)
    }
    
    const { data: briefs, error } = await query
    
    if (error) {
      console.error('Error fetching news briefs:', error)
      throw error
    }
    
    // Get statistics
    const { data: stats, error: statsError } = await supabase
      .from('news_briefs')
      .select('language, category, created_at')
      .gte('created_at', since.toISOString())
    
    const briefStats = stats?.reduce((acc, brief) => {
      const key = `${brief.language}_${brief.category}`
      acc[key] = (acc[key] || 0) + 1
      return acc
    }, {} as Record<string, number>) || {}
    
    return NextResponse.json({
      success: true,
      briefs: briefs || [],
      stats: {
        totalBriefs: briefs?.length || 0,
        averageDuration: briefs?.length 
          ? Math.round(briefs.reduce((sum, b) => sum + b.estimated_duration_seconds, 0) / briefs.length)
          : 0,
        byLanguageAndCategory: briefStats,
        dateRange: {
          from: since.toISOString(),
          to: new Date().toISOString(),
          days
        }
      },
      filters: {
        language,
        category,
        limit,
        days
      }
    })
    
  } catch (error) {
    console.error('Error in news briefs API:', error)
    return NextResponse.json({
      error: 'Failed to fetch news briefs',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}