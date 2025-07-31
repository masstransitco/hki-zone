import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

async function verifyConsistency() {
  const languages = ['en', 'zh-TW', 'zh-CN']
  const results: any = {}
  
  console.log('Verifying language consistency on port 3001...\n')
  
  // Fetch data for each language
  for (const lang of languages) {
    const response = await fetch(`http://localhost:3001/api/signals-unified?language=${lang}&limit=20`)
    const data = await response.json()
    results[lang] = data.signals || []
  }
  
  // Compare counts
  console.log('Feed counts by language:')
  console.log(`  English: ${results.en.length} items`)
  console.log(`  Traditional Chinese: ${results['zh-TW'].length} items`)
  console.log(`  Simplified Chinese: ${results['zh-CN'].length} items`)
  
  // Check content availability
  console.log('\nContent analysis:')
  
  for (const lang of languages) {
    const items = results[lang]
    const hasTranslation = items.filter((i: any) => i.has_translation).length
    const isConverted = items.filter((i: any) => i.is_converted).length
    const nullTitles = items.filter((i: any) => !i.title).length
    
    console.log(`\n${lang}:`)
    console.log(`  Has native translation: ${hasTranslation}/${items.length}`)
    console.log(`  Auto-converted: ${isConverted}/${items.length}`)
    console.log(`  Null titles: ${nullTitles}/${items.length}`)
  }
  
  // Check source consistency
  console.log('\nTop sources by language:')
  for (const lang of languages) {
    const sources = results[lang].reduce((acc: any, item: any) => {
      acc[item.source_slug] = (acc[item.source_slug] || 0) + 1
      return acc
    }, {})
    
    console.log(`\n${lang}:`)
    Object.entries(sources)
      .sort(([,a], [,b]) => (b as number) - (a as number))
      .slice(0, 5)
      .forEach(([source, count]) => {
        console.log(`  ${source}: ${count}`)
      })
  }
}

verifyConsistency().catch(console.error)