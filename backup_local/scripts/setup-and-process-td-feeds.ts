import dotenv from 'dotenv'
dotenv.config({ path: '.env.cli' })

import { createClient } from '@supabase/supabase-js'
import { getUnifiedFeedsV2 } from '../lib/government-feeds-unified-v2'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function setupAndProcessTDFeeds() {
  console.log('Setting up Transport Department feeds...\n')
  
  // First, ensure TD feeds exist in the database
  const tdFeeds = [
    {
      base_slug: 'td_notices',
      name_en: 'Transport Dept Traffic Notices',
      name_zh_tw: '運輸署交通通告',
      name_zh_cn: '运输署交通通告',
      department: 'transport',
      feed_type: 'notices',
      url_en: 'https://www.td.gov.hk/filemanager/rss/en/traffic_notices.xml',
      url_zh_tw: 'https://www.td.gov.hk/filemanager/rss/tc/traffic_notices.xml',
      url_zh_cn: 'https://www.td.gov.hk/filemanager/rss/sc/traffic_notices.xml',
      active: true
    },
    {
      base_slug: 'td_press',
      name_en: 'Transport Dept Press Release',
      name_zh_tw: '運輸署新聞公報',
      name_zh_cn: '运输署新闻公报',
      department: 'transport',
      feed_type: 'press',
      url_en: 'https://www.td.gov.hk/filemanager/rss/en/press_release.xml',
      url_zh_tw: 'https://www.td.gov.hk/filemanager/rss/tc/press_release.xml',
      url_zh_cn: 'https://www.td.gov.hk/filemanager/rss/sc/press_release.xml',
      active: true
    },
    {
      base_slug: 'td_special',
      name_en: 'Transport Dept Special Traffic News',
      name_zh_tw: '運輸署特別交通消息',
      name_zh_cn: '运输署特别交通消息',
      department: 'transport',
      feed_type: 'special',
      url_en: 'https://www.td.gov.hk/filemanager/rss/en/special_traffic_news.xml',
      url_zh_tw: 'https://www.td.gov.hk/filemanager/rss/tc/special_traffic_news.xml',
      url_zh_cn: 'https://www.td.gov.hk/filemanager/rss/sc/special_traffic_news.xml',
      active: true
    }
  ]
  
  // Insert or update TD feeds
  for (const feed of tdFeeds) {
    const { error } = await supabase
      .from('gov_feeds_unified')
      .upsert(feed, {
        onConflict: 'base_slug'
      })
    
    if (error) {
      console.error(`Error inserting/updating ${feed.base_slug}:`, error)
    } else {
      console.log(`✓ Configured ${feed.base_slug}`)
    }
  }
  
  // Verify feeds are in database
  const { data: verifyFeeds } = await supabase
    .from('gov_feeds_unified')
    .select('*')
    .in('base_slug', ['td_notices', 'td_press', 'td_special'])
  
  console.log(`\nVerified ${verifyFeeds?.length || 0} TD feeds in database`)
  
  // Process the TD feeds
  console.log('\nProcessing TD feeds...')
  const processor = getUnifiedFeedsV2()
  
  for (const feed of verifyFeeds || []) {
    try {
      console.log(`\nProcessing ${feed.base_slug}...`)
      
      // Process feed using the processFeed method
      await processor['processFeed'](feed)
      
      // Check results
      const { count } = await supabase
        .from('incidents_unified')
        .select('*', { count: 'exact', head: true })
        .eq('feed_id', feed.id)
      
      console.log(`  Total incidents stored: ${count || 0}`)
      
    } catch (error) {
      console.error(`  Error processing ${feed.base_slug}:`, error)
    }
  }
  
  // Verify final results
  console.log('\n\nVerifying TD incidents in the system...')
  
  const { data: tdIncidents } = await supabase
    .from('incidents_unified')
    .select(`
      id,
      content,
      source_published_at,
      feed:gov_feeds_unified!inner(base_slug)
    `)
    .in('feed.base_slug', ['td_notices', 'td_press', 'td_special'])
    .order('source_published_at', { ascending: false })
    .limit(10)
  
  if (tdIncidents && tdIncidents.length > 0) {
    console.log(`\nLatest TD incidents:`)
    tdIncidents.forEach((inc, idx) => {
      const title = inc.content?.en?.title || inc.content?.['zh-TW']?.title || 'No title'
      const feedName = inc.feed?.base_slug || 'unknown'
      console.log(`${idx + 1}. [${feedName}] ${title} (${inc.source_published_at})`)
    })
  } else {
    console.log('No TD incidents found in the system')
  }
  
  // Test the API endpoint
  console.log('\n\nTesting API endpoint...')
  const apiUrl = `http://localhost:3001/api/signals-unified?language=en&limit=5`
  try {
    const response = await fetch(apiUrl)
    const data = await response.json()
    
    const tdSignals = data.signals?.filter((s: any) => 
      s.source_slug?.startsWith('td_')
    )
    
    console.log(`Found ${tdSignals?.length || 0} TD signals in API response`)
    if (tdSignals?.length > 0) {
      console.log('Sample TD signal:', {
        title: tdSignals[0].title,
        source: tdSignals[0].source_slug,
        date: tdSignals[0].source_updated_at
      })
    }
  } catch (error) {
    console.error('Error testing API:', error)
  }
}

setupAndProcessTDFeeds().catch(console.error)