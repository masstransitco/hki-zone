import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { perplexityEnhancerV2, type EnhancementOptions } from '@/lib/perplexity-enhancer-v2'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { articleIds, options = {} } = body as {
      articleIds: string[]
      options?: EnhancementOptions
    }

    if (!articleIds || articleIds.length === 0) {
      return NextResponse.json(
        { error: 'Article IDs are required' },
        { status: 400 }
      )
    }

    // Limit the number of articles to prevent overwhelming the API
    if (articleIds.length > 20) {
      return NextResponse.json(
        { error: 'Maximum 20 articles allowed per bulk operation' },
        { status: 400 }
      )
    }

    // Check if Perplexity API is configured
    if (!perplexityEnhancerV2.isConfigured()) {
      return NextResponse.json(
        { error: 'Perplexity API not configured. Please add PERPLEXITY_API_KEY to environment variables.' },
        { status: 503 }
      )
    }

    // Fetch all original articles
    const { data: originalArticles, error: fetchError } = await supabase
      .from('articles')
      .select('*')
      .in('id', articleIds)
      .eq('is_ai_enhanced', false) // Only allow non-enhanced articles

    if (fetchError) {
      return NextResponse.json(
        { error: 'Failed to fetch articles' },
        { status: 500 }
      )
    }

    if (!originalArticles || originalArticles.length === 0) {
      return NextResponse.json(
        { error: 'No valid articles found (articles may already be AI-enhanced)' },
        { status: 404 }
      )
    }

    const languages = ['en', 'zh-TW', 'zh-CN'] as const
    const results = {
      successful: [] as any[],
      failed: [] as any[],
      totalProcessed: 0,
      totalCost: 0
    }

    // Track which articles have been successfully processed for marking
    const processedArticles = new Map<string, {
      article: any,
      successfulLanguages: string[],
      failedLanguages: string[]
    }>()

    // Process each article in each language
    for (const article of originalArticles) {
      // Initialize tracking for this article
      if (!processedArticles.has(article.id)) {
        processedArticles.set(article.id, {
          article,
          successfulLanguages: [],
          failedLanguages: []
        })
      }

      for (const language of languages) {
        try {
          // Add small delay between requests to avoid rate limiting
          if (results.totalProcessed > 0) {
            await new Promise(resolve => setTimeout(resolve, 1000))
          }

          // Estimate cost
          const estimatedCost = perplexityEnhancerV2.estimateEnhancementCost(
            (article.content || '').length + article.title.length
          )

          // Perform AI enhancement
          const enhancementResult = await perplexityEnhancerV2.enhanceArticle(
            article.title,
            article.content || '',
            article.summary || article.ai_summary || '',
            { ...options, language }
          )

          // Create enhanced article data
          const enhancedArticle = {
            title: enhancementResult.enhancedTitle || `${article.title} - Enhanced with AI Research`,
            content: enhancementResult.enhancedContent,
            summary: enhancementResult.enhancedSummary || article.ai_summary || article.summary,
            ai_summary: enhancementResult.enhancedSummary || `Enhanced analysis: ${enhancementResult.enhancedContent.substring(0, 200)}...`,
            url: `${article.url}#enhanced-${language}-${Date.now()}`, // Make URL unique per language
            source: `${article.source} (AI Enhanced)`,
            published_at: article.published_at,
            image_url: article.image_url,
            category: article.category,
            is_ai_enhanced: true,
            original_article_id: article.id,
            enhancement_metadata: {
              searchQueries: enhancementResult.searchQueries,
              sources: enhancementResult.sources,
              relatedTopics: enhancementResult.relatedTopics,
              enhancedAt: new Date().toISOString(),
              enhancementCost: estimatedCost,
              extractedImages: enhancementResult.extractedImages,
              citationsText: enhancementResult.citationsText,
              language: language,
              originalArticleId: article.id,
              bulkEnhanced: true,
              structuredContent: {
                enhancedTitle: enhancementResult.enhancedTitle,
                enhancedSummary: enhancementResult.enhancedSummary,
                keyPoints: enhancementResult.keyPoints,
                whyItMatters: enhancementResult.whyItMatters
              }
            }
          }

          // Try to save enhanced article to database with language field
          let { data: savedArticle, error: saveError } = await supabase
            .from('articles')
            .insert([{ ...enhancedArticle, language }])
            .select()
            .single()

          // If language column doesn't exist, try without it
          if (saveError?.code === '42703' || saveError?.message?.includes('language')) {
            const { data: retryData, error: retryError } = await supabase
              .from('articles')
              .insert([enhancedArticle])
              .select()
              .single()
            
            savedArticle = retryData
            saveError = retryError
          }

          if (saveError) {
            results.failed.push({
              originalArticleId: article.id,
              originalTitle: article.title,
              language,
              error: saveError.message
            })
            // Track failed language for this article
            processedArticles.get(article.id)!.failedLanguages.push(language)
          } else {
            results.successful.push({
              originalArticleId: article.id,
              originalTitle: article.title,
              enhancedArticleId: savedArticle.id,
              language,
              enhancementCost: estimatedCost,
              sources: enhancementResult.sources.length,
              searchQueries: enhancementResult.searchQueries.length
            })
            results.totalCost += estimatedCost
            // Track successful language for this article
            processedArticles.get(article.id)!.successfulLanguages.push(language)
          }

          results.totalProcessed++

        } catch (error) {
          console.error(`Enhancement error for article ${article.id} in ${language}:`, error)
          results.failed.push({
            originalArticleId: article.id,
            originalTitle: article.title,
            language,
            error: error instanceof Error ? error.message : 'Unknown error'
          })
          // Track failed language for this article
          processedArticles.get(article.id)!.failedLanguages.push(language)
          results.totalProcessed++
        }
      }
    }

    // Mark original articles as enhanced and selected to prevent re-selection by automated processes
    console.log('Marking original articles as enhanced and selected for future prevention...')
    for (const [articleId, articleData] of processedArticles.entries()) {
      // Only mark articles that had at least one successful language enhancement
      if (articleData.successfulLanguages.length > 0) {
        try {
          const { error } = await supabase
            .from('articles')
            .update({ 
              selected_for_enhancement: true,
              is_ai_enhanced: true, // Mark as enhanced to prevent re-selection
              selection_metadata: {
                selected_at: new Date().toISOString(),
                selection_reason: 'Manual bulk clone selection',
                selection_type: 'bulk_manual',
                selection_session: Date.now(),
                languages_processed: articleData.successfulLanguages,
                languages_failed: articleData.failedLanguages,
                success_count: articleData.successfulLanguages.length,
                total_languages: languages.length
              },
              enhancement_metadata: {
                enhanced_at: new Date().toISOString(),
                trilingual_versions_created: articleData.successfulLanguages.length,
                enhancement_method: 'bulk_manual',
                languages_created: articleData.successfulLanguages,
                languages_failed: articleData.failedLanguages,
                bulk_enhanced: true
              }
            })
            .eq('id', articleId)

          if (error) {
            console.error(`Failed to mark article ${articleId} as enhanced:`, error)
          } else {
            console.log(`✓ Marked article "${articleData.article.title}" as enhanced (${articleData.successfulLanguages.length}/${languages.length} languages successful)`)
          }
        } catch (error) {
          console.error(`Error marking article ${articleId} as enhanced:`, error)
        }
      } else {
        console.log(`⚠ Skipping marking article "${articleData.article.title}" - no successful language enhancements`)
      }
    }

    // Calculate summary statistics
    const articlesMarkedAsSelected = Array.from(processedArticles.values())
      .filter(data => data.successfulLanguages.length > 0).length
    
    const summary = {
      originalArticles: originalArticles.length,
      targetClones: originalArticles.length * 3, // 3 languages per article
      successfulClones: results.successful.length,
      failedClones: results.failed.length,
      successRate: Math.round((results.successful.length / (originalArticles.length * 3)) * 100),
      totalCost: Math.round(results.totalCost * 100) / 100, // Round to 2 decimal places
      articlesMarkedAsSelected, // Track how many original articles were marked
      languageBreakdown: {
        en: results.successful.filter(r => r.language === 'en').length,
        'zh-TW': results.successful.filter(r => r.language === 'zh-TW').length,
        'zh-CN': results.successful.filter(r => r.language === 'zh-CN').length
      }
    }

    return NextResponse.json({
      success: true,
      summary,
      results,
      message: `Successfully cloned ${results.successful.length} articles across ${languages.length} languages from ${originalArticles.length} source articles. Marked ${articlesMarkedAsSelected} original articles as selected to prevent re-selection.`
    })

  } catch (error) {
    console.error('Bulk clone API error:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// GET endpoint to check bulk clone status and limits
export async function GET() {
  try {
    const isConfigured = perplexityEnhancerV2.isConfigured()
    
    return NextResponse.json({
      configured: isConfigured,
      status: isConfigured ? 'ready' : 'not_configured',
      limits: {
        maxArticlesPerBatch: 20,
        supportedLanguages: ['en', 'zh-TW', 'zh-CN'],
        estimatedTimePerArticle: '30-60 seconds',
        rateLimitDelay: '1 second between requests'
      },
      message: isConfigured 
        ? 'Bulk cloning API is configured and ready'
        : 'Perplexity API key not found in environment variables'
    })
  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Failed to check API configuration',
        configured: false,
        status: 'error'
      },
      { status: 500 }
    )
  }
}