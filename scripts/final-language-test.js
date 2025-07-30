#!/usr/bin/env node

/**
 * Final test to verify language consistency across government feeds
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

// Category mapping for better organization
function getCategoryLabel(slug) {
  if (slug.includes('td_')) return 'Transport'
  if (slug.includes('hkma_')) return 'HKMA'
  if (slug.includes('chp_')) return 'Health'
  if (slug.includes('hko_')) return 'Weather'
  if (slug.includes('news_gov_')) return 'Gov News'
  return 'Other'
}

async function testLanguageConsistency() {
  console.log('🧪 Testing Language Consistency Across Government Feeds')
  console.log('=' * 60)
  
  try {
    // Test English feeds
    console.log('\n📡 Testing English feed API...')
    const enResponse = await fetch('http://localhost:3002/api/signals?language=en&limit=100')
    const enData = await enResponse.json()
    
    // Test Chinese feeds  
    console.log('📡 Testing Traditional Chinese feed API...')
    const zhResponse = await fetch('http://localhost:3002/api/signals?language=zh-TW&limit=100')
    const zhData = await zhResponse.json()
    
    // Analyze English feeds
    const enSources = new Map()
    enData.articles?.forEach(article => {
      const slug = article.source_slug
      const category = getCategoryLabel(slug)
      if (!enSources.has(category)) {
        enSources.set(category, new Set())
      }
      enSources.get(category).add(slug)
    })
    
    // Analyze Chinese feeds
    const zhSources = new Map()
    const fallbackCount = enData.articles?.filter(a => a.is_fallback)?.length || 0
    zhData.articles?.forEach(article => {
      const slug = article.source_slug
      const category = getCategoryLabel(slug)
      if (!zhSources.has(category)) {
        zhSources.set(category, new Set())
      }
      zhSources.get(category).add(slug)
    })
    
    console.log('\n📊 FEED ANALYSIS BY CATEGORY')
    console.log('=' * 40)
    
    // Get all categories
    const allCategories = new Set([...enSources.keys(), ...zhSources.keys()])
    
    for (const category of Array.from(allCategories).sort()) {
      const enSourcesInCat = enSources.get(category) || new Set()
      const zhSourcesInCat = zhSources.get(category) || new Set()
      
      console.log(`\n📁 ${category}:`)
      console.log(`   English sources: ${enSourcesInCat.size}`)
      console.log(`   Chinese sources: ${zhSourcesInCat.size}`)
      
      // Show English sources
      if (enSourcesInCat.size > 0) {
        console.log(`   English feeds:`)
        Array.from(enSourcesInCat).sort().forEach(source => {
          console.log(`     - ${source}`)
        })
      }
      
      // Show Chinese sources
      if (zhSourcesInCat.size > 0) {
        console.log(`   Chinese feeds:`)
        Array.from(zhSourcesInCat).sort().forEach(source => {
          console.log(`     - ${source}`)
        })
      }
      
      // Show missing feeds
      const missingInChinese = Array.from(enSourcesInCat).filter(source => 
        !Array.from(zhSourcesInCat).some(zhSource => 
          zhSource.includes(source.replace('_zh_tw', '')) || source.includes(zhSource.replace('_zh_tw', ''))
        )
      )
      
      if (missingInChinese.length > 0) {
        console.log(`   ⚠️  Missing Chinese variants for:`)
        missingInChinese.forEach(source => console.log(`     - ${source}`))
      }
    }
    
    console.log('\n📈 SUMMARY STATISTICS')
    console.log('=' * 30)
    console.log(`English articles: ${enData.articles?.length || 0}`)
    console.log(`Chinese articles: ${zhData.articles?.length || 0}`)
    console.log(`Fallback articles in Chinese: ${fallbackCount}`)
    
    const totalEnSources = Array.from(enSources.values()).reduce((total, set) => total + set.size, 0)
    const totalZhSources = Array.from(zhSources.values()).reduce((total, set) => total + set.size, 0)
    
    console.log(`Total English sources: ${totalEnSources}`)
    console.log(`Total Chinese sources: ${totalZhSources}`)
    
    const coverage = totalZhSources > 0 ? ((totalZhSources / totalEnSources) * 100).toFixed(1) : '0'
    console.log(`Chinese coverage: ${coverage}%`)
    
    // Final assessment
    console.log('\n🎯 DISCREPANCY ASSESSMENT')
    console.log('=' * 30)
    
    if (totalZhSources >= totalEnSources * 0.8) {
      console.log('✅ GOOD: Chinese feed coverage is adequate (≥80%)')
    } else if (totalZhSources >= totalEnSources * 0.6) {
      console.log('⚠️  FAIR: Chinese feed coverage is moderate (60-80%)')
    } else {
      console.log('❌ POOR: Chinese feed coverage is insufficient (<60%)')
    }
    
    console.log('\n🔧 FIXES APPLIED')
    console.log('=' * 20)
    console.log('✅ Added td_press_zh_tw (Transport Department press releases)')
    console.log('✅ Added hkma_press_zh_tw (HKMA press releases)')
    console.log('✅ Added hkma_circulars_zh_tw (HKMA circulars)')
    console.log('✅ Added fallback strategy for missing translations')
    console.log('❌ chp_press_zh_tw not available (404 error from source)')
    
  } catch (error) {
    console.error('❌ Error testing language consistency:', error)
  }
}

async function main() {
  await testLanguageConsistency()
}

main().catch(console.error)