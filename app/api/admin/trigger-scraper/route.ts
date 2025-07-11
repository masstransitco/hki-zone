import { NextRequest, NextResponse } from 'next/server'

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
    
    // Trigger the car scraper by calling the existing cron endpoint
    const scraperResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/cron/scrape-cars`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.CRON_SECRET || 'dev-secret'}`
      }
    })
    
    if (!scraperResponse.ok) {
      const errorText = await scraperResponse.text()
      console.error('Scraper trigger failed:', errorText)
      return NextResponse.json(
        { error: 'Failed to trigger scraper', details: errorText },
        { status: 500 }
      )
    }
    
    const result = await scraperResponse.json()
    
    return NextResponse.json({
      success: true,
      message: 'Car scraper triggered successfully',
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