import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { perplexityEnhancerV2, type EnhancementOptions } from '@/lib/perplexity-enhancer-v2'
import type { Article } from '@/lib/types'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { articleId, options = {} } = body as {
      articleId: string
      options?: EnhancementOptions
    }

    if (!articleId) {
      return NextResponse.json(
        { error: 'Article ID is required' },
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

    // Fetch the original article
    const { data: originalArticle, error: fetchError } = await supabase
      .from('articles')
      .select('*')
      .eq('id', articleId)
      .single()

    if (fetchError || !originalArticle) {
      return NextResponse.json(
        { error: 'Article not found' },
        { status: 404 }
      )
    }

    // Check if article is already AI-enhanced
    if (originalArticle.is_ai_enhanced) {
      return NextResponse.json(
        { error: 'Article is already AI-enhanced. Cannot enhance an enhanced article.' },
        { status: 400 }
      )
    }

    // Estimate cost before processing
    const estimatedCost = perplexityEnhancerV2.estimateEnhancementCost(
      (originalArticle.content || '').length + originalArticle.title.length
    )

    try {
      // Perform AI enhancement
      const enhancementResult = await perplexityEnhancerV2.enhanceArticle(
        originalArticle.title,
        originalArticle.content || '',
        originalArticle.summary || originalArticle.ai_summary || '',
        options
      )

      // Create enhanced article data
      const enhancedArticle = {
        title: enhancementResult.enhancedTitle || `${originalArticle.title} - Enhanced with AI Research`,
        content: enhancementResult.enhancedContent,
        summary: enhancementResult.enhancedSummary || originalArticle.ai_summary || originalArticle.summary,
        ai_summary: enhancementResult.enhancedSummary || `Enhanced analysis: ${enhancementResult.enhancedContent.substring(0, 200)}...`,
        url: `${originalArticle.url}#enhanced-${Date.now()}`, // Make URL unique
        source: `${originalArticle.source} (AI Enhanced)`,
        published_at: originalArticle.published_at,
        image_url: originalArticle.image_url,
        category: originalArticle.category,
        is_ai_enhanced: true,
        original_article_id: originalArticle.id,
        enhancement_metadata: {
          searchQueries: enhancementResult.searchQueries,
          sources: enhancementResult.sources,
          relatedTopics: enhancementResult.relatedTopics,
          enhancedAt: new Date().toISOString(),
          enhancementCost: estimatedCost,
          extractedImages: enhancementResult.extractedImages,
          citationsText: enhancementResult.citationsText,
          structuredContent: {
            enhancedTitle: enhancementResult.enhancedTitle,
            enhancedSummary: enhancementResult.enhancedSummary,
            keyPoints: enhancementResult.keyPoints,
            whyItMatters: enhancementResult.whyItMatters
          }
        }
      }

      // Save enhanced article to database
      const { data: savedArticle, error: saveError } = await supabase
        .from('articles')
        .insert([enhancedArticle])
        .select()
        .single()

      if (saveError) {
        console.error('Database save error:', saveError)
        console.error('Enhanced article data:', enhancedArticle)
        return NextResponse.json(
          { 
            error: 'Failed to save enhanced article to database',
            details: saveError.message,
            code: saveError.code
          },
          { status: 500 }
        )
      }

      // Transform database article to frontend Article interface
      const responseArticle: Article = {
        id: savedArticle.id,
        title: savedArticle.title,
        summary: savedArticle.ai_summary || savedArticle.summary,
        content: savedArticle.content,
        url: savedArticle.url,
        source: savedArticle.source,
        publishedAt: savedArticle.published_at,
        imageUrl: savedArticle.image_url,
        category: savedArticle.category,
        isAiEnhanced: savedArticle.is_ai_enhanced,
        originalArticleId: savedArticle.original_article_id,
        enhancementMetadata: savedArticle.enhancement_metadata
      }

      return NextResponse.json({
        success: true,
        originalArticle: {
          id: originalArticle.id,
          title: originalArticle.title
        },
        enhancedArticle: responseArticle,
        enhancementStats: {
          searchQueries: enhancementResult.searchQueries.length,
          sources: enhancementResult.sources.length,
          relatedTopics: enhancementResult.relatedTopics.length,
          estimatedCost
        }
      })

    } catch (enhancementError) {
      console.error('Enhancement error:', enhancementError)
      
      // Provide specific error messages based on the error type
      let errorMessage = 'Failed to enhance article with AI'
      if (enhancementError instanceof Error) {
        if (enhancementError.message.includes('API key')) {
          errorMessage = 'Perplexity API authentication failed'
        } else if (enhancementError.message.includes('rate limit')) {
          errorMessage = 'API rate limit exceeded. Please try again later.'
        } else if (enhancementError.message.includes('quota')) {
          errorMessage = 'API quota exceeded. Please check your Perplexity account.'
        }
      }

      return NextResponse.json(
        { 
          error: errorMessage,
          details: enhancementError instanceof Error ? enhancementError.message : 'Unknown error'
        },
        { status: 500 }
      )
    }

  } catch (error) {
    console.error('Clone with AI API error:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// GET endpoint to check API status and configuration
export async function GET() {
  try {
    const isConfigured = perplexityEnhancerV2.isConfigured()
    
    return NextResponse.json({
      configured: isConfigured,
      status: isConfigured ? 'ready' : 'not_configured',
      message: isConfigured 
        ? 'Perplexity API is configured and ready'
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