import { NextRequest, NextResponse } from 'next/server'
import { getSignalsAggregator } from '@/lib/government-signals-aggregator'

export const dynamic = 'force-dynamic'

/**
 * GET /api/cron/government-signals
 * Comprehensive government signals processing
 * Combines aggregation and basic monitoring
 */
export async function GET(request: NextRequest) {
  try {
    console.log('🕒 [CRON] Government signals comprehensive processing started')
    
    // Enhanced authentication for cron jobs
    const authHeader = request.headers.get('authorization')
    const userAgent = request.headers.get('user-agent')
    
    // Allow Vercel cron requests (primary method)
    const isVercelCron = userAgent === 'vercel-cron/1.0'
    
    // Allow manual requests with valid secret (backup method)
    const isValidSecret = process.env.CRON_SECRET && 
                          authHeader === `Bearer ${process.env.CRON_SECRET}`
    
    if (!isVercelCron && !isValidSecret) {
      console.log('❌ [CRON] Unauthorized request:', { userAgent, hasAuth: !!authHeader })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    console.log(`🔐 [CRON] Authentication: ${isVercelCron ? 'Vercel Cron' : 'Secret Auth'}`)
    
    const aggregator = getSignalsAggregator()
    
    // Get initial stats
    const initialStats = await aggregator.getProcessingStatistics()
    console.log(`📊 [CRON] Initial state: ${initialStats.totalSignals} signals`)
    
    // Run the aggregation
    const startTime = Date.now()
    const result = await aggregator.processAllFeeds()
    const duration = Date.now() - startTime
    
    // Get final stats
    const finalStats = await aggregator.getProcessingStatistics()
    const newSignals = finalStats.totalSignals - initialStats.totalSignals
    
    console.log(`✅ [CRON] Completed in ${duration}ms`)
    console.log(`📈 [CRON] Added ${newSignals} new signals`)
    
    return NextResponse.json({
      success: true,
      duration_ms: duration,
      processed: result.processed,
      grouped: result.grouped,
      stored: result.stored,
      new_signals: newSignals,
      total_signals: finalStats.totalSignals,
      errors: result.errors,
      feed_breakdown: finalStats.byFeedGroup,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('❌ [CRON] Government signals aggregation failed:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

/**
 * POST /api/cron/government-signals
 * Manual trigger for testing
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🧪 Manual Government Signals processing triggered')
    
    const aggregator = getSignalsAggregator()
    const result = await aggregator.processAllFeeds()
    
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      message: `Manually processed ${result.processed} RSS items into ${result.grouped} signals`,
      result
    })
    
  } catch (error) {
    console.error('💥 Manual government signals processing failed:', error)
    
    return NextResponse.json({
      success: false,
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Manual processing failed'
    }, { status: 500 })
  }
}