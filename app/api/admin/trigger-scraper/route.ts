import { NextRequest, NextResponse } from 'next/server'
import { runSingleScraper } from '@/lib/scraper-orchestrator'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const { type } = await request.json()
    
    if (type !== 'cars') {
      return NextResponse.json(
        { error: 'Invalid scraper type' },
        { status: 400 }
      )
    }
    
    console.log('🚗 Starting manual 28car scraping from admin trigger...')
    
    // Directly call the scraper function instead of making HTTP request
    const result = await runSingleScraper('28car', true) // with progress tracking
    
    console.log('🚗 Manual 28car scraping completed:', result)
    
    return NextResponse.json({
      success: true,
      message: `28car scraping completed: ${result.articlesSaved}/${result.articlesFound} cars saved`,
      result: result
    })
    
  } catch (error) {
    console.error('Error triggering scraper:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}