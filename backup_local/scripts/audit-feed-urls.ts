import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Known Chinese feed URLs to check
const knownChineseFeeds = {
  // Transport Department
  'td_notices': {
    'zh-TW': 'https://www.td.gov.hk/tc/special_news/trafficnews_tc.xml',
    'zh-CN': 'https://www.td.gov.hk/sc/special_news/trafficnews_sc.xml'
  },
  'td_press': {
    'zh-TW': 'https://www.td.gov.hk/tc/publications_and_press_releases/press_releases/press_tc.xml',
    'zh-CN': 'https://www.td.gov.hk/sc/publications_and_press_releases/press_releases/press_sc.xml'
  },
  'td_special': {
    'zh-TW': 'https://www.td.gov.hk/tc/special_news/spnews_tc.xml',
    'zh-CN': 'https://www.td.gov.hk/sc/special_news/spnews_sc.xml'
  },
  
  // Centre for Health Protection
  'chp_press': {
    'zh-TW': 'https://www.chp.gov.hk/rss/pressrelease_tc_rss.xml',
    'zh-CN': 'https://www.chp.gov.hk/rss/pressrelease_sc_rss.xml'
  },
  'chp_disease': {
    'zh-TW': 'https://www.chp.gov.hk/rss/cdwatch_tc_rss.xml',
    'zh-CN': 'https://www.chp.gov.hk/rss/cdwatch_sc_rss.xml'
  },
  'chp_guidelines': {
    'zh-TW': 'https://www.chp.gov.hk/rss/guideline_tc_rss.xml',
    'zh-CN': 'https://www.chp.gov.hk/rss/guideline_sc_rss.xml'
  },
  'chp_ncd': {
    'zh-TW': 'https://www.chp.gov.hk/rss/ncdwatch_tc_rss.xml',
    'zh-CN': 'https://www.chp.gov.hk/rss/ncdwatch_sc_rss.xml'
  },
  
  // Hong Kong Monetary Authority
  'hkma_press': {
    'zh-TW': 'https://www.hkma.gov.hk/chi/rss/press-releases.xml',
    'zh-CN': 'https://www.hkma.gov.hk/sc/rss/press-releases.xml'
  },
  'hkma_circulars': {
    'zh-TW': 'https://www.hkma.gov.hk/chi/rss/circulars.xml',
    'zh-CN': 'https://www.hkma.gov.hk/sc/rss/circulars.xml'
  },
  'hkma_guidelines': {
    'zh-TW': 'https://www.hkma.gov.hk/chi/rss/guidelines.xml',
    'zh-CN': 'https://www.hkma.gov.hk/sc/rss/guidelines.xml'
  },
  'hkma_speeches': {
    'zh-TW': 'https://www.hkma.gov.hk/chi/rss/speeches.xml',
    'zh-CN': 'https://www.hkma.gov.hk/sc/rss/speeches.xml'
  },
  
  // Hong Kong Observatory
  'hko_warn': {
    'zh-TW': 'https://www.hko.gov.hk/textonly/chinese/rss/WeatherWarningBulletin_tc.xml',
    'zh-CN': 'https://www.hko.gov.hk/textonly/sc/rss/WeatherWarningBulletin_sc.xml'
  },
  'hko_eq': {
    'zh-TW': 'https://www.hko.gov.hk/textonly/chinese/rss/QuickEarthquakeMessage_tc.xml',
    'zh-CN': 'https://www.hko.gov.hk/textonly/sc/rss/QuickEarthquakeMessage_sc.xml'
  },
  'hko_felt_earthquake': {
    'zh-TW': 'https://www.hko.gov.hk/textonly/chinese/rss/FeltEarthquake_tc.xml',
    'zh-CN': 'https://www.hko.gov.hk/textonly/sc/rss/FeltEarthquake_sc.xml'
  },
  
  // Government News
  'news_gov_top': {
    'zh-TW': 'https://www.news.gov.hk/tc/common/html/topstories.rss.xml',
    'zh-CN': 'https://www.news.gov.hk/sc/common/html/topstories.rss.xml'
  },
  
  // MTR
  'mtr_rail': {
    'zh-TW': 'https://www.mtr.com.hk/alert/ryg_line_status_tc.xml',
    'zh-CN': 'https://www.mtr.com.hk/alert/ryg_line_status_sc.xml'
  },
  
  // Hospital Authority - A&E waiting times (JSON API, not RSS)
  'ha_ae_waiting': {
    'zh-TW': 'https://www.ha.org.hk/opendata/aed/aedwtdata-tc.json',
    'zh-CN': 'https://www.ha.org.hk/opendata/aed/aedwtdata-sc.json'
  }
}

