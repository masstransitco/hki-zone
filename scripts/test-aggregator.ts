import { getSignalsAggregator } from '../lib/government-signals-aggregator'

async function testAggregator() {
  console.log('🚀 Testing Government Signals Aggregator...')
  
  const aggregator = getSignalsAggregator()
  
  try {
    const result = await aggregator.processAllFeeds()
    console.log('\n📊 Aggregation Results:')
    console.log(`✅ Processed: ${result.processed} items`)
    console.log(`🔗 Grouped: ${result.grouped} unique signals`)
    console.log(`💾 Stored: ${result.stored} signals`)
    
    if (result.errors.length > 0) {
      console.log('\n❌ Errors:')
      result.errors.forEach(err => console.log(`  - ${err}`))
    }
    
    // Get statistics
    const stats = await aggregator.getProcessingStatistics()
    console.log('\n📈 Processing Statistics:')
    console.log(`Total Signals: ${stats.totalSignals}`)
    console.log(`Content Complete: ${stats.contentCompleteness.complete}`)
    console.log(`English Only: ${stats.contentCompleteness.english_only}`)
    console.log(`Partial Content: ${stats.contentCompleteness.partial}`)
    
    console.log('\n📦 By Feed Group:')
    Object.entries(stats.byFeedGroup)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .forEach(([group, count]) => {
        console.log(`  ${group}: ${count}`)
      })
      
  } catch (error) {
    console.error('❌ Error:', error)
  }
}

testAggregator()