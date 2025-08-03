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

    // Query the new government_signals table - get more data for proper ranking
    let query = supabase
      .from('government_signals')
      .select(`
        id,
        source_identifier,
        feed_group,
        category,
        priority_score,
        content,
        processing_status,
        created_at,
        updated_at
      `)
      .limit(500) // Get larger sample for proper ranking

    // Apply category filter if specified
    if (category && category !== 'top_signals') {
      query = query.eq('category', category)
    }

    // Include both complete and partial content (but exclude failed/error states)
    query = query.in('processing_status', ['content_complete', 'enriched', 'content_partial'])

    const { data: incidents, error } = await query

    if (error) {
      console.error("Error fetching incidents:", error)
      return NextResponse.json({
        error: "Failed to fetch incidents",
        debug: error.message
      }, { status: 500 })
    }

    // Enhanced ranking system for government signals
    const rankedIncidents = incidents.map((incident: any) => {
      const content = incident.content || {}
      const meta = content.meta || {}
      const publishedAt = meta.published_at ? new Date(meta.published_at) : new Date(incident.created_at)
      const now = new Date()
      const ageInHours = (now.getTime() - publishedAt.getTime()) / (1000 * 60 * 60)
      
      // Calculate dynamic relevance score
      let relevanceScore = incident.priority_score || 50
      
      // 1. Recency boost (newer content gets higher relevance) - Enhanced for Transport signals
      if (ageInHours <= 6) {
        relevanceScore += 30 // Breaking news bonus  
      } else if (ageInHours <= 24) {
        relevanceScore += 20 // Recent news bonus  
      } else if (ageInHours <= 48) {
        relevanceScore += 10 // Still relevant bonus
      } else if (ageInHours <= 72) {
        relevanceScore += 5  // Moderately relevant
      } else {
        // Stronger age penalty for older content
        relevanceScore -= Math.floor(ageInHours / 24) * 5 // Age penalty increased from 2 to 5
      }
      
      // 2. Content urgency analysis
      const title = content.languages?.en?.title || content.languages?.['zh-TW']?.title || ''
      const body = content.languages?.en?.body || content.languages?.['zh-TW']?.body || ''
      const fullText = (title + ' ' + body).toLowerCase()
      
      // Urgency keywords detection
      const urgencyKeywords = [
        'emergency', 'urgent', 'immediate', 'alert', 'warning', 'closure', 'suspended',
        'evacuation', 'typhoon', 'severe', 'critical', 'dangerous', 'accident'
      ]
      const emergencyBoost = urgencyKeywords.filter(keyword => fullText.includes(keyword)).length * 15
      relevanceScore += emergencyBoost
      
      // Transportation priority keywords - ENHANCED
      const transportKeywords = [
        'highway', 'tunnel', 'bridge', 'mtr', 'airport', 'ferry', 'bus route', 'road',
        'traffic', 'lane', 'closure', 'suspension', 'works', 'arrangement'
      ]
      const transportBoost = transportKeywords.filter(keyword => fullText.includes(keyword)).length * 12 // Increased from 8 to 12
      relevanceScore += transportBoost
      
      // 3. Feed-specific adjustments - ENHANCED
      const feedGroup = incident.feed_group || ''
      if (feedGroup.includes('warning') || feedGroup.includes('earthquake')) {
        relevanceScore += 25 // Safety alerts get priority
      } else if (feedGroup.includes('td_notices') || feedGroup.includes('td_special') || feedGroup.includes('td_road')) {
        relevanceScore += 30 // Transport notices get high priority
      } else if (feedGroup.includes('td_press')) {
        relevanceScore += 15 // Transport press releases also important
      } else if (feedGroup.includes('9day') || feedGroup.includes('forecast')) {
        relevanceScore -= 15 // Weather forecasts are less urgent than warnings (increased penalty)
      } else if (feedGroup.includes('hkma_press')) {
        relevanceScore -= 10 // HKMA press releases are informational (new penalty)
      } else if (feedGroup.includes('press')) {
        relevanceScore -= 5 // Other press releases are informational
      }
      
      // 4. Content completeness bonus
      if (incident.processing_status === 'content_complete') {
        relevanceScore += 5
      } else if (incident.processing_status === 'enriched') {
        relevanceScore += 10
      }
      
      // Ensure minimum relevance score
      relevanceScore = Math.max(relevanceScore, 10)
      
      return {
        ...incident,
        calculated_relevance: relevanceScore,
        published_at: publishedAt,
        age_hours: ageInHours
      }
    })
    
    // Sort by calculated relevance (desc), then by published date (desc)
    rankedIncidents.sort((a, b) => {
      if (b.calculated_relevance !== a.calculated_relevance) {
        return b.calculated_relevance - a.calculated_relevance
      }
      return b.published_at.getTime() - a.published_at.getTime()
    })
    
    // Apply pagination after ranking
    const startIndex = page * limit
    const endIndex = startIndex + limit
    const hasMore = rankedIncidents.length > endIndex
    const paginatedIncidents = rankedIncidents.slice(startIndex, endIndex)

    // Transform to match expected format
    const transformedIncidents = paginatedIncidents.map((incident: any) => {
      const content = incident.content || {}
      const languages_content = content.languages || {}
      const meta = content.meta || {}
      
      // Determine which language to use (preference order)
      let selectedLanguage = 'en'
      let languageContent = languages_content.en || {}
      
      // Try to find requested language
      if (language && languages_content[language] && languages_content[language].title) {
        selectedLanguage = language
        languageContent = languages_content[language]
      } else if (language === 'zh-CN' && languages_content['zh-TW'] && languages_content['zh-TW'].title) {
        // Fallback from Simplified to Traditional Chinese
        selectedLanguage = 'zh-TW'
        languageContent = languages_content['zh-TW']
      }
      
      // Extract content with fallbacks
      let title = languageContent.title || 'Untitled'
      let body = languageContent.body || ''
      let isConverted = false
      
      // Handle conversion for Simplified Chinese if needed
      if (language === 'zh-CN' && selectedLanguage === 'zh-TW') {
        title = convertTraditionalToSimplified(title)
        body = convertTraditionalToSimplified(body)
        isConverted = true
      }
      
      // Generate feed name from feed group
      const feedName = incident.feed_group?.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()) || 'Government Source'
      
      return {
        id: incident.id,
        title: title,
        category: incident.category,
        url: `https://hki.zone/signals/${incident.id}`,
        article_status: incident.processing_status,
        article_html: body,
        lede: body,
        source: feedName,
        author: "Government Source",
        created_at: incident.published_at?.toISOString() || incident.created_at,
        updated_at: incident.updated_at,
        
        // Language metadata
        has_translation: Object.keys(languages_content).length > 1,
        original_language: selectedLanguage,
        requested_language: language,
        is_converted: isConverted,
        
        // Ranking metadata (for debugging)
        calculated_relevance: incident.calculated_relevance,
        age_hours: Math.round(incident.age_hours * 10) / 10,
        base_priority: incident.priority_score,
        
        // Additional fields
        severity: incident.calculated_relevance,
        relevance_score: incident.calculated_relevance,
        source_published_at: meta.published_at || incident.created_at,
        enrichment_status: incident.processing_status,
        link: meta.urls?.[selectedLanguage] || meta.urls?.en || '',
        
        // Frontend compatibility fields
        body: body,
        source_slug: incident.feed_group,
        source_updated_at: meta.published_at || incident.created_at,
        
        // Additional metadata
        available_languages: Object.keys(languages_content),
        word_count: languageContent.word_count || 0,
        source_identifier: incident.source_identifier
      }
    })

    // Get language coverage statistics from the new schema
    const { data: coverageStats } = await supabase
      .from('government_feed_sources')
      .select('feed_group, department, feed_type, urls')
      .eq('active', true)
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