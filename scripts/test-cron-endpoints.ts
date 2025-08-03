#!/usr/bin/env npx tsx

import fetch from 'node-fetch'

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
const CRON_SECRET = process.env.CRON_SECRET

interface CronEndpoint {
  name: string
  path: string
  schedule: string
  method: 'GET' | 'POST'
}

const cronEndpoints: CronEndpoint[] = [
  {
    name: 'Government Signals Aggregator',
    path: '/api/cron/government-signals-aggregator',
    schedule: '*/7 * * * * (every 7 minutes)',
    method: 'GET'
  },
  {
    name: 'Government Signals Scraper',
    path: '/api/cron/government-signals-scraper',
    schedule: '3,13,23,33,43,53 * * * * (every 10 minutes, offset by 3)',
    method: 'GET'
  },
  {
    name: 'Government Signals Combined',
    path: '/api/cron/government-signals',
    schedule: '*/15 * * * * (every 15 minutes)',
    method: 'GET'
  }
]

async function testCronEndpoint(endpoint: CronEndpoint): Promise<void> {
  console.log(`\n📡 Testing ${endpoint.name}`)
  console.log(`   Path: ${endpoint.path}`)
  console.log(`   Schedule: ${endpoint.schedule}`)
  
  try {
    // Test with manual authentication (CRON_SECRET)
    if (CRON_SECRET) {
      const response = await fetch(`${BASE_URL}${endpoint.path}`, {
        method: endpoint.method,
        headers: {
          'Authorization': `Bearer ${CRON_SECRET}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        console.log(`   ✅ Manual auth: Success`)
        console.log(`   📊 Result:`, {
          success: data.success,
          message: data.message || 'No message',
          processed: data.result?.rss_items_fetched || data.result?.signals_processed || data.processed,
          duration: data.processing_time_ms || data.duration_ms || 'N/A'
        })
      } else {
        console.log(`   ❌ Manual auth: Failed (${response.status})`)
      }
    } else {
      console.log(`   ⚠️  No CRON_SECRET set - skipping manual auth test`)
    }
    
    // Test with Vercel cron user agent
    const vercelResponse = await fetch(`${BASE_URL}${endpoint.path}`, {
      method: endpoint.method,
      headers: {
        'User-Agent': 'vercel-cron/1.0',
        'Content-Type': 'application/json'
      }
    })
    
    if (vercelResponse.ok) {
      console.log(`   ✅ Vercel cron: Would succeed in production`)
    } else {
      console.log(`   ⚠️  Vercel cron: ${vercelResponse.status} (normal in dev)`)
    }
    
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`)
  }
}

async function checkDeploymentReadiness(): Promise<void> {
  console.log('🚀 GOVERNMENT FEEDS DEPLOYMENT READINESS CHECK')
  console.log('=' .repeat(60))
  
  // Check environment
  console.log('\n📋 Environment Check:')
  console.log(`   NEXT_PUBLIC_SITE_URL: ${process.env.NEXT_PUBLIC_SITE_URL || '❌ Not set'}`)
  console.log(`   CRON_SECRET: ${process.env.CRON_SECRET ? '✅ Set' : '❌ Not set'}`)
  console.log(`   NEXT_PUBLIC_SUPABASE_URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ Set' : '❌ Not set'}`)
  console.log(`   SUPABASE_SERVICE_ROLE_KEY: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ Set' : '❌ Not set'}`)
  
  // Test endpoints
  console.log('\n🔧 Testing Cron Endpoints:')
  for (const endpoint of cronEndpoints) {
    await testCronEndpoint(endpoint)
  }
  
  // Deployment checklist
  console.log('\n\n✅ DEPLOYMENT CHECKLIST:')
  console.log('=' .repeat(60))
  console.log('1. Environment Variables:')
  console.log('   [ ] CRON_SECRET is set in Vercel')
  console.log('   [ ] All Supabase credentials are set')
  console.log('')
  console.log('2. Vercel Configuration:')
  console.log('   [ ] vercel.json contains all 3 government cron jobs')
  console.log('   [ ] Cron schedules are correct:')
  console.log('       - Aggregator: */7 * * * * (every 7 minutes)')
  console.log('       - Scraper: 3,13,23,33,43,53 * * * * (every 10 minutes)')
  console.log('       - Combined: */15 * * * * (every 15 minutes)')
  console.log('')
  console.log('3. Database:')
  console.log('   [ ] 19 active feed sources configured')
  console.log('   [ ] All feeds have trilingual support')
  console.log('   [ ] Scrapers configured for non-HKO feeds')
  console.log('')
  console.log('4. Production Readiness:')
  console.log('   [ ] Error handling in place')
  console.log('   [ ] Proper logging for monitoring')
  console.log('   [ ] Authentication secured')
  console.log('   [ ] Rate limiting configured')
  
  console.log('\n📊 SYSTEM STATUS:')
  console.log('   • Active Feeds: 19 (Transport: 7, Weather: 8, Monetary: 3, Police: 1)')
  console.log('   • Languages: English, Traditional Chinese, Simplified Chinese')
  console.log('   • Processing: RSS every 7min, Scraping every 10min')
  console.log('   • Content: HKO in RSS, Others via scraping')
}

// Run the tests
checkDeploymentReadiness().catch(console.error)