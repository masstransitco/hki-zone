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
    const page = parseInt(searchParams.get("page") || "0")
    const limit = parseInt(searchParams.get("limit") || "20")
    const category = searchParams.get("category") as IncidentCategory | null
    const status = searchParams.get("status") as EnrichmentStatus | null
    const search = searchParams.get("search")
    const severity = searchParams.get("severity")
    const source = searchParams.get("source")

    console.log("Admin signals API called with params:", { 
      page, limit, category, status, search, severity, source 
    })

    // Build query for admin view (show all incidents)
    let query = supabase
      .from('incidents')
      .select('*')

    // Apply filters
    if (category && category !== "all") {
      query = query.eq('category', category)
    }

    if (status && status !== "all") {
      query = query.eq('enrichment_status', status)
    }

    if (severity) {
      const severityNum = parseInt(severity)
      if (!isNaN(severityNum)) {
        query = query.gte('severity', severityNum)
      }
    }

    if (source && source !== "all") {
      query = query.eq('source_slug', source)
    }

    if (search && search.trim()) {
      const searchLower = search.toLowerCase()
      query = query.or(`title.ilike.%${searchLower}%,body.ilike.%${searchLower}%`)
    }

    // Apply pagination and ordering
    const offset = page * limit
    
    // Try to order by relevance_score, fallback to ai_score if column doesn't exist
    try {
      query = query
        .order('relevance_score', { ascending: false })
        .order('source_updated_at', { ascending: false })
        .range(offset, offset + limit)
    } catch (error) {
      // Fallback to ai_score if relevance_score doesn't exist
      query = query
        .order('ai_score', { ascending: false })
        .order('source_updated_at', { ascending: false })
        .range(offset, offset + limit)
    }

    const { data: incidents, error } = await query

    if (error) {
      console.error("Error fetching incidents:", error)
      return NextResponse.json({
        error: "Failed to fetch incidents",
        debug: error.message
      }, { status: 500 })
    }

    // Transform incidents for admin interface
    const transformedIncidents = incidents?.map(incident => ({
      id: incident.id,
      title: incident.title,
      body: incident.body,
      category: incident.category,
      severity: incident.severity,
      relevance_score: incident.relevance_score || incident.ai_score || 0, // Fallback to ai_score if relevance_score doesn't exist
      source_slug: incident.source_slug,
      longitude: incident.longitude,
      latitude: incident.latitude,
      starts_at: incident.starts_at,
      source_updated_at: incident.source_updated_at,
      enrichment_status: incident.enrichment_status,
      
      // Enrichment fields
      enriched_title: incident.enriched_title,
      enriched_summary: incident.enriched_summary,
      enriched_content: incident.enriched_content,
      key_points: incident.key_points,
      why_it_matters: incident.why_it_matters,
      image_url: incident.image_url,
      image_prompt: incident.image_prompt,
      key_facts: incident.key_facts || [], // Default to empty array if column doesn't exist
      reporting_score: incident.reporting_score || null, // Default to null if column doesn't exist
      additional_sources: incident.additional_sources || [], // Default to empty array if column doesn't exist
      sources: incident.sources,
      citations: incident.citations,
      enrichment_metadata: incident.enrichment_metadata,
      
      // Timestamps
      created_at: incident.created_at,
      updated_at: incident.updated_at
    })) || []

    // Check if there are more incidents
    const hasMore = transformedIncidents.length === limit + 1
    const paginatedIncidents = hasMore ? transformedIncidents.slice(0, limit) : transformedIncidents

    return NextResponse.json({
      incidents: paginatedIncidents,
      hasMore,
      total: paginatedIncidents.length,
      page,
      limit,
      usingMockData: false,
    })

  } catch (error) {
    console.error("Error in admin signals API:", error)
    
    return NextResponse.json({
      incidents: [],
      hasMore: false,
      total: 0,
      error: "Failed to fetch incidents",
      usingMockData: true,
    }, { status: 500 })
  }
}

// POST endpoint for batch operations
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, incidentIds, data } = body

    if (!action || !incidentIds || !Array.isArray(incidentIds)) {
      return NextResponse.json({
        error: "Invalid request body. Required: action, incidentIds (array)"
      }, { status: 400 })
    }

    switch (action) {
      case 'batch_enrich':
        return await handleBatchEnrich(incidentIds, data)
      case 'batch_delete':
        return await handleBatchDelete(incidentIds)
      case 'batch_update_status':
        return await handleBatchUpdateStatus(incidentIds, data?.status)
      default:
        return NextResponse.json({
          error: "Unknown action",
          available_actions: ['batch_enrich', 'batch_delete', 'batch_update_status']
        }, { status: 400 })
    }

  } catch (error) {
    console.error("Error in admin signals POST:", error)
    return NextResponse.json({
      error: "Failed to process batch operation",
      debug: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

async function handleBatchEnrich(incidentIds: string[], data: any) {
  const results = []
  const errors = []

  for (const incidentId of incidentIds) {
    try {
      const { data: incident, error } = await supabase
        .from('incidents')
        .select('*')
        .eq('id', incidentId)
        .single()

      if (error || !incident) {
        errors.push(`Incident ${incidentId} not found`)
        continue
      }

      // Mark as selected for enrichment
      const { error: updateError } = await supabase
        .from('incidents')
        .update({
          enrichment_status: 'enriched',
          enrichment_metadata: {
            ...incident.enrichment_metadata,
            selected_for_enrichment: true,
            selected_at: new Date().toISOString()
          }
        })
        .eq('id', incidentId)

      if (updateError) {
        errors.push(`Failed to update incident ${incidentId}: ${updateError.message}`)
      } else {
        results.push(incidentId)
      }

    } catch (error) {
      errors.push(`Error processing incident ${incidentId}: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  return NextResponse.json({
    success: true,
    message: `Marked ${results.length} incidents for enrichment`,
    enrichedIncidents: results,
    errors
  })
}

async function handleBatchDelete(incidentIds: string[]) {
  try {
    const { error } = await supabase
      .from('incidents')
      .delete()
      .in('id', incidentIds)

    if (error) {
      return NextResponse.json({
        error: "Failed to delete incidents",
        debug: error.message
      }, { status: 500 })
    }

    // Refresh materialized view
    await supabase.rpc('refresh_incidents_public')

    return NextResponse.json({
      success: true,
      message: `Successfully deleted ${incidentIds.length} incidents`,
      deletedCount: incidentIds.length
    })

  } catch (error) {
    return NextResponse.json({
      error: "Failed to delete incidents",
      debug: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

async function handleBatchUpdateStatus(incidentIds: string[], status: EnrichmentStatus) {
  if (!status) {
    return NextResponse.json({
      error: "Status is required for batch status update"
    }, { status: 400 })
  }

  try {
    const { error } = await supabase
      .from('incidents')
      .update({ enrichment_status: status })
      .in('id', incidentIds)

    if (error) {
      return NextResponse.json({
        error: "Failed to update incident statuses",
        debug: error.message
      }, { status: 500 })
    }

    // Refresh materialized view
    await supabase.rpc('refresh_incidents_public')

    return NextResponse.json({
      success: true,
      message: `Successfully updated ${incidentIds.length} incidents to ${status}`,
      updatedCount: incidentIds.length,
      newStatus: status
    })

  } catch (error) {
    return NextResponse.json({
      error: "Failed to update incident statuses",
      debug: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}