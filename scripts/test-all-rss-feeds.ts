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

interface FeedTestResult {
  feed_group: string
  department: string
  language: string
  url: string
  status: 'success' | 'error'
  error?: string
  item_count?: number
}

async function testRSSFeed(url: string): Promise<{ success: boolean; items: number; error?: string }> {
  try {
    const feed = await parser.parseURL(url)
    return { success: true, items: feed.items.length }
  } catch (error) {
    return { success: false, items: 0, error: error.message }
  }
}

async function testXMLDataFeed(url: string): Promise<{ success: boolean; items: number; error?: string }> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; HKI-Zone-Signals/2.0)',
      }
    })
    
    if (!response.ok) {
      return { success: false, items: 0, error: `HTTP ${response.status}` }
    }
    
    const text = await response.text()
    const itemMatches = text.match(/<item>/gi) || []
    return { success: true, items: itemMatches.length }
  } catch (error) {
    return { success: false, items: 0, error: error.message }
  }
}

async function testAllFeeds() {
  console.log('🔍 Testing all RSS feeds for 3-language support...\n')
  
  // Get all feed sources
  const { data: feedSources, error } = await supabase
    .from('government_feed_sources')
    .select('*')
    .order('department', { ascending: true })
    .order('feed_group', { ascending: true })
  
  if (error || !feedSources) {
    console.error('❌ Error fetching feed sources:', error)
    return
  }
  
  const results: FeedTestResult[] = []
  const languages = ['en', 'zh-TW', 'zh-CN']
  
  for (const source of feedSources) {
    console.log(`\n📡 Testing ${source.feed_group} (${source.department})`)
    
    // Handle XML data feeds
    if (source.feed_type === 'xml_data' && source.urls.multilingual) {
      const result = await testXMLDataFeed(source.urls.multilingual)
      results.push({
        feed_group: source.feed_group,
        department: source.department,
        language: 'multilingual',
        url: source.urls.multilingual,
        status: result.success ? 'success' : 'error',
        error: result.error,
        item_count: result.items
      })
      
      const icon = result.success ? '✅' : '❌'
      console.log(`  ${icon} Multilingual XML: ${result.items} items ${result.error ? `(${result.error})` : ''}`)
      continue
    }
    
    // Test each language
    for (const lang of languages) {
      const url = source.urls[lang]
      
      if (!url) {
        results.push({
          feed_group: source.feed_group,
          department: source.department,
          language: lang,
          url: '',
          status: 'error',
          error: 'Missing URL'
        })
        console.log(`  ❌ ${lang}: Missing URL`)
        continue
      }
      
      const result = await testRSSFeed(url)
      results.push({
        feed_group: source.feed_group,
        department: source.department,
        language: lang,
        url: url,
        status: result.success ? 'success' : 'error',
        error: result.error,
        item_count: result.items
      })
      
      const icon = result.success ? '✅' : '❌'
      console.log(`  ${icon} ${lang}: ${result.items} items ${result.error ? `(${result.error})` : ''}`)
    }
  }
  
  // Summary
  console.log('\n\n📊 SUMMARY BY DEPARTMENT:')
  console.log('='.repeat(80))
  
  const departments = [...new Set(results.map(r => r.department))]
  
  for (const dept of departments) {
    const deptResults = results.filter(r => r.department === dept)
    const working = deptResults.filter(r => r.status === 'success').length
    const total = deptResults.length
    const percentage = Math.round((working / total) * 100)
    
    console.log(`\n${dept.toUpperCase()} (${working}/${total} - ${percentage}% working)`)
    
    // Group by feed
    const feeds = [...new Set(deptResults.map(r => r.feed_group))]
    for (const feed of feeds) {
      const feedResults = deptResults.filter(r => r.feed_group === feed)
      const status = feedResults.map(r => {
        if (r.language === 'multilingual') return r.status === 'success' ? '✅ XML' : '❌ XML'
        return r.status === 'success' ? `✅ ${r.language}` : `❌ ${r.language}`
      }).join(' ')
      console.log(`  ${feed}: ${status}`)
    }
  }
  
  // Feeds needing fixes
  console.log('\n\n🔧 FEEDS NEEDING FIXES:')
  console.log('='.repeat(80))
  
  const brokenFeeds = results.filter(r => r.status === 'error')
  const feedGroups = [...new Set(brokenFeeds.map(r => r.feed_group))]
  
  for (const feed of feedGroups) {
    const feedErrors = brokenFeeds.filter(r => r.feed_group === feed)
    console.log(`\n${feed}:`)
    for (const error of feedErrors) {
      console.log(`  - ${error.language}: ${error.error} ${error.url ? `(${error.url})` : ''}`)
    }
  }
  
  // Missing language support
  console.log('\n\n🌐 MISSING LANGUAGE SUPPORT:')
  console.log('='.repeat(80))
  
  for (const source of feedSources) {
    if (source.feed_type === 'xml_data') continue
    
    const missingLangs = []
    if (!source.urls.en) missingLangs.push('en')
    if (!source.urls['zh-TW']) missingLangs.push('zh-TW')
    if (!source.urls['zh-CN']) missingLangs.push('zh-CN')
    
    if (missingLangs.length > 0) {
      console.log(`${source.feed_group}: Missing ${missingLangs.join(', ')}`)
    }
  }
}

testAllFeeds().catch(console.error)