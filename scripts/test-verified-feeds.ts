import Parser from 'rss-parser'

const parser = new Parser({
  timeout: 30000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; HKI-Zone-Signals/2.0)',
  }
})

// Verified feeds from the comprehensive list
const verifiedFeeds = [
  // Transport Department - XML Data Feeds
  {
    group: 'td_special_traffic',
    name: 'TD Special Traffic Arrangements',
    type: 'xml_data',
    urls: {
      'multilingual': 'https://www.td.gov.hk/datagovhk_tis/traffic-notices/Special_Traffic_and_Transport_Arrangement.xml'
    }
  },
  {
    group: 'td_clearways',
    name: 'TD Clearways Notices',
    type: 'xml_data',
    urls: {
      'multilingual': 'https://www.td.gov.hk/datagovhk_tis/traffic-notices/Notices_on_Clearways.xml'
    }
  },
  {
    group: 'td_public_transport',
    name: 'TD Public Transport Notices',
    type: 'xml_data',
    urls: {
      'multilingual': 'https://www.td.gov.hk/datagovhk_tis/traffic-notices/Notices_on_Public_Transports.xml'
    }
  },
  {
    group: 'td_road_closure',
    name: 'TD Road Closure Notices',
    type: 'xml_data',
    urls: {
      'multilingual': 'https://www.td.gov.hk/datagovhk_tis/traffic-notices/Notices_on_Temporary_Road_Closure.xml'
    }
  },
  {
    group: 'td_expressways',
    name: 'TD Expressway Notices',
    type: 'xml_data',
    urls: {
      'multilingual': 'https://www.td.gov.hk/datagovhk_tis/traffic-notices/Notices_on_Expressways.xml'
    }
  },
  
  // Transport Press via news.gov.hk
  {
    group: 'td_press_infrastructure',
    name: 'Transport Press (Infrastructure)',
    type: 'rss',
    urls: {
      'en': 'https://www.news.gov.hk/en/category/infrastructure/rss.xml',
      'zh-TW': 'https://www.news.gov.hk/tc/category/infrastructure/rss.xml',
      'zh-CN': 'https://www.news.gov.hk/sc/category/infrastructure/rss.xml'
    }
  },
  
  // HKO Weather Feeds
  {
    group: 'hko_warnings_v3',
    name: 'HKO Weather Warnings V3',
    type: 'rss',
    urls: {
      'en': 'https://rss.weather.gov.hk/rss/WeatherWarningSummaryv2.xml',
      'zh-TW': 'https://rss.weather.gov.hk/rss/WeatherWarningSummaryv2_uc.xml',
      'zh-CN': 'https://rss.weather.gov.hk/sc/rss/WeatherWarningSummaryv2_uc.xml'
    }
  },
  {
    group: 'hko_warning_bulletin',
    name: 'HKO Weather Warning Bulletin',
    type: 'rss',
    urls: {
      'en': 'https://rss.weather.gov.hk/rss/WeatherWarningBulletin.xml',
      'zh-TW': 'https://rss.weather.gov.hk/rss/WeatherWarningBulletin_uc.xml',
      'zh-CN': 'https://rss.weather.gov.hk/sc/rss/WeatherWarningBulletin_uc.xml'
    }
  },
  {
    group: 'hko_earthquakes_quick',
    name: 'HKO Quick Earthquake Messages',
    type: 'rss',
    urls: {
      'en': 'https://rss.weather.gov.hk/rss/QuickEarthquakeMessage.xml',
      'zh-TW': 'https://rss.weather.gov.hk/rss/QuickEarthquakeMessage_uc.xml',
      'zh-CN': 'https://rss.weather.gov.hk/sc/rss/QuickEarthquakeMessage_uc.xml'
    }
  },
  {
    group: 'hko_felt_earthquake',
    name: 'HKO Felt Earthquake Reports',
    type: 'rss',
    urls: {
      'en': 'https://rss.weather.gov.hk/rss/FeltEarthquake.xml',
      'zh-TW': 'https://rss.weather.gov.hk/rss/FeltEarthquake_uc.xml'
    }
  },
  {
    group: 'hko_current_v2',
    name: 'HKO Current Weather V2',
    type: 'rss',
    urls: {
      'en': 'https://rss.weather.gov.hk/rss/CurrentWeather.xml',
      'zh-TW': 'https://rss.weather.gov.hk/rss/CurrentWeather_uc.xml'
    }
  },
  {
    group: 'hko_local_forecast_v2',
    name: 'HKO Local Forecast V2',
    type: 'rss',
    urls: {
      'en': 'https://rss.weather.gov.hk/rss/LocalWeatherForecast.xml',
      'zh-TW': 'https://rss.weather.gov.hk/rss/LocalWeatherForecast_uc.xml'
    }
  },
  {
    group: 'hko_9day_v2',
    name: 'HKO 9-Day Forecast V2',
    type: 'rss',
    urls: {
      'en': 'https://rss.weather.gov.hk/rss/SeveralDaysWeatherForecast.xml',
      'zh-TW': 'https://rss.weather.gov.hk/rss/SeveralDaysWeatherForecast_uc.xml'
    }
  },
  
  // Government News Categories
  {
    group: 'gov_news_admin',
    name: 'Gov News Admin/Policy',
    type: 'rss',
    urls: {
      'en': 'https://www.news.gov.hk/en/category/admin/rss.xml',
      'zh-TW': 'https://www.news.gov.hk/tc/category/admin/rss.xml',
      'zh-CN': 'https://www.news.gov.hk/sc/category/admin/rss.xml'
    }
  },
  {
    group: 'gov_news_city_v2',
    name: 'Gov News City',
    type: 'rss',
    urls: {
      'en': 'https://www.news.gov.hk/en/category/city/rss.xml',
      'zh-TW': 'https://www.news.gov.hk/tc/category/city/rss.xml',
      'zh-CN': 'https://www.news.gov.hk/sc/category/city/rss.xml'
    }
  },
  {
    group: 'gov_news_finance_v2',
    name: 'Gov News Finance',
    type: 'rss',
    urls: {
      'en': 'https://www.news.gov.hk/en/category/finance/rss.xml',
      'zh-TW': 'https://www.news.gov.hk/tc/category/finance/rss.xml',
      'zh-CN': 'https://www.news.gov.hk/sc/category/finance/rss.xml'
    }
  },
  {
    group: 'gov_news_business_v2',
    name: 'Gov News Business',
    type: 'rss',
    urls: {
      'en': 'https://www.news.gov.hk/en/category/business/rss.xml',
      'zh-TW': 'https://www.news.gov.hk/tc/category/business/rss.xml',
      'zh-CN': 'https://www.news.gov.hk/sc/category/business/rss.xml'
    }
  },
  {
    group: 'gov_news_health_v2',
    name: 'Gov News Health',
    type: 'rss',
    urls: {
      'en': 'https://www.news.gov.hk/en/category/health/rss.xml',
      'zh-TW': 'https://www.news.gov.hk/tc/category/health/rss.xml',
      'zh-CN': 'https://www.news.gov.hk/sc/category/health/rss.xml'
    }
  },
  {
    group: 'gov_news_environment_v2',
    name: 'Gov News Environment',
    type: 'rss',
    urls: {
      'en': 'https://www.news.gov.hk/en/category/environment/rss.xml',
      'zh-TW': 'https://www.news.gov.hk/tc/category/environment/rss.xml',
      'zh-CN': 'https://www.news.gov.hk/sc/category/environment/rss.xml'
    }
  }
]

