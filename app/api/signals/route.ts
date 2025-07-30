import { type NextRequest, NextResponse } from "next/server"
import { createClient } from '@supabase/supabase-js'
import type { Incident, IncidentCategory, EnrichmentStatus } from "@/lib/types"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const dynamic = 'force-dynamic'

import { convertTraditionalToSimplified } from '@/lib/chinese-converter'

/**
 * Get display-friendly source name based on source slug and language
 */
function getDisplaySource(sourceSlug: string, language?: string | null): string {
  // Remove language suffixes for mapping
  const baseSlug = sourceSlug.replace(/_zh_(tw|cn)$/, '').replace(/_zh$/, '')
  
  // Traditional Chinese names
  const traditionalChineseNames: Record<string, string> = {
    'td_notices': '運輸署交通通告',
    'td_press': '運輸署新聞公報', 
    'td_special': '運輸署特別交通消息',
    'chp_press': '衞生防護中心新聞公報',
    'chp_disease': '衞生防護中心疾病監測',
    'chp_guidelines': '衞生防護中心指引',
    'chp_ncd': '衞生防護中心非傳染病',
    'hkma_press': '金管局新聞稿',
    'hkma_circulars': '金管局通告',
    'hkma_guidelines': '金管局指引',
    'hkma_speeches': '金管局演辭',
    'hko_warn': '天文台天氣警告',
    'hko_eq': '天文台地震資訊',
    'hko_felt_earthquake': '天文台有感地震',
    'news_gov_top': '政府新聞網頭條',
    'mtr_rail': '港鐵服務消息',
    'ha_ae_waiting': '醫管局急症室輪候時間',
    'emsd_util': '機電工程署停電通知'
  }
  
  // English names
  const englishNames: Record<string, string> = {
    'td_notices': 'Transport Dept Traffic Notices',
    'td_press': 'Transport Dept Press Release',
    'td_special': 'Transport Dept Special Traffic News',
    'chp_press': 'Health Protection Centre Press',
    'chp_disease': 'Health Protection Centre Disease Watch',
    'chp_guidelines': 'Health Protection Centre Guidelines',
    'chp_ncd': 'Health Protection Centre NCD',
    'hkma_press': 'HKMA Press Release',
    'hkma_circulars': 'HKMA Circulars',
    'hkma_guidelines': 'HKMA Guidelines',
    'hkma_speeches': 'HKMA Speeches',
    'hko_warn': 'Observatory Weather Warning',
    'hko_eq': 'Observatory Earthquake Info',
    'hko_felt_earthquake': 'Observatory Felt Earthquake',
    'news_gov_top': 'Government News Top Stories',
    'mtr_rail': 'MTR Service Update',
    'ha_ae_waiting': 'HA A&E Waiting Times',
    'emsd_util': 'EMSD Electricity Incidents'
  }
  
  // Use appropriate Chinese names based on language
  if (language === 'zh-TW') {
    return traditionalChineseNames[baseSlug] || `政府 ${baseSlug.toUpperCase()}`
  } else if (language === 'zh-CN') {
    // Convert Traditional Chinese names to Simplified
    const tradName = traditionalChineseNames[baseSlug]
    if (tradName) {
      return convertTraditionalToSimplified(tradName)
    }
    return `政府 ${baseSlug.toUpperCase()}`
  }
  
  // Default to English names
  return englishNames[baseSlug] || `Government ${baseSlug.toUpperCase()}`
}

/**
 * Check if the materialized view is stale by comparing latest timestamps
 * Returns true if we should use raw incidents table instead
 */
async function checkMaterializedViewStaleness(): Promise<boolean> {
  try {
    // Get latest timestamp from materialized view
    const { data: publicData, error: publicError } = await supabase
      .from('incidents_public')
      .select('source_updated_at')
      .order('source_updated_at', { ascending: false })
      .limit(1)
    
    // Get latest timestamp from raw incidents
    const { data: rawData, error: rawError } = await supabase
      .from('incidents')
      .select('source_updated_at')
      .order('source_updated_at', { ascending: false })
      .limit(1)
    
    if (publicError || rawError || !publicData[0] || !rawData[0]) {
      console.warn('Error checking view staleness, falling back to raw data:', publicError || rawError)
      return true // Use raw data as fallback
    }
    
    const publicLatest = new Date(publicData[0].source_updated_at)
    const rawLatest = new Date(rawData[0].source_updated_at)
    const stalenessHours = (rawLatest.getTime() - publicLatest.getTime()) / (1000 * 60 * 60)
    
    // Consider stale if difference is more than 2 hours
    const isStale = stalenessHours > 2
    
    if (isStale) {
      console.warn(`Materialized view is stale by ${stalenessHours.toFixed(2)} hours, using raw data`)
    }
    
    return isStale
  } catch (error) {
    console.error('Error checking materialized view staleness:', error)
    return true // Use raw data as fallback on error
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const category = searchParams.get("category") as IncidentCategory | null
    const status = searchParams.get("status") as EnrichmentStatus | null
    const search = searchParams.get("search")
    const page = parseInt(searchParams.get("page") || "0")
    const limit = parseInt(searchParams.get("limit") || "20")
    const severity = searchParams.get("severity")
    const source = searchParams.get("source")
    const language = searchParams.get("language") as 'en' | 'zh-TW' | 'zh-CN' | null

    console.log("Signals API called with params:", { 
      category, status, search, page, limit, severity, source, language 
    })

    // Check if materialized view is stale and fall back to raw data if needed
    const useRawData = await checkMaterializedViewStaleness()
    const tableName = useRawData ? 'incidents' : 'incidents_public'
    
    console.log(`Using ${tableName} for data (materialized view ${useRawData ? 'is stale' : 'is fresh'})`)

    // Language filtering will be applied in the standard query below

    // Build standard query - exclude A&E data (hospital authority feeds) from government RSS feeds
    let query = supabase
      .from(tableName)
      .select(useRawData ? `
        id, source_slug, title, body, category, severity, 
        starts_at, source_updated_at, enrichment_status, enriched_title,
        enriched_summary, enriched_content, key_points, why_it_matters,
        key_facts, reporting_score, additional_sources, sources,
        enrichment_metadata, created_at, updated_at, image_url,
        relevance_score, multilingual_content, language
      ` : '*')
      .not('source_slug', 'like', 'ha_%')
    
    // Apply 7-day filter when using raw data (to match materialized view behavior)
    if (useRawData) {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      query = query.gte('source_updated_at', sevenDaysAgo)
    }

    // Apply filters - now show ALL government content chronologically by default
    if (category === "top_signals" || !category) {
      // Show all government feeds chronologically (removed restriction to only certain sources)
      // This includes all 15+ active government feeds: HKMA, CHP, TD, HKO, news_gov_top, etc.
      query = query.not('source_slug', 'eq', 'null') // Show all government content
    } else if (category === "environment") {
      // For environment category, include both category-based and source-based filtering
      // Include all CHP sources: chp_disease, chp_press, chp_ncd, chp_guidelines
      query = query.or('category.eq.environment,source_slug.like.chp_%')
    } else if (category) {
      // For other specific categories
      query = query.eq('category', category)
    }

    if (status && status !== "all") {
      query = query.eq('enrichment_status', status)
    }
    // Show all incidents regardless of enrichment status for public view, including pending

    if (severity) {
      const severityNum = parseInt(severity)
      if (!isNaN(severityNum)) {
        query = query.gte('severity', severityNum)
      }
    }

    if (source) {
      query = query.eq('source_slug', source)
    }

    if (search) {
      const searchLower = search.toLowerCase()
      query = query.or(`title.ilike.%${searchLower}%,body.ilike.%${searchLower}%`)
    }

    // Apply language filtering with simplified, predictable logic
    if (language && language !== 'en') {
      console.log(`Filtering by language: ${language} with predictable fallback`)
      
      // Simplified approach: Get Chinese incidents where available, English fallback for feeds without Chinese variants
      // This ensures 1:1 content parity between languages
      
      // Get all English parent feeds that should have Chinese equivalents
      const { data: feedMappings } = await supabase
        .from('gov_feeds')
        .select('slug, parent_feed_slug')
        .eq('language', language)
        .not('parent_feed_slug', 'is', null)
      
      const parentFeedSlugs = feedMappings?.map(f => f.parent_feed_slug) || []
      
      if (parentFeedSlugs.length > 0) {
        // Get Chinese language incidents OR English incidents from feeds that don't have Chinese variants
        // This ensures every English feed item has a corresponding item shown in Chinese mode
        query = query.or(
          `language.eq.${language},and(language.eq.en,source_slug.not.in.(${parentFeedSlugs.join(',')}))`
        )
      } else {
        // If no parent feeds configured, just show Chinese language incidents
        query = query.eq('language', language)
      }
    } else if (language === 'en') {
      console.log(`Filtering by language: ${language}`)
      // For English, show only English language incidents and exclude Chinese-specific slugs
      query = query.eq('language', language)
        .not('source_slug', 'like', '%_zh_tw')
        .not('source_slug', 'like', '%_zh_cn')
        .not('source_slug', 'like', '%_zh')
    }

    // Apply pagination and ordering
    const startIndex = page * limit
    
    // Order chronologically with latest published first, then by relevance
    try {
      query = query
        .order('source_updated_at', { ascending: false })
        .order('relevance_score', { ascending: false })
        .range(startIndex, startIndex + limit)
    } catch (error) {
      // Fallback to ai_score if relevance_score doesn't exist
      query = query
        .order('source_updated_at', { ascending: false })
        .order('ai_score', { ascending: false })
        .range(startIndex, startIndex + limit)
    }

    const { data: incidents, error } = await query

    if (error) {
      console.error("Error fetching incidents:", error)
      return NextResponse.json({
        error: "Failed to fetch incidents",
        debug: error.message
      }, { status: 500 })
    }

    // Transform incidents to match expected response format
    const transformedIncidents = incidents?.map(incident => {
      // Determine if this is fallback content (English when user requested Chinese)
      // Only mark as fallback if it's English content shown in Chinese mode AND there should be a Chinese version
      const isFromFallback = language && language !== 'en' && incident.language === 'en' && 
        !incident.source_slug.includes('_zh')
      
      // Handle content based on requested language
      let title = incident.title
      let body = incident.body
      let enrichedContent = incident.enriched_content
      let enrichedTitle = incident.enriched_title
      let enrichedSummary = incident.enriched_summary
      
      // If user requested Simplified Chinese but we have Traditional Chinese content
      if (language === 'zh-CN' && incident.language === 'zh-TW') {
        title = convertTraditionalToSimplified(title)
        body = convertTraditionalToSimplified(body)
        if (enrichedContent) {
          enrichedContent = convertTraditionalToSimplified(enrichedContent)
        }
        if (enrichedTitle) {
          enrichedTitle = convertTraditionalToSimplified(enrichedTitle)
        }
        if (enrichedSummary) {
          enrichedSummary = convertTraditionalToSimplified(enrichedSummary)
        }
      }
      
      return {
        id: incident.id,
        title: title,
        category: incident.category,
        url: `https://hki.zone/signals/${incident.id}`,
        article_status: incident.enrichment_status,
        image_status: incident.image_url ? 'ready' : 'pending',
        article_html: enrichedContent || body,
        lede: body,
        image_url: incident.image_url,
        enhanced_title: enrichedTitle,
        summary: enrichedSummary,
        key_points: incident.key_points,
        why_it_matters: incident.why_it_matters,
        key_facts: incident.key_facts || [],
        reporting_score: incident.reporting_score || null,
        additional_sources: incident.additional_sources || [],
        structured_sources: incident.sources,
        source: getDisplaySource(incident.source_slug, language),
        author: "Government Source",
        created_at: incident.created_at,
        updated_at: incident.updated_at,
        
        // Incident-specific fields
        severity: incident.severity,
        relevance_score: incident.relevance_score || incident.ai_score || 0,
        longitude: incident.longitude,
        latitude: incident.latitude,
        starts_at: incident.starts_at,
        source_updated_at: incident.source_updated_at,
        source_slug: incident.source_slug,
        enrichment_status: incident.enrichment_status,
        
        // Language metadata
        content_language: incident.language,
        is_fallback: isFromFallback,
        is_converted: language === 'zh-CN' && incident.language === 'zh-TW' // Track if content was converted
      }
    }) || []

    // Check if there are more incidents
    const hasMore = transformedIncidents.length === limit + 1
    const paginatedIncidents = hasMore ? transformedIncidents.slice(0, limit) : transformedIncidents

    return NextResponse.json({
      articles: paginatedIncidents, // Keep 'articles' for backward compatibility
      signals: paginatedIncidents, // Also provide as 'signals'
      total: paginatedIncidents.length,
      page,
      limit,
      hasMore,
      metadata: {
        source: 'government_feeds',
        last_updated: new Date().toISOString(),
        categories_available: ['top_signals', 'road', 'rail', 'weather', 'utility', 'environment'],
        enrichment_statuses: ['pending', 'enriched', 'ready', 'failed']
      }
    })

  } catch (error) {
    console.error("Error in signals API:", error)
    return NextResponse.json({
      error: "Failed to fetch signals",
      debug: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// POST endpoint for manual refresh/processing
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action } = body

    if (action === 'refresh_view') {
      // Refresh the materialized view
      const { error } = await supabase.rpc('refresh_incidents_public')
      
      if (error) {
        console.error("Error refreshing materialized view:", error)
        return NextResponse.json({
          error: "Failed to refresh incidents view",
          debug: error.message
        }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        message: "Incidents public view refreshed successfully",
        timestamp: new Date().toISOString()
      })
    }

    return NextResponse.json({
      error: "Unknown action",
      available_actions: ['refresh_view']
    }, { status: 400 })

  } catch (error) {
    console.error("Error in signals POST:", error)
    return NextResponse.json({
      error: "Failed to process request",
      debug: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}