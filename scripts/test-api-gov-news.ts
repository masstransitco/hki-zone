import fetch from 'node-fetch'

async function testAPIGovNews() {
  try {
    // Test Chinese API
    const zhResponse = await fetch('http://localhost:3001/api/signals-unified?language=zh-TW&limit=50')
    const zhData = await zhResponse.json() as any
    
    const zhGovNews = zhData.signals?.filter((s: any) => s.source_slug === 'news_gov_top')
    
    console.log('Chinese (zh-TW) API Response:')
    console.log('=============================')
    console.log(`Total signals: ${zhData.signals?.length || 0}`)
    console.log(`Government news items: ${zhGovNews?.length || 0}`)
    
    if (zhGovNews && zhGovNews.length > 0) {
      console.log('\nFirst 3 government news items:')
      zhGovNews.slice(0, 3).forEach((item: any, i: number) => {
        console.log(`\n${i+1}. ${item.title}`)
        console.log(`   Source: ${item.source_slug}`)
        console.log(`   Has translation: ${item.has_translation}`)
        console.log(`   Original language: ${item.original_language}`)
      })
    }
    
    // Also test English API for comparison
    const enResponse = await fetch('http://localhost:3001/api/signals-unified?language=en&limit=50')
    const enData = await enResponse.json() as any
    
    const enGovNews = enData.signals?.filter((s: any) => s.source_slug === 'news_gov_top')
    
    console.log('\n\nEnglish (en) API Response:')
    console.log('==========================')
    console.log(`Government news items: ${enGovNews?.length || 0}`)
    
    if (enGovNews && enGovNews.length > 0) {
      console.log('\nFirst 3 government news items:')
      enGovNews.slice(0, 3).forEach((item: any, i: number) => {
        console.log(`\n${i+1}. ${item.title}`)
      })
    }
    
  } catch (error) {
    console.error('Error:', error)
  }
}

testAPIGovNews()