import { getSignalsScraper } from '../lib/government-signals-scraper'

async function testHKMAScraper() {
  console.log('🔍 Testing HKMA Signal Scraping...')
  
  const scraper = getSignalsScraper()
  
  try {
    // Test a specific HKMA signal
    const result = await scraper.processSingleSignalById('hkma_press_08_202408013_')
    
    console.log('\n📊 Scraping Result:')
    console.log(`Success: ${result.success}`)
    console.log(`Details:`, result.details)
    if (result.error) {
      console.log(`Error: ${result.error}`)
    }
    
  } catch (error) {
    console.error('❌ Error:', error)
  }
}

testHKMAScraper()