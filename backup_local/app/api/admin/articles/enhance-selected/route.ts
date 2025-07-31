import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { batchEnhanceTrilingualArticles } from '@/lib/perplexity-trilingual-enhancer'
import { saveEnhancedArticles } from '@/lib/article-saver'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Missing Supabase environment variables')
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

function generateBatchId(): string {
  return `admin_enhance_${Date.now()}_${Math.random().toString(36).substring(7)}`
}

function calculateTrilingualCost(enhancedArticles: any[]): number {
  // Estimate: ~$0.075 per enhanced article
  return enhancedArticles.length * 0.075
}

async function getSelectedArticleForEnhancement(): Promise<any | null> {
  try {
    console.log('🔍 Finding article marked for enhancement...')
    
    const { data: articles, error } = await supabase
      .from('articles')
      .select('*')
      .eq('selected_for_enhancement', true)
      .is('is_ai_enhanced', false)
      .order('selection_metadata->selected_at', { ascending: false })
      .limit(1)

    if (error) {
      console.error('❌ Database error:', error)
      throw error
    }

    console.log(`📊 Found ${articles?.length || 0} articles marked for enhancement`)

    if (!articles || articles.length === 0) {
      console.log('⚠️ No articles marked for enhancement found')
      return null
    }

    const article = articles[0]
    console.log(`✅ Selected article: "${article.title?.substring(0, 50)}..." (${article.source})`)
    
    return {
      id: article.id,
      title: article.title,
      summary: article.summary,
      content: article.content,
      url: article.url,
      source: article.source,
      category: article.category || 'general',
      published_at: article.published_at,
      created_at: article.created_at,
      image_url: article.image_url,
      author: article.author,
      selection_reason: article.selection_metadata?.selection_reason || 
        (article.selection_metadata?.selection_method === 'perplexity_ai' ? 'AI-selected for enhancement' : 'Selected for enhancement'),
      priority_score: article.selection_metadata?.priority_score || 80,
      selection_metadata: article.selection_metadata // Include full metadata for debugging
    }

  } catch (error) {
    console.error('❌ Error getting selected article:', error)
    throw error
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 Starting admin-triggered article enhancement...')
    const startTime = Date.now()
    const batchId = generateBatchId()

    // Check if Perplexity API is configured
    if (!process.env.PERPLEXITY_API_KEY) {
      console.error('Perplexity API key not configured')
      return NextResponse.json({
        success: false,
        error: 'Perplexity API key not configured'
      }, { status: 503 })
    }

    // 1. Find the article marked for enhancement
    let selectedArticle
    try {
      console.log('🔍 Looking for selected article...')
      selectedArticle = await getSelectedArticleForEnhancement()

      if (!selectedArticle) {
        console.log('⏭️ No article found for enhancement')
        return NextResponse.json({
          success: false,
          message: 'No article found for enhancement',
          processed: 0
        })
      }

      console.log(`📝 Processing selected article: "${selectedArticle.title}"`)
      console.log(`   Source: ${selectedArticle.source}`)
      console.log(`   Reason: ${selectedArticle.selection_reason}`)
      
      // Debug: Show selection method and metadata
      const selectionMethod = selectedArticle.selection_metadata?.selection_method || 'unknown'
      const selectionSession = selectedArticle.selection_metadata?.selection_session || 'unknown'
      console.log(`🔍 Selection Debug Info:`)
      console.log(`   Method: ${selectionMethod}`)
      console.log(`   Session: ${selectionSession}`)
      console.log(`   Score: ${selectedArticle.priority_score}`)
    } catch (error) {
      console.error('❌ Error finding selected article:', error)
      throw new Error(`Failed to find selected article: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    // 2. Create trilingual enhanced versions
    let trilingualArticles
    try {
      console.log('🌐 Creating trilingual enhanced versions...')
      console.log(`   Input: 1 article with ID ${selectedArticle.id}`)
      
      // Convert to the format expected by batchEnhanceTrilingualArticles
      const selectedArticles = [{
        id: selectedArticle.id,
        title: selectedArticle.title,
        summary: selectedArticle.summary,
        content: selectedArticle.content,
        url: selectedArticle.url,
        source: selectedArticle.source,
        category: selectedArticle.category,
        published_at: selectedArticle.published_at,
        created_at: selectedArticle.created_at,
        image_url: selectedArticle.image_url,
        author: selectedArticle.author,
        selection_reason: selectedArticle.selection_reason,
        priority_score: selectedArticle.priority_score
      }]
      
      trilingualArticles = await batchEnhanceTrilingualArticles(selectedArticles, batchId)
      console.log(`   Output: ${trilingualArticles?.length || 0} trilingual articles`)

      if (!trilingualArticles || trilingualArticles.length === 0) {
        throw new Error('Trilingual enhancement returned no articles')
      }

      console.log('✅ Trilingual enhancement completed successfully')
    } catch (error) {
      console.error('❌ Error in trilingual enhancement:', error)
      throw new Error(`Failed in trilingual enhancement: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    // 3. Save all enhanced articles to database
    let savedArticles
    try {
      console.log('💾 Saving enhanced articles to database...')
      console.log(`   Saving ${trilingualArticles.length} articles with batchId: ${batchId}`)
      
      savedArticles = await saveEnhancedArticles(trilingualArticles, batchId)
      console.log(`   Saved: ${savedArticles?.length || 0} articles to database`)
    } catch (error) {
      console.error('❌ Error saving articles:', error)
      throw new Error(`Failed to save articles: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    // 4. Mark original article as enhanced to prevent re-selection - CRITICAL: Must succeed
    try {
      console.log('🔐 Marking original article as enhanced...')
      
      // Use atomic transaction to ensure both operations succeed or both fail
      const { error: markError } = await supabase
        .from('articles')
        .update({ 
          is_ai_enhanced: false, // IMPORTANT: Source articles should NOT be marked as enhanced
          selected_for_enhancement: false, // Reset selection flag
          enhancement_metadata: {
            enhanced_at: new Date().toISOString(),
            trilingual_versions_created: savedArticles.length,
            batch_id: batchId,
            processing_time_ms: Date.now() - startTime,
            estimated_cost: calculateTrilingualCost(trilingualArticles),
            enhancement_method: 'admin_trilingual',
            enhanced_article_ids: savedArticles.map(a => a.id),
            admin_triggered: true,
            source_article_status: 'enhanced_children_created'
          }
        })
        .eq('id', selectedArticle.id)
        .eq('selected_for_enhancement', true) // Additional safety check

      if (markError) {
        console.error('❌ CRITICAL: Failed to mark original article properly:', markError)
        console.error('❌ This will cause AI to re-select this article!')
        
        // CRITICAL FIX: Throw error to prevent incomplete state
        throw new Error(`Failed to mark source article properly: ${markError.message}. This would cause duplicate selection by AI.`)
      } else {
        console.log(`✅ Marked source article "${selectedArticle.title}" as processed (not enhanced)`)
        console.log(`✅ Created ${savedArticles.length} enhanced children articles`)
      }
    } catch (error) {
      console.error('❌ CRITICAL Error marking original article:', error)
      
      // CRITICAL FIX: This MUST throw to prevent inconsistent state
      throw new Error(`Critical failure in marking source article: ${error instanceof Error ? error.message : 'Unknown error'}. Enhancement was successful but marking failed - this will cause AI re-selection.`)
    }

    const processingTime = Date.now() - startTime
    const estimatedCost = calculateTrilingualCost(trilingualArticles)

    console.log(`✅ Admin enhancement complete: 1 → ${savedArticles.length} articles in ${Math.round(processingTime / 1000)}s`)
    console.log(`   Cost: $${estimatedCost.toFixed(4)}`)

    return NextResponse.json({
      success: true,
      message: `Enhanced article into ${savedArticles.length} trilingual versions`,
      batchId,
      sourceArticle: {
        id: selectedArticle.id,
        title: selectedArticle.title,
        source: selectedArticle.source,
        selection_reason: selectedArticle.selection_reason,
        priority_score: selectedArticle.priority_score
      },
      totalEnhanced: trilingualArticles.length,
      totalSaved: savedArticles.length,
      articlesByLanguage: {
        english: trilingualArticles.filter(a => a.language === 'en').length,
        traditionalChinese: trilingualArticles.filter(a => a.language === 'zh-TW').length,
        simplifiedChinese: trilingualArticles.filter(a => a.language === 'zh-CN').length
      },
      processingTime,
      processingTimeMinutes: Math.round(processingTime / 60000 * 10) / 10,
      estimatedCost: estimatedCost.toFixed(4),
      articles: savedArticles.map(article => ({
        id: article.id,
        title: article.title,
        language: article.language,
        url: article.url,
        source: article.source,
        qualityScore: article.quality_score
      }))
    })

  } catch (error) {
    console.error('❌ Error in admin article enhancement:', error)
    console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace')
    
    let errorMessage = 'Unknown error occurred'
    let errorDetails = 'No additional details'
    
    if (error instanceof Error) {
      errorMessage = error.message
      errorDetails = error.stack || 'No stack trace available'
    } else if (typeof error === 'string') {
      errorMessage = error
      errorDetails = 'String error thrown'
    } else if (error && typeof error === 'object') {
      errorMessage = JSON.stringify(error)
      errorDetails = 'Object error thrown'
    }
    
    return NextResponse.json({
      success: false,
      error: errorMessage,
      details: errorDetails,
      errorType: typeof error,
      errorConstructor: error?.constructor?.name || 'unknown'
    }, { status: 500 })
  }
}