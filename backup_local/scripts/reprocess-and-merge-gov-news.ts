import dotenv from 'dotenv'
dotenv.config({ path: '.env.cli' })

import { createClient } from '@supabase/supabase-js'
import { getUnifiedFeedsV2 } from '../lib/government-feeds-unified-v2'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function reprocessAndMergeGovNews() {
  console.log('Cleaning up and reprocessing Government News feed...\n')
  
  // Get the feed
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
  console.log('- Active: ' + feed.active)
  
  // First, delete all existing incidents for this feed to start fresh
  console.log('\nDeleting existing incidents...')
  const { error: deleteError } = await supabase
    .from('incidents_unified')
    .delete()
    .eq('feed_id', feed.id)
  
  if (deleteError) {
    console.error('Error deleting incidents:', deleteError)
  } else {
    console.log('Existing incidents deleted')
  }
  
  // Process the feed with the unified processor
  const processor = getUnifiedFeedsV2()
  
  try {
    console.log('\nReprocessing feed with unified processor...')
    await processor['processFeed'](feed)
    
    // Check results
    const { data: newIncidents, count } = await supabase
      .from('incidents_unified')
      .select('id, content, source_published_at', { count: 'exact' })
      .eq('feed_id', feed.id)
      .order('source_published_at', { ascending: false })
      .limit(10)
    
    console.log(`\nProcessed ${count} unified incidents`)
    
    console.log('\nSample incidents:')
    newIncidents?.forEach((inc, i) => {
      console.log(`\n${i+1}. Published: ${inc.source_published_at}`)
      const langs = []
      if (inc.content?.en) langs.push(`EN: ${inc.content.en.title}`)
      if (inc.content?.['zh-TW']) langs.push(`ZH-TW: ${inc.content['zh-TW'].title}`)
      if (inc.content?.['zh-CN']) langs.push(`ZH-CN: ${inc.content['zh-CN'].title}`)
      langs.forEach(l => console.log(`   ${l}`))
    })
    
  } catch (error) {
    console.error('Error processing feed:', error)
  }
}

reprocessAndMergeGovNews().catch(console.error)