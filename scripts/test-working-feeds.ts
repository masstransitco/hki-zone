import Parser from 'rss-parser'

const parser = new Parser({
  timeout: 30000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; HKI-Zone-Signals/2.0)',
  }
})

// Focus on feeds that are likely to work based on patterns
const workingFeeds = [
  // HKO - confirmed working
  { 
    group: 'hko_forecast', 
    name: 'HKO Local Weather Forecast',
    urls: {
      'en': 'https://rss.weather.gov.hk/rss/LocalWeatherForecast.xml',
      'zh-TW': 'https://rss.weather.gov.hk/rss/LocalWeatherForecast_uc.xml',
      'zh-CN': 'https://rss.weather.gov.hk/rss/LocalWeatherForecast_uc.xml'
    }
  },
  
  // Try alternative news.gov.hk patterns
  {
    group: 'gov_news_record',
    name: 'Gov News Records',
    urls: {
      'en': 'https://www.news.gov.hk/eng/rss/common/all_topstories_rss.xml',
      'zh-TW': 'https://www.news.gov.hk/chi/rss/common/all_topstories_rss.xml',
      'zh-CN': 'https://www.news.gov.hk/chi/rss/common/all_topstories_rss.xml'
    }
  },
  
  // Direct feed URLs from departments
  {
    group: 'food_safety',
    name: 'Food Safety Center',
    urls: {
      'en': 'https://www.cfs.gov.hk/english/RSS/rss.xml',
      'zh-TW': 'https://www.cfs.gov.hk/tc_chi/RSS/rss.xml',
      'zh-CN': 'https://www.cfs.gov.hk/sc_chi/RSS/rss.xml'
    }
  },
  
  // Water Supplies Department
  {
    group: 'water_supplies',
    name: 'Water Supplies Dept',
    urls: {
      'en': 'https://www.wsd.gov.hk/en/rss/press_releases.xml',
      'zh-TW': 'https://www.wsd.gov.hk/tc/rss/press_releases.xml',
      'zh-CN': 'https://www.wsd.gov.hk/sc/rss/press_releases.xml'
    }
  },
  
  // Drainage Services
  {
    group: 'drainage',
    name: 'Drainage Services',
    urls: {
      'en': 'https://www.dsd.gov.hk/en/RSS/rss.xml',
      'zh-TW': 'https://www.dsd.gov.hk/tc/RSS/rss.xml', 
      'zh-CN': 'https://www.dsd.gov.hk/sc/RSS/rss.xml'
    }
  },
  
  // Civil Engineering Department
  {
    group: 'cedd',
    name: 'Civil Engineering Dept',
    urls: {
      'en': 'https://www.cedd.gov.hk/eng/home/rss/index.xml',
      'zh-TW': 'https://www.cedd.gov.hk/tc/home/rss/index.xml',
      'zh-CN': 'https://www.cedd.gov.hk/sc/home/rss/index.xml'
    }
  },
  
  // Buildings Department
  {
    group: 'buildings',
    name: 'Buildings Dept',
    urls: {
      'en': 'https://www.bd.gov.hk/en/resources/rss.xml',
      'zh-TW': 'https://www.bd.gov.hk/tc/resources/rss.xml',
      'zh-CN': 'https://www.bd.gov.hk/sc/resources/rss.xml'
    }
  },
  
  // Marine Department
  {
    group: 'marine',
    name: 'Marine Dept',
    urls: {
      'en': 'https://www.mardep.gov.hk/en/publication/rss-e.xml',
      'zh-TW': 'https://www.mardep.gov.hk/hk/publication/rss-c.xml',
      'zh-CN': 'https://www.mardep.gov.hk/sc/publication/rss-s.xml'
    }
  }
]

async function testFeedGroup(group: any) {
  console.log(`\n📦 Testing ${group.name} (${group.group})`)
  const results: any = {}
  
  for (const [lang, url] of Object.entries(group.urls)) {
    try {
      const feed = await parser.parseURL(url as string)
      results[lang] = {
        success: true,
        items: feed.items.length,
        title: feed.title
      }
      console.log(`   ✅ ${lang}: ${feed.items.length} items - "${feed.title}"`)
    } catch (error) {
      results[lang] = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
      console.log(`   ❌ ${lang}: ${results[lang].error}`)
    }
    // Small delay
    await new Promise(resolve => setTimeout(resolve, 300))
  }
  
  return { group: group.group, name: group.name, results }
}

async function main() {
  console.log('🚀 Testing Working Government RSS Feeds...')
  console.log('=' .repeat(50))
  
  const allResults = []
  
  for (const feed of workingFeeds) {
    const result = await testFeedGroup(feed)
    allResults.push(result)
  }
  
  console.log('\n' + '=' .repeat(50))
  console.log('📊 Summary of Working Feeds:')
  
  const workingGroups = allResults.filter(r => 
    Object.values(r.results).some((res: any) => res.success)
  )
  
  console.log(`\n✅ Groups with at least one working feed: ${workingGroups.length}`)
  workingGroups.forEach(group => {
    const langs = Object.entries(group.results)
      .filter(([_, res]: any) => res.success)
      .map(([lang]) => lang)
    console.log(`   - ${group.name}: ${langs.join(', ')}`)
  })
  
  console.log('\n🎯 Recommended feeds to add:')
  workingGroups.forEach(group => {
    console.log(`\n// ${group.name}`)
    console.log(`('${group.group}', 'government', 'news', '{`)
    Object.entries(group.results).forEach(([lang, res]: any) => {
      if (res.success) {
        const url = workingFeeds.find(f => f.group === group.group)?.urls[lang as keyof typeof f.urls]
        console.log(`    "${lang}": "${url}",`)
      }
    })
    console.log(`}', ...)`)
  })
}

main().catch(console.error)