import dotenv from 'dotenv'

// Load environment variables FIRST
dotenv.config({ path: '.env.local' })

// Import after env vars are loaded
import { getUnifiedFeeds } from '../lib/government-feeds-unified'

async function main() {
  console.log('Starting unified feed processing...')
  console.log('Environment:', {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ? '✓ Set' : '✗ Missing',
    supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY ? '✓ Set' : '✗ Missing'
  })

  try {
    const unifiedFeeds = getUnifiedFeeds()
    await unifiedFeeds.processAllFeeds()
    console.log('Feed processing completed successfully!')
  } catch (error) {
    console.error('Error processing feeds:', error)
    process.exit(1)
  }
}

main().catch(console.error)