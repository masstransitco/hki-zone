// Test script to verify Perplexity feed ordering
async function testPerplexityOrdering() {
  console.log('🧪 Testing Perplexity feed ordering...\n')
  
  try {
    // Test the API endpoint directly
    const response = await fetch('http://localhost:3000/api/perplexity?page=0')
    const data = await response.json()
    
    console.log('📊 API Response:')
    console.log(`   Articles returned: ${data.articles.length}`)
    console.log(`   Using mock data: ${data.usingMockData}`)
    console.log(`   Next page: ${data.nextPage}`)
    console.log(`   Debug: ${data.debug}`)
    
    if (data.articles.length > 0) {
      console.log('\n📅 Article ordering (by updated_at):')
      data.articles.forEach((article, i) => {
        console.log(`   ${i + 1}. "${article.title}"`)
        console.log(`      Updated: ${article.updated_at}`)
        console.log(`      ID: ${article.id}`)
        console.log(`      Status: ${article.article_status}`)
        console.log('')
      })
      
      // Verify ordering
      let isCorrectlyOrdered = true
      for (let i = 0; i < data.articles.length - 1; i++) {
        const current = new Date(data.articles[i].updated_at)
        const next = new Date(data.articles[i + 1].updated_at)
        
        if (current < next) {
          console.log(`❌ Ordering issue: Article ${i + 1} is older than article ${i + 2}`)
          isCorrectlyOrdered = false
        }
      }
      
      if (isCorrectlyOrdered) {
        console.log('✅ Articles are correctly ordered by updated_at (newest first)')
      } else {
        console.log('❌ Articles are NOT correctly ordered')
      }
    } else {
      console.log('⚠️ No articles found')
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message)
  }
}

// Run the test
testPerplexityOrdering()