#!/usr/bin/env node

/**
 * Script to fix specific language tagging issues
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

async function fixLanguageTagging() {
  console.log('🔧 Fixing language tagging issues...\n')
  
  // Fix 1: Correct incidents with wrong language tags
  console.log('1. Fixing incidents with incorrect language tags...')
  
  // Fix Chinese source incidents that are tagged as English
  const fixes = [
    {
      description: 'news_gov_top_zh incidents should be zh-TW, not en',
      update: { language: 'zh-TW' },
      condition: { source_slug: 'news_gov_top_zh', language: 'en' }
    },
    {
      description: 'hko_warn_zh_tw incidents should be zh-TW, not en', 
      update: { language: 'zh-TW' },
      condition: { source_slug: 'hko_warn_zh_tw', language: 'en' }
    },
    {
      description: 'All _zh_tw sources should have zh-TW language',
      update: { language: 'zh-TW' },
      condition: { language: 'en' },
      filter: 'source_slug.like.*_zh_tw'
    },
    {
      description: 'All _zh_cn sources should have zh-CN language',
      update: { language: 'zh-CN' },
      condition: { language: 'en' },
      filter: 'source_slug.like.*_zh_cn'
    }
  ]
  
  for (const fix of fixes) {
    try {
      let query = supabase.from('incidents').update(fix.update)
      
      // Apply conditions
      Object.entries(fix.condition).forEach(([key, value]) => {
        query = query.eq(key, value)
      })
      
      // Apply filters if specified
      if (fix.filter) {
        const [field, operator, pattern] = fix.filter.split('.')
        if (operator === 'like') {
          query = query.like(field, pattern)
        }
      }
      
      const { data, error, count } = await query.select('id', { count: 'exact' })
      
      if (error) {
        console.error(`❌ Failed to fix: ${fix.description}`, error)
      } else {
        console.log(`✅ ${fix.description}: ${count || 0} records updated`)
      }
    } catch (error) {
      console.error(`❌ Error applying fix: ${fix.description}`, error)
    }
  }
}

async function checkMissingTransportData() {
  console.log('\n2. Checking missing Transport data...')
  
  // Check if td_press_zh_tw feed has any incidents
  const { data: tdPressZh, error: tdError } = await supabase
    .from('incidents')
    .select('id, title, source_updated_at')
    .eq('source_slug', 'td_press_zh_tw')
    .limit(5)
  
  if (tdError) {
    console.error('Error checking td_press_zh_tw:', tdError)
  } else {
    console.log(`td_press_zh_tw incidents: ${tdPressZh?.length || 0}`)
    if (tdPressZh && tdPressZh.length > 0) {
      console.log('Sample td_press_zh_tw incidents:')
      tdPressZh.forEach(incident => {
        console.log(`  - ${incident.title} (${incident.source_updated_at})`)
      })
    }
  }
  
  // Check if the feed configuration exists and is active
  const { data: feedConfig, error: feedError } = await supabase
    .from('gov_feeds')
    .select('*')
    .eq('slug', 'td_press_zh_tw')
  
  if (feedError) {
    console.error('Error checking td_press_zh_tw feed config:', feedError)
  } else {
    console.log('td_press_zh_tw feed config:', feedConfig?.[0] || 'Not found')
  }
}

async function testAPIWithCorrections() {
  console.log('\n3. Testing API responses after corrections...')
  
  try {
    // Test Chinese API
    const zhResponse = await fetch('http://localhost:3000/api/signals?language=zh-TW&limit=20')
    if (zhResponse.ok) {
      const textResponse = await zhResponse.text()
      if (textResponse.startsWith('{')) {
        const zhData = JSON.parse(textResponse)
        
        const transportSources = new Set()
        const utilitySources = new Set()
        
        zhData.articles?.forEach(article => {
          if (article.source_slug.includes('td_')) {
            transportSources.add(article.source_slug)
          }
          if (article.source_slug.includes('news_gov_')) {
            utilitySources.add(article.source_slug)
          }
        })
        
        console.log('Chinese API after fixes:')
        console.log(`  Transport sources: ${Array.from(transportSources).join(', ')}`)
        console.log(`  Gov News sources: ${Array.from(utilitySources).join(', ')}`)
        console.log(`  Total articles: ${zhData.articles?.length || 0}`)
        console.log(`  Fallback articles: ${zhData.articles?.filter(a => a.is_fallback)?.length || 0}`)
      }
    }
    
    // Test English API  
    const enResponse = await fetch('http://localhost:3000/api/signals?language=en&limit=20')
    if (enResponse.ok) {
      const textResponse = await enResponse.text()
      if (textResponse.startsWith('{')) {
        const enData = JSON.parse(textResponse)
        
        const transportSources = new Set()
        const utilitySources = new Set()
        const chineseSources = []
        
        enData.articles?.forEach(article => {
          if (article.source_slug.includes('td_')) {
            transportSources.add(article.source_slug)
          }
          if (article.source_slug.includes('news_gov_')) {
            utilitySources.add(article.source_slug)
          }
          if (article.source_slug.includes('_zh_')) {
            chineseSources.push(article.source_slug)
          }
        })
        
        console.log('\nEnglish API after fixes:')
        console.log(`  Transport sources: ${Array.from(transportSources).join(', ')}`)
        console.log(`  Gov News sources: ${Array.from(utilitySources).join(', ')}`)
        console.log(`  Total articles: ${enData.articles?.length || 0}`)
        
        if (chineseSources.length > 0) {
          console.log(`  ❌ Still showing Chinese sources: ${chineseSources.join(', ')}`)
        } else {
          console.log(`  ✅ No Chinese sources in English results`)
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error testing API:', error)
  }
}

async function main() {
  await fixLanguageTagging()
  await checkMissingTransportData()
  await testAPIWithCorrections()
}

main().catch(console.error)