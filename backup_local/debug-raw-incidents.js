#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function debugRawIncidents() {
  console.log('🔍 Debugging raw incidents data...')
  console.log('Current time:', new Date().toISOString())
  console.log()

  try {
    // 1. Check all raw incidents by source and date
    console.log('1. Checking incidents by source slug and date...')
    const { data: incidents, error } = await supabase
      .from('incidents')
      .select('id, title, source_slug, source_updated_at, category, enrichment_status')
      .order('source_updated_at', { ascending: false })
      .limit(50)

    if (error) {
      console.error('Error fetching incidents:', error)
      return
    }

    // Group by source and show count by date
    const sourceStats = {}
    const recentIncidents = []
    const now = new Date()

    incidents.forEach(incident => {
      const sourceSlug = incident.source_slug
      const incidentDate = new Date(incident.source_updated_at)
      const hoursAgo = (now - incidentDate) / (1000 * 60 * 60)
      
      if (!sourceStats[sourceSlug]) {
        sourceStats[sourceSlug] = { total: 0, recent: 0, latest: incidentDate }
      }
      
      sourceStats[sourceSlug].total++
      if (hoursAgo < 24) {
        sourceStats[sourceSlug].recent++
      }
      
      if (incidentDate > sourceStats[sourceSlug].latest) {
        sourceStats[sourceSlug].latest = incidentDate
      }

      if (hoursAgo < 48) { // Show incidents from last 48 hours
        recentIncidents.push({
          ...incident,
          hoursAgo: hoursAgo.toFixed(2)
        })
      }
    })

    console.log('📊 Statistics by source:')
    Object.entries(sourceStats).forEach(([source, stats]) => {
      const hoursAgo = ((now - stats.latest) / (1000 * 60 * 60)).toFixed(2)
      console.log(`  ${source}: ${stats.total} total, ${stats.recent} in last 24h, latest ${hoursAgo}h ago`)
    })
    console.log()

    console.log('📋 Recent incidents (last 48 hours):')
    if (recentIncidents.length === 0) {
      console.log('  ❌ No incidents found in the last 48 hours!')
    } else {
      recentIncidents.slice(0, 20).forEach((incident, index) => {
        console.log(`  ${index + 1}. [${incident.source_slug}] ${incident.title.slice(0, 60)}...`)
        console.log(`      ${incident.hoursAgo}h ago | Status: ${incident.enrichment_status}`)
      })
    }
    console.log()

    // 2. Check if we have non-AE incidents
    console.log('2. Checking for non-A&E government incidents...')
    const { data: nonAeIncidents, error: nonAeError } = await supabase
      .from('incidents')
      .select('id, title, source_slug, source_updated_at, category')
      .not('source_slug', 'like', 'ha_%')
      .order('source_updated_at', { ascending: false })
      .limit(20)

    if (nonAeError) {
      console.error('Error fetching non-A&E incidents:', nonAeError)
    } else {
      console.log(`Found ${nonAeIncidents.length} non-A&E incidents:`)
      nonAeIncidents.forEach((incident, index) => {
        const hoursAgo = ((now - new Date(incident.source_updated_at)) / (1000 * 60 * 60)).toFixed(2)
        console.log(`  ${index + 1}. [${incident.source_slug}] ${incident.title.slice(0, 60)}...`)
        console.log(`      ${hoursAgo}h ago | Category: ${incident.category}`)
      })
    }
    console.log()

    // 3. Check active feeds
    console.log('3. Checking active government feeds...')
    const { data: feeds, error: feedsError } = await supabase
      .from('gov_feeds')
      .select('*')
      .eq('active', true)
      .order('slug')

    if (feedsError) {
      console.error('Error fetching feeds:', feedsError)
    } else {
      console.log(`Found ${feeds.length} active feeds:`)
      feeds.forEach((feed, index) => {
        const lastSeen = feed.last_seen_pubdate ? new Date(feed.last_seen_pubdate) : null
        const lastSeenStr = lastSeen ? 
          `${((now - lastSeen) / (1000 * 60 * 60)).toFixed(2)}h ago` : 
          'Never'
        console.log(`  ${index + 1}. ${feed.slug}: ${feed.url}`)
        console.log(`      Last seen: ${lastSeenStr}`)
      })
    }

  } catch (error) {
    console.error('💥 Script failed:', error.message)
  }
}

debugRawIncidents()