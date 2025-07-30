#!/usr/bin/env node

/**
 * Script to fix feed language discrepancies
 * This will add missing Chinese language variants for various government feeds
 */

import { createClient } from '@supabase/supabase-js'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { readFileSync } from 'fs'

// Load environment variables
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const envPath = join(__dirname, '..', '.env.local')

try {
  const envFile = readFileSync(envPath, 'utf8')
  envFile.split('\n').forEach(line => {
    const [key, value] = line.split('=')
    if (key && value) {
      process.env[key] = value
    }
  })
} catch (error) {
  console.warn('Could not load .env.local file')
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const missingFeeds = [
  // Transport Department press Traditional Chinese
  {
    slug: 'td_press_zh_tw',
    url: 'https://www.td.gov.hk/filemanager/rss/tc/press_release.xml',
    language: 'zh-TW',
    parent_feed_slug: 'td_press',
    active: true
  },
  
  // HKMA Traditional Chinese feeds
  {
    slug: 'hkma_press_zh_tw',
    url: 'https://www.hkma.gov.hk/chi/other-information/rss/rss_press-release.xml',
    language: 'zh-TW',
    parent_feed_slug: 'hkma_press',
    active: true
  },
  {
    slug: 'hkma_circulars_zh_tw',
    url: 'https://www.hkma.gov.hk/chi/other-information/rss/rss_circulars.xml',
    language: 'zh-TW',
    parent_feed_slug: 'hkma_circulars',
    active: true
  },
  
  // CHP Traditional Chinese press feed
  {
    slug: 'chp_press_zh_tw',
    url: 'https://www.chp.gov.hk/rss/tc/press_release.xml',
    language: 'zh-TW',
    parent_feed_slug: 'chp_press',
    active: true
  }
]

async function addMissingFeeds() {
  console.log('🚀 Adding missing Chinese language feeds...')
  
  for (const feed of missingFeeds) {
    try {
      console.log(`Adding feed: ${feed.slug}`)
      
      const { data, error } = await supabase
        .from('gov_feeds')
        .upsert(feed, { onConflict: 'slug' })
        .select()
      
      if (error) {
        console.error(`❌ Failed to add ${feed.slug}:`, error)
      } else {
        console.log(`✅ Successfully added ${feed.slug}`)
      }
    } catch (error) {
      console.error(`❌ Error adding ${feed.slug}:`, error)
    }
  }
  
  console.log('✅ All Chinese language feeds added!')
  
  console.log('✅ Feed discrepancy fixes complete!')
}

// Check current feed status
async function checkFeedStatus() {
  console.log('📊 Checking current feed status...')
  
  const { data: feeds, error } = await supabase
    .from('gov_feeds')
    .select('slug, language, active')
    .eq('active', true)
    .order('slug')
  
  if (error) {
    console.error('Error fetching feeds:', error)
    return
  }
  
  const english = feeds.filter(f => f.language === 'en')
  const chinese = feeds.filter(f => f.language === 'zh-TW')
  
  console.log(`\nEnglish feeds (${english.length}):`)
  english.forEach(f => console.log(`  ${f.slug}`))
  
  console.log(`\nTraditional Chinese feeds (${chinese.length}):`)
  chinese.forEach(f => console.log(`  ${f.slug}`))
}

async function main() {
  await checkFeedStatus()
  await addMissingFeeds()
  await checkFeedStatus()
}

main().catch(console.error)