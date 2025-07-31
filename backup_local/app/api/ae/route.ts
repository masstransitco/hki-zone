import { type NextRequest, NextResponse } from "next/server"
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get("limit") || "50")

    console.log("A&E API called with params:", { limit })

    // Build query specifically for A&E data (Hospital Authority feeds)
    let query = supabase
      .from('incidents_public')
      .select('*')
      .like('source_slug', 'ha_%')
      .order('source_updated_at', { ascending: false })
      .limit(limit)

    const { data: incidents, error } = await query

    if (error) {
      console.error("Error fetching A&E incidents:", error)
      return NextResponse.json({
        error: "Failed to fetch A&E incidents",
        debug: error.message
      }, { status: 500 })
    }

    // Transform incidents to match expected response format
    const transformedIncidents = incidents?.map(incident => ({
      id: incident.id,
      title: incident.title,
      category: incident.category,
      url: `https://hki.zone/ae/${incident.id}`,
      article_status: incident.enrichment_status,
      image_status: incident.image_url ? 'ready' : 'pending',
      article_html: incident.enriched_content || incident.body,
      lede: incident.body,
      image_url: incident.image_url,
      enhanced_title: incident.enriched_title,
      summary: incident.enriched_summary,
      key_points: incident.key_points,
      why_it_matters: incident.why_it_matters,
      source: `Hospital Authority`,
      author: "Hospital Authority",
      created_at: incident.created_at,
      updated_at: incident.updated_at,
      
      // A&E-specific fields
      severity: incident.severity,
      relevance_score: incident.relevance_score || 0,
      longitude: incident.longitude,
      latitude: incident.latitude,
      starts_at: incident.starts_at,
      source_updated_at: incident.source_updated_at,
      source_slug: incident.source_slug,
      enrichment_status: incident.enrichment_status
    })) || []

    return NextResponse.json({
      articles: transformedIncidents,
      total: transformedIncidents.length,
      metadata: {
        source: 'hospital_authority_ae',
        last_updated: new Date().toISOString(),
        categories_available: ['health'],
        enrichment_statuses: ['pending', 'enriched', 'ready', 'failed']
      }
    })

  } catch (error) {
    console.error("Error in A&E API:", error)
    return NextResponse.json({
      error: "Failed to fetch A&E data",
      debug: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}