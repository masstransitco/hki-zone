#!/usr/bin/env node

/**
 * Script to process all government feeds
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

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing required environment variables')
  process.exit(1)
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function processFeeds() {
  console.log('🚀 Triggering government feed processing...')
  
  try {
    // Call the admin API to process feeds
    const response = await fetch('http://localhost:3002/api/admin/process-feeds', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ force: true })
    })
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    
    const result = await response.json()
    console.log('✅ Feed processing completed:', result)
    
  } catch (error) {
    console.error('❌ Error processing feeds:', error)
  }
}

async function checkIncidentCounts() {
  console.log('📊 Checking incident counts by language...')
  
  try {
    // Get incident counts by language
    const { data: counts, error } = await supabase
      .from('incidents')
      .select('language, source_slug')
      .gte('source_updated_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .not('source_slug', 'like', 'ha_%')
    
    if (error) {
      console.error('Error fetching incident counts:', error)
      return
    }
    
    const englishSources = new Set()
    const chineseSources = new Set()
    
    counts.forEach(incident => {
      if (incident.language === 'en') {
        englishSources.add(incident.source_slug)
      } else if (incident.language === 'zh-TW') {
        chineseSources.add(incident.source_slug)
      }
    })
    
    console.log(`\nEnglish sources (${englishSources.size}):`)
    Array.from(englishSources).sort().forEach(source => console.log(`  ${source}`))
    
    console.log(`\nTraditional Chinese sources (${chineseSources.size}):`)
    Array.from(chineseSources).sort().forEach(source => console.log(`  ${source}`))
    
    console.log(`\nTotal English incidents: ${counts.filter(i => i.language === 'en').length}`)
    console.log(`Total Chinese incidents: ${counts.filter(i => i.language === 'zh-TW').length}`)
    
  } catch (error) {
    console.error('Error checking incident counts:', error)
  }
}

async function main() {
  await checkIncidentCounts()
  await processFeeds()
  // Wait a bit for processing to complete
  await new Promise(resolve => setTimeout(resolve, 10000))
  await checkIncidentCounts()
}

main().catch(console.error)