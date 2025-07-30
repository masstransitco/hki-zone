import { type NextRequest, NextResponse } from "next/server"
import { createClient } from '@supabase/supabase-js'
import { convertTraditionalToSimplified } from '@/lib/chinese-converter'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const category = searchParams.get("category")
    const language = searchParams.get("language") || 'en'
    const page = parseInt(searchParams.get("page") || "0")
    const limit = parseInt(searchParams.get("limit") || "50")
    const source = searchParams.get("source")

    console.log("Unified Signals API called with params:", { 
      category, language, page, limit, source 
    })

    // Use the database function for clean language handling
    const { data: incidents, error } = await supabase.rpc('get_incidents_with_language', {
      p_language: language,
      p_category: category === 'top_signals' ? null : category,
      p_limit: limit + 1, // Fetch one extra to check hasMore
      p_offset: page * limit
    })

    if (error) {
      console.error("Error fetching incidents:", error)
      return NextResponse.json({
        error: "Failed to fetch incidents",
        debug: error.message
      }, { status: 500 })
    }

    // Don't filter out incidents - the database function already handles language fallback
    const validIncidents = incidents
    
    // Check if there are more incidents
    const hasMore = validIncidents.length > limit
    const paginatedIncidents = hasMore ? validIncidents.slice(0, limit) : validIncidents

    // Transform to match expected format
    const transformedIncidents = paginatedIncidents.map((incident: any) => {
      // Handle conversion for Simplified Chinese if needed
      let title = incident.title
      let body = incident.body
      let feedName = incident.feed_name
      let isConverted = false
      
      // If user requested Simplified Chinese but content is not available
      // and we have a fallback to Traditional Chinese, convert it
      if (language === 'zh-CN' && !incident.has_translation && incident.original_language === 'zh-TW') {
        title = convertTraditionalToSimplified(title)
        body = convertTraditionalToSimplified(body)
        feedName = convertTraditionalToSimplified(feedName)
        isConverted = true
      }
      
      return {
        id: incident.id,
        title: title,
        category: incident.category,
        url: `https://hki.zone/signals/${incident.id}`,
        article_status: incident.enrichment_status,
        article_html: body,
        lede: body,
        source: feedName,
        author: "Government Source",
        created_at: incident.source_published_at,
        updated_at: incident.source_published_at,
        
        // Language metadata
        has_translation: incident.has_translation,
        original_language: incident.original_language,
        requested_language: language,
        is_converted: isConverted, // Track if content was converted from Traditional to Simplified
        
        // Additional fields
        severity: incident.severity,
        relevance_score: incident.relevance_score,
        source_published_at: incident.source_published_at,
        enrichment_status: incident.enrichment_status,
        link: incident.link,
        
        // Frontend compatibility fields
        body: body,
        source_slug: incident.feed_slug, // Now coming from database function
        source_updated_at: incident.source_published_at // Frontend expects this field name
      }
    })

    // Get language coverage statistics
    const { data: coverageStats } = await supabase
      .from('gov_feeds_language_coverage')
      .select('*')
      .order('department', { ascending: true })

    return NextResponse.json({
      signals: transformedIncidents,
      total: paginatedIncidents.length,
      page,
      limit,
      hasMore,
      metadata: {
        source: 'unified_government_feeds',
        language: language,
        last_updated: new Date().toISOString(),
        language_coverage: coverageStats || []
      }
    })

  } catch (error) {
    console.error("Error in unified signals API:", error)
    return NextResponse.json({
      error: "Failed to fetch signals",
      debug: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// POST endpoint for manual feed processing
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, feed_id } = body

    if (action === 'process_feeds') {
      // Import and run the unified feed processor
      const { getUnifiedFeeds } = await import('@/lib/government-feeds-unified')
      const unifiedFeeds = getUnifiedFeeds()
      
      await unifiedFeeds.processAllFeeds()
      
      return NextResponse.json({
        success: true,
        message: "Feed processing initiated",
        timestamp: new Date().toISOString()
      })
    }

    if (action === 'process_single_feed' && feed_id) {
      // Process a single feed group
      const { getUnifiedFeeds } = await import('@/lib/government-feeds-unified')
      const unifiedFeeds = getUnifiedFeeds()
      
      // Get feed configuration
      const { data: feed } = await supabase
        .from('gov_feeds_unified')
        .select('*')
        .eq('id', feed_id)
        .single()
      
      if (!feed) {
        return NextResponse.json({
          error: "Feed not found"
        }, { status: 404 })
      }
      
      // Process just this feed
      await unifiedFeeds.processFeedGroup(feed.base_slug, feed)
      
      return NextResponse.json({
        success: true,
        message: `Processed feed: ${feed.base_slug}`,
        timestamp: new Date().toISOString()
      })
    }

    return NextResponse.json({
      error: "Unknown action",
      available_actions: ['process_feeds', 'process_single_feed']
    }, { status: 400 })

  } catch (error) {
    console.error("Error in unified signals POST:", error)
    return NextResponse.json({
      error: "Failed to process request",
      debug: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}