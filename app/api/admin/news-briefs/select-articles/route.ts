import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Missing Supabase environment variables')
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

interface ArticleSelectionResult {
  article: any
  reason: string
  score: number
}

// Score articles based on various criteria for TTS news briefs
async function scoreArticleForTTS(article: any): Promise<number> {
  let score = 50 // Base score

  // Recent articles get higher scores
  const createdAt = new Date(article.created_at)
  const hoursAgo = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60)
  if (hoursAgo < 6) score += 20
  else if (hoursAgo < 12) score += 15
  else if (hoursAgo < 24) score += 10

  // Category-based scoring
  const categoryScores: Record<string, number> = {
    'News': 25,
    'Local': 20,
    'Politics': 15,
    'International': 15,
    'General': 10
  }
  score += categoryScores[article.category] || 5

  // Quality score from existing system
  if (article.quality_score) {
    score += Math.min(article.quality_score / 10, 10) // Max 10 points from quality
  }

  // Content length (good TTS articles have substantial content)
  const contentLength = (article.content?.length || 0) + (article.ai_summary?.length || 0)
  if (contentLength > 2000) score += 15
  else if (contentLength > 1000) score += 10
  else if (contentLength > 500) score += 5

  // AI enhancement metadata
  if (article.enhancement_metadata?.keyPoints?.length > 0) {
    score += Math.min(article.enhancement_metadata.keyPoints.length * 2, 10)
  }

  // Prefer articles with clear summaries
  if (article.ai_summary && article.ai_summary.length > 100) {
    score += 10
  }

  // Language variant bonus (prefer complete trilingual sets)
  if (article.language_variant) {
    score += 5
  }

  return Math.min(score, 100) // Cap at 100
}

async function selectArticlesForTTS(options: {
  count?: number
  language?: string
  category?: string
  hours?: number
}): Promise<ArticleSelectionResult[]> {
  const { count = 10, language, category, hours = 24 } = options

  // Get candidate articles
  const since = new Date()
  since.setHours(since.getHours() - hours)

  let query = supabase
    .from('articles')
    .select('*')
    .eq('is_ai_enhanced', true)
    .eq('selected_for_tts_brief', false) // Only articles not yet used for TTS
    .gte('created_at', since.toISOString())
    .order('created_at', { ascending: false })
    .limit(200) // Get more candidates for better selection

  if (language) {
    query = query.eq('language_variant', language)
  }

  if (category) {
    query = query.eq('category', category)
  }

  const { data: articles, error } = await query

  if (error) {
    throw new Error(`Failed to fetch articles: ${error.message}`)
  }

  if (!articles || articles.length === 0) {
    return []
  }

  // Score and rank articles
  const scoredArticles = await Promise.all(
    articles.map(async (article) => {
      const score = await scoreArticleForTTS(article)
      return {
        article,
        score,
        reason: `Scored ${score}/100 for TTS suitability`
      }
    })
  )

  // Sort by score and return top articles
  return scoredArticles
    .sort((a, b) => b.score - a.score)
    .slice(0, count)
}

async function markArticlesForTTS(articleIds: string[], reason: string): Promise<void> {
  const updates = articleIds.map(id => ({
    id,
    selected_for_tts_brief: true,
    tts_selection_metadata: {
      selected_at: new Date().toISOString(),
      selection_reason: reason,
      selected_by: 'admin_manual',
      selection_method: 'manual_selection'
    }
  }))

  for (const update of updates) {
    const { error } = await supabase
      .from('articles')
      .update({
        selected_for_tts_brief: update.selected_for_tts_brief,
        tts_selection_metadata: update.tts_selection_metadata
      })
      .eq('id', update.id)

    if (error) {
      console.error(`Failed to mark article ${update.id}:`, error)
      throw new Error(`Failed to mark article ${update.id}: ${error.message}`)
    }
  }
}

// GET: Get statistics and recommended articles for TTS selection
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const language = searchParams.get('language') || 'en'
    const category = searchParams.get('category') || ''
    const count = parseInt(searchParams.get('count') || '10')
    const hours = parseInt(searchParams.get('hours') || '24')

    console.log(`🔍 Getting TTS article selection recommendations...`)
    console.log(`   Language: ${language}, Category: ${category || 'all'}`)
    console.log(`   Count: ${count}, Hours: ${hours}`)

    // Get recommended articles
    const recommendations = await selectArticlesForTTS({
      count,
      language: language || undefined,
      category: category || undefined,
      hours
    })

    // Get current stats
    const { data: currentSelected } = await supabase
      .from('articles')
      .select('id, title, category, language_variant, tts_selection_metadata')
      .eq('selected_for_tts_brief', true)
      .gte('tts_selection_metadata->selected_at', new Date(Date.now() - hours * 60 * 60 * 1000).toISOString())

    // Get total available articles
    const { data: totalAvailable } = await supabase
      .from('articles')
      .select('id')
      .eq('is_ai_enhanced', true)
      .eq('selected_for_tts_brief', false)
      .gte('created_at', new Date(Date.now() - hours * 60 * 60 * 1000).toISOString())

    return NextResponse.json({
      success: true,
      recommendations: recommendations.map(r => ({
        id: r.article.id,
        title: r.article.title,
        category: r.article.category,
        language_variant: r.article.language_variant,
        created_at: r.article.created_at,
        source: r.article.source,
        score: r.score,
        reason: r.reason,
        content_length: (r.article.content?.length || 0) + (r.article.ai_summary?.length || 0),
        has_summary: !!r.article.ai_summary,
        quality_score: r.article.quality_score
      })),
      stats: {
        totalRecommendations: recommendations.length,
        currentlySelected: currentSelected?.length || 0,
        totalAvailable: totalAvailable?.length || 0,
        selectionCriteria: {
          language: language || 'all',
          category: category || 'all',
          hours,
          maxRecommendations: count
        }
      }
    })

  } catch (error) {
    console.error('Error getting TTS article recommendations:', error)
    return NextResponse.json({
      error: 'Failed to get TTS article recommendations',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// POST: Select and mark articles for TTS news briefs
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      action, 
      articleIds, 
      autoSelect, 
      language, 
      category, 
      count = 5,
      reason = 'Selected for TTS news brief generation'
    } = body

    console.log(`🎯 TTS Article Selection Action: ${action}`)

    switch (action) {
      case 'manual_select':
        if (!articleIds || !Array.isArray(articleIds) || articleIds.length === 0) {
          return NextResponse.json({
            error: 'Article IDs are required for manual selection'
          }, { status: 400 })
        }

        await markArticlesForTTS(articleIds, reason)

        return NextResponse.json({
          success: true,
          message: `Marked ${articleIds.length} articles for TTS news briefs`,
          selectedCount: articleIds.length,
          method: 'manual_selection',
          articleIds
        })

      case 'auto_select':
        const recommendations = await selectArticlesForTTS({
          count,
          language: language || undefined,
          category: category || undefined,
          hours: 24
        })

        if (recommendations.length === 0) {
          return NextResponse.json({
            success: true,
            message: 'No suitable articles found for automatic selection',
            selectedCount: 0,
            recommendations: []
          })
        }

        const selectedIds = recommendations.map(r => r.article.id)
        await markArticlesForTTS(selectedIds, 'Auto-selected based on TTS suitability scoring')

        return NextResponse.json({
          success: true,
          message: `Auto-selected ${recommendations.length} articles for TTS news briefs`,
          selectedCount: recommendations.length,
          method: 'auto_selection',
          articles: recommendations.map(r => ({
            id: r.article.id,
            title: r.article.title,
            category: r.article.category,
            language_variant: r.article.language_variant,
            score: r.score,
            reason: r.reason
          }))
        })

      case 'clear_selection':
        // Clear TTS selection flags for articles
        const clearLanguage = language || 'en'
        const { error: clearError } = await supabase
          .from('articles')
          .update({
            selected_for_tts_brief: false,
            tts_selection_metadata: null
          })
          .eq('selected_for_tts_brief', true)
          .eq('language_variant', clearLanguage)

        if (clearError) {
          throw clearError
        }

        return NextResponse.json({
          success: true,
          message: `Cleared TTS selection for ${clearLanguage} articles`,
          method: 'clear_selection'
        })

      default:
        return NextResponse.json({
          error: 'Invalid action. Use: manual_select, auto_select, or clear_selection'
        }, { status: 400 })
    }

  } catch (error) {
    console.error('Error in TTS article selection:', error)
    return NextResponse.json({
      error: 'Failed to process TTS article selection',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}