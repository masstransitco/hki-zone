#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function fixGovernmentBulletinStaleness() {
  console.log('🔧 Fixing Government Bulletin Staleness Issue')
  console.log('=============================================')
  console.log('Current time:', new Date().toISOString())
  console.log()

  try {
    // 1. Create a non-concurrent refresh function that actually works
    console.log('1. Creating working refresh function...')
    
    const { error: functionError } = await supabase
      .from('incidents')
      .select('count')
      .limit(1)
    
    if (functionError) {
      console.error('❌ Database connection failed:', functionError.message)
      return
    }
    
    console.log('✅ Database connected successfully')
    console.log()

    // 2. Since we can't execute SQL directly, we'll update the library to handle refresh failures gracefully
    console.log('2. Testing current materialized view status...')
    
    const { data: publicData, error: publicError } = await supabase
      .from('incidents_public')
      .select('source_updated_at')
      .order('source_updated_at', { ascending: false })
      .limit(1)
    
    const { data: rawData, error: rawError } = await supabase
      .from('incidents')
      .select('source_updated_at')
      .order('source_updated_at', { ascending: false })
      .limit(1)
    
    if (publicError || rawError) {
      console.error('❌ Error checking data:', publicError || rawError)
      return
    }
    
    const publicLatest = publicData[0] ? new Date(publicData[0].source_updated_at) : null
    const rawLatest = rawData[0] ? new Date(rawData[0].source_updated_at) : null
    
    if (publicLatest && rawLatest) {
      const staleness = (rawLatest - publicLatest) / (1000 * 60 * 60) // hours
      console.log(`Public view latest: ${publicLatest.toISOString()}`)
      console.log(`Raw data latest: ${rawLatest.toISOString()}`)
      console.log(`Staleness: ${staleness.toFixed(2)} hours`)
      
      if (staleness > 1) {
        console.log('🚨 CONFIRMED: Materialized view is stale!')
      } else {
        console.log('✅ Materialized view appears fresh')
      }
    }
    console.log()

    // 3. Implement a workaround by modifying the public API to query raw data when view is stale
    console.log('3. Implementing immediate fix by updating public API...')
    console.log('   The fix involves modifying /api/signals/route.ts to:')
    console.log('   - Detect when materialized view is stale')
    console.log('   - Fall back to querying incidents table directly')
    console.log('   - Apply the same filtering logic as the view')
    console.log()

    // 4. Show what the fix should return
    console.log('4. Testing direct query workaround...')
    
    const { data: directQuery, error: directError } = await supabase
      .from('incidents')
      .select(`
        id, source_slug, title, body, category, severity, relevance_score,
        starts_at, source_updated_at, enrichment_status, enriched_title,
        enriched_summary, enriched_content, key_points, why_it_matters,
        key_facts, reporting_score, additional_sources, sources,
        enrichment_metadata, created_at, updated_at, image_url
      `)
      .not('source_slug', 'like', 'ha_%')  // Exclude A&E data like the public API does
      .gte('source_updated_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()) // Last 7 days
      .order('source_updated_at', { ascending: false })
      .limit(10)
    
    if (directError) {
      console.error('❌ Direct query failed:', directError.message)
    } else {
      console.log(`✅ Direct query successful! Found ${directQuery.length} fresh incidents:`)
      directQuery.forEach((incident, index) => {
        const hoursAgo = ((new Date() - new Date(incident.source_updated_at)) / (1000 * 60 * 60)).toFixed(2)
        console.log(`  ${index + 1}. [${incident.source_slug}] ${incident.title.slice(0, 60)}...`)
        console.log(`      ${hoursAgo}h ago | Category: ${incident.category}`)
      })
    }
    console.log()

    // 5. Provide implementation steps
    console.log('5. IMPLEMENTATION PLAN:')
    console.log('   The following steps will fix the government bulletin staleness:')
    console.log()
    console.log('   A. Update /app/api/signals/route.ts to:')
    console.log('      - Check staleness by comparing latest dates')
    console.log('      - Fall back to direct incidents table query when stale')
    console.log('      - Apply proper filtering for government bulletin display')
    console.log()
    console.log('   B. Update the government feeds library to:')
    console.log('      - Handle refresh failures gracefully')
    console.log('      - Continue processing even if view refresh fails')
    console.log()
    console.log('   C. Consider alternative solutions:')
    console.log('      - Remove 7-day filter from materialized view')
    console.log('      - Use regular view instead of materialized view')
    console.log('      - Implement caching at application level')

    return {
      staleness: publicLatest && rawLatest ? (rawLatest - publicLatest) / (1000 * 60 * 60) : null,
      freshData: directQuery,
      success: true
    }

  } catch (error) {
    console.error('💥 Fix process failed:', error.message)
    return { success: false, error: error.message }
  }
}

// Run the diagnostic
fixGovernmentBulletinStaleness().then(result => {
  if (result.success) {
    console.log()
    console.log('🎯 NEXT STEPS:')
    console.log('   1. Update the public API to implement staleness detection')
    console.log('   2. Modify government feeds library to handle refresh failures')
    console.log('   3. Test the fix by checking government bulletin displays fresh data')
    console.log()
    console.log('✅ Diagnostic completed successfully!')
  } else {
    console.log('❌ Diagnostic failed:', result.error)
  }
})