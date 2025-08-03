import { NextRequest, NextResponse } from 'next/server'
import { getSignalsScraper } from '@/lib/government-signals-scraper'

export const dynamic = 'force-dynamic'

/**
 * GET /api/cron/government-signals-scraper
 * Cron job to scrape missing content for government signals
 * Runs every 10 minutes to fill in body content from RSS feeds
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
      console.log('❌ Unauthorized scraper request:', { userAgent, hasAuth: !!authHeader })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const startTime = Date.now()
    console.log('🔍 Government Signals Scraper cron started:', new Date().toISOString())
    console.log(`🔐 Authentication: ${isVercelCron ? 'Vercel Cron' : 'Secret Auth'}`)
    
    // Process incomplete signals using the new scraper
    const scraper = getSignalsScraper()
    const result = await scraper.processIncompleteSignals(15) // Process up to 15 signals per run
    
    const processingTime = Date.now() - startTime
    
    console.log('✅ Government Signals Scraper completed:', {
      processed: result.processed,
      updated: result.updated,
      failed: result.failed,
      duration: `${processingTime}ms`
    })
    
    // Log details about what was processed
    if (result.results.length > 0) {
      const successful = result.results.filter(r => r.success)
      const failed = result.results.filter(r => !r.success)
      
      if (successful.length > 0) {
        console.log('📄 Successfully scraped content for:', 
          successful.map(r => `${r.source_identifier} (${r.languages_processed.join(', ')})`).join(', '))
      }
      
      if (failed.length > 0) {
        console.warn('⚠️ Failed to scrape content for:', 
          failed.map(r => `${r.source_identifier}: ${r.error}`).join('; '))
      }
    }
    
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      message: `Processed ${result.processed} signals, updated ${result.updated}, failed ${result.failed}`,
      processing_time_ms: processingTime,
      result: {
        signals_processed: result.processed,
        content_updated: result.updated,
        processing_failed: result.failed,
        details: result.results.map(r => ({
          source_identifier: r.source_identifier,
          languages_processed: r.languages_processed,
          success: r.success,
          error: r.error
        })),
        performance: {
          duration_ms: processingTime,
          signals_per_second: result.processed > 0 ? Math.round((result.processed / processingTime) * 1000) : 0
        }
      }
    })

  } catch (error) {
    console.error('💥 Government Signals Scraper cron failed:', error)
    
    return NextResponse.json({
      success: false,
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      message: 'Failed to scrape government signals content'
    }, { status: 500 })
  }
}

/**
 * POST /api/cron/government-signals-scraper
 * Manual trigger for testing, with optional specific signal targeting
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🧪 Manual Government Signals Scraper triggered')
    
    const body = await request.json().catch(() => ({}))
    const { source_identifier, max_signals = 10 } = body
    
    const scraper = getSignalsScraper()
    
    let result
    if (source_identifier) {
      // Process specific signal
      console.log(`🎯 Targeting specific signal: ${source_identifier}`)
      result = await scraper.processSingleSignalById(source_identifier)
      
      return NextResponse.json({
        success: true,
        timestamp: new Date().toISOString(),
        message: `Processed signal: ${source_identifier}`,
        result: {
          target: source_identifier,
          success: result.success,
          details: result.details,
          error: result.error
        }
      })
    } else {
      // Process multiple signals
      result = await scraper.processIncompleteSignals(max_signals)
      
      return NextResponse.json({
        success: true,
        timestamp: new Date().toISOString(),
        message: `Manually processed ${result.processed} signals`,
        result
      })
    }
    
  } catch (error) {
    console.error('💥 Manual scraper failed:', error)
    
    return NextResponse.json({
      success: false,
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Manual scraping failed'
    }, { status: 500 })
  }
}