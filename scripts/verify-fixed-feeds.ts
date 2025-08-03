import { createClient } from '@supabase/supabase-js'
import fetch from 'node-fetch'
import Parser from 'rss-parser'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const parser = new Parser({
  timeout: 10000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; HKI-Zone-Signals/2.0)',
  }
})

async function verifyFeeds() {
  console.log('🔍 Verifying fixed RSS feeds...\n')
  
  // Get only active feeds
  const { data: feedSources, error } = await supabase
    .from('government_feed_sources')
    .select('*')
    .eq('active', true)
    .order('department', { ascending: true })
  
  if (error || !feedSources) {
    console.error('❌ Error fetching feed sources:', error)
    return
  }
  
  let totalSuccess = 0
  let totalTested = 0
  
  for (const source of feedSources) {
    console.log(`\n📡 ${source.feed_group} (${source.department})`)
    
    // Test XML data feeds
    if (source.feed_type === 'xml_data' && source.urls.multilingual) {
      totalTested++
      try {
        const response = await fetch(source.urls.multilingual, {
          headers: { 'User-Agent': 'Mozilla/5.0' }
        })
        if (response.ok) {
          console.log(`  ✅ Multilingual XML: Working`)
          totalSuccess++
        } else {
          console.log(`  ❌ Multilingual XML: HTTP ${response.status}`)
        }
      } catch (error) {
        console.log(`  ❌ Multilingual XML: ${error.message}`)
      }
      continue
    }
    
    // Test each language
    for (const [lang, url] of Object.entries(source.urls)) {
      if (!url) continue
      totalTested++
      
      try {
        const feed = await parser.parseURL(url as string)
        console.log(`  ✅ ${lang}: ${feed.items.length} items`)
        totalSuccess++
      } catch (error) {
        console.log(`  ❌ ${lang}: ${error.message}`)
      }
    }
    
    // Show scraping config
    if (source.scraping_config?.enabled) {
      console.log(`  🔧 Scraping: Enabled`)
    } else if (source.scraping_config?.content_in_rss) {
      console.log(`  📄 Content: In RSS (no scraping needed)`)
    }
  }
  
  console.log(`\n\n✅ SUCCESS RATE: ${totalSuccess}/${totalTested} (${Math.round(totalSuccess/totalTested*100)}%)`)
  console.log(`📊 Active Feeds: ${feedSources.length}`)
  
  // Summary by department
  console.log('\n📈 DEPARTMENT SUMMARY:')
  const deptCounts = feedSources.reduce((acc, feed) => {
    acc[feed.department] = (acc[feed.department] || 0) + 1
    return acc
  }, {} as Record<string, number>)
  
  Object.entries(deptCounts).forEach(([dept, count]) => {
    console.log(`  ${dept}: ${count} active feeds`)
  })
}

verifyFeeds().catch(console.error)