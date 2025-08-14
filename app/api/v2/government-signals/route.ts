import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const dynamic = 'force-dynamic'

/**
 * GET /api/v2/government-signals
 * Retrieve government signals with language preference and filtering
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    // Parse query parameters
    const languages = searchParams.get('languages')?.split(',') || ['en']
    const categories = searchParams.get('categories')?.split(',') || null
    const feedGroups = searchParams.get('feed_groups')?.split(',') || null
    const minPriority = parseInt(searchParams.get('min_priority') || '0')
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)
    const offset = parseInt(searchParams.get('offset') || '0')
    const includePartial = searchParams.get('include_partial') === 'true'
    
    console.log('📡 Government Signals API V2 called:', {
      languages,
      categories,
      feedGroups,
      minPriority,
      limit,
      offset,
      includePartial
    })
    
    // Build the query with joins to new content structure
    let query = supabase
      .from('government_signals')
      .select(`
        id,
        source_identifier,
        feed_group,
        category,
        priority_score,
        processing_status,
        created_at,
        updated_at,
        government_signals_meta (
          notice_id,
          published_at,
          urls
        ),
        government_signals_content (
          language,
          title,
          body,
          word_count,
          scraped_at
        )
      `)
      .gte('priority_score', minPriority)
      .order('priority_score', { ascending: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)
    
    // Apply filters
    if (categories) {
      query = query.in('category', categories)
    }
    
    if (feedGroups) {
      query = query.in('feed_group', feedGroups)
    }
    
    if (!includePartial) {
      query = query.in('processing_status', ['content_complete', 'enriched'])
    }
    
    const { data: signals, error } = await query
    
    if (error) {
      console.error('❌ Database error:', error)
      return NextResponse.json({
        success: false,
        error: 'Database query failed',
        details: error.message
      }, { status: 500 })
    }
    
    if (!signals || signals.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        metadata: {
          count: 0,
          offset,
          limit,
          languages,
          filters: { categories, feedGroups, minPriority }
        }
      })
    }
    
    // Transform signals with language preference using new structure
    const transformedSignals = signals.map(signal => {
      const meta = signal.government_signals_meta || {}
      const contentArray = signal.government_signals_content || []
      
      // Create language lookup
      const contentByLanguage = {}
      contentArray.forEach(content => {
        contentByLanguage[content.language] = content
      })
      
      // Determine which language to use (preference order)
      let selectedLanguage = 'en'
      let languageContent = contentByLanguage.en || {}
      
      for (const lang of languages) {
        if (contentByLanguage[lang] && contentByLanguage[lang].title) {
          selectedLanguage = lang
          languageContent = contentByLanguage[lang]
          break
        }
      }
      
      // Fallback to first available language if preferred not found
      if (!languageContent.title) {
        const availableLanguages = Object.keys(contentByLanguage)
        if (availableLanguages.length > 0) {
          selectedLanguage = availableLanguages[0]
          languageContent = contentByLanguage[selectedLanguage]
        }
      }
      
      return {
        id: signal.id,
        source_identifier: signal.source_identifier,
        feed_group: signal.feed_group,
        category: signal.category,
        priority_score: signal.priority_score,
        processing_status: signal.processing_status,
        
        // Content in preferred language
        title: languageContent.title || 'Untitled',
        body: languageContent.body || '',
        language_used: selectedLanguage,
        
        // Metadata from new structure
        published_at: meta.published_at,
        notice_id: meta.notice_id,
        urls: meta.urls || {},
        
        // Content quality indicators
        word_count: languageContent.word_count || 0,
        scraped_at: languageContent.scraped_at,
        
        // Available languages
        available_languages: Object.keys(contentByLanguage),
        content_complete: signal.processing_status === 'content_complete' || signal.processing_status === 'enriched',
        
        // Timestamps
        created_at: signal.created_at,
        updated_at: signal.updated_at
      }
    })
    
    return NextResponse.json({
      success: true,
      data: transformedSignals,
      metadata: {
        count: transformedSignals.length,
        offset,
        limit,
        languages,
        filters: { categories, feedGroups, minPriority, includePartial }
      }
    })
    
  } catch (error) {
    console.error('❌ Government Signals API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

/**
 * POST /api/v2/government-signals
 * Manually trigger signal processing (admin only)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, source_identifier, feed_group } = body
    
    // Basic authentication check (extend as needed)
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 })
    }
    
    console.log('🔧 Manual signal processing triggered:', { action, source_identifier, feed_group })
    
    switch (action) {
      case 'refresh_feeds':
        // Trigger feed refresh
        const { getSignalsAggregator } = await import('@/lib/government-signals-aggregator')
        const aggregator = getSignalsAggregator()
        const result = await aggregator.processAllFeeds()
        
        return NextResponse.json({
          success: true,
          action: 'refresh_feeds',
          result
        })
      
      case 'scrape_content':
        // Trigger content scraping
        const { getSignalsScraper } = await import('@/lib/government-signals-scraper')
        const scraper = getSignalsScraper()
        
        if (source_identifier) {
          // Scrape specific signal
          const scrapeResult = await scraper.processSingleSignalById(source_identifier)
          return NextResponse.json({
            success: true,
            action: 'scrape_content',
            target: source_identifier,
            result: scrapeResult
          })
        } else {
          // Scrape all incomplete signals
          const scrapeResult = await scraper.processIncompleteSignals(10)
          return NextResponse.json({
            success: true,
            action: 'scrape_content',
            result: scrapeResult
          })
        }
      
      case 'get_statistics':
        // Get processing statistics
        const [aggregatorStats, scraperStats] = await Promise.all([
          (await import('@/lib/government-signals-aggregator')).getSignalsAggregator().getProcessingStatistics(),
          (await import('@/lib/government-signals-scraper')).getSignalsScraper().getScrapingStatistics()
        ])
        
        return NextResponse.json({
          success: true,
          action: 'get_statistics',
          statistics: {
            aggregation: aggregatorStats,
            scraping: scraperStats
          }
        })
      
      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action',
          available_actions: ['refresh_feeds', 'scrape_content', 'get_statistics']
        }, { status: 400 })
    }
    
  } catch (error) {
    console.error('❌ Manual processing error:', error)
    return NextResponse.json({
      success: false,
      error: 'Processing failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}