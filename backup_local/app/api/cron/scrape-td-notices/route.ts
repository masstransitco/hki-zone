import { NextRequest, NextResponse } from 'next/server'
import { tdNoticesScraper } from '@/lib/td-notices-scraper'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  console.log('[CRON] TD notices scraper endpoint called')
  
  try {
    // Check for cron secret to prevent unauthorized access
    const authHeader = request.headers.get('authorization')
    const expectedAuth = `Bearer ${process.env.CRON_SECRET || 'test-secret'}`
    
    console.log('[CRON] Auth check:', { 
      received: authHeader?.substring(0, 20) + '...', 
      expected: expectedAuth.substring(0, 20) + '...' 
    })
    
    if (authHeader !== expectedAuth) {
      console.log('[CRON] Unauthorized request')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    console.log('[CRON] Starting TD notices content scraping...')
    
    // Run the scraper
    const result = await tdNoticesScraper.processEmptyNotices()
    
    if (result.success) {
      console.log(`[CRON] TD notices scraping completed: ${result.updated} notices updated`)
      return NextResponse.json({
        success: true,
        message: `Processed ${result.processed} notices, updated ${result.updated} with content`,
        timestamp: new Date().toISOString(),
        details: result
      })
    } else {
      console.error('[CRON] TD notices scraping failed:', result.error)
      return NextResponse.json({
        success: false,
        error: result.error,
        timestamp: new Date().toISOString()
      }, { status: 500 })
    }
    
  } catch (error) {
    console.error('[CRON] Unexpected error in TD notices scraper:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

// POST endpoint for testing specific notices
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const body = await request.json()
    const { noticeId } = body
    
    if (!noticeId) {
      return NextResponse.json({ error: 'noticeId required' }, { status: 400 })
    }
    
    const result = await tdNoticesScraper.processSingleNotice(noticeId)
    
    return NextResponse.json(result, { status: result.success ? 200 : 400 })
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}