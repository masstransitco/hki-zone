import { getSignalsAggregator } from '../lib/government-signals-aggregator'

async function testCurrentSignals() {
  console.log('🧪 Testing Current Government Signals System...')
  
  try {
    const aggregator = getSignalsAggregator()
    
    console.log('\n📊 Getting processing statistics...')
    const stats = await aggregator.getProcessingStatistics()
    
    console.log('Current database state:')
    console.log(`   Total signals: ${stats.totalSignals}`)
    console.log(`   By status:`, stats.byStatus)
    console.log(`   By feed group:`, stats.byFeedGroup)
    console.log(`   Content completeness:`, stats.contentCompleteness)
    
    console.log('\n🔄 Running feed aggregation...')
    const result = await aggregator.processAllFeeds()
    
    console.log('\nAggregation results:')
    console.log(`   ✅ Processed: ${result.processed} items`)
    console.log(`   🔗 Grouped: ${result.grouped} unique signals`)
    console.log(`   💾 Stored: ${result.stored} signals`)
    
    if (result.errors.length > 0) {
      console.log(`   ❌ Errors: ${result.errors.length}`)
      result.errors.forEach(error => console.log(`      - ${error}`))
    }
    
    console.log('\n📊 Updated statistics...')
    const newStats = await aggregator.getProcessingStatistics()
    console.log(`   Total signals: ${newStats.totalSignals} (was ${stats.totalSignals})`)
    console.log(`   New signals added: ${newStats.totalSignals - stats.totalSignals}`)
    
  } catch (error) {
    console.error('❌ Test failed:', error)
  }
}

// Load env
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  require('dotenv').config({ path: '.env.local' })
}

testCurrentSignals()