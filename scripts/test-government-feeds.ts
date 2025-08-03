import Parser from 'rss-parser'

const parser = new Parser({
  timeout: 30000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; HKI-Zone-Signals/2.0)',
  }
})

// Test feeds to verify they're working
const testFeeds = [
  // Hong Kong Observatory - new feeds
  { name: 'HKO Current Weather (EN)', url: 'https://rss.weather.gov.hk/rss/CurrentWeather.xml' },
  { name: 'HKO Weather Forecast (EN)', url: 'https://rss.weather.gov.hk/rss/WeatherForecast.xml' },
  { name: 'HKO Earthquakes (EN)', url: 'https://rss.weather.gov.hk/rss/QuickEarthquakeMessage.xml' },
  { name: 'HKO Special Tips (EN)', url: 'https://rss.weather.gov.hk/rss/SpecialWeatherTips.xml' },
  
  // Government News
  { name: 'Gov News Main (EN)', url: 'https://www.news.gov.hk/en/common/html/topstories.rss.xml' },
  { name: 'Gov News Health (EN)', url: 'https://www.news.gov.hk/en/health/html/articles.rss.xml' },
  { name: 'Gov News Finance (ZH-TW)', url: 'https://www.news.gov.hk/tc/finance/html/articles.rss.xml' },
  { name: 'Gov News Infrastructure (ZH-CN)', url: 'https://www.news.gov.hk/sc/infrastructure/html/articles.rss.xml' },
  
  // Other departments
  { name: 'HK Police (EN)', url: 'https://www.police.gov.hk/info/rss/press_en.xml' },
  { name: 'Fire Services (EN)', url: 'https://www.hkfsd.gov.hk/eng/source/rss/press.xml' },
  { name: 'CHP Press (EN)', url: 'https://www.chp.gov.hk/files/rss/en_press_release.xml' },
  { name: 'CHP Alerts (EN)', url: 'https://www.chp.gov.hk/files/rss/en_health_alert.xml' },
  { name: 'Education Bureau (EN)', url: 'https://www.edb.gov.hk/attachment/en/news/whats-new/rss_en_new.xml' },
  { name: 'Immigration (EN)', url: 'https://www.immd.gov.hk/eng/RSS/rssfeed.xml' },
  { name: 'Lands Dept (EN)', url: 'https://www.landsd.gov.hk/en/resources/rss/rss.xml' },
]

async function testFeed(name: string, url: string) {
  try {
    console.log(`\n📡 Testing ${name}...`)
    console.log(`   URL: ${url}`)
    
    const feed = await parser.parseURL(url)
    
    console.log(`   ✅ Success! Found ${feed.items.length} items`)
    console.log(`   📰 Feed Title: ${feed.title}`)
    
    if (feed.items.length > 0) {
      const firstItem = feed.items[0]
      console.log(`   🔹 Latest item:`)
      console.log(`      Title: ${firstItem.title}`)
      console.log(`      Date: ${firstItem.pubDate}`)
      console.log(`      Link: ${firstItem.link}`)
    }
    
    return { name, url, status: 'success', itemCount: feed.items.length }
  } catch (error) {
    console.log(`   ❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    return { name, url, status: 'failed', error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

async function main() {
  console.log('🚀 Testing Government RSS Feeds...')
  console.log('=' .repeat(50))
  
  const results = []
  
  for (const feed of testFeeds) {
    const result = await testFeed(feed.name, feed.url)
    results.push(result)
  }
  
  console.log('\n' + '=' .repeat(50))
  console.log('📊 Summary:')
  console.log(`   Total feeds tested: ${results.length}`)
  console.log(`   ✅ Successful: ${results.filter(r => r.status === 'success').length}`)
  console.log(`   ❌ Failed: ${results.filter(r => r.status === 'failed').length}`)
  
  const failed = results.filter(r => r.status === 'failed')
  if (failed.length > 0) {
    console.log('\n⚠️  Failed feeds:')
    failed.forEach(f => {
      console.log(`   - ${f.name}: ${f.error}`)
    })
  }
  
  console.log('\n✅ Test complete!')
}

main().catch(console.error)