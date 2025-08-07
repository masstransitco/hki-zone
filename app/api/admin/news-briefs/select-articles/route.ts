import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

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

// Score articles based on simplified criteria for TTS news briefs
async function scoreArticleForTTS(article: any): Promise<number> {
  let score = 50 // Base score

  // Recent articles get higher scores
  const createdAt = new Date(article.created_at)
  const hoursAgo = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60)
  if (hoursAgo < 6) score += 20
  else if (hoursAgo < 12) score += 15
  else if (hoursAgo < 24) score += 10

  // Updated category-based scoring using actual database categories
  const categoryScores: Record<string, number> = {
    'Top Stories': 25,
    'Finance': 20,
    'Tech & Science': 18,
    'International': 15,
    'Entertainment': 12,
    'Arts & Culture': 10,
    'News': 15
  }
  score += categoryScores[article.category] || 5

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

// Find trilingual variants for selected English articles
async function findTrilingualVariants(selectedEnglishArticles: ArticleSelectionResult[]): Promise<ArticleSelectionResult[]> {
  const allVariants: ArticleSelectionResult[] = []
  
  for (const englishItem of selectedEnglishArticles) {
    const englishArticle = englishItem.article
    
    // Add the English article first
    allVariants.push(englishItem)
    
    // Find Chinese variants using trilingual_batch_id
    if (englishArticle.trilingual_batch_id) {
      const { data: variants, error } = await supabase
        .from('articles')
        .select('*')
        .eq('trilingual_batch_id', englishArticle.trilingual_batch_id)
        .in('language_variant', ['zh-CN', 'zh-TW'])
      
      if (error) {
        console.error(`Error finding variants for batch ${englishArticle.trilingual_batch_id}:`, error)
        continue
      }
      
      // Add Chinese variants
      variants?.forEach(variant => {
        allVariants.push({
          article: variant,
          score: englishItem.score, // Use same score as English version
          reason: `Trilingual variant of selected English story (${variant.language_variant})`
        })
      })
      
      console.log(`🌐 Found ${variants?.length || 0} variants for "${englishArticle.title?.substring(0, 50)}..."`)
    } else {
      console.warn(`⚠️ English article "${englishArticle.title?.substring(0, 50)}..." has no trilingual_batch_id`)
    }
  }
  
  console.log(`📊 Trilingual expansion: ${selectedEnglishArticles.length} English stories → ${allVariants.length} total articles`)
  return allVariants
}


