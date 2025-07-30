#!/usr/bin/env node

/**
 * Script to manually process government feeds
 */

import { createClient } from '@supabase/supabase-js'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { readFileSync } from 'fs'

// Load environment variables from .env.local and .env.cli
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

function loadEnvFile(filename) {
  const envPath = join(__dirname, '..', filename)
  try {
    const envFile = readFileSync(envPath, 'utf8')
    envFile.split('\n').forEach(line => {
      const [key, ...valueParts] = line.split('=')
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=').replace(/^['"]|['"]$/g, '') // Remove quotes
        process.env[key] = value
      }
    })
    console.log(`Loaded ${filename}`)
  } catch (error) {
    console.warn(`Could not load ${filename}`)
  }
}

// Load both .env files
loadEnvFile('.env.local')
loadEnvFile('.env.cli')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Simple feed processing function
async function processSingleFeed(feed) {
  console.log(`Processing feed: ${feed.slug}`)
  
  try {
    const response = await fetch(feed.url, {
      headers: {
        'User-Agent': 'hki.zone/incident-fetcher 1.0'
      }
    })
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    
    const content = await response.text()
    console.log(`✅ Successfully fetched ${feed.slug} (${content.length} bytes)`)
    
    // For now, just check if we can fetch the feeds
    // The actual processing would require importing the full GovernmentFeeds class
    
  } catch (error) {
    console.error(`❌ Failed to fetch ${feed.slug}:`, error.message)
  }
}

async function testNewFeeds() {
  console.log('🧪 Testing new Chinese feeds...')
  
  const newFeeds = [
    {
      slug: 'td_press_zh_tw',
      url: 'https://www.td.gov.hk/filemanager/rss/tc/press_release.xml'
    },
    {
      slug: 'hkma_press_zh_tw', 
      url: 'https://www.hkma.gov.hk/chi/other-information/rss/rss_press-release.xml'
    },
    {
      slug: 'hkma_circulars_zh_tw',
      url: 'https://www.hkma.gov.hk/chi/other-information/rss/rss_circulars.xml'
    },
    {
      slug: 'chp_press_zh_tw',
      url: 'https://www.chp.gov.hk/rss/tc/press_release.xml'
    }
  ]
  
  for (const feed of newFeeds) {
    await processSingleFeed(feed)
    // Rate limit
    await new Promise(resolve => setTimeout(resolve, 1000))
  }
}

async function checkAPIResponse() {
  console.log('🔍 Checking API responses...')
  
  try {
    console.log('Testing English feeds API...')
    const enResponse = await fetch('http://localhost:3002/api/signals?language=en&limit=20')
    const enData = await enResponse.json()
    
    console.log('Testing Chinese feeds API...')
    const zhResponse = await fetch('http://localhost:3002/api/signals?language=zh-TW&limit=20')
    const zhData = await zhResponse.json()
    
    // Count unique sources
    const enSources = new Set(enData.articles?.map(a => a.source_slug) || [])
    const zhSources = new Set(zhData.articles?.map(a => a.source_slug) || [])
    
    console.log(`\nAPI Results:`)
    console.log(`English: ${enData.articles?.length || 0} articles from ${enSources.size} sources`)
    console.log(`Chinese: ${zhData.articles?.length || 0} articles from ${zhSources.size} sources`)
    
    console.log(`\nEnglish sources:`)
    Array.from(enSources).sort().forEach(s => console.log(`  ${s}`))
    
    console.log(`\nChinese sources:`)
    Array.from(zhSources).sort().forEach(s => console.log(`  ${s}`))
    
    // Check for fallback indicators
    const fallbackArticles = zhData.articles?.filter(a => a.is_fallback) || []
    console.log(`\nFallback articles in Chinese: ${fallbackArticles.length}`)
    
  } catch (error) {
    console.error('❌ Error checking API:', error)
  }
}

async function main() {
  await testNewFeeds()
  await checkAPIResponse()
}

main().catch(console.error)