#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.cli' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function testApiDirect() {
  console.log('🧪 Testing API Direct Query')
  console.log('===========================')
  
  try {
    // Test the raw query that the API should use
    const { data: incidents, error } = await supabase
      .from('incidents')
      .select(`
        id, source_slug, title, body, category, severity, 
        starts_at, source_updated_at, enrichment_status, enriched_title,
        enriched_summary, enriched_content, key_points, why_it_matters,
        key_facts, reporting_score, additional_sources, sources,
        enrichment_metadata, created_at, updated_at, image_url,
        relevance_score
      `)
      .not('source_slug', 'like', 'ha_%')
      .gte('source_updated_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order('source_updated_at', { ascending: false })
      .limit(5)
    
    if (error) {
      console.error('❌ Query failed:', error.message)
      return
    }
    
    console.log(`✅ Query successful! Found ${incidents.length} incidents:`)
    incidents.forEach((incident, index) => {
      const hoursAgo = ((new Date() - new Date(incident.source_updated_at)) / (1000 * 60 * 60)).toFixed(2)
      console.log(`  ${index + 1}. [${incident.source_slug}] ${incident.title.slice(0, 60)}...`)
      console.log(`      ${hoursAgo}h ago | Category: ${incident.category}`)
    })
    
    // Transform to match API format
    const transformed = incidents.map(incident => ({
      id: incident.id,
      title: incident.title,
      source_slug: incident.source_slug,
      source_updated_at: incident.source_updated_at,
      category: incident.category,
      severity: incident.severity,
      relevance_score: incident.relevance_score || 0,
      enrichment_status: incident.enrichment_status
    }))
    
    console.log()
    console.log('📋 Transformed data sample:')
    console.log(JSON.stringify(transformed[0], null, 2))
    
  } catch (error) {
    console.error('💥 Test failed:', error.message)
  }
}

testApiDirect()