import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { batchEnhanceTrilingualArticles } from '@/lib/perplexity-trilingual-enhancer'
import { saveEnhancedArticles } from '@/lib/article-saver'
import { perplexityHKNews } from '@/lib/perplexity-hk-news'
import { perplexityImageSearch } from '@/lib/perplexity-image-search'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Missing Supabase environment variables')
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

function generateBatchId(): string {
  return `enhance_selected_${Date.now()}_${Math.random().toString(36).substring(7)}`
}

function calculateTrilingualCost(enhancedArticles: any[]): number {
  // Estimate: ~$0.075 per enhanced article
  return enhancedArticles.length * 0.075
}

async function getSelectedArticleForEnhancement(): Promise<any | null> {
  try {
    console.log('   🔍 Finding article marked for enhancement...')
    
    // Check for backlog - if multiple articles are pending, prioritize oldest selection
    const { data: articles, error } = await supabase
      .from('articles')
      .select('*')
      .eq('selected_for_enhancement', true)
      .is('is_ai_enhanced', false)
      .order('selection_metadata->selected_at', { ascending: true }) // Process oldest selection first
      .limit(1)

    if (error) {
      console.error('❌ Database error:', error)
      throw error
    }

    console.log(`   📊 Found ${articles?.length || 0} articles marked for enhancement`)

    if (!articles || articles.length === 0) {
      console.log('   ⚠️ No articles marked for enhancement found')
      return null
    }

    const article = articles[0]
    console.log(`   ✅ Selected article: "${article.title?.substring(0, 50)}..." (${article.source})`)
    
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
      selection_reason: article.selection_metadata?.selection_reason || 'Selected for enhancement',
      priority_score: article.selection_metadata?.priority_score || 80
    }

  } catch (error) {
    console.error('❌ Error getting selected article:', error)
    console.error('Error type:', typeof error)
    console.error('Error message:', error instanceof Error ? error.message : String(error))
    throw error
  }
}

async function addContextualEnrichment(article: any): Promise<any> {
  try {
    console.log(`🔄 Adding contextual enrichment to "${article.title}"...`)
    
    // Convert to format expected by enrichment
    const perplexityArticle = {
      id: article.id,
      title: article.title,
      category: article.category,
      url: article.url,
      created_at: article.created_at,
      updated_at: new Date().toISOString()
    }
    
    console.log('   📡 Calling perplexityHKNews.enrichArticleWithContext...')
    const contextualEnrichment = await perplexityHKNews.enrichArticleWithContext(perplexityArticle)
    
    console.log('   🔄 Converting to article enrichment format...')
    const enrichment = perplexityHKNews.contextualToArticleEnrichment(contextualEnrichment)
    
    console.log(`✅ Contextual enrichment complete:`)
    console.log(`   Enhanced title: ${enrichment.enhanced_title}`)
    console.log(`   Key points: ${enrichment.key_points.length} items`)
    console.log(`   Sources: ${enrichment.sources.length} citations`)

    // Add image if needed
    let imageResult = null
    if (!article.image_url) {
      try {
        console.log(`🎯 Searching for relevant image...`)
        
        imageResult = await perplexityImageSearch.findImageWithMetadata(
          {
            title: enrichment.enhanced_title,
            imagePrompt: enrichment.image_prompt,
            summary: enrichment.summary,
            keyPoints: enrichment.key_points,
            sources: enrichment.sources,
            citations: enrichment.citations
          },
          article.category
        )
        
        console.log(`✅ Image found: ${imageResult.source} - ${imageResult.url}`)
      } catch (imageError) {
        console.error(`❌ Failed to find image: ${imageError.message}`)
        // Don't fail the whole process if image fails
      }
    }

    return {
      ...article,
      // Update content with enriched version
      content: `<p>${enrichment.lede}</p>${enrichment.body_html}`,
      summary: enrichment.summary,
      // Add enrichment metadata
      contextual_enrichment: {
        enhanced_title: enrichment.enhanced_title,
        lede: enrichment.lede,
        key_points: enrichment.key_points,
        why_it_matters: enrichment.why_it_matters,
        citations: enrichment.citations,
        sources: enrichment.sources,
        contextual_bullets: contextualEnrichment.contextual_bullets,
        data_points: contextualEnrichment.data_points,
        historical_references: contextualEnrichment.historical_references,
        enrichment_cost: contextualEnrichment.cost || 0
      },
      // Add image if found
      ...(imageResult && {
        image_url: imageResult.url,
        image_metadata: {
          license: imageResult.license,
          attribution: imageResult.attribution,
          original: imageResult.url,
          source: imageResult.source
        }
      })
    }

  } catch (error) {
    console.error('Error in contextual enrichment:', error)
    // Return original article if enrichment fails
    return article
  }
}


// Optional: Support manual testing via POST  
export async function POST(request: NextRequest) {
  console.log('Manual trigger of article enhancement');
  return GET(request);
}

