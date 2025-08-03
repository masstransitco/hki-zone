import { getSignalsScraper } from '../lib/government-signals-scraper'

async function testScraper() {
  console.log('🔍 Testing Government Signals Scraper...')
  
  const scraper = getSignalsScraper()
  
  try {
    // Test with a small batch first
    const result = await scraper.processIncompleteSignals(5)
    
    console.log('\n📊 Scraping Results:')
    console.log(`✅ Processed: ${result.processed} signals`)
    console.log(`✨ Updated: ${result.updated} signals`)
    console.log(`❌ Failed: ${result.failed} signals`)
    
    console.log('\n📝 Detailed Results:')
    result.results.forEach(r => {
      const status = r.success ? '✅' : '❌'
      console.log(`${status} ${r.source_identifier}`)
      if (r.languages_processed.length > 0) {
        console.log(`   Languages: ${r.languages_processed.join(', ')}`)
      }
      if (r.error) {
        console.log(`   Error: ${r.error}`)
      }
    })
    
    // Get statistics
    const stats = await scraper.getScrapingStatistics()
    console.log('\n📈 Scraping Statistics:')
    console.log(`Signals needing scraping: ${stats.signals_needing_scraping}`)
    console.log(`Signals with failed attempts: ${stats.signals_with_failed_attempts}`)
    
  } catch (error) {
    console.error('❌ Error:', error)
  }
}

testScraper()