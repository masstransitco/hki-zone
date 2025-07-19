import { NextRequest, NextResponse } from 'next/server'
import { selectArticlesWithPerplexity } from '@/lib/perplexity-article-selector'

export async function POST(request: NextRequest) {
  try {
    console.log('🔍 Admin triggered article selection process...')

    // Check if Perplexity API is configured
    if (!process.env.PERPLEXITY_API_KEY) {
      console.error('Perplexity API key not configured')
      return NextResponse.json({
        success: false,
        error: 'Perplexity API key not configured'
      }, { status: 503 })
    }

    // Select 1 best article from scraped sources for enhancement
    const selectedArticles = await selectArticlesWithPerplexity(1)

    if (selectedArticles.length === 0) {
      console.log('⏭️ No articles available for selection')
      return NextResponse.json({ 
        success: true, 
        message: 'No articles available for selection - all recent articles may have already been enhanced',
        selectedCount: 0,
        details: 'This usually means all candidate articles from the last 7 days have already been processed or are similar to recently enhanced topics'
      })
    }

    const selectedArticle = selectedArticles[0]
    
    console.log(`✅ Admin selected article for enhancement:`)
    console.log(`   Title: ${selectedArticle.title}`)
    console.log(`   Source: ${selectedArticle.source}`)
    console.log(`   Reason: ${selectedArticle.selection_reason}`)
    console.log(`   Score: ${selectedArticle.priority_score}`)

    return NextResponse.json({
      success: true,
      message: 'Article selected for enhancement by admin request',
      selectedCount: 1,
      method: 'admin_ai_selection',
      article: {
        id: selectedArticle.id,
        title: selectedArticle.title,
        source: selectedArticle.source,
        category: selectedArticle.category,
        selection_reason: selectedArticle.selection_reason,
        priority_score: selectedArticle.priority_score,
        published_at: selectedArticle.published_at,
        url: selectedArticle.url
      }
    })

  } catch (error) {
    console.error('❌ Error in admin article selection:', error)
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'No stack trace'
    })
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        selectedCount: 0,
        details: 'Failed to select article using Perplexity AI. This could be due to API limits, no available articles, or similarity detection issues.'
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
      message: 'Admin article selection endpoint is ready',
      candidateStats: stats,
      endpoint: 'admin_select_article'
    })
  } catch (error) {
    console.error('Error getting admin selection statistics:', error)
    return NextResponse.json(
      { 
        configured: false, 
        error: 'Failed to get statistics',
        endpoint: 'admin_select_article'
      }, 
      { status: 500 }
    )
  }
}