export async function GET(request: NextRequest) {
  // Check if this is a cron request (has auth headers) vs stats request (no auth)
  const authHeader = request.headers.get('authorization')
  const userAgent = request.headers.get('user-agent')
  const isCronRequest = userAgent === 'vercel-cron/1.0' || authHeader === `Bearer ${process.env.CRON_SECRET}`
  
  if (!isCronRequest) {
    // Return stats for non-cron requests
    try {
      const oneHourAgo = new Date()
      oneHourAgo.setHours(oneHourAgo.getHours() - 1)

      const { data: selectedArticles } = await supabase
        .from('articles')
        .select('id, title, source, selection_metadata')
        .eq('selected_for_enhancement', true)
        .is('is_ai_enhanced', false)
        .gte('selection_metadata->selected_at', oneHourAgo.toISOString())

      return NextResponse.json({
        configured: true,
        message: 'Article enhancement endpoint is ready',
        selectedForEnhancement: selectedArticles?.length || 0,
        lastHour: selectedArticles?.map(a => ({
          title: a.title,
          source: a.source,
          selectedAt: a.selection_metadata?.selected_at
        })) || []
      })
    } catch (error) {
      console.error('Error getting enhancement statistics:', error)
      return NextResponse.json(
        { 
          configured: false, 
          error: 'Failed to get statistics' 
        }, 
        { status: 500 }
      )
    }
  }
  
  // Main enhancement logic (same as before) for cron requests
  try {
    // Enhanced authentication for cron jobs  
    const isVercelCron = userAgent === 'vercel-cron/1.0'
    const isValidSecret = process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`
    
    console.log(`🔐 Authentication: isVercelCron=${isVercelCron}, isValidSecret=${isValidSecret}`)
    
    if (!isVercelCron && !isValidSecret) {
      console.log(`❌ UNAUTHORIZED: userAgent=${userAgent}, hasSecret=${!!process.env.CRON_SECRET}`)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const now = new Date()
    const utcTime = now.toISOString()
    const hkTime = new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString().replace('Z', ' HKT')
    
    console.log('🚀 Starting enhancement of selected article...')
    console.log(`⏰ Execution time: ${utcTime} (UTC) / ${hkTime}`)
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
    let selectedArticle;
    try {
      console.log('🔍 Looking for selected article...')
      selectedArticle = await getSelectedArticleForEnhancement()

      if (!selectedArticle) {
        console.log('⏭️ No article found for enhancement - may have been processed already')
        return NextResponse.json({
          success: true,
          message: 'No article found for enhancement',
          processed: 0
        })
      }

      console.log(`📝 Processing selected article: "${selectedArticle.title}"`)
      console.log(`   Source: ${selectedArticle.source}`)
      console.log(`   Reason: ${selectedArticle.selection_reason}`)
    } catch (error) {
      console.error('❌ Error finding selected article:', error)
      throw new Error(`Failed to find selected article: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    // 2. Create trilingual enhanced versions - format as array like working implementation
    let trilingualArticles;
    try {
      console.log('🌐 Creating trilingual enhanced versions...')
      console.log(`   Input: 1 article with ID ${selectedArticle.id}`)
      
      // Convert to the format expected by batchEnhanceTrilingualArticles (same as working implementation)
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
      }];
      
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
    let savedArticles;
    try {
      console.log('💾 Saving enhanced articles to database...')
      console.log(`   Saving ${trilingualArticles.length} articles with batchId: ${batchId}`)
      
      savedArticles = await saveEnhancedArticles(trilingualArticles, batchId)
      console.log(`   Saved: ${savedArticles?.length || 0} articles to database`)
    } catch (error) {
      console.error('❌ Error saving articles:', error)
      throw new Error(`Failed to save articles: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    // 4. Mark original article as processed to prevent re-selection - CRITICAL: Must succeed
    try {
      console.log('🔐 Marking original article as processed...')
      
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
            enhancement_method: 'cron_trilingual',
            enhanced_article_ids: savedArticles.map(a => a.id),
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

    console.log(`✅ Enhancement complete: 1 → ${savedArticles.length} articles in ${Math.round(processingTime / 1000)}s`)
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
    console.error('❌ Error enhancing selected article:', error)
    console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace')
    console.error('Error type:', typeof error)
    console.error('Error constructor:', error?.constructor?.name)
    
    let errorMessage = 'Unknown error occurred';
    let errorDetails = 'No additional details';
    
    if (error instanceof Error) {
      errorMessage = error.message;
      errorDetails = error.stack || 'No stack trace available';
    } else if (typeof error === 'string') {
      errorMessage = error;
      errorDetails = 'String error thrown';
    } else if (error && typeof error === 'object') {
      errorMessage = JSON.stringify(error);
      errorDetails = 'Object error thrown';
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