// Additional potential feeds to discover
const potentialFeeds = {
  // EMSD
  'emsd_util': {
    'zh-TW': 'https://www.emsd.gov.hk/tc/news_and_press_releases/press_releases/index_rss.xml',
    'zh-CN': 'https://www.emsd.gov.hk/sc/news_and_press_releases/press_releases/index_rss.xml'
  },
  
  // Water Supplies Department
  'wsd_interruption': {
    'zh-TW': 'https://www.wsd.gov.hk/tc/rss/water_supply_interruption.xml',
    'zh-CN': 'https://www.wsd.gov.hk/sc/rss/water_supply_interruption.xml'
  },
  
  // Drainage Services Department
  'dsd_flooding': {
    'zh-TW': 'https://www.dsd.gov.hk/TC/RSS/flooding_rss.xml',
    'zh-CN': 'https://www.dsd.gov.hk/SC/RSS/flooding_rss.xml'
  }
}

async function checkFeedAvailability(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; HKI-Zone/1.0)'
      },
      timeout: 5000
    })
    return response.ok
  } catch (error) {
    return false
  }
}

async function auditFeeds() {
  console.log('Starting feed URL audit...\n')
  
  // Get current feed configuration
  const { data: currentFeeds, error } = await supabase
    .from('gov_feeds_unified')
    .select('*')
    .order('base_slug')
  
  if (error || !currentFeeds) {
    console.error('Error fetching current feeds:', error)
    return
  }
  
  // Create lookup map
  const feedMap = new Map()
  for (const feed of currentFeeds) {
    feedMap.set(feed.base_slug, feed)
  }
  
  console.log('=== CURRENT FEED STATUS ===\n')
  
  // Check each current feed
  for (const feed of currentFeeds) {
    console.log(`${feed.base_slug}:`)
    console.log(`  English: ${feed.url_en ? '✓' : '✗'}`)
    console.log(`  Traditional Chinese: ${feed.url_zh_tw ? '✓' : '✗'}`)
    console.log(`  Simplified Chinese: ${feed.url_zh_cn ? '✓' : '✗'}`)
    
    // Check if we have known URLs for missing feeds
    if (!feed.url_zh_tw && knownChineseFeeds[feed.base_slug]?.['zh-TW']) {
      console.log(`  → Found missing zh-TW URL: ${knownChineseFeeds[feed.base_slug]['zh-TW']}`)
    }
    if (!feed.url_zh_cn && knownChineseFeeds[feed.base_slug]?.['zh-CN']) {
      console.log(`  → Found missing zh-CN URL: ${knownChineseFeeds[feed.base_slug]['zh-CN']}`)
    }
    console.log('')
  }
  
  console.log('\n=== TESTING KNOWN CHINESE FEED URLS ===\n')
  
  // Test all known Chinese feed URLs
  for (const [baseSlug, urls] of Object.entries(knownChineseFeeds)) {
    console.log(`Testing ${baseSlug}:`)
    
    for (const [lang, url] of Object.entries(urls)) {
      const isAvailable = await checkFeedAvailability(url)
      console.log(`  ${lang}: ${isAvailable ? '✓ Available' : '✗ Not available'} - ${url}`)
    }
    console.log('')
  }
  
  console.log('\n=== TESTING POTENTIAL NEW FEEDS ===\n')
  
  // Test potential new feeds
  for (const [baseSlug, urls] of Object.entries(potentialFeeds)) {
    console.log(`Testing potential feed ${baseSlug}:`)
    
    for (const [lang, url] of Object.entries(urls)) {
      const isAvailable = await checkFeedAvailability(url)
      console.log(`  ${lang}: ${isAvailable ? '✓ Available' : '✗ Not available'} - ${url}`)
    }
    console.log('')
  }
  
  console.log('\n=== RECOMMENDATIONS ===\n')
  
  // Generate SQL updates for missing URLs
  const updates: string[] = []
  
  for (const [baseSlug, urls] of Object.entries(knownChineseFeeds)) {
    const feed = feedMap.get(baseSlug)
    if (!feed) continue
    
    if (!feed.url_zh_tw && urls['zh-TW']) {
      updates.push(`UPDATE gov_feeds_unified SET url_zh_tw = '${urls['zh-TW']}' WHERE base_slug = '${baseSlug}';`)
    }
    if (!feed.url_zh_cn && urls['zh-CN']) {
      updates.push(`UPDATE gov_feeds_unified SET url_zh_cn = '${urls['zh-CN']}' WHERE base_slug = '${baseSlug}';`)
    }
  }
  
  if (updates.length > 0) {
    console.log('SQL Updates needed:')
    console.log(updates.join('\n'))
  } else {
    console.log('All known feeds are properly configured!')
  }
  
  // Check for feeds without any Chinese variant
  console.log('\n=== FEEDS WITHOUT CHINESE VARIANTS ===\n')
  
  for (const feed of currentFeeds) {
    if (!feed.url_zh_tw && !feed.url_zh_cn) {
      console.log(`- ${feed.base_slug} (${feed.name_en})`)
    }
  }
}

// Run the audit
auditFeeds().catch(console.error)