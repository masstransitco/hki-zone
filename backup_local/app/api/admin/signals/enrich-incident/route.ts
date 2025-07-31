import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Incident } from '@/lib/types'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Enhanced incident enrichment using Perplexity API for research and analysis
async function enrichIncidentWithPerplexity(incident: Incident) {
  if (!process.env.PERPLEXITY_API_KEY) {
    throw new Error('PERPLEXITY_API_KEY not configured')
  }

  const prompt = `
You are an expert Hong Kong news analyst. Research this government incident and provide structured enrichment with additional sources:

INCIDENT DETAILS:
- Title: ${incident.title}
- Category: ${incident.category}
- Source: ${incident.source_slug}
- Content: ${incident.body || 'No additional details'}
- Severity: ${incident.severity}/10
- Location: ${incident.latitude && incident.longitude ? `${incident.latitude}, ${incident.longitude}` : 'Not specified'}
- Time: ${incident.source_updated_at}

Please research this incident and provide a structured analysis in the following format:

ENHANCED_TITLE: [A clear, concise headline that captures the key impact]

SUMMARY: [2-3 sentence summary of what happened and its significance]

KEY_FACTS:
• [First key verified fact about the incident]
• [Second key verified fact about the impact or consequences]
• [Third key verified fact that residents should know]

WHY_IT_MATTERS: [Single paragraph explaining the broader significance and impact on Hong Kong residents]

REPORTING_SCORE: [Score from 1-10 indicating how newsworthy this incident is for further reporting, where 1 = routine maintenance notice, 10 = major emergency affecting many people]

ADDITIONAL_SOURCES: [List any additional credible sources you found during research, formatted as: Title | URL | Brief description]

IMAGE_PROMPT: [Description for finding a relevant image, focusing on the type of incident and location]

Please ensure all facts are verified and focus on Hong Kong context and practical implications for residents.
  `

  try {
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar-pro',
        messages: [
          {
            role: 'system',
            content: 'You are a Hong Kong news expert providing structured incident analysis.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 800,
        temperature: 0.1,
      }),
    })

    if (!response.ok) {
      throw new Error(`Perplexity API error: ${response.status}`)
    }

    const data = await response.json()
    const content = data.choices[0]?.message?.content || ''
    
    // Parse the structured response
    const enrichedTitle = extractSection(content, 'ENHANCED_TITLE')
    const summary = extractSection(content, 'SUMMARY')
    const keyFactsText = extractSection(content, 'KEY_FACTS')
    const whyItMatters = extractSection(content, 'WHY_IT_MATTERS')
    const reportingScoreText = extractSection(content, 'REPORTING_SCORE')
    const additionalSourcesText = extractSection(content, 'ADDITIONAL_SOURCES')
    const imagePrompt = extractSection(content, 'IMAGE_PROMPT')

    // Parse key facts from bullet points
    const keyFacts = keyFactsText
      .split('\n')
      .filter(line => line.trim().startsWith('•'))
      .map(line => line.trim().substring(1).trim())
      .filter(fact => fact.length > 0)

    // Parse reporting score
    const reportingScore = parseInt(reportingScoreText.match(/\d+/)?.[0] || '5')

    // Parse additional sources
    const additionalSources = additionalSourcesText
      .split('\n')
      .filter(line => line.trim().length > 0 && line.includes('|'))
      .map(line => {
        const parts = line.split('|').map(part => part.trim())
        if (parts.length >= 3) {
          return {
            title: parts[0],
            url: parts[1],
            description: parts[2],
            domain: parts[1] ? new URL(parts[1]).hostname : '',
            accessed_at: new Date().toISOString()
          }
        }
        return null
      })
      .filter(source => source !== null)

    // Extract citations if available
    const citations = data.citations || []
    const sources = citations.map((citation: any) => ({
      title: citation.title,
      url: citation.url,
      domain: new URL(citation.url).hostname,
      description: citation.text?.substring(0, 100) + '...' || ''
    }))

    return {
      enriched_title: enrichedTitle || incident.title,
      enriched_summary: summary || incident.body?.substring(0, 200) + '...',
      enriched_content: content,
      key_points: keyFacts, // Changed from keyPoints to keyFacts
      why_it_matters: whyItMatters,
      image_prompt: imagePrompt,
      key_facts: keyFacts,
      reporting_score: reportingScore,
      additional_sources: additionalSources,
      sources: {
        citations: citations.map((c: any) => c.url),
        sources: sources,
        generated_at: new Date().toISOString()
      },
      enrichment_metadata: {
        enriched_at: new Date().toISOString(),
        ai_model: 'sonar-pro',
        enrichment_cost: estimateEnrichmentCost(content.length),
        search_queries: [incident.title, `${incident.category} ${incident.source_slug} Hong Kong`],
        reporting_score: reportingScore,
        additional_sources_count: additionalSources.length
      }
    }

  } catch (error) {
    console.error('Error enriching incident with Perplexity:', error)
    throw new Error('Failed to enrich incident with AI')
  }
}

function extractSection(content: string, section: string): string {
  const regex = new RegExp(`${section}:\\s*([^]*?)(?=\\n\\n[A-Z_]+:|$)`, 'i')
  const match = content.match(regex)
  return match ? match[1].trim() : ''
}

function estimateEnrichmentCost(contentLength: number): string {
  // Rough estimate based on token count (1 token ≈ 4 characters)
  const tokens = Math.ceil(contentLength / 4)
  const cost = tokens * 0.00002 // Approximate cost per token
  return cost.toFixed(6)
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { incidentId, incidentIds, options = {} } = body

    // Handle both single incident and batch processing
    const idsToProcess = incidentIds || (incidentId ? [incidentId] : [])
    
    if (!idsToProcess || idsToProcess.length === 0) {
      return NextResponse.json(
        { error: 'Incident ID or incident IDs are required' },
        { status: 400 }
      )
    }

    console.log('Enriching incidents:', idsToProcess.length, 'incidents')

    // Check if Perplexity API is configured
    if (!process.env.PERPLEXITY_API_KEY) {
      return NextResponse.json(
        { error: 'Perplexity API not configured. Please add PERPLEXITY_API_KEY to environment variables.' },
        { status: 503 }
      )
    }

    // Fetch the incidents
    const { data: incidents, error: fetchError } = await supabase
      .from('incidents')
      .select('*')
      .in('id', idsToProcess)

    if (fetchError || !incidents || incidents.length === 0) {
      return NextResponse.json(
        { error: 'No incidents found' },
        { status: 404 }
      )
    }

    // Process each incident
    const results = []
    const errors = []

    for (const incident of incidents) {
      // Check if incident is already enriched
      if (incident.enrichment_status === 'enriched' || incident.enrichment_status === 'ready') {
        errors.push(`Incident ${incident.id} is already enriched`)
        continue
      }

      try {
        // Perform AI enrichment
        const enrichmentResult = await enrichIncidentWithPerplexity(incident)

        // Update incident with enrichment
        const { data: updatedIncident, error: updateError } = await supabase
          .from('incidents')
          .update({
            enrichment_status: 'enriched',
            enriched_title: enrichmentResult.enriched_title,
            enriched_summary: enrichmentResult.enriched_summary,
            enriched_content: enrichmentResult.enriched_content,
            key_points: enrichmentResult.key_points,
            why_it_matters: enrichmentResult.why_it_matters,
            image_prompt: enrichmentResult.image_prompt,
            key_facts: enrichmentResult.key_facts,
            reporting_score: enrichmentResult.reporting_score,
            additional_sources: enrichmentResult.additional_sources,
            sources: enrichmentResult.sources,
            enrichment_metadata: enrichmentResult.enrichment_metadata,
            updated_at: new Date().toISOString()
          })
          .eq('id', incident.id)
          .select()
          .single()

        if (updateError) {
          console.error('Database update error:', updateError)
          errors.push(`Failed to save enriched incident ${incident.id}: ${updateError.message}`)
          continue
        }

        results.push({
          id: incident.id,
          title: incident.title,
          enriched_title: enrichmentResult.enriched_title,
          enrichment_cost: enrichmentResult.enrichment_metadata.enrichment_cost
        })

        // Add delay between enrichments to respect rate limits
        if (incidents.indexOf(incident) < incidents.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000))
        }

      } catch (enrichmentError) {
        console.error('Enrichment error for incident', incident.id, ':', enrichmentError)
        
        // Mark incident as failed
        await supabase
          .from('incidents')
          .update({
            enrichment_status: 'failed',
            enrichment_metadata: {
              failed_at: new Date().toISOString(),
              error: enrichmentError instanceof Error ? enrichmentError.message : 'Unknown error'
            }
          })
          .eq('id', incident.id)

        errors.push(`Failed to enrich incident ${incident.id}: ${enrichmentError instanceof Error ? enrichmentError.message : 'Unknown error'}`)
      }
    }

    // Refresh materialized view
    await supabase.rpc('refresh_incidents_public')

    return NextResponse.json({
      success: true,
      processed: results.length,
      errors: errors.length,
      results,
      errorDetails: errors,
      totalCost: results.reduce((sum, r) => sum + parseFloat(r.enrichment_cost), 0).toFixed(6)
    })

  } catch (error) {
    console.error('Enrich incident API error:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// GET endpoint to check enrichment status and configuration
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const incidentId = searchParams.get('incidentId')

    if (incidentId) {
      // Check specific incident status
      const { data: incident, error } = await supabase
        .from('incidents')
        .select('id, title, enrichment_status, enrichment_metadata')
        .eq('id', incidentId)
        .single()

      if (error || !incident) {
        return NextResponse.json(
          { error: 'Incident not found' },
          { status: 404 }
        )
      }

      return NextResponse.json({
        incident: {
          id: incident.id,
          title: incident.title,
          enrichment_status: incident.enrichment_status,
          enrichment_metadata: incident.enrichment_metadata
        },
        canEnrich: incident.enrichment_status === 'pending' || incident.enrichment_status === 'failed'
      })
    }

    // General configuration check
    const isConfigured = !!process.env.PERPLEXITY_API_KEY
    
    // Get enrichment statistics
    const { data: stats, error: statsError } = await supabase
      .from('incidents')
      .select('enrichment_status')

    const enrichmentStats = {
      total: 0,
      pending: 0,
      enriched: 0,
      ready: 0,
      failed: 0
    }

    if (!statsError && stats) {
      enrichmentStats.total = stats.length
      stats.forEach(incident => {
        enrichmentStats[incident.enrichment_status]++
      })
    }

    return NextResponse.json({
      configured: isConfigured,
      status: isConfigured ? 'ready' : 'not_configured',
      message: isConfigured 
        ? 'Perplexity API is configured and ready for incident enrichment'
        : 'Perplexity API key not found in environment variables',
      enrichmentStats
    })

  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Failed to check enrichment configuration',
        configured: false,
        status: 'error'
      },
      { status: 500 }
    )
  }
}