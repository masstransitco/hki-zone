import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'
import { getUnifiedFeedsV2 } from '../lib/government-feeds-unified-v2'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function reprocessTDFeeds() {
  console.log('Reprocessing Transport Department feeds...\n')
  
  // Get TD feed configurations
  const { data: tdFeeds, error } = await supabase
    .from('gov_feeds_unified')
    .select('*')
    .like('base_slug', 'td_%')
    .eq('active', true)
  
  if (error || !tdFeeds) {
    console.error('Error fetching TD feeds:', error)
    return
  }
  
  console.log(`Found ${tdFeeds.length} TD feeds to process`)
  
  const processor = getUnifiedFeedsV2()
  
  // Process each TD feed
  for (const feed of tdFeeds) {
    console.log(`\nProcessing ${feed.base_slug}...`)
    
    try {
      await processor.processFeed(feed)
      
      // Check if any incidents were stored
      const { count } = await supabase
        .from('incidents_unified')
        .select('*', { count: 'exact', head: true })
        .eq('feed_id', feed.id)
        .gte('source_published_at', new Date(Date.now() - 24*60*60*1000).toISOString())
      
      console.log(`  Stored ${count || 0} incidents from last 24 hours`)
      
    } catch (error) {
      console.error(`  Error processing ${feed.base_slug}:`, error)
    }
  }
  
  // Verify results
  console.log('\n\nVerifying TD feeds in the system...')
  
  const { data: tdIncidents } = await supabase
    .from('incidents_unified')
    .select('id, content')
    .in('feed_id', tdFeeds.map(f => f.id))
    .order('source_published_at', { ascending: false })
    .limit(5)
  
  if (tdIncidents && tdIncidents.length > 0) {
    console.log(`\nSample TD incidents:`)
    tdIncidents.forEach((inc, idx) => {
      const title = inc.content?.en?.title || inc.content?.['zh-TW']?.title || 'No title'
      console.log(`${idx + 1}. ${title}`)
    })
  } else {
    console.log('No TD incidents found in the system')
  }
}

reprocessTDFeeds().catch(console.error)