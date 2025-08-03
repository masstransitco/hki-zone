import Parser from 'rss-parser'

const parser = new Parser({
  timeout: 30000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; HKI-Zone-Signals/2.0)',
  }
})

// Comprehensive list of government feeds to test
const feedsToTest = [
  // Transport Department
  {
    group: 'td_general',
    name: 'Transport Department General',
    urls: {
      'en': 'https://www.td.gov.hk/en/rss/index_rss.xml',
      'zh-TW': 'https://www.td.gov.hk/tc/rss/index_rss.xml',
      'zh-CN': 'https://www.td.gov.hk/sc/rss/index_rss.xml'
    }
  },
  
  // Weather / Hong Kong Observatory
  {
    group: 'hko_warnings_v2',
    name: 'HKO Weather Warnings V2',
    urls: {
      'en': 'https://rss.weather.gov.hk/rss/WeatherWarningSummaryv2.xml',
      'zh-TW': 'https://rss.weather.gov.hk/rss/WeatherWarningSummaryv2_uc.xml',
      'zh-CN': 'https://rss.weather.gov.hk/rss/WeatherWarningSummaryv2_sc.xml'
    }
  },
  {
    group: 'hko_current',
    name: 'HKO Current Weather',
    urls: {
      'en': 'https://rss.weather.gov.hk/rss/CurrentWeather.xml',
      'zh-TW': 'https://rss.weather.gov.hk/rss/CurrentWeather_uc.xml',
      'zh-CN': 'https://rss.weather.gov.hk/rss/CurrentWeather_sc.xml'
    }
  },
  {
    group: 'hko_forecast',
    name: 'HKO Local Weather Forecast',
    urls: {
      'en': 'https://rss.weather.gov.hk/rss/LocalWeatherForecast.xml',
      'zh-TW': 'https://rss.weather.gov.hk/rss/LocalWeatherForecast_uc.xml',
      'zh-CN': 'https://rss.weather.gov.hk/rss/LocalWeatherForecast_sc.xml'
    }
  },
  {
    group: 'hko_earthquake',
    name: 'HKO Earthquakes',
    urls: {
      'en': 'https://rss.weather.gov.hk/rss/QuickEarthquake.xml',
      'zh-TW': 'https://rss.weather.gov.hk/rss/QuickEarthquake_uc.xml',
      'zh-CN': 'https://rss.weather.gov.hk/rss/QuickEarthquake_sc.xml'
    }
  },
  {
    group: 'hko_9day',
    name: 'HKO 9-Day Weather Forecast',
    urls: {
      'en': 'https://rss.weather.gov.hk/rss/SeveralDaysWeatherForecast.xml',
      'zh-TW': 'https://rss.weather.gov.hk/rss/SeveralDaysWeatherForecast_uc.xml',
      'zh-CN': 'https://rss.weather.gov.hk/rss/SeveralDaysWeatherForecast_sc.xml'
    }
  },
  
  // Hong Kong Monetary Authority
  {
    group: 'hkma_press_new',
    name: 'HKMA Press Releases',
    urls: {
      'en': 'https://www.hkma.gov.hk/eng/news-and-media/press-releases/rss.xml',
      'zh-TW': 'https://www.hkma.gov.hk/chi/news-and-media/press-releases/rss.xml',
      'zh-CN': 'https://www.hkma.gov.hk/sc/news-and-media/press-releases/rss.xml'
    }
  },
  {
    group: 'hkma_circulars_new',
    name: 'HKMA Circulars',
    urls: {
      'en': 'https://www.hkma.gov.hk/eng/regulatory-resources/circulars/rss.xml',
      'zh-TW': 'https://www.hkma.gov.hk/chi/regulatory-resources/circulars/rss.xml',
      'zh-CN': 'https://www.hkma.gov.hk/sc/regulatory-resources/circulars/rss.xml'
    }
  },
  
  // Centre for Health Protection
  {
    group: 'chp_press_new',
    name: 'CHP Press Releases',
    urls: {
      'en': 'https://www.chp.gov.hk/rss/pressreleases_en_RSS.xml',
      'zh-TW': 'https://www.chp.gov.hk/rss/pressreleases_tc_RSS.xml',
      'zh-CN': 'https://www.chp.gov.hk/rss/pressreleases_sc_RSS.xml'
    }
  },
  {
    group: 'chp_guidelines_new',
    name: 'CHP Guidelines',
    urls: {
      'en': 'https://www.chp.gov.hk/rss/guidelines_en_RSS.xml',
      'zh-TW': 'https://www.chp.gov.hk/rss/guidelines_tc_RSS.xml',
      'zh-CN': 'https://www.chp.gov.hk/rss/guidelines_sc_RSS.xml'
    }
  },
  
  // Government News (info.gov.hk)
  {
    group: 'gov_general',
    name: 'Gov News General',
    urls: {
      'en': 'https://www.info.gov.hk/gia/rss/general_en.xml',
      'zh-TW': 'https://www.info.gov.hk/gia/rss/general_tc.xml',
      'zh-CN': 'https://www.info.gov.hk/gia/rss/general_sc.xml'
    }
  },
  {
    group: 'gov_finance',
    name: 'Gov News Finance',
    urls: {
      'en': 'https://www.info.gov.hk/gia/rss/finance_en.xml',
      'zh-TW': 'https://www.info.gov.hk/gia/rss/finance_tc.xml',
      'zh-CN': 'https://www.info.gov.hk/gia/rss/finance_sc.xml'
    }
  },
  {
    group: 'gov_business',
    name: 'Gov News Business',
    urls: {
      'en': 'https://www.info.gov.hk/gia/rss/business_en.xml',
      'zh-TW': 'https://www.info.gov.hk/gia/rss/business_tc.xml',
      'zh-CN': 'https://www.info.gov.hk/gia/rss/business_sc.xml'
    }
  },
  {
    group: 'gov_health',
    name: 'Gov News Health',
    urls: {
      'en': 'https://www.info.gov.hk/gia/rss/health_en.xml',
      'zh-TW': 'https://www.info.gov.hk/gia/rss/health_tc.xml',
      'zh-CN': 'https://www.info.gov.hk/gia/rss/health_sc.xml'
    }
  },
  {
    group: 'gov_infrastructure',
    name: 'Gov News Infrastructure',
    urls: {
      'en': 'https://www.info.gov.hk/gia/rss/infrastructure_en.xml',
      'zh-TW': 'https://www.info.gov.hk/gia/rss/infrastructure_tc.xml',
      'zh-CN': 'https://www.info.gov.hk/gia/rss/infrastructure_sc.xml'
    }
  },
  {
    group: 'gov_city',
    name: 'Gov News City',
    urls: {
      'en': 'https://www.info.gov.hk/gia/rss/city_en.xml',
      'zh-TW': 'https://www.info.gov.hk/gia/rss/city_tc.xml',
      'zh-CN': 'https://www.info.gov.hk/gia/rss/city_sc.xml'
    }
  },
  {
    group: 'gov_environment',
    name: 'Gov News Environment',
    urls: {
      'en': 'https://www.info.gov.hk/gia/rss/environment_en.xml',
      'zh-TW': 'https://www.info.gov.hk/gia/rss/environment_tc.xml',
      'zh-CN': 'https://www.info.gov.hk/gia/rss/environment_sc.xml'
    }
  },
  
  // Other Departments
  {
    group: 'police_press',
    name: 'Police Press Releases',
    urls: {
      'en': 'https://www.police.gov.hk/ppp_en/03_police_message/pr/rss.xml',
      'zh-TW': 'https://www.police.gov.hk/ppp_tc/03_police_message/pr/rss.xml',
      'zh-CN': 'https://www.police.gov.hk/ppp_sc/03_police_message/pr/rss.xml'
    }
  },
  {
    group: 'fsd_press',
    name: 'Fire Services Press',
    urls: {
      'en': 'https://www.hkfsd.gov.hk/eng/rss.xml',
      'zh-TW': 'https://www.hkfsd.gov.hk/tc/rss.xml',
      'zh-CN': 'https://www.hkfsd.gov.hk/sc/rss.xml'
    }
  },
  {
    group: 'edb_announcements',
    name: 'Education Bureau',
    urls: {
      'en': 'https://www.edb.gov.hk/en/whats_new_rss.xml',
      'zh-TW': 'https://www.edb.gov.hk/tc/whats_new_rss.xml',
      'zh-CN': 'https://www.edb.gov.hk/sc/whats_new_rss.xml'
    }
  },
  {
    group: 'immd_announcements',
    name: 'Immigration Department',
    urls: {
      'en': 'https://www.immd.gov.hk/eng/pressrss.xml',
      'zh-TW': 'https://www.immd.gov.hk/tc/pressrss.xml',
      'zh-CN': 'https://www.immd.gov.hk/sc/pressrss.xml'
    }
  },
  {
    group: 'lands_press',
    name: 'Lands Department',
    urls: {
      'en': 'https://www.landsd.gov.hk/en/pressreleases_rss.xml',
      'zh-TW': 'https://www.landsd.gov.hk/tc/pressreleases_rss.xml',
      'zh-CN': 'https://www.landsd.gov.hk/sc/pressreleases_rss.xml'
    }
  }
]

