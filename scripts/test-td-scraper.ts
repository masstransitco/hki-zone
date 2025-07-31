import { tdNoticesScraper } from '../lib/td-notices-scraper'

async function testScraper() {
  console.log('Testing TD notices scraper...\n')
  
  // Test URL from the example
  const testUrl = 'http://www.td.gov.hk/tc/traffic_notices/index_id_82058.html'
  
  console.log(`Testing with URL: ${testUrl}`)
  console.log('Expected content should mention: 連翔道(東行)近青沙公路...\n')
  
  // Test the scraper directly (without database)
  // We'll need to temporarily expose the private method for testing
  const scraper = tdNoticesScraper as any
  
  // Create a test method that uses the private scrapeNoticeContent
  const testScrapeContent = async (url: string) => {
    try {
      // Call the private method directly for testing
      const content = await scraper.scrapeNoticeContent(url)
      
      if (content) {
        console.log('✅ Successfully scraped content!')
        console.log(`Length: ${content.length} characters\n`)
        console.log('Content preview:')
        console.log('---')
        console.log(content.substring(0, 500) + '...')
        console.log('---\n')
        
        // Check if it contains expected content
        if (content.includes('連翔道') && content.includes('青沙公路')) {
          console.log('✅ Content contains expected road names!')
        } else {
          console.log('⚠️  Content might not be correct - expected road names not found')
        }
      } else {
        console.log('❌ No content scraped')
      }
    } catch (error) {
      console.error('Error:', error)
    }
  }
  
  // Run the test
  await testScrapeContent(testUrl)
  
  console.log('\nNow testing the full process with database...')
  
  // Test the full process (this will actually update the database)
  const result = await tdNoticesScraper.processEmptyNotices()
  
  console.log('\nFull process result:', JSON.stringify(result, null, 2))
}

// Run the test
testScraper().catch(console.error)