async function testXMLData(url: string): Promise<any> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; HKI-Zone-Signals/2.0)'
      }
    })
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    
    const xmlText = await response.text()
    const itemMatches = xmlText.match(/<item>/g)
    const titleMatches = xmlText.match(/<Title_EN>/g)
    
    return {
      success: true,
      type: 'xml_data',
      itemCount: itemMatches?.length || 0,
      hasMultilingualTitles: (titleMatches?.length || 0) > 0,
      preview: xmlText.substring(0, 200) + '...'
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

async function testRSSFeed(url: string): Promise<any> {
  try {
    const feed = await parser.parseURL(url)
    return {
      success: true,
      type: 'rss',
      itemCount: feed.items.length,
      title: feed.title,
      firstItem: feed.items[0]?.title || 'No items'
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

async function testFeedGroup(group: any) {
  console.log(`\n📦 Testing ${group.name} (${group.group}) - ${group.type.toUpperCase()}`)
  const results: any = {}
  let allSuccess = true
  let hasAnySuccess = false
  
  for (const [lang, url] of Object.entries(group.urls)) {
    try {
      let result
      if (group.type === 'xml_data') {
        result = await testXMLData(url as string)
      } else {
        result = await testRSSFeed(url as string)
      }
      
      results[lang] = result
      
      if (result.success) {
        hasAnySuccess = true
        if (group.type === 'xml_data') {
          console.log(`   ✅ ${lang}: ${result.itemCount} items (multilingual: ${result.hasMultilingualTitles})`)
        } else {
          console.log(`   ✅ ${lang}: ${result.itemCount} items - "${result.title}"`)
        }
      } else {
        console.log(`   ❌ ${lang}: ${result.error}`)
        allSuccess = false
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      results[lang] = { success: false, error: errorMsg }
      console.log(`   ❌ ${lang}: ${errorMsg}`)
      allSuccess = false
    }
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 300))
  }
  
  return { 
    group: group.group, 
    name: group.name, 
    type: group.type,
    results, 
    allSuccess, 
    hasAnySuccess 
  }
}

async function main() {
  console.log('🚀 Testing Verified Government RSS Feeds...')
  console.log('=' .repeat(70))
  
  const allResults = []
  
  // Test in smaller batches
  for (let i = 0; i < verifiedFeeds.length; i += 3) {
    const batch = verifiedFeeds.slice(i, i + 3)
    const batchResults = await Promise.all(batch.map(testFeedGroup))
    allResults.push(...batchResults)
    
    if (i + 3 < verifiedFeeds.length) {
      console.log('\n⏳ Pausing before next batch...')
      await new Promise(resolve => setTimeout(resolve, 1500))
    }
  }
  
  console.log('\n' + '=' .repeat(70))
  console.log('📊 FINAL RESULTS:')
  
  const fullyWorking = allResults.filter(r => r.allSuccess)
  const partiallyWorking = allResults.filter(r => r.hasAnySuccess && !r.allSuccess)
  const notWorking = allResults.filter(r => !r.hasAnySuccess)
  
  console.log(`\n✅ FULLY WORKING (all languages): ${fullyWorking.length}`)
  fullyWorking.forEach(group => {
    const langs = Object.keys(group.results).join(', ')
    console.log(`   - ${group.name} (${langs})`)
  })
  
  console.log(`\n⚠️  PARTIALLY WORKING: ${partiallyWorking.length}`)
  partiallyWorking.forEach(group => {
    const workingLangs = Object.entries(group.results)
      .filter(([_, res]: any) => res.success)
      .map(([lang]) => lang)
    console.log(`   - ${group.name}: ${workingLangs.join(', ')} only`)
  })
  
  console.log(`\n❌ NOT WORKING: ${notWorking.length}`)
  notWorking.forEach(group => {
    console.log(`   - ${group.name}`)
  })
  
  // Count totals
  const totalWorking = fullyWorking.length + partiallyWorking.length
  console.log(`\n🎯 SUMMARY: ${totalWorking}/${allResults.length} feed groups have working URLs`)
  
  // Generate SQL for working feeds
  console.log('\n' + '=' .repeat(70))
  console.log('📝 READY FOR DATABASE INSERTION:')
  
  const allWorking = [...fullyWorking, ...partiallyWorking]
  console.log(`\n-- ${allWorking.length} working feed groups found`)
  
  allWorking.forEach(group => {
    const workingUrls: any = {}
    Object.entries(group.results).forEach(([lang, res]: any) => {
      if (res.success) {
        workingUrls[lang] = verifiedFeeds.find(f => f.group === group.group)?.urls[lang as keyof typeof f.urls]
      }
    })
    
    console.log(`-- ${group.name} (${group.type})`)
    console.log(`('${group.group}', 'verified_working', '${group.type}', '${JSON.stringify(workingUrls)}'),`)
  })
}

main().catch(console.error)