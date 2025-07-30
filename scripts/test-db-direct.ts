import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.cli' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function testDB() {
  // Test if news_gov_top exists
  const { data: feed } = await supabase
    .from('gov_feeds_unified')
    .select('*')
    .eq('base_slug', 'news_gov_top')
    .single()
  
  console.log('Feed exists:', Boolean(feed))
  console.log('Feed active:', feed?.active)
  
  // Count incidents
  const { count } = await supabase
    .from('incidents_unified')
    .select('*', { count: 'exact', head: true })
    .eq('feed_id', feed?.id)
    .eq('active', true)
  
  console.log('Active incidents:', count)
  
  // Check a specific incident
  const { data: sampleIncident } = await supabase
    .from('incidents_unified')
    .select('*')
    .eq('feed_id', feed?.id)
    .eq('active', true)
    .limit(1)
    .single()
  
  if (sampleIncident) {
    console.log('\nSample incident:')
    console.log('ID:', sampleIncident.id)
    console.log('Active:', sampleIncident.active)
    console.log('Has EN content:', Boolean(sampleIncident.content?.en))
    console.log('Has ZH-TW content:', Boolean(sampleIncident.content?.['zh-TW']))
  }
  
  // Test the function
  const { data: funcData, error } = await supabase.rpc('get_incidents_with_language', {
    p_language: 'zh-TW',
    p_limit: 10
  })
  
  if (error) {
    console.error('Function error:', error)
  } else {
    console.log('\nFunction returned:', funcData?.length || 0, 'rows')
    const govNews = funcData?.filter((d: any) => d.feed_slug === 'news_gov_top')
    console.log('Gov news in function result:', govNews?.length || 0)
  }
}

testDB().catch(console.error)