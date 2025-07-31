// Debug script to investigate environment category issues
// Run with: node debug-environment-category.js

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function debugEnvironmentCategory() {
  console.log('🔍 Debugging Environment Category Issues...\n')

  try {
    // 1. Check all CHP sources in the database
    console.log('1. Checking all CHP sources in incidents table:')
    const { data: chpIncidents, error: chpError } = await supabase
      .from('incidents')
      .select('source_slug, category, title, created_at')
      .ilike('source_slug', 'chp_%')
      .order('created_at', { ascending: false })
      .limit(10)

    if (chpError) {
      console.error('Error fetching CHP incidents:', chpError)
    } else {
      console.log(`Found ${chpIncidents.length} CHP incidents:`)
      chpIncidents.forEach(incident => {
        console.log(`- ${incident.source_slug} | ${incident.category} | ${incident.title.substring(0, 50)}...`)
      })
    }

    console.log('\n2. Checking incidents_public materialized view:')
    const { data: publicIncidents, error: publicError } = await supabase
      .from('incidents_public')
      .select('source_slug, category, title, created_at')
      .ilike('source_slug', 'chp_%')
      .order('created_at', { ascending: false })
      .limit(10)

    if (publicError) {
      console.error('Error fetching from incidents_public:', publicError)
    } else {
      console.log(`Found ${publicIncidents.length} CHP incidents in public view:`)
      publicIncidents.forEach(incident => {
        console.log(`- ${incident.source_slug} | ${incident.category} | ${incident.title.substring(0, 50)}...`)
      })
    }

    console.log('\n3. Testing environment category API query:')
    const { data: envIncidents, error: envError } = await supabase
      .from('incidents_public')
      .select('source_slug, category, title, created_at')
      .or('category.eq.environment,source_slug.like.chp_%')
      .not('source_slug', 'like', 'ha_%')
      .order('created_at', { ascending: false })
      .limit(10)

    if (envError) {
      console.error('Error testing environment query:', envError)
    } else {
      console.log(`Environment query returned ${envIncidents.length} incidents:`)
      envIncidents.forEach(incident => {
        console.log(`- ${incident.source_slug} | ${incident.category} | ${incident.title.substring(0, 50)}...`)
      })
    }

    console.log('\n4. Checking category distribution:')
    const { data: categoryStats, error: statsError } = await supabase
      .from('incidents_public')
      .select('category, source_slug')
      .ilike('source_slug', 'chp_%')

    if (statsError) {
      console.error('Error fetching category stats:', statsError)
    } else {
      const stats = {}
      categoryStats.forEach(incident => {
        const key = `${incident.source_slug}_${incident.category}`
        stats[key] = (stats[key] || 0) + 1
      })
      console.log('Category distribution for CHP sources:')
      Object.entries(stats).forEach(([key, count]) => {
        console.log(`- ${key}: ${count} incidents`)
      })
    }

    console.log('\n5. Testing the exact API call for environment category:')
    const apiQuery = supabase
      .from('incidents_public')
      .select('*')
      .not('source_slug', 'like', 'ha_%')
      .or('category.eq.environment,source_slug.like.chp_%')
      .order('relevance_score', { ascending: false })
      .order('source_updated_at', { ascending: false })
      .range(0, 19)

    const { data: apiResult, error: apiError } = await apiQuery

    if (apiError) {
      console.error('Error testing API query:', apiError)
    } else {
      console.log(`API query returned ${apiResult.length} incidents:`)
      apiResult.slice(0, 5).forEach(incident => {
        console.log(`- ${incident.source_slug} | ${incident.category} | ${incident.title.substring(0, 50)}...`)
      })
    }

    console.log('\n6. Checking for recent incidents:')
    const { data: recentIncidents, error: recentError } = await supabase
      .from('incidents_public')
      .select('source_slug, category, title, source_updated_at')
      .ilike('source_slug', 'chp_%')
      .gte('source_updated_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order('source_updated_at', { ascending: false })
      .limit(10)

    if (recentError) {
      console.error('Error fetching recent incidents:', recentError)
    } else {
      console.log(`Found ${recentIncidents.length} recent CHP incidents (last 7 days):`)
      recentIncidents.forEach(incident => {
        console.log(`- ${incident.source_slug} | ${incident.category} | ${incident.source_updated_at} | ${incident.title.substring(0, 50)}...`)
      })
    }

  } catch (error) {
    console.error('Debug script error:', error)
  }
}

debugEnvironmentCategory()