async function testFeedGroup(group: any) {
  console.log(`\n📦 Testing ${group.name} (${group.group})`)
  const results: any = {}
  let allSuccess = true
  
  for (const [lang, url] of Object.entries(group.urls)) {
    try {
      const feed = await parser.parseURL(url as string)
      results[lang] = {
        success: true,
        items: feed.items.length,
        title: feed.title,
        firstItem: feed.items[0]?.title || 'No items'
      }
      console.log(`   ✅ ${lang}: ${feed.items.length} items - "${feed.title}"`)
    } catch (error) {
      results[lang] = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
      console.log(`   ❌ ${lang}: ${results[lang].error}`)
      allSuccess = false
    }
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 200))
  }
  
  return { group: group.group, name: group.name, results, allSuccess }
}

async function main() {
  console.log('🚀 Testing Comprehensive Government RSS Feeds...')
  console.log('=' .repeat(60))
  
  const allResults = []
  
  // Test in batches to avoid overwhelming
  for (let i = 0; i < feedsToTest.length; i += 5) {
    const batch = feedsToTest.slice(i, i + 5)
    const batchResults = await Promise.all(batch.map(testFeedGroup))
    allResults.push(...batchResults)
    
    if (i + 5 < feedsToTest.length) {
      console.log('\n⏳ Pausing before next batch...')
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }
  
  console.log('\n' + '=' .repeat(60))
  console.log('📊 SUMMARY OF RESULTS:')
  
  const fullyWorking = allResults.filter(r => r.allSuccess)
  const partiallyWorking = allResults.filter(r => 
    !r.allSuccess && Object.values(r.results).some((res: any) => res.success)
  )
  const notWorking = allResults.filter(r => 
    Object.values(r.results).every((res: any) => !res.success)
  )
  
  console.log(`\n✅ FULLY WORKING (all languages): ${fullyWorking.length}`)
  fullyWorking.forEach(group => {
    console.log(`   - ${group.name} (${group.group})`)
  })
  
  console.log(`\n⚠️  PARTIALLY WORKING: ${partiallyWorking.length}`)
  partiallyWorking.forEach(group => {
    const langs = Object.entries(group.results)
      .filter(([_, res]: any) => res.success)
      .map(([lang]) => lang)
    console.log(`   - ${group.name}: ${langs.join(', ')} only`)
  })
  
  console.log(`\n❌ NOT WORKING: ${notWorking.length}`)
  notWorking.forEach(group => {
    console.log(`   - ${group.name}`)
  })
  
  // Generate SQL for working feeds
  console.log('\n' + '=' .repeat(60))
  console.log('📝 SQL INSERTS FOR WORKING FEEDS:')
  console.log('\n-- Working Government RSS Feeds')
  
  const workingFeeds = [...fullyWorking, ...partiallyWorking]
  workingFeeds.forEach(group => {
    const workingUrls: any = {}
    Object.entries(group.results).forEach(([lang, res]: any) => {
      if (res.success) {
        workingUrls[lang] = feedsToTest.find(f => f.group === group.group)?.urls[lang as keyof typeof f.urls]
      }
    })
    
    if (Object.keys(workingUrls).length > 0) {
      console.log(`\n-- ${group.name}`)
      console.log(`INSERT INTO government_feed_sources (feed_group, department, feed_type, urls, scraping_config)`)
      console.log(`VALUES ('${group.group}', 'government', 'news', '${JSON.stringify(workingUrls)}', '{`)
      console.log(`    "enabled": true,`)
      console.log(`    "frequency_minutes": 15,`)
      console.log(`    "priority_boost": 5`)
      console.log(`}')`)
      console.log(`ON CONFLICT (feed_group) DO UPDATE SET urls = EXCLUDED.urls;`)
    }
  })
}

main().catch(console.error)