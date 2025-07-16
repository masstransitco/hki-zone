import { type NextRequest, NextResponse } from "next/server"
import { createClient } from '@supabase/supabase-js'
import type { Incident, IncidentCategory, EnrichmentStatus } from "@/lib/types"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const dynamic = 'force-dynamic'

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

    // Build query - exclude A&E data (hospital authority feeds) from signals
    let query = supabase
      .from('incidents_public')
      .select('*')
      .not('source_slug', 'like', 'ha_%')

    // Apply filters
    if (category && category !== "all") {
      query = query.eq('category', category)
    }

    if (status && status !== "all") {
      query = query.eq('enrichment_status', status)
    }
    // Show all incidents regardless of enrichment status for public view

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
    
    // Try to order by relevance_score, fallback to ai_score if column doesn't exist
    try {
      query = query
        .order('relevance_score', { ascending: false })
        .order('source_updated_at', { ascending: false })
        .range(startIndex, startIndex + limit)
    } catch (error) {
      // Fallback to ai_score if relevance_score doesn't exist
      query = query
        .order('ai_score', { ascending: false })
        .order('source_updated_at', { ascending: false })
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
        categories_available: ['road', 'rail', 'weather', 'utility'],
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