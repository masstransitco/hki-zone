#!/usr/bin/env node

/**
 * Debug script to understand fallback logic
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

async function debugFallbackLogic() {
  console.log('🔍 Debugging fallback logic for Chinese (zh-TW) language...\n')
  
  const language = 'zh-TW'
  
  // Step 1: Get available feeds (sources that have incidents in Chinese)
  console.log('Step 1: Get available feeds with Chinese incidents...')
  const { data: availableFeeds } = await supabase
    .from('incidents')
    .select('source_slug')
    .eq('language', language)
    .not('source_slug', 'like', 'ha_%')
  
  const availableFeedSlugs = new Set(availableFeeds?.map(f => f.source_slug) || [])
  console.log('Available Chinese feeds:', Array.from(availableFeedSlugs))
  
  // Step 2: Get parent feed mappings
  console.log('\nStep 2: Get parent feed mappings...')
  const { data: feedMappings } = await supabase
    .from('gov_feeds')
    .select('slug, parent_feed_slug')
    .eq('language', language)
    .not('parent_feed_slug', 'is', null)
  
  console.log('Feed mappings:')
  feedMappings?.forEach(mapping => {
    console.log(`  ${mapping.slug} -> ${mapping.parent_feed_slug}`)
  })
  
  const parentFeedSlugs = feedMappings?.map(f => f.parent_feed_slug) || []
  console.log('Parent feed slugs:', parentFeedSlugs)
  
  // Step 3: Understand the fallback query
  console.log('\nStep 3: Understanding the fallback query...')
  console.log('Query should be:')
  if (parentFeedSlugs.length > 0) {
    const queryStr = `language.eq.${language},and(language.eq.en,source_slug.not.in.(${parentFeedSlugs.join(',')}))`
    console.log(`  query.or('${queryStr}')`)
    console.log('This means: Show incidents where:')
    console.log(`  - language = '${language}' (Chinese incidents) OR`)
    console.log(`  - (language = 'en' AND source_slug NOT IN [${parentFeedSlugs.join(', ')}])`)
    console.log('  Which means: Chinese incidents + English incidents from feeds without Chinese variants')
  }
  
  // Step 4: Check which English feeds should be included as fallback
  console.log('\nStep 4: Check English feeds for fallback...')
  const { data: englishFeeds } = await supabase
    .from('incidents')
    .select('source_slug, title')
    .eq('language', 'en')
    .not('source_slug', 'like', 'ha_%')
    .limit(50)
  
  const englishFeedCounts = {}
  englishFeeds?.forEach(incident => {
    englishFeedCounts[incident.source_slug] = (englishFeedCounts[incident.source_slug] || 0) + 1
  })
  
  console.log('English feeds with incident counts:')
  Object.entries(englishFeedCounts).forEach(([slug, count]) => {
    const shouldFallback = !parentFeedSlugs.includes(slug)
    console.log(`  ${slug}: ${count} incidents ${shouldFallback ? '(SHOULD BE FALLBACK)' : '(HAS CHINESE VARIANT)'}`)
  })
  
  // Step 5: Specifically check td_press situation
  console.log('\nStep 5: Check td_press situation...')
  console.log(`Is 'td_press' in parentFeedSlugs? ${parentFeedSlugs.includes('td_press')}`)
  
  const { data: tdPressEn } = await supabase
    .from('incidents')
    .select('id, title, source_updated_at')
    .eq('source_slug', 'td_press')
    .eq('language', 'en')
    .limit(3)
  
  const { data: tdPressZh } = await supabase
    .from('incidents')
    .select('id, title, source_updated_at')
    .eq('source_slug', 'td_press_zh_tw')
    .eq('language', 'zh-TW')
    .limit(3)
  
  console.log(`English td_press incidents: ${tdPressEn?.length || 0}`)
  if (tdPressEn && tdPressEn.length > 0) {
    console.log('Sample English td_press:')
    tdPressEn.forEach(incident => console.log(`  - ${incident.title}`))
  }
  
  console.log(`Chinese td_press_zh_tw incidents: ${tdPressZh?.length || 0}`)
  if (tdPressZh && tdPressZh.length > 0) {
    console.log('Sample Chinese td_press_zh_tw:')
    tdPressZh.forEach(incident => console.log(`  - ${incident.title}`))
  }
  
  // Step 6: Test the actual query manually
  console.log('\nStep 6: Test the fallback query manually...')
  try {
    let query = supabase
      .from('incidents')
      .select('source_slug, language, title')
      .not('source_slug', 'like', 'ha_%')
    
    if (parentFeedSlugs.length > 0) {
      query = query.or(`language.eq.${language},and(language.eq.en,source_slug.not.in.(${parentFeedSlugs.join(',')}))`)
    } else {
      query = query.eq('language', language)
    }
    
    const { data: testResults, error } = await query.limit(50)
    
    if (error) {
      console.error('❌ Query failed:', error)
    } else {
      console.log(`✅ Query returned ${testResults?.length || 0} results`)
      
      const sourceCounts = {}
      testResults?.forEach(incident => {
        const key = `${incident.source_slug} (${incident.language})`
        sourceCounts[key] = (sourceCounts[key] || 0) + 1
      })
      
      console.log('Results by source:')
      Object.entries(sourceCounts).forEach(([source, count]) => {
        console.log(`  ${source}: ${count}`)
      })
    }
    
  } catch (error) {
    console.error('❌ Error testing query:', error)
  }
}

async function main() {
  await debugFallbackLogic()
}

main().catch(console.error)