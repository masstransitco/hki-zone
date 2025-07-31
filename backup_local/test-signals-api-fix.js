#!/usr/bin/env node

// Use built-in fetch in Node.js 18+
const fetch = globalThis.fetch || require('node-fetch')

async function testSignalsApiFix() {
  console.log('🧪 Testing Government Bulletin Fix')
  console.log('=================================')
  console.log('Current time:', new Date().toISOString())
  console.log()

  try {
    // Test the local development server if available, otherwise use production
    const testUrls = [
      'http://localhost:3000/api/signals?limit=5',
      'https://hki.zone/api/signals?limit=5'
    ]

    for (const url of testUrls) {
      try {
        console.log(`🔍 Testing: ${url}`)
        
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'test-signals-api-fix/1.0'
          }
        })

        if (!response.ok) {
          console.log(`❌ ${url} returned ${response.status}: ${response.statusText}`)
          continue
        }

        const data = await response.json()
        
        if (data.error) {
          console.log(`❌ API returned error: ${data.error}`)
          continue
        }

        const articles = data.articles || data.signals || []
        console.log(`✅ API returned ${articles.length} articles`)
        
        if (articles.length > 0) {
          console.log('📋 Latest articles:')
          articles.forEach((article, index) => {
            const publishedDate = new Date(article.source_updated_at)
            const hoursAgo = ((new Date() - publishedDate) / (1000 * 60 * 60)).toFixed(2)
            
            console.log(`  ${index + 1}. [${article.source_slug}] ${article.title.slice(0, 60)}...`)
            console.log(`      Published: ${publishedDate.toISOString()} (${hoursAgo}h ago)`)
          })
          
          // Check if we have fresh data (within last 24 hours)
          const latestArticle = articles[0]
          const latestTime = new Date(latestArticle.source_updated_at)
          const now = new Date()
          const hoursSinceLatest = (now - latestTime) / (1000 * 60 * 60)
          
          if (hoursSinceLatest < 24) {
            console.log(`✅ SUCCESS: Fresh data found! Latest article is ${hoursSinceLatest.toFixed(2)} hours old`)
          } else {
            console.log(`⚠️ WARNING: Data is still stale. Latest article is ${hoursSinceLatest.toFixed(2)} hours old`)
          }
        } else {
          console.log('❌ No articles returned')
        }
        
        console.log()
        break // Exit after first successful test
        
      } catch (error) {
        console.log(`❌ Error testing ${url}:`, error.message)
      }
    }

    // Also test the metadata
    console.log('📊 API Metadata:')
    const response = await fetch(testUrls[1])
    if (response.ok) {
      const data = await response.json()
      if (data.metadata) {
        console.log(`  Source: ${data.metadata.source}`)
        console.log(`  Last updated: ${data.metadata.last_updated}`)
        console.log(`  Categories: ${data.metadata.categories_available?.join(', ')}`)
      }
    }

  } catch (error) {
    console.error('💥 Test failed:', error.message)
  }
}

testSignalsApiFix()