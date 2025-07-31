import fetch from 'node-fetch'

async function testChineseAPI() {
  try {
    const response = await fetch('http://localhost:3001/api/signals-unified?language=zh-TW&limit=10')
    const data = await response.json() as any
    
    const govFeeds = data.signals?.filter((s: any) => s.source_slug === 'news_gov_top')
    console.log('Government feeds when requesting zh-TW:')
    
    if (govFeeds && govFeeds.length > 0) {
      govFeeds.forEach((feed: any, i: number) => {
        console.log(`\n${i+1}. Title: ${feed.title}`)
        console.log(`   Has translation: ${feed.has_translation}`)
        console.log(`   Original language: ${feed.original_language}`)
        console.log(`   Requested language: ${feed.requested_language}`)
        console.log(`   Is converted: ${feed.is_converted}`)
      })
    } else {
      console.log('\nNo government feeds found! Checking all signals:')
      console.log(`Total signals: ${data.signals?.length || 0}`)
      data.signals?.slice(0, 5).forEach((s: any) => {
        console.log(`- ${s.source_slug}: ${s.title}`)
      })
    }
  } catch (error) {
    console.error('Error:', error)
  }
}

testChineseAPI()