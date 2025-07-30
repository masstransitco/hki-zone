import dotenv from 'dotenv'
dotenv.config({ path: '.env.cli' })

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function debugGovNewsChinese() {
  // Get feed ID
  const { data: feed } = await supabase
    .from('gov_feeds_unified')
    .select('id, base_slug')
    .eq('base_slug', 'news_gov_top')
    .single()
  
  if (!feed) {
    console.log('Government news feed not found!')
    return
  }
  
  // Get recent incidents with feed slug
  const { data: incidents } = await supabase
    .from('incidents_unified')
    .select(`
      id,
      content,
      source_published_at,
      feed:gov_feeds_unified!inner(base_slug)
    `)
    .eq('feed_id', feed.id)
    .order('source_published_at', { ascending: false })
    .limit(10)
  
  console.log('Recent Government News Incidents:')
  console.log('================================')
  
  incidents?.forEach((inc, i) => {
    console.log(`\n${i+1}. ID: ${inc.id}`)
    console.log(`   Feed slug: ${inc.feed?.base_slug}`)
    console.log(`   Published: ${inc.source_published_at}`)
    console.log('   Content languages:')
    
    if (inc.content?.en) {
      console.log(`     EN: ${inc.content.en.title}`)
    }
    if (inc.content?.['zh-TW']) {
      console.log(`     ZH-TW: ${inc.content['zh-TW'].title}`)
    }
    if (inc.content?.['zh-CN']) {
      console.log(`     ZH-CN: ${inc.content['zh-CN'].title}`)
    }
  })
  
  // Test the database function directly
  console.log('\n\nTesting database function with zh-TW:')
  console.log('=====================================')
  
  const { data: funcResult } = await supabase.rpc('get_incidents_with_language', {
    p_language: 'zh-TW',
    p_category: 'gov',
    p_limit: 20,
    p_offset: 0
  })
  
  const govResults = funcResult?.filter((r: any) => r.feed_slug === 'news_gov_top')
  console.log(`Found ${govResults?.length || 0} government news items`)
  
  govResults?.slice(0, 5).forEach((item: any, i: number) => {
    console.log(`\n${i+1}. Title: ${item.title}`)
    console.log(`   Feed slug: ${item.feed_slug}`)
    console.log(`   Has translation: ${item.has_translation}`)
    console.log(`   Original language: ${item.original_language}`)
  })
}

debugGovNewsChinese().catch(console.error)