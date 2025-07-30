#!/usr/bin/env node

/**
 * Debug script to investigate feed categorization issues
 */

import { createClient } from '@supabase/supabase-js'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { readFileSync } from 'fs'

// Load environment variables
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

function loadEnvFile(filename) {
  const envPath = join(__dirname, '..', filename)
  try {
    const envFile = readFileSync(envPath, 'utf8')
    envFile.split('\n').forEach(line => {
      const [key, ...valueParts] = line.split('=')
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=').replace(/^['"]|['"]$/g, '')
        process.env[key] = value
      }
    })
  } catch (error) {
    // Silently ignore
  }
}

loadEnvFile('.env.local')
loadEnvFile('.env.cli')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

function getCategoryLabel(slug) {
  if (slug.includes('td_')) return 'Transport'
  if (slug.includes('hkma_')) return 'HKMA'
  if (slug.includes('chp_')) return 'Health'
  if (slug.includes('hko_')) return 'Weather'
  if (slug.includes('news_gov_')) return 'Gov News'
  return 'Other'
}

async function checkDatabaseFeeds() {
  console.log('🔍 Checking database feed configurations...\n')
  
  const { data: feeds, error } = await supabase
    .from('gov_feeds')
    .select('slug, language, active, parent_feed_slug')
    .eq('active', true)
    .order('slug')
  
  if (error) {
    console.error('Error fetching feeds:', error)
    return
  }
  
  console.log('📋 All Active Feeds in Database:')
  feeds.forEach(feed => {
    const category = getCategoryLabel(feed.slug)
    console.log(`  ${feed.slug} (${feed.language}) [${category}] ${feed.parent_feed_slug ? `-> ${feed.parent_feed_slug}` : ''}`)
  })
  
  console.log('\n📊 Feed Summary by Category:')
  const english = feeds.filter(f => f.language === 'en')
  const chinese = feeds.filter(f => f.language === 'zh-TW')
  
  const categories = {}
  feeds.forEach(feed => {
    const cat = getCategoryLabel(feed.slug)
    if (!categories[cat]) categories[cat] = { en: [], zh: [] }
    if (feed.language === 'en') categories[cat].en.push(feed.slug)
    else if (feed.language === 'zh-TW') categories[cat].zh.push(feed.slug)
  })
  
  for (const [category, feedLists] of Object.entries(categories)) {
    console.log(`\n${category}:`)
    console.log(`  English: ${feedLists.en.length} feeds`)
    feedLists.en.forEach(feed => console.log(`    - ${feed}`))
    console.log(`  Chinese: ${feedLists.zh.length} feeds`)
    feedLists.zh.forEach(feed => console.log(`    - ${feed}`))
  }
}

async function checkRecentIncidents() {
  console.log('\n🔍 Checking recent incidents by source and language...\n')
  
  const { data: incidents, error } = await supabase
    .from('incidents')
    .select('source_slug, language, category, title')
    .gte('source_updated_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
    .not('source_slug', 'like', 'ha_%')
    .limit(50)
    .order('source_updated_at', { ascending: false })
  
  if (error) {
    console.error('Error fetching incidents:', error)
    return
  }
  
  console.log('📋 Recent Incidents Sample:')
  const sourceStats = {}
  
  incidents.forEach(incident => {
    const key = `${incident.source_slug} (${incident.language})`
    if (!sourceStats[key]) {
      sourceStats[key] = {
        count: 0,
        category: incident.category,
        categoryLabel: getCategoryLabel(incident.source_slug)
      }
    }
    sourceStats[key].count++
  })
  
  console.log('\nIncident Count by Source:')
  Object.entries(sourceStats)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([source, stats]) => {
      console.log(`  ${source}: ${stats.count} incidents [${stats.category}] (${stats.categoryLabel})`)
    })
}

async function checkAPIEndpoints() {
  console.log('\n🔍 Testing API endpoints for language-specific issues...\n')
  
  try {
    // Check English response
    console.log('Testing English API (localhost:3000)...')
    const enResponse = await fetch('http://localhost:3000/api/signals?language=en&limit=30')
    let enData = null
    
    if (enResponse.ok) {
      const textResponse = await enResponse.text()
      if (textResponse.startsWith('{')) {
        enData = JSON.parse(textResponse)
      } else {
        console.log('❌ English API returned HTML instead of JSON')
      }
    }
    
    // Check Chinese response  
    console.log('Testing Chinese API (localhost:3000)...')
    const zhResponse = await fetch('http://localhost:3000/api/signals?language=zh-TW&limit=30')
    let zhData = null
    
    if (zhResponse.ok) {
      const textResponse = await zhResponse.text()
      if (textResponse.startsWith('{')) {
        zhData = JSON.parse(textResponse)
      } else {
        console.log('❌ Chinese API returned HTML instead of JSON')
      }
    }
    
    if (enData && zhData) {
      console.log('\n📊 API Response Analysis:')
      
      // Analyze English response
      const enSources = {}
      enData.articles?.forEach(article => {
        const category = getCategoryLabel(article.source_slug)
        if (!enSources[category]) enSources[category] = new Set()
        enSources[category].add(article.source_slug)
      })
      
      // Analyze Chinese response
      const zhSources = {}
      const fallbackCount = zhData.articles?.filter(a => a.is_fallback)?.length || 0
      zhData.articles?.forEach(article => {
        const category = getCategoryLabel(article.source_slug)
        if (!zhSources[category]) zhSources[category] = new Set()
        zhSources[category].add(article.source_slug)
      })
      
      console.log('\nEnglish API Results:')
      Object.entries(enSources).forEach(([cat, sources]) => {
        console.log(`  ${cat}: ${sources.size} sources`)
        Array.from(sources).forEach(source => console.log(`    - ${source}`))
      })
      
      console.log('\nChinese API Results:')
      Object.entries(zhSources).forEach(([cat, sources]) => {
        console.log(`  ${cat}: ${sources.size} sources`)
        Array.from(sources).forEach(source => console.log(`    - ${source}`))
      })
      
      console.log(`\nFallback articles in Chinese response: ${fallbackCount}`)
      
      // Identify specific issues
      console.log('\n🔍 ISSUE ANALYSIS:')
      
      // Check for Utility feeds in English
      const enUtility = enSources['Gov News'] || new Set()
      if (enUtility.size > 0) {
        console.log('❌ Issue 1: English shows Gov News/Utility feeds:')
        Array.from(enUtility).forEach(source => console.log(`    - ${source}`))
      }
      
      // Check for missing Transport in Chinese
      const zhTransport = zhSources['Transport'] || new Set()
      const enTransport = enSources['Transport'] || new Set()
      if (enTransport.size > zhTransport.size) {
        console.log('❌ Issue 2: Chinese missing Transport feeds:')
        console.log(`    English Transport: ${enTransport.size} sources`)
        console.log(`    Chinese Transport: ${zhTransport.size} sources`)
        const missing = Array.from(enTransport).filter(source => 
          !Array.from(zhTransport).some(zhSource => 
            zhSource.includes(source.replace('_zh_tw', '')) || source.includes(zhSource.replace('_zh_tw', ''))
          )
        )
        missing.forEach(source => console.log(`    Missing: ${source}`))
      }
    }
    
  } catch (error) {
    console.error('❌ Error testing API endpoints:', error)
  }
}

async function main() {
  await checkDatabaseFeeds()
  await checkRecentIncidents() 
  await checkAPIEndpoints()
}

main().catch(console.error)