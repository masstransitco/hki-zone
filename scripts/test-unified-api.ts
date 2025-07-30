import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

async function testAPI() {
  const languages = ['en', 'zh-TW', 'zh-CN']
  
  for (const lang of languages) {
    console.log(`\n=== Testing ${lang} ===`)
    
    try {
      const response = await fetch(`http://localhost:3000/api/signals-unified?language=${lang}&limit=5`)
      const data = await response.json()
      
      console.log(`Total signals: ${data.signals?.length || 0}`)
      
      if (data.signals && data.signals.length > 0) {
        data.signals.forEach((signal: any, index: number) => {
          console.log(`\n${index + 1}. ${signal.title}`)
          console.log(`   Source: ${signal.source}`)
          console.log(`   Has translation: ${signal.has_translation}`)
          console.log(`   Original language: ${signal.original_language}`)
          console.log(`   Is converted: ${signal.is_converted || false}`)
        })
      }
    } catch (error) {
      console.error(`Error testing ${lang}:`, error)
    }
  }
  
  // Test language coverage
  console.log('\n=== Language Coverage ===')
  try {
    const response = await fetch('http://localhost:3000/api/signals-unified?language=en&limit=1')
    const data = await response.json()
    
    if (data.metadata?.language_coverage) {
      console.log('\nFeed Language Coverage:')
      data.metadata.language_coverage.forEach((feed: any) => {
        console.log(`${feed.base_slug}: ${feed.coverage_status} (EN: ${feed.has_english ? '✓' : '✗'}, TC: ${feed.has_traditional_chinese ? '✓' : '✗'}, SC: ${feed.has_simplified_chinese ? '✓' : '✗'})`)
      })
    }
  } catch (error) {
    console.error('Error fetching coverage:', error)
  }
}

testAPI().catch(console.error)