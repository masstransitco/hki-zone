import { type NextRequest, NextResponse } from "next/server"
import { createClient } from '@supabase/supabase-js'
import type { Incident } from "@/lib/types"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const dynamic = 'force-dynamic'

interface RouteParams {
  params: {
    id: string
  }
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = params

    if (!id) {
      return NextResponse.json({
        error: "Signal ID is required"
      }, { status: 400 })
    }

    console.log("Fetching signal:", id)

    // Fetch incident from database
    const { data: incident, error } = await supabase
      .from('incidents')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      console.error("Error fetching incident:", error)
      
      if (error.code === 'PGRST116') {
        return NextResponse.json({
          error: "Signal not found"
        }, { status: 404 })
      }
      
      return NextResponse.json({
        error: "Failed to fetch signal",
        debug: error.message
      }, { status: 500 })
    }

    if (!incident) {
      return NextResponse.json({
        error: "Signal not found"
      }, { status: 404 })
    }

    // Transform incident to match expected response format
    const transformedIncident = {
      id: incident.id,
      title: incident.enriched_title || incident.title,
      category: incident.category,
      url: `https://hki.zone/signals/${incident.id}`,
      article_status: incident.enrichment_status,
      image_status: incident.image_url ? 'ready' : 'pending',
      article_html: incident.enriched_content || incident.body,
      lede: incident.enriched_summary || incident.body?.substring(0, 200) + '...',
      image_url: incident.image_url,
      image_prompt: incident.image_prompt,
      enhanced_title: incident.enriched_title,
      summary: incident.enriched_summary,
      key_points: incident.key_points,
      why_it_matters: incident.why_it_matters,
      structured_sources: incident.sources,
      source: `Government ${incident.source_slug.toUpperCase()}`,
      author: "Government Source",
      created_at: incident.created_at,
      updated_at: incident.updated_at,
      
      // Incident-specific fields
      severity: incident.severity,
      ai_score: incident.ai_score,
      longitude: incident.longitude,
      latitude: incident.latitude,
      starts_at: incident.starts_at,
      source_updated_at: incident.source_updated_at,
      source_slug: incident.source_slug,
      enrichment_status: incident.enrichment_status,
      citations: incident.citations,
      enrichment_metadata: incident.enrichment_metadata
    }

    return NextResponse.json(transformedIncident)

  } catch (error) {
    console.error("Error in signal detail API:", error)
    return NextResponse.json({
      error: "Failed to fetch signal",
      debug: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// PATCH endpoint for updating incident enrichment
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = params
    const body = await request.json()

    if (!id) {
      return NextResponse.json({
        error: "Signal ID is required"
      }, { status: 400 })
    }

    console.log("Updating signal:", id, body)

    // Validate update fields
    const allowedFields = [
      'enrichment_status',
      'ai_score',
      'enriched_title',
      'enriched_summary',
      'enriched_content',
      'key_points',
      'why_it_matters',
      'image_url',
      'image_prompt',
      'sources',
      'citations',
      'enrichment_metadata'
    ]

    const updateData: any = {}
    for (const [key, value] of Object.entries(body)) {
      if (allowedFields.includes(key)) {
        updateData[key] = value
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({
        error: "No valid fields to update",
        allowed_fields: allowedFields
      }, { status: 400 })
    }

    // Update incident in database
    const { data: updatedIncident, error } = await supabase
      .from('incidents')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error("Error updating incident:", error)
      return NextResponse.json({
        error: "Failed to update signal",
        debug: error.message
      }, { status: 500 })
    }

    // Refresh materialized view
    await supabase.rpc('refresh_incidents_public')

    return NextResponse.json({
      success: true,
      message: "Signal updated successfully",
      incident: updatedIncident
    })

  } catch (error) {
    console.error("Error updating signal:", error)
    return NextResponse.json({
      error: "Failed to update signal",
      debug: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// DELETE endpoint for removing incidents
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = params

    if (!id) {
      return NextResponse.json({
        error: "Signal ID is required"
      }, { status: 400 })
    }

    console.log("Deleting signal:", id)

    // Delete incident from database
    const { error } = await supabase
      .from('incidents')
      .delete()
      .eq('id', id)

    if (error) {
      console.error("Error deleting incident:", error)
      return NextResponse.json({
        error: "Failed to delete signal",
        debug: error.message
      }, { status: 500 })
    }

    // Refresh materialized view
    await supabase.rpc('refresh_incidents_public')

    return NextResponse.json({
      success: true,
      message: "Signal deleted successfully"
    })

  } catch (error) {
    console.error("Error deleting signal:", error)
    return NextResponse.json({
      error: "Failed to delete signal",
      debug: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}