async function selectArticlesForTTSWithAI(options: {
  count?: number
  language?: string
  category?: string
  hours?: number
}): Promise<ArticleSelectionResult[]> {
  const { count = 15, language, category, hours = 24 } = options

  console.log(`🔍 Trilingual TTS selection: targeting ${count} stories, requested language: ${language || 'all'}`)

  // Get candidate articles - ALWAYS use English for selection to ensure trilingual consistency
  const since = new Date()
  since.setHours(since.getHours() - hours)

  let query = supabase
    .from('articles')
    .select('*')
    .eq('is_ai_enhanced', true)
    .eq('selected_for_tts_brief', false)
    .eq('language_variant', 'en') // Always select from English articles
    .gte('created_at', since.toISOString())
    .order('created_at', { ascending: false })
    .limit(500)

  // Apply category filter if specified
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

  // First, score all articles using our simplified scoring
  const scoredArticles = await Promise.all(
    articles.map(async (article) => {
      const score = await scoreArticleForTTS(article)
      return {
        article,
        score,
        reason: `Initial score: ${score}/100`
      }
    })
  )

  // Group articles by category to ensure coverage
  const articlesByCategory = scoredArticles.reduce((acc, item) => {
    const cat = item.article.category || 'Uncategorized'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(item)
    return acc
  }, {} as Record<string, typeof scoredArticles>)

  // Sort each category by score
  Object.keys(articlesByCategory).forEach(cat => {
    articlesByCategory[cat].sort((a, b) => b.score - a.score)
  })

  // Use OpenAI to make final selection ensuring category coverage
  const openai = new (await import('openai')).default({ 
    apiKey: process.env.OPENAI_API_KEY 
  })

  const categoryStats = Object.keys(articlesByCategory).map(cat => ({
    category: cat,
    count: articlesByCategory[cat].length,
    topScore: articlesByCategory[cat][0]?.score || 0
  }))

  const candidateArticles = scoredArticles
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.min(50, scoredArticles.length)) // Top 50 for AI consideration

  const selectionPrompt = `You are selecting ${count} news articles for a comprehensive TTS news brief that should cover diverse categories.

Available categories and their article counts:
${categoryStats.map(c => `- ${c.category}: ${c.count} articles available`).join('\n')}

Candidate articles (with basic scores):
${candidateArticles.map((item, idx) => 
  `${idx + 1}. [${item.article.category}] "${item.article.title}" (Score: ${item.score}/100)\n   Summary: ${(item.article.ai_summary || item.article.summary || '').substring(0, 150)}...`
).join('\n\n')}

Select exactly ${count} articles that:
1. Ensure every category is represented (minimum 1 article per category if possible)
2. Prioritize recent, high-scoring articles
3. Create a balanced, comprehensive news brief
4. Avoid redundant or very similar stories

Respond with ONLY a JSON array of the article numbers (1-${candidateArticles.length}) you select. 
Do not include any markdown formatting, explanations, or code blocks.
Just return a plain JSON array like: [1, 3, 7, 12, 15, 18, 22, 25, 28, 31, 35, 38, 41, 44, 47]`

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a news editor selecting articles for a comprehensive news brief. Respond only with the requested JSON array." },
        { role: "user", content: selectionPrompt }
      ],
      temperature: 0.3,
      max_tokens: 500
    })

    const response = completion.choices[0].message.content?.trim() || '[]'
    
    // Clean up the response - remove markdown code blocks if present
    let cleanedResponse = response
    if (response.startsWith('```json')) {
      cleanedResponse = response.replace(/```json\s*/, '').replace(/\s*```$/, '')
    } else if (response.startsWith('```')) {
      cleanedResponse = response.replace(/```\s*/, '').replace(/\s*```$/, '')
    }
    
    console.log('🤖 Raw AI response:', response)
    console.log('🧹 Cleaned response:', cleanedResponse)
    
    let selectedIndices: number[]
    try {
      selectedIndices = JSON.parse(cleanedResponse) as number[]
      
      // Validate that it's actually an array of numbers
      if (!Array.isArray(selectedIndices) || !selectedIndices.every(n => typeof n === 'number')) {
        throw new Error('Response is not an array of numbers')
      }
      
      console.log('✅ Successfully parsed AI selection:', selectedIndices)
      
    } catch (parseError) {
      console.error('❌ Failed to parse AI response:', parseError)
      console.error('Raw response was:', response)
      throw new Error(`AI response parsing failed: ${parseError}`)
    }
    
    const selectedArticles = selectedIndices
      .map(idx => candidateArticles[idx - 1]) // Convert to 0-based index
      .filter(Boolean) // Remove any invalid selections
      .slice(0, count) // Ensure we don't exceed the requested count
      .map(item => ({
        ...item,
        reason: `AI-selected for comprehensive news coverage (Original score: ${item.score}/100)`
      }))

    console.log(`🤖 AI selected ${selectedArticles.length} English articles across categories:`, 
      selectedArticles.reduce((acc, item) => {
        const cat = item.article.category
        acc[cat] = (acc[cat] || 0) + 1
        return acc
      }, {} as Record<string, number>)
    )

    // Now find and include trilingual variants
    const articlesWithVariants = await findTrilingualVariants(selectedArticles)
    console.log(`🌍 Found trilingual variants: ${articlesWithVariants.length} total articles (${selectedArticles.length} stories × ~3 languages)`)

    return articlesWithVariants

  } catch (error) {
    console.error('AI selection failed, falling back to score-based selection:', error)
    
    // Fallback: ensure category coverage manually
    const selected: typeof scoredArticles = []
    const categoriesUsed = new Set<string>()
    
    // First pass: one article from each category
    Object.keys(articlesByCategory).forEach(cat => {
      if (selected.length < count && articlesByCategory[cat].length > 0) {
        selected.push(articlesByCategory[cat][0])
        categoriesUsed.add(cat)
      }
    })
    
    // Second pass: fill remaining slots with highest scores
    const remaining = scoredArticles
      .filter(item => !selected.includes(item))
      .sort((a, b) => b.score - a.score)
    
    while (selected.length < count && remaining.length > 0) {
      selected.push(remaining.shift()!)
    }
    
    const fallbackSelection = selected.map(item => ({
      ...item,
      reason: `Score-based selection with category coverage (Score: ${item.score}/100)`
    }))
    
    // Find trilingual variants for fallback selection too
    const fallbackWithVariants = await findTrilingualVariants(fallbackSelection)
    console.log(`🔄 Fallback selection with variants: ${fallbackWithVariants.length} total articles`)
    
    return fallbackWithVariants
  }
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

    console.log(`📊 Getting TTS selection stats only...`)
    console.log(`   Language: ${language}, Category: ${category || 'all'}`)

    // No recommendations on GET - just return empty array for display
    const recommendations: any[] = []

    // Get current stats - articles selected for TTS briefs
    // With trilingual approach, we count by stories (trilingual batches) not individual articles
    let currentSelectedQuery = supabase
      .from('articles')
      .select('id, title, category, language_variant, tts_selection_metadata, created_at, trilingual_batch_id')
      .eq('selected_for_tts_brief', true)
      .gte('created_at', new Date(Date.now() - hours * 60 * 60 * 1000).toISOString())

    // Apply language filter if specified (but note this now represents stories, not just that language)
    if (language) {
      currentSelectedQuery = currentSelectedQuery.eq('language_variant', language)
    }

    // Apply category filter if specified  
    if (category) {
      currentSelectedQuery = currentSelectedQuery.eq('category', category)
    }

    const { data: currentSelected } = await currentSelectedQuery

    console.log(`📊 Current selection stats: found ${currentSelected?.length || 0} selected articles for language=${language}, category=${category}`)

    // Get total available articles (English only, since we select from English articles)
    const { data: totalAvailable } = await supabase
      .from('articles')
      .select('id')
      .eq('is_ai_enhanced', true)
      .eq('selected_for_tts_brief', false)
      .eq('language_variant', 'en') // Count English articles as available stories
      .gte('created_at', new Date(Date.now() - hours * 60 * 60 * 1000).toISOString())

    console.log(`📊 Available English stories for selection: ${totalAvailable?.length || 0}`)

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
      count = 15,
      reason = 'AI-selected for comprehensive TTS news brief generation'
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
        // Check if we already have recent selections to avoid duplicates
        const { data: existingSelections } = await supabase
          .from('articles')
          .select('id')
          .eq('selected_for_tts_brief', true)
          .gte('created_at', new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()) // Last 2 hours
        
        if (existingSelections && existingSelections.length >= 30) { // 10 stories × 3 languages = 30 articles
          console.log(`⏭️ Already have ${existingSelections.length} recently selected articles, skipping auto-selection`)
          return NextResponse.json({
            success: true,
            message: `Already have ${Math.floor(existingSelections.length / 3)} stories selected recently`,
            selectedCount: 0,
            method: 'auto_selection_skipped'
          })
        }

        console.log(`🎯 Proceeding with auto-selection (found ${existingSelections?.length || 0} existing selections)`)
        
        const recommendations = await selectArticlesForTTSWithAI({
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
        // Clear TTS selection flags for ALL articles (trilingual approach)
        console.log('🧹 Clearing ALL TTS selections across all languages...')
        
        // First, count how many articles will be cleared
        const { data: selectedArticles, error: countError } = await supabase
          .from('articles')
          .select('id, language_variant')
          .eq('selected_for_tts_brief', true)
        
        if (countError) {
          console.error('Error counting selected articles:', countError)
          throw countError
        }
        
        const articleCount = selectedArticles?.length || 0
        const languageBreakdown = selectedArticles?.reduce((acc, article) => {
          acc[article.language_variant] = (acc[article.language_variant] || 0) + 1
          return acc
        }, {} as Record<string, number>) || {}
        
        console.log(`📊 Found ${articleCount} selected articles:`, languageBreakdown)
        
        // Clear ALL selected articles regardless of language
        const { error: clearError } = await supabase
          .from('articles')
          .update({
            selected_for_tts_brief: false,
            tts_selection_metadata: null
          })
          .eq('selected_for_tts_brief', true)

        if (clearError) {
          console.error('Error clearing selections:', clearError)
          throw clearError
        }

        console.log(`✅ Successfully cleared ${articleCount} articles across all languages`)

        return NextResponse.json({
          success: true,
          message: `Cleared ${articleCount} TTS selections across all languages (${Object.entries(languageBreakdown).map(([lang, count]) => `${lang}: ${count}`).join(', ')})`,
          method: 'clear_selection',
          clearedCount: articleCount,
          languageBreakdown
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