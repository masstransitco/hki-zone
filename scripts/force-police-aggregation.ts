import { createClient } from '@supabase/supabase-js'
import Parser from 'rss-parser'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const parser = new Parser({
  timeout: 30000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; HKI-Zone-Signals/2.0)',
  }
})

async function forcePoliceAggregation() {
  console.log('🚔 Force Police Feed Aggregation...')
  
  // First clear recent police signals to test fresh aggregation
  const { error: deleteError } = await supabase
    .from('government_signals')
    .delete()
    .eq('feed_group', 'hkpf_press')
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    
  if (deleteError) {
    console.error('Error clearing recent police signals:', deleteError)
  } else {
    console.log('✅ Cleared recent police signals for fresh test')
  }
  
  // Now trigger aggregator
  const { getSignalsAggregator } = await import('../lib/government-signals-aggregator')
  const aggregator = getSignalsAggregator()
  
  const result = await aggregator.processAllFeeds()
  console.log('\n📊 Aggregation Results:')
  console.log(`Processed: ${result.processed} items`)
  console.log(`Grouped: ${result.grouped} signals`)
  console.log(`Stored: ${result.stored} signals`)
  
  // Check the results
  const { data: newSignals } = await supabase
    .from('government_signals')
    .select('source_identifier, content')
    .eq('feed_group', 'hkpf_press')
    .order('created_at', { ascending: false })
    .limit(5)
  
  console.log('\n📋 New Police Signals:')
  for (const signal of newSignals || []) {
    const languages = Object.keys(signal.content?.languages || {})
    console.log(`${signal.source_identifier}: ${languages.join(', ')}`)
  }
}

forcePoliceAggregation().catch(console.error)