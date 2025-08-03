import { getSignalsAggregator } from '../lib/government-signals-aggregator'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function testPoliceAggregation() {
  console.log('🚔 Testing Police Feed Aggregation...')
  
  // Get the aggregator
  const aggregator = getSignalsAggregator()
  
  // Get police feed configuration
  const { data: policeFeed } = await supabase
    .from('government_feed_sources')
    .select('*')
    .eq('feed_group', 'hkpf_press')
    .single()
    
  if (!policeFeed) {
    console.error('❌ Police feed not found')
    return
  }
  
  console.log('\n📋 Police Feed Configuration:')
  console.log('URLs:', policeFeed.urls)
  
  // Process just the police feed
  try {
    console.log('\n🔄 Processing police feeds...')
    const result = await aggregator.processAllFeeds()
    
    console.log('\n✅ Aggregation completed:')
    console.log(`Processed: ${result.processed} items`)
    console.log(`Grouped: ${result.grouped} signals`)
    console.log(`Stored: ${result.stored} signals`)
    
    // Check if we now have multilingual police signals
    const { data: policeSignals } = await supabase
      .from('government_signals')
      .select('source_identifier, content')
      .eq('feed_group', 'hkpf_press')
      .order('created_at', { ascending: false })
      .limit(5)
    
    console.log('\n📊 Latest Police Signals:')
    for (const signal of policeSignals || []) {
      const languages = Object.keys(signal.content?.languages || {})
      console.log(`${signal.source_identifier}: ${languages.join(', ')}`)
    }
    
  } catch (error) {
    console.error('❌ Error:', error)
  }
}

testPoliceAggregation()