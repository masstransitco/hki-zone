import { NextRequest, NextResponse } from "next/server"
import { runSingleScraper } from "@/lib/scraper-orchestrator"

export async function GET(request: NextRequest) {
  // Verify this is a cron job request
  const userAgent = request.headers.get('user-agent')
  if (!userAgent || !userAgent.includes('vercel-cron')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  console.log('🚗 Starting scheduled 28car scraping...')
  
  try {
    const result = await runSingleScraper('28car', false)
    
    console.log('🚗 28car scraping completed:', result)
    
    return NextResponse.json({
      success: true,
      message: `28car scraping completed: ${result.articlesSaved}/${result.articlesFound} cars saved`,
      result: result,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('❌ 28car scraping failed:', error)
    
    return NextResponse.json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

// Also allow POST for manual triggering
export async function POST(request: NextRequest) {
  console.log('🚗 Starting manual 28car scraping...')
  
  try {
    const result = await runSingleScraper('28car', true) // with progress tracking
    
    console.log('🚗 Manual 28car scraping completed:', result)
    
    return NextResponse.json({
      success: true,
      message: `28car scraping completed: ${result.articlesSaved}/${result.articlesFound} cars saved`,
      result: result,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('❌ Manual 28car scraping failed:', error)
    
    return NextResponse.json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}