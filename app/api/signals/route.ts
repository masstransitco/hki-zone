import { type NextRequest, NextResponse } from "next/server"
import { createClient } from '@supabase/supabase-js'
import type { Incident, IncidentCategory, EnrichmentStatus } from "@/lib/types"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const dynamic = 'force-dynamic'

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

    console.log("Signals API called with params:", { 
      category, status, search, page, limit, severity, source 
    })

    // Check if materialized view is stale and fall back to raw data if needed
    const useRawData = await checkMaterializedViewStaleness()
    const tableName = useRawData ? 'incidents' : 'incidents_public'
    
    console.log(`Using ${tableName} for data (materialized view ${useRawData ? 'is stale' : 'is fresh'})`)

    // Build query - exclude A&E data (hospital authority feeds) from signals
    let query = supabase
      .from(tableName)
      .select(useRawData ? `
        id, source_slug, title, body, category, severity, 
        starts_at, source_updated_at, enrichment_status, enriched_title,
        enriched_summary, enriched_content, key_points, why_it_matters,
        key_facts, reporting_score, additional_sources, sources,
        enrichment_metadata, created_at, updated_at, image_url,
        relevance_score
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
    const transformedIncidents = incidents?.map(incident => ({
      id: incident.id,
      title: incident.title, // Always show original title
      category: incident.category,
      url: `https://hki.zone/signals/${incident.id}`,
      article_status: incident.enrichment_status,
      image_status: incident.image_url ? 'ready' : 'pending',
      article_html: incident.enriched_content || incident.body,
      lede: incident.body, // Always show original government content as lede
      image_url: incident.image_url,
      enhanced_title: incident.enriched_title,
      summary: incident.enriched_summary, // AI-enhanced summary
      key_points: incident.key_points,
      why_it_matters: incident.why_it_matters,
      key_facts: incident.key_facts || [],
      reporting_score: incident.reporting_score || null,
      additional_sources: incident.additional_sources || [],
      structured_sources: incident.sources,
      source: `Government ${incident.source_slug.toUpperCase()}`,
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
      enrichment_status: incident.enrichment_status
    })) || []

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