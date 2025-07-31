#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function debugIncidentFreshness() {
  console.log('🔍 Debugging incident data freshness...')
  console.log('Current time:', new Date().toISOString())
  console.log()

  try {
    // 1. Check raw incidents table data (what admin sees)
    console.log('1. Checking raw incidents table (admin view)...')
    const { data: rawIncidents, error: rawError } = await supabase
      .from('incidents')
      .select('id, title, source_updated_at, source_slug, category, enrichment_status')
      .order('source_updated_at', { ascending: false })
      .limit(10)

    if (rawError) {
      console.error('Error fetching raw incidents:', rawError)
    } else {
      console.log(`Found ${rawIncidents.length} incidents in raw table:`)
      rawIncidents.forEach((incident, index) => {
        console.log(`  ${index + 1}. [${incident.source_slug}] ${incident.title.slice(0, 60)}...`)
        console.log(`      Updated: ${incident.source_updated_at} | Status: ${incident.enrichment_status}`)
      })
    }
    console.log()

    // 2. Check materialized view data (what public sees)
    console.log('2. Checking incidents_public materialized view (public API)...')
    const { data: publicIncidents, error: publicError } = await supabase
      .from('incidents_public')
      .select('id, title, source_updated_at, source_slug, category, enrichment_status')
      .order('source_updated_at', { ascending: false })
      .limit(10)

    if (publicError) {
      console.error('Error fetching public incidents:', publicError)
    } else {
      console.log(`Found ${publicIncidents.length} incidents in public view:`)
      publicIncidents.forEach((incident, index) => {
        console.log(`  ${index + 1}. [${incident.source_slug}] ${incident.title.slice(0, 60)}...`)
        console.log(`      Updated: ${incident.source_updated_at} | Status: ${incident.enrichment_status}`)
      })
    }
    console.log()

    // 3. Check for discrepancies
    console.log('3. Comparing data freshness...')
    if (rawIncidents.length > 0 && publicIncidents.length > 0) {
      const latestRaw = new Date(rawIncidents[0].source_updated_at)
      const latestPublic = new Date(publicIncidents[0].source_updated_at)
      
      console.log(`Latest in raw table: ${latestRaw.toISOString()}`)
      console.log(`Latest in public view: ${latestPublic.toISOString()}`)
      
      const timeDiff = latestRaw.getTime() - latestPublic.getTime()
      const hoursDiff = timeDiff / (1000 * 60 * 60)
      
      if (timeDiff > 0) {
        console.log(`🚨 PUBLIC VIEW IS STALE by ${hoursDiff.toFixed(2)} hours!`)
      } else {
        console.log(`✅ Public view is up to date`)
      }
    }
    console.log()

    // 4. Try to refresh the materialized view
    console.log('4. Attempting to refresh materialized view...')
    const { error: refreshError } = await supabase.rpc('refresh_incidents_public')
    
    if (refreshError) {
      console.error('❌ Refresh failed:', refreshError.message)
      
      // Try non-concurrent refresh if concurrent fails
      console.log('5. Trying non-concurrent refresh...')
      const { error: nonConcurrentError } = await supabase
        .rpc('sql', { query: 'REFRESH MATERIALIZED VIEW incidents_public;' })
      
      if (nonConcurrentError) {
        console.error('❌ Non-concurrent refresh also failed:', nonConcurrentError.message)
      } else {
        console.log('✅ Non-concurrent refresh succeeded!')
      }
    } else {
      console.log('✅ Materialized view refresh succeeded!')
    }
    console.log()

    // 5. Check public view again after refresh
    console.log('6. Checking public view after refresh...')
    const { data: refreshedIncidents, error: refreshedError } = await supabase
      .from('incidents_public')
      .select('id, title, source_updated_at, source_slug, category, enrichment_status')
      .order('source_updated_at', { ascending: false })
      .limit(5)

    if (refreshedError) {
      console.error('Error fetching refreshed incidents:', refreshedError)
    } else {
      console.log(`Found ${refreshedIncidents.length} incidents in refreshed view:`)
      refreshedIncidents.forEach((incident, index) => {
        console.log(`  ${index + 1}. [${incident.source_slug}] ${incident.title.slice(0, 60)}...`)
        console.log(`      Updated: ${incident.source_updated_at}`)
      })
    }

    // 6. Test what the public API actually returns
    console.log()
    console.log('7. Testing public API response...')
    const response = await fetch('http://localhost:3000/api/signals?limit=5')
    if (response.ok) {
      const apiData = await response.json()
      console.log(`API returned ${apiData.articles?.length || 0} articles:`)
      apiData.articles?.forEach((article, index) => {
        console.log(`  ${index + 1}. [${article.source_slug}] ${article.title.slice(0, 60)}...`)
        console.log(`      Updated: ${article.source_updated_at}`)
      })
    } else {
      console.log('❌ Failed to fetch from public API:', response.statusText)
    }

  } catch (error) {
    console.error('💥 Script failed:', error.message)
  }
}

debugIncidentFreshness()