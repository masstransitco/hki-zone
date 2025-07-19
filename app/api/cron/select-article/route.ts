import { NextRequest, NextResponse } from 'next/server'
import { selectArticlesWithPerplexity } from '@/lib/perplexity-article-selector'

export async function POST(request: NextRequest) {
  try {
    // Verify this is a legitimate cron request
    const authHeader = request.headers.get('authorization')
    const userAgent = request.headers.get('user-agent')
    
    if (userAgent !== 'vercel-cron/1.0' && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('🔍 Starting article selection process...')

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
    console.error('❌ Error in article selection:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        selectedCount: 0
      }, 
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    // Get statistics about available articles for selection
    const { getSelectionStatistics } = await import('@/lib/perplexity-article-selector')
    const stats = await getSelectionStatistics()
    
    return NextResponse.json({
      configured: true,
      message: 'Article selection endpoint is ready',
      candidateStats: stats
    })
  } catch (error) {
    console.error('Error getting selection statistics:', error)
    return NextResponse.json(
      { 
        configured: false, 
        error: 'Failed to get statistics' 
      }, 
      { status: 500 }
    )
  }
}