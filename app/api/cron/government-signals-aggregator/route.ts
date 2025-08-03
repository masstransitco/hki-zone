import { NextRequest, NextResponse } from 'next/server'
import { getSignalsAggregator } from '@/lib/government-signals-aggregator'

export const dynamic = 'force-dynamic'

/**
 * GET /api/cron/government-signals-aggregator
 * Cron job to fetch and aggregate government RSS feeds
 * Runs every 5 minutes to ensure fresh data
 */
export async function GET(request: NextRequest) {
  try {
    // Enhanced authentication for cron jobs
    const authHeader = request.headers.get('authorization')
    const userAgent = request.headers.get('user-agent')
    
    // Allow Vercel cron requests (primary method)
    const isVercelCron = userAgent === 'vercel-cron/1.0'
    
    // Allow manual requests with valid secret (backup method)
    const isValidSecret = process.env.CRON_SECRET && 
                          authHeader === `Bearer ${process.env.CRON_SECRET}`
    
    if (!isVercelCron && !isValidSecret) {
      console.log('❌ Unauthorized aggregator request:', { userAgent, hasAuth: !!authHeader })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const startTime = Date.now()
    console.log('🚀 Government Signals Aggregator cron started:', new Date().toISOString())
    console.log(`🔐 Authentication: ${isVercelCron ? 'Vercel Cron' : 'Secret Auth'}`)
    
    // Process all feeds using the new aggregator
    const aggregator = getSignalsAggregator()
    const result = await aggregator.processAllFeeds()
    
    const processingTime = Date.now() - startTime
    
    console.log('✅ Government Signals Aggregator completed:', {
      processed: result.processed,
      grouped: result.grouped,
      stored: result.stored,
      errors: result.errors.length,
      duration: `${processingTime}ms`
    })
    
    // Log errors if any
    if (result.errors.length > 0) {
      console.warn('⚠️ Aggregation errors:', result.errors)
    }
    
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      message: `Processed ${result.processed} RSS items into ${result.grouped} signals, stored ${result.stored}`,
      processing_time_ms: processingTime,
      result: {
        rss_items_fetched: result.processed,
        signals_grouped: result.grouped,
        signals_stored: result.stored,
        errors: result.errors,
        performance: {
          duration_ms: processingTime,
          items_per_second: result.processed > 0 ? Math.round((result.processed / processingTime) * 1000) : 0
        }
      }
    })

  } catch (error) {
    console.error('💥 Government Signals Aggregator cron failed:', error)
    
    return NextResponse.json({
      success: false,
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      message: 'Failed to aggregate government signals'
    }, { status: 500 })
  }
}

/**
 * POST /api/cron/government-signals-aggregator
 * Manual trigger for testing
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🧪 Manual Government Signals Aggregator triggered')
    
    const aggregator = getSignalsAggregator()
    const result = await aggregator.processAllFeeds()
    
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      message: `Manually processed ${result.processed} RSS items into ${result.grouped} signals`,
      result
    })
    
  } catch (error) {
    console.error('💥 Manual aggregator failed:', error)
    
    return NextResponse.json({
      success: false,
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Manual aggregation failed'
    }, { status: 500 })
  }
}