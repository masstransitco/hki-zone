// Test script for the new contextual enrichment system
require('dotenv').config({ path: '.env.local' })

const { PerplexityHKNews } = require('./lib/perplexity-hk-news')

// Sample test headlines
const testHeadlines = [
  {
    id: 'test-1',
    category: 'business',
    title: 'Hong Kong property prices rise 3.2% in October',
    url: 'https://example.com/property-rise',
    article_status: 'pending',
    image_status: 'pending',
    source: 'Test',
    author: 'Test'
  },
  {
    id: 'test-2',
    category: 'tech',
    title: 'Hong Kong launches new AI innovation fund worth HK$5 billion',
    url: 'https://example.com/ai-fund',
    article_status: 'pending',
    image_status: 'pending',
    source: 'Test',
    author: 'Test'
  },
  {
    id: 'test-3',
    category: 'health',
    title: 'Public hospital waiting times reduced by 20% with new system',
    url: 'https://example.com/hospital-times',
    article_status: 'pending',
    image_status: 'pending',
    source: 'Test',
    author: 'Test'
  }
]

async function testContextualEnrichment() {
  console.log('🧪 Testing Contextual Enrichment System\n')
  
  const perplexityHKNews = new PerplexityHKNews()
  
  for (const headline of testHeadlines) {
    console.log(`\n📰 Testing: "${headline.title}"`)
    console.log(`   Category: ${headline.category}`)
    console.log('   ---')
    
    try {
      // Test the new contextual enrichment
      console.log('   1️⃣ Searching for historical context...')
      const { historical_data, citations } = await perplexityHKNews.searchHistoricalContext(headline)
      console.log(`   ✅ Found ${historical_data.length} historical references`)
      console.log(`   ✅ Found ${citations.length} citations`)
      
      console.log('\n   2️⃣ Creating contextual enrichment...')
      const contextualEnrichment = await perplexityHKNews.enrichArticleWithContext(headline)
      
      console.log(`   ✅ Enhanced title: "${contextualEnrichment.enhanced_title}"`)
      console.log(`   ✅ Generated ${contextualEnrichment.contextual_bullets.length} contextual bullets`)
      console.log(`   ✅ Found ${contextualEnrichment.data_points.length} data points`)
      
      // Display the contextual bullets
      console.log('\n   📊 Contextual Bullets:')
      contextualEnrichment.contextual_bullets.forEach((bullet, i) => {
        console.log(`\n   Bullet ${i + 1}:`)
        console.log(`   • Historical: ${bullet.historical_context}`)
        console.log(`   • Current: ${bullet.key_fact}`)
        console.log(`   • Insight: ${bullet.significance}`)
      })
      
      // Display data points if any
      if (contextualEnrichment.data_points.length > 0) {
        console.log('\n   📈 Data Points:')
        contextualEnrichment.data_points.forEach(dp => {
          console.log(`   • ${dp.metric}: ${dp.value}${dp.comparison ? ` (${dp.comparison})` : ''}`)
        })
      }
      
      // Test conversion to standard format
      console.log('\n   3️⃣ Converting to standard article format...')
      const articleEnrichment = perplexityHKNews.contextualToArticleEnrichment(contextualEnrichment)
      console.log(`   ✅ Summary: ${articleEnrichment.summary.substring(0, 100)}...`)
      console.log(`   ✅ Key points: ${articleEnrichment.key_points.length}`)
      console.log(`   ✅ HTML body length: ${articleEnrichment.body_html.length} chars`)
      
    } catch (error) {
      console.error(`   ❌ Error:`, error.message)
    }
    
    console.log('\n   ' + '='.repeat(60))
    
    // Add delay between tests to respect rate limits
    if (testHeadlines.indexOf(headline) < testHeadlines.length - 1) {
      console.log('\n   ⏳ Waiting 2 seconds before next test...')
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }
  
  console.log('\n✅ Contextual enrichment testing completed!')
}

// Display example output format
function showExampleOutput() {
  console.log('\n📋 Example Contextual Enrichment Output:\n')
  console.log('Bullet 1 - HISTORICAL PERSPECTIVE')
  console.log('• Historical: "2019年同期物業價格僅上升1.5%，2020年因疫情下跌8.3%"')
  console.log('• Current: "10月份物業價格上升3.2%，為今年最大單月升幅"')
  console.log('• Insight: "市場復甦跡象明顯，預示香港房地產市場重拾動力"')
  
  console.log('\nBullet 2 - DATA COMPARISON')
  console.log('• Historical: "過去五年平均月升幅為0.8%，最高紀錄為2018年4月的4.1%"')
  console.log('• Current: "本月3.2%升幅超越五年平均水平四倍"')
  console.log('• Insight: "強勁增長反映市場信心恢復，為投資者帶來新機遇"')
  
  console.log('\nBullet 3 - BROADER IMPACT')
  console.log('• Historical: "2017年類似升幅後，帶動整體經濟增長2.3%"')
  console.log('• Current: "預計將刺激相關行業如建築、裝修及金融服務"')
  console.log('• Insight: "香港經濟復甦勢頭增強，為未來發展奠定基礎"')
  
  console.log('\nKey Data Points:')
  console.log('• Average Price: HK$180,000/sq ft (vs HK$165,000 last year)')
  console.log('• Transaction Volume: 5,823 units (up 15%)')
  console.log('• Mortgage Rate: 3.5% (trend: stable)')
}

// Run the test
async function main() {
  try {
    showExampleOutput()
    await testContextualEnrichment()
  } catch (error) {
    console.error('💥 Test failed:', error)
  }
}

main()