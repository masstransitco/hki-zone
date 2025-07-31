import dotenv from 'dotenv'
dotenv.config({ path: '.env.cli' })

import { createClient } from '@supabase/supabase-js'
import { getUnifiedFeedsV2 } from '../lib/government-feeds-unified-v2'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function reprocessGovNewsFeed() {
  console.log('Reprocessing Government News feed with all languages...\n')
  
  // Get the feed configuration
  const { data: feed } = await supabase
    .from('gov_feeds_unified')
    .select('*')
    .eq('base_slug', 'news_gov_top')
    .single()
  
  if (!feed) {
    console.error('Government news feed not found!')
    return
  }
  
  console.log('Feed configuration:')
  console.log('- EN: ' + feed.url_en)
  console.log('- ZH-TW: ' + feed.url_zh_tw)
  console.log('- ZH-CN: ' + feed.url_zh_cn)
  
  // Process the feed
  const processor = getUnifiedFeedsV2()
  
  try {
    console.log('\nProcessing feed...')
    await processor['processFeed'](feed)
    
    // Check results
    const { data: recentIncidents } = await supabase
      .from('incidents_unified')
      .select('id, content, source_published_at')
      .eq('feed_id', feed.id)
      .order('source_published_at', { ascending: false })
      .limit(5)
    
    console.log('\nRecent incidents after processing:')
    recentIncidents?.forEach((inc, i) => {
      console.log(`\n${i+1}. Incident ${inc.id}:`)
      const langs = []
      if (inc.content?.en) langs.push('EN: ' + inc.content.en.title)
      if (inc.content?.['zh-TW']) langs.push('ZH-TW: ' + inc.content['zh-TW'].title)
      if (inc.content?.['zh-CN']) langs.push('ZH-CN: ' + inc.content['zh-CN'].title)
      langs.forEach(l => console.log('   ' + l))
    })
    
  } catch (error) {
    console.error('Error processing feed:', error)
  }
}

reprocessGovNewsFeed().catch(console.error)