import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'
import { getUnifiedFeedsV2 } from '../lib/government-feeds-unified-v2'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function cleanup() {
  console.log('Cleaning up existing incidents...')
  
  // Delete all existing incidents to start fresh
  const { error } = await supabase
    .from('incidents_unified')
    .delete()
    .gte('created_at', '2000-01-01') // Delete all
    
  if (error) {
    console.error('Error cleaning up:', error)
    return false
  }
  
  console.log('Cleanup completed')
  return true
}

async function reprocess() {
  console.log('Starting reprocessing with proper multilingual merging...')
  
  const processor = getUnifiedFeedsV2()
  await processor.processAllFeeds()
  
  console.log('Reprocessing completed')
}

async function verify() {
  console.log('\nVerifying results...')
  
  // Check for duplicate incidents
  const { data: duplicates } = await supabase.rpc('get_duplicate_incidents')
  
  if (duplicates && duplicates.length > 0) {
    console.warn(`Found ${duplicates.length} duplicate incidents`)
  } else {
    console.log('✓ No duplicate incidents found')
  }
  
  // Check language coverage
  const { data: stats } = await supabase
    .from('incidents_unified')
    .select('content')
    .limit(10)
    
  if (stats) {
    let enCount = 0, zhTwCount = 0, zhCnCount = 0
    
    for (const row of stats) {
      if (row.content?.en) enCount++
      if (row.content?.['zh-TW']) zhTwCount++
      if (row.content?.['zh-CN']) zhCnCount++
    }
    
    console.log(`\nLanguage coverage (sample of 10):`)
    console.log(`  English: ${enCount}/10`)
    console.log(`  Traditional Chinese: ${zhTwCount}/10`)
    console.log(`  Simplified Chinese: ${zhCnCount}/10`)
  }
}

async function main() {
  const cleanupSuccess = await cleanup()
  if (!cleanupSuccess) {
    console.error('Cleanup failed, aborting')
    return
  }
  
  await reprocess()
  await verify()
}

main().catch(console.error)