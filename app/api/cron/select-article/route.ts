import { NextRequest, NextResponse } from 'next/server'
import { selectArticlesWithPerplexity } from '@/lib/perplexity-article-selector'

export async function POST(request: NextRequest) {
  try {
    // Enhanced logging for production debugging
    const now = new Date()
    const utcTime = now.toISOString()
    const hkTime = new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString().replace('Z', ' HKT')
    
    console.log('🔍 ARTICLE SELECTION CRON JOB STARTED')
    console.log(`⏰ Execution time: ${utcTime} (UTC) / ${hkTime}`)
    console.log(`🌐 Environment: ${process.env.NODE_ENV || 'unknown'}`)
    console.log(`📍 Vercel Region: ${process.env.VERCEL_REGION || 'unknown'}`)
    
    // Enhanced authentication for cron jobs
    const authHeader = request.headers.get('authorization')
    const userAgent = request.headers.get('user-agent')
    
    // Allow Vercel cron requests (primary method)
    const isVercelCron = userAgent === 'vercel-cron/1.0'
    
    // Allow manual requests with valid secret (backup method)
    const isValidSecret = process.env.CRON_SECRET && 
                          authHeader === `Bearer ${process.env.CRON_SECRET}`
    
    console.log(`🔐 Request verification:`)
    console.log(`   User-Agent: ${userAgent || 'none'}`)
    console.log(`   Auth Header: ${authHeader ? 'Bearer [REDACTED]' : 'none'}`)
    console.log(`   CRON_SECRET configured: ${process.env.CRON_SECRET ? 'Yes' : 'No'}`)
    console.log(`   Is Vercel Cron: ${isVercelCron}`)
    console.log(`   Is Valid Secret: ${isValidSecret}`)
    
    // Allow either method
    if (!isVercelCron && !isValidSecret) {
      console.log(`❌ UNAUTHORIZED: userAgent=${userAgent}, hasSecret=${!!process.env.CRON_SECRET}`)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log(`✅ Authentication: ${isVercelCron ? 'Vercel Cron' : 'Secret Auth'}`)
    console.log('🎯 Starting article selection with Perplexity...')

    // Select 1 best article from scraped sources for enhancement
    const selectedArticles = await selectArticlesWithPerplexity(1)

    if (selectedArticles.length === 0) {
      console.log('⏭️ No articles available for selection')
      return NextResponse.json({ 
        success: true, 
        message: 'No articles available for selection',
        selectedCount: 0
      })
    }

    const selectedArticle = selectedArticles[0]
    
    console.log(`✅ Selected article for enhancement:`)
    console.log(`   Title: ${selectedArticle.title}`)
    console.log(`   Source: ${selectedArticle.source}`)
    console.log(`   Reason: ${selectedArticle.selection_reason}`)
    console.log(`   Score: ${selectedArticle.priority_score}`)

    return NextResponse.json({
      success: true,
      message: 'Article selected for enhancement',
      selectedCount: 1,
      article: {
        id: selectedArticle.id,
        title: selectedArticle.title,
        source: selectedArticle.source,
        category: selectedArticle.category,
        selection_reason: selectedArticle.selection_reason,
        priority_score: selectedArticle.priority_score,
        published_at: selectedArticle.published_at
      }
    })

  } catch (error) {
    console.error('❌ CRITICAL ERROR in article selection:', error)
    console.error('❌ Error type:', typeof error)
    console.error('❌ Error name:', error?.constructor?.name || 'unknown')
    console.error('❌ Error message:', error instanceof Error ? error.message : String(error))
    console.error('❌ Error stack:', error instanceof Error ? error.stack : 'no stack trace')
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        selectedCount: 0,
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'unknown'
      }, 
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  // Check if this is a cron request or status check
  const authHeader = request.headers.get('authorization')
  const userAgent = request.headers.get('user-agent')
  const isVercelCron = userAgent === 'vercel-cron/1.0'
  
  // If it's a Vercel cron request, run the selection logic
  if (isVercelCron) {
    console.log('🚀 GET request detected as Vercel cron - running selection logic')
    return POST(request)
  }
  
  // Otherwise, return statistics for monitoring
  try {
    console.log('📊 Getting selection statistics...')
    
    // Get statistics about available articles for selection
    const { getSelectionStatistics } = await import('@/lib/perplexity-article-selector')
    const stats = await getSelectionStatistics()
    
    console.log('✅ Selection statistics retrieved:', JSON.stringify(stats, null, 2))
    
    return NextResponse.json({
      configured: true,
      message: 'Article selection endpoint is ready',
      candidateStats: stats,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'unknown',
      cronSecret: process.env.CRON_SECRET ? 'configured' : 'missing',
      supabaseConfigured: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'yes' : 'no'
    })
  } catch (error) {
    console.error('❌ Error getting selection statistics:', error)
    console.error('❌ Error details:', error instanceof Error ? error.stack : error)
    
    return NextResponse.json(
      { 
        configured: false, 
        error: 'Failed to get statistics',
        errorMessage: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'unknown'
      }, 
      { status: 500 }
    )
  }
}