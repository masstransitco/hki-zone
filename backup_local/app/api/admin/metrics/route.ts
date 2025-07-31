import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-server"

export const dynamic = 'force-dynamic'

interface MetricsQuery {
  timeframe?: string // '7d', '30d', '90d', 'all'
  sources?: string[]
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const timeframe = searchParams.get('timeframe') || '30d'
    const sources = searchParams.get('sources')?.split(',').filter(s => s.length > 0) || []

    // Calculate date threshold
    let dateThreshold = '1900-01-01'
    const now = new Date()
    switch (timeframe) {
      case '7d':
        dateThreshold = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
        break
      case '30d':
        dateThreshold = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
        break
      case '90d':
        dateThreshold = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString()
        break
    }

    // Build query with filters
    let query = supabaseAdmin
      .from('articles')
      .select('source, created_at, is_ai_enhanced, selected_for_enhancement')
      .is('deleted_at', null)

    if (timeframe !== 'all') {
      query = query.gte('created_at', dateThreshold)
    }

    if (sources.length > 0) {
      query = query.in('source', sources)
    }

    // PostgREST limits responses to 1000 records by default
    // We need to paginate through all records for accurate metrics
    let allArticles = []
    let page = 0
    const pageSize = 1000
    let hasMore = true

    console.log('Starting pagination to get all articles for metrics...')

    while (hasMore) {
      const { data: pageArticles, error: pageError } = await query
        .range(page * pageSize, (page + 1) * pageSize - 1)
      
      if (pageError) {
        console.error(`Error fetching page ${page}:`, pageError)
        throw pageError
      }

      if (!pageArticles || pageArticles.length === 0) {
        hasMore = false
      } else {
        allArticles.push(...pageArticles)
        hasMore = pageArticles.length === pageSize
        page++
        
        console.log(`Fetched page ${page}, got ${pageArticles.length} articles, total: ${allArticles.length}`)
      }

      // Safety limit to prevent infinite loops (50k records max)
      if (page > 50) {
        console.warn('Reached pagination safety limit of 50 pages (50k records)')
        break
      }
    }

    console.log(`Pagination complete. Total articles fetched: ${allArticles.length}`)

    if (allArticles.length === 0) {
      throw new Error('No data returned from query')
    }

    const articles = allArticles

    if (!articles) {
      throw new Error('No data returned from query')
    }

    // Process the data
    const totalArticles = articles.length
    const aiEnhanced = articles.filter(a => a.is_ai_enhanced).length
    const selectedForEnhancement = articles.filter(a => a.selected_for_enhancement).length
    const uniqueSources = new Set(articles.map(a => a.source)).size

    const processedOverall = {
      total_articles: totalArticles,
      active_articles: totalArticles,
      selected_for_enhancement: selectedForEnhancement,
      ai_enhanced_articles: aiEnhanced,
      unique_sources: uniqueSources,
      enhancement_rate: totalArticles > 0 ? Math.round((aiEnhanced / totalArticles) * 100 * 100) / 100 : 0,
      earliest_article: articles.length > 0 ? articles[articles.length - 1]?.created_at : null,
      latest_article: articles.length > 0 ? articles[0]?.created_at : null
    }

    // Source breakdown
    const sourceBreakdown = {}
    articles.forEach(article => {
      if (!sourceBreakdown[article.source]) {
        sourceBreakdown[article.source] = {
          source: article.source,
          total_count: 0,
          active_count: 0,
          selected_count: 0,
          enhanced_count: 0,
          enhancement_rate: 0
        }
      }
      const s = sourceBreakdown[article.source]
      s.total_count++
      s.active_count++
      if (article.selected_for_enhancement) s.selected_count++
      if (article.is_ai_enhanced) s.enhanced_count++
    })

    // Calculate enhancement rates for sources
    Object.values(sourceBreakdown).forEach(s => {
      s.enhancement_rate = s.total_count > 0 ? Math.round((s.enhanced_count / s.total_count) * 100 * 100) / 100 : 0
    })

    // Daily trends
    const dailyTrends = {}
    articles.forEach(article => {
      const date = article.created_at.split('T')[0]
      if (!dailyTrends[date]) {
        dailyTrends[date] = {
          date,
          articles_scraped: 0,
          selected_for_enhancement: 0,
          ai_enhanced: 0,
          unique_sources_per_day: new Set()
        }
      }
      const d = dailyTrends[date]
      d.articles_scraped++
      if (article.selected_for_enhancement) d.selected_for_enhancement++
      if (article.is_ai_enhanced) d.ai_enhanced++
      d.unique_sources_per_day.add(article.source)
    })

    // Convert daily trends to array and process unique sources
    const dailyTrendsArray = Object.values(dailyTrends).map(d => ({
      ...d,
      unique_sources_per_day: d.unique_sources_per_day.size
    })).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    return NextResponse.json({
      overall: processedOverall,
      sourceBreakdown: Object.values(sourceBreakdown).sort((a, b) => b.total_count - a.total_count),
      dailyTrends: dailyTrendsArray,
      timeframe,
      recordsAnalyzed: articles.length
    })

  } catch (error) {
    console.error('Metrics API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch metrics', details: error.message },
      { status: 500 }
    )
  }
}