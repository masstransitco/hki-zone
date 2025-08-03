import Parser from 'rss-parser'

const parser = new Parser({
  timeout: 30000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; HKI-Zone-Signals/2.0)',
  }
})

// Corrected feeds based on actual government websites
const correctedFeeds = [
  // Hong Kong Observatory - correct URLs
  { name: 'HKO Local Weather Forecast (EN)', url: 'https://rss.weather.gov.hk/rss/LocalWeatherForecast.xml' },
  { name: 'HKO Local Weather Forecast (ZH)', url: 'https://rss.weather.gov.hk/rss/LocalWeatherForecast_uc.xml' },
  { name: 'HKO 9-day Forecast (EN)', url: 'https://rss.weather.gov.hk/rss/SeveralDaysForecast.xml' },
  { name: 'HKO 9-day Forecast (ZH)', url: 'https://rss.weather.gov.hk/rss/SeveralDaysForecast_uc.xml' },
  
  // Government News - category feeds
  { name: 'Gov News Categories (EN)', url: 'https://www.news.gov.hk/en/categories/health/html/articles.rss.xml' },
  { name: 'Gov News Categories (TC)', url: 'https://www.news.gov.hk/tc/categories/health/html/articles.rss.xml' },
  { name: 'Gov News Categories (SC)', url: 'https://www.news.gov.hk/sc/categories/health/html/articles.rss.xml' },
  
  { name: 'Gov News Finance (EN)', url: 'https://www.news.gov.hk/en/categories/finance/html/articles.rss.xml' },
  { name: 'Gov News Finance (TC)', url: 'https://www.news.gov.hk/tc/categories/finance/html/articles.rss.xml' },
  { name: 'Gov News Finance (SC)', url: 'https://www.news.gov.hk/sc/categories/finance/html/articles.rss.xml' },
  
  { name: 'Gov News Infrastructure (EN)', url: 'https://www.news.gov.hk/en/categories/infrastructure/html/articles.rss.xml' },
  { name: 'Gov News School (EN)', url: 'https://www.news.gov.hk/en/categories/school_work/html/articles.rss.xml' },
  { name: 'Gov News Environment (EN)', url: 'https://www.news.gov.hk/en/categories/environment/html/articles.rss.xml' },
  
  // HKPF - correct path
  { name: 'Police Press (EN)', url: 'https://www.police.gov.hk/ppp_en/03_police_message/pr/rss_pr_index.xml' },
  { name: 'Police Press (TC)', url: 'https://www.police.gov.hk/ppp_tc/03_police_message/pr/rss_pr_index.xml' },
  { name: 'Police Press (SC)', url: 'https://www.police.gov.hk/ppp_sc/03_police_message/pr/rss_pr_index.xml' },
  
  // CHP feeds - correct paths
  { name: 'CHP News (EN)', url: 'https://www.chp.gov.hk/files/xhtml/eng_rss_news.xml' },
  { name: 'CHP News (TC)', url: 'https://www.chp.gov.hk/files/xhtml/chi_rss_news.xml' },
  { name: 'CHP Letters to Doctors (EN)', url: 'https://www.chp.gov.hk/files/xhtml/ltdl_eng_rss.xml' },
  { name: 'CHP Letters to Doctors (TC)', url: 'https://www.chp.gov.hk/files/xhtml/ltdl_chi_rss.xml' },
  
  // Immigration - correct path
  { name: 'Immigration News (EN)', url: 'https://www.immd.gov.hk/eng/press/rss.xml' },
  { name: 'Immigration News (TC)', url: 'https://www.immd.gov.hk/hkt/press/rss.xml' },
  { name: 'Immigration News (SC)', url: 'https://www.immd.gov.hk/hks/press/rss.xml' },
  
  // Labour Department
  { name: 'Labour Dept (EN)', url: 'https://www.labour.gov.hk/common/public/rss/rss2_en_news.xml' },
  { name: 'Labour Dept (TC)', url: 'https://www.labour.gov.hk/common/public/rss/rss2_tc_news.xml' },
  { name: 'Labour Dept (SC)', url: 'https://www.labour.gov.hk/common/public/rss/rss2_sc_news.xml' },
  
  // Environmental Protection Department
  { name: 'EPD News (EN)', url: 'https://www.epd.gov.hk/epd/english/news_events/press/files/rssPress.xml' },
  { name: 'EPD News (TC)', url: 'https://www.epd.gov.hk/epd/tc_chi/news_events/press/files/rssPress.xml' },
  { name: 'EPD News (SC)', url: 'https://www.epd.gov.hk/epd/sc_chi/news_events/press/files/rssPress.xml' },
  
  // Housing Authority  
  { name: 'Housing Authority (EN)', url: 'https://www.housingauthority.gov.hk/mini-site/hablog/en/blog_rss.xml' },
  { name: 'Housing Authority (TC)', url: 'https://www.housingauthority.gov.hk/mini-site/hablog/tc/blog_rss.xml' },
  { name: 'Housing Authority (SC)', url: 'https://www.housingauthority.gov.hk/mini-site/hablog/sc/blog_rss.xml' },
  
  // AFCD
  { name: 'AFCD News (EN)', url: 'https://www.afcd.gov.hk/english/rss/pr.xml' },
  { name: 'AFCD News (TC)', url: 'https://www.afcd.gov.hk/tc_chi/rss/pr.xml' },
  { name: 'AFCD News (SC)', url: 'https://www.afcd.gov.hk/sc_chi/rss/pr.xml' },
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
      console.log(`      Title: ${firstItem.title?.substring(0, 80)}...`)
      console.log(`      Date: ${firstItem.pubDate}`)
    }
    
    return { name, url, status: 'success', itemCount: feed.items.length, title: feed.title }
  } catch (error) {
    console.log(`   ❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    return { name, url, status: 'failed', error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

async function main() {
  console.log('🚀 Testing Corrected Government RSS Feeds...')
  console.log('=' .repeat(50))
  
  const results = []
  
  for (const feed of correctedFeeds) {
    const result = await testFeed(feed.name, feed.url)
    results.push(result)
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  
  console.log('\n' + '=' .repeat(50))
  console.log('📊 Summary:')
  console.log(`   Total feeds tested: ${results.length}`)
  console.log(`   ✅ Successful: ${results.filter(r => r.status === 'success').length}`)
  console.log(`   ❌ Failed: ${results.filter(r => r.status === 'failed').length}`)
  
  const successful = results.filter(r => r.status === 'success')
  console.log('\n✅ Working feeds:')
  successful.forEach(f => {
    console.log(`   - ${f.name}: ${f.itemCount} items`)
  })
  
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