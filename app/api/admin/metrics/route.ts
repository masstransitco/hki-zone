import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-server"

export const dynamic = 'force-dynamic'

// Cache metrics for 5 minutes to improve performance
let metricsCache: any = null
let cacheTimestamp: number = 0
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

interface MetricsQuery {
  timeframe?: string // '2h', '6h', '24h', '7d', '30d', '60d', '90d', 'all'
  sources?: string[]
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const timeframe = searchParams.get('timeframe') || '24h'
    const sources = searchParams.get('sources')?.split(',').filter(s => s.length > 0) || []
    
    const cacheKey = `${timeframe}-${sources.join(',')}`
    const nowTimestamp = Date.now()
    
    // Check cache (only for default 24h view without source filters) 
    if (timeframe === '24h' && sources.length === 0 && metricsCache && (nowTimestamp - cacheTimestamp) < CACHE_DURATION) {
      console.log('Returning cached metrics data')
      return NextResponse.json(metricsCache)
    }

    console.log(`Fetching optimized metrics for timeframe: ${timeframe}, sources: ${sources.length}`)

    // Calculate date threshold
    let dateFilter = ''
    const nowDate = new Date()
    switch (timeframe) {
      case '2h':
        const twoHoursAgo = new Date(nowDate.getTime() - 2 * 60 * 60 * 1000).toISOString()
        dateFilter = `AND created_at >= '${twoHoursAgo}'`
        break
      case '6h':
        const sixHoursAgo = new Date(nowDate.getTime() - 6 * 60 * 60 * 1000).toISOString()
        dateFilter = `AND created_at >= '${sixHoursAgo}'`
        break
      case '24h':
        const twentyFourHoursAgo = new Date(nowDate.getTime() - 24 * 60 * 60 * 1000).toISOString()
        dateFilter = `AND created_at >= '${twentyFourHoursAgo}'`
        break
      case '7d':
        const sevenDaysAgo = new Date(nowDate.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
        dateFilter = `AND created_at >= '${sevenDaysAgo}'`
        break
      case '30d':
        const thirtyDaysAgo = new Date(nowDate.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
        dateFilter = `AND created_at >= '${thirtyDaysAgo}'`
        break
      case '60d':
        const sixtyDaysAgo = new Date(nowDate.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString()
        dateFilter = `AND created_at >= '${sixtyDaysAgo}'`
        break
      case '90d':
        const ninetyDaysAgo = new Date(nowDate.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString()
        dateFilter = `AND created_at >= '${ninetyDaysAgo}'`
        break
      case 'all':
      default:
        dateFilter = ''
    }

    // Build source filter
    const sourceFilter = sources.length > 0 ? `AND source IN (${sources.map(s => `'${s}'`).join(',')})` : ''

    // First, get total counts using COUNT queries (much faster than fetching data)
    let countQuery = supabaseAdmin
      .from('articles')
      .select('*', { count: 'exact', head: true })
      .is('deleted_at', null)
    
    if (timeframe !== 'all') {
      const threshold = new Date()
      switch (timeframe) {
        case '2h':
          threshold.setTime(threshold.getTime() - 2 * 60 * 60 * 1000)
          break
        case '6h':
          threshold.setTime(threshold.getTime() - 6 * 60 * 60 * 1000)
          break
        case '24h':
          threshold.setTime(threshold.getTime() - 24 * 60 * 60 * 1000)
          break
        case '7d':
          threshold.setDate(threshold.getDate() - 7)
          break
        case '30d':
          threshold.setDate(threshold.getDate() - 30)
          break
        case '60d':
          threshold.setDate(threshold.getDate() - 60)
          break
        case '90d':
          threshold.setDate(threshold.getDate() - 90)
          break
      }
      countQuery = countQuery.gte('created_at', threshold.toISOString())
    }

    if (sources.length > 0) {
      countQuery = countQuery.in('source', sources)
    }

    // Get total count
    const { count: totalCount, error: countError } = await countQuery
    
    if (countError) {
      console.error('Error fetching total count:', countError)
      throw countError
    }

    // Get AI enhanced count
    let enhancedCountQuery = supabaseAdmin
      .from('articles')
      .select('*', { count: 'exact', head: true })
      .is('deleted_at', null)
      .eq('is_ai_enhanced', true)
    
    if (timeframe !== 'all') {
      const threshold = new Date()
      switch (timeframe) {
        case '2h':
          threshold.setTime(threshold.getTime() - 2 * 60 * 60 * 1000)
          break
        case '6h':
          threshold.setTime(threshold.getTime() - 6 * 60 * 60 * 1000)
          break
        case '24h':
          threshold.setTime(threshold.getTime() - 24 * 60 * 60 * 1000)
          break
        case '7d':
          threshold.setDate(threshold.getDate() - 7)
          break
        case '30d':
          threshold.setDate(threshold.getDate() - 30)
          break
        case '60d':
          threshold.setDate(threshold.getDate() - 60)
          break
        case '90d':
          threshold.setDate(threshold.getDate() - 90)
          break
      }
      enhancedCountQuery = enhancedCountQuery.gte('created_at', threshold.toISOString())
    }

    if (sources.length > 0) {
      enhancedCountQuery = enhancedCountQuery.in('source', sources)
    }

    const { count: enhancedCount, error: enhancedError } = await enhancedCountQuery
    
    if (enhancedError) {
      console.error('Error fetching enhanced count:', enhancedError)
      throw enhancedError
    }

    // Get selected count
    let selectedCountQuery = supabaseAdmin
      .from('articles')
      .select('*', { count: 'exact', head: true })
      .is('deleted_at', null)
      .eq('selected_for_enhancement', true)
    
    if (timeframe !== 'all') {
      const threshold = new Date()
      switch (timeframe) {
        case '2h':
          threshold.setTime(threshold.getTime() - 2 * 60 * 60 * 1000)
          break
        case '6h':
          threshold.setTime(threshold.getTime() - 6 * 60 * 60 * 1000)
          break
        case '24h':
          threshold.setTime(threshold.getTime() - 24 * 60 * 60 * 1000)
          break
        case '7d':
          threshold.setDate(threshold.getDate() - 7)
          break
        case '30d':
          threshold.setDate(threshold.getDate() - 30)
          break
        case '60d':
          threshold.setDate(threshold.getDate() - 60)
          break
        case '90d':
          threshold.setDate(threshold.getDate() - 90)
          break
      }
      selectedCountQuery = selectedCountQuery.gte('created_at', threshold.toISOString())
    }

    if (sources.length > 0) {
      selectedCountQuery = selectedCountQuery.in('source', sources)
    }

    const { count: selectedCount, error: selectedError } = await selectedCountQuery
    
    if (selectedError) {
      console.error('Error fetching selected count:', selectedError)
      throw selectedError
    }

    // Get accurate counts for 24h pipeline metrics
    const twentyFourHoursAgo = new Date()
    twentyFourHoursAgo.setTime(twentyFourHoursAgo.getTime() - 24 * 60 * 60 * 1000)

    const oneHourAgo = new Date()
    oneHourAgo.setTime(oneHourAgo.getTime() - 60 * 60 * 1000)

    // Articles in last 24h count
    let articles24hQuery = supabaseAdmin
      .from('articles')
      .select('*', { count: 'exact', head: true })
      .is('deleted_at', null)
      .gte('created_at', twentyFourHoursAgo.toISOString())

    if (sources.length > 0) {
      articles24hQuery = articles24hQuery.in('source', sources)
    }

    const { count: articles24hCount, error: articles24hError } = await articles24hQuery

    // Articles in last hour count
    let articles1hQuery = supabaseAdmin
      .from('articles')
      .select('*', { count: 'exact', head: true })
      .is('deleted_at', null)
      .gte('created_at', oneHourAgo.toISOString())

    if (sources.length > 0) {
      articles1hQuery = articles1hQuery.in('source', sources)
    }

    const { count: articles1hCount, error: articles1hError } = await articles1hQuery

    // Enhanced articles in last 24h count
    let enhanced24hQuery = supabaseAdmin
      .from('articles')
      .select('*', { count: 'exact', head: true })
      .is('deleted_at', null)
      .eq('is_ai_enhanced', true)
      .gte('created_at', twentyFourHoursAgo.toISOString())

    if (sources.length > 0) {
      enhanced24hQuery = enhanced24hQuery.in('source', sources)
    }

    const { count: enhanced24hCount, error: enhanced24hError } = await enhanced24hQuery

    // Selected articles in last 24h count
    let selected24hQuery = supabaseAdmin
      .from('articles')
      .select('*', { count: 'exact', head: true })
      .is('deleted_at', null)
      .eq('selected_for_enhancement', true)
      .gte('created_at', twentyFourHoursAgo.toISOString())

    if (sources.length > 0) {
      selected24hQuery = selected24hQuery.in('source', sources)
    }

    const { count: selected24hCount, error: selected24hError } = await selected24hQuery

    // Now fetch a sample of articles for more complex calculations
    let baseQuery = supabaseAdmin
      .from('articles')
      .select('source, created_at, is_ai_enhanced, selected_for_enhancement, category, content')
      .is('deleted_at', null)
    
    if (timeframe !== 'all') {
      const threshold = new Date()
      switch (timeframe) {
        case '2h':
          threshold.setTime(threshold.getTime() - 2 * 60 * 60 * 1000)
          break
        case '6h':
          threshold.setTime(threshold.getTime() - 6 * 60 * 60 * 1000)
          break
        case '24h':
          threshold.setTime(threshold.getTime() - 24 * 60 * 60 * 1000)
          break
        case '7d':
          threshold.setDate(threshold.getDate() - 7)
          break
        case '30d':
          threshold.setDate(threshold.getDate() - 30)
          break
        case '60d':
          threshold.setDate(threshold.getDate() - 60)
          break
        case '90d':
          threshold.setDate(threshold.getDate() - 90)
          break
      }
      baseQuery = baseQuery.gte('created_at', threshold.toISOString())
    }

    if (sources.length > 0) {
      baseQuery = baseQuery.in('source', sources)
    }

    // Fetch a reasonable sample for complex calculations (10k should be enough for trends/breakdowns)
    const { data: articles, error: articlesError } = await baseQuery
      .order('created_at', { ascending: false })
      .limit(10000)

    if (articlesError) {
      console.error('Error fetching articles:', articlesError)
      throw articlesError
    }

    if (!articles || articles.length === 0) {
      // Return empty metrics structure with accurate counts
      return NextResponse.json({
        overall: {
          total_articles: totalCount || 0,
          active_articles: totalCount || 0,
          selected_for_enhancement: selectedCount || 0,
          ai_enhanced_articles: enhancedCount || 0,
          unique_sources: 0,
          enhancement_rate: totalCount && enhancedCount ? Math.round((enhancedCount / totalCount) * 100 * 100) / 100 : 0,
          earliest_article: null,
          latest_article: null
        },
        pipeline: {
          articles_last_24h: articles24hCount || 0,
          articles_last_hour: articles1hCount || 0,
          enhanced_last_24h: enhanced24hCount || 0,
          selected_last_24h: selected24hCount || 0,
          low_quality_articles: 0,
          avg_content_length: 0
        },
        sourceBreakdown: [],
        dailyTrends: [],
        categoryDistribution: [],
        availableSources: [],
        availableCategories: [],
        timeframe,
        recordsAnalyzed: totalCount || 0,
        generatedAt: new Date().toISOString(),
        cached: false
      })
    }

    // Process data efficiently using sample + accurate counts
    
    // Calculate sample-based metrics for trends and breakdowns
    const uniqueSources = new Set(articles.map(a => a.source)).size
    const availableSourcesList = Array.from(new Set(articles.map(a => a.source.replace(' (AI Enhanced)', ''))))
    const availableCategoriesList = Array.from(new Set(articles.filter(a => a.is_ai_enhanced).map(a => a.category || 'Uncategorized')))
    
    // Use accurate counts for the main metrics
    const processedOverall = {
      total_articles: totalCount || 0,
      active_articles: totalCount || 0,
      selected_for_enhancement: selectedCount || 0,
      ai_enhanced_articles: enhancedCount || 0,
      unique_sources: uniqueSources,
      enhancement_rate: totalCount && enhancedCount ? Math.round((enhancedCount / totalCount) * 100 * 100) / 100 : 0,
      earliest_article: articles.length > 0 ? articles[articles.length - 1]?.created_at : null,
      latest_article: articles.length > 0 ? articles[0]?.created_at : null
    }

    // Calculate pipeline health metrics (use accurate counts for time-based metrics, sample for quality metrics)
    const lowQualityArticles = articles.filter(a => (a.content?.length || 0) < 100).length
    const avgContentLength = articles.reduce((sum, a) => sum + (a.content?.length || 0), 0) / articles.length
    
    const processedPipeline = {
      articles_last_24h: articles24hCount || 0,
      articles_last_hour: articles1hCount || 0,
      enhanced_last_24h: enhanced24hCount || 0,
      selected_last_24h: selected24hCount || 0,
      low_quality_articles: lowQualityArticles,
      avg_content_length: Math.round(avgContentLength || 0)
    }

    // Calculate source breakdown
    const sourceBreakdown: { [key: string]: any } = {}
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
    Object.values(sourceBreakdown).forEach((s: any) => {
      s.enhancement_rate = s.total_count > 0 ? Math.round((s.enhanced_count / s.total_count) * 100 * 100) / 100 : 0
    })

    // Calculate time-appropriate trends based on selected timeframe
    const getTimeKey = (dateString: string, timeframe: string): string => {
      const date = new Date(dateString)
      
      switch (timeframe) {
        case '2h':
        case '6h':
          // Show 15-minute intervals
          const minutes = date.getMinutes()
          const roundedMinutes = Math.floor(minutes / 15) * 15
          date.setMinutes(roundedMinutes, 0, 0)
          return date.toISOString()
        case '24h':
          // Show hourly intervals  
          date.setMinutes(0, 0, 0)
          return date.toISOString()
        case '7d':
        case '30d':
        case '60d':
        case '90d':
        default:
          // Show daily intervals
          return dateString.split('T')[0]
      }
    }
    
    const getTimeLabel = (timeKey: string, timeframe: string): string => {
      const date = new Date(timeKey)
      
      switch (timeframe) {
        case '2h':
        case '6h':
          return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        case '24h':
          return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        default:
          return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
      }
    }

    const timeTrends: { [key: string]: any } = {}
    articles.forEach(article => {
      const timeKey = getTimeKey(article.created_at, timeframe)
      if (!timeTrends[timeKey]) {
        timeTrends[timeKey] = {
          time: timeKey,
          label: getTimeLabel(timeKey, timeframe),
          articles_scraped: 0,
          selected_for_enhancement: 0,
          ai_enhanced: 0,
          unique_sources: new Set(),
          sources: {}, // Track articles by source
          enhancedCategories: {} // Track AI enhanced articles by category
        }
      }
      const t = timeTrends[timeKey]
      t.articles_scraped++
      if (article.selected_for_enhancement) t.selected_for_enhancement++
      if (article.is_ai_enhanced) t.ai_enhanced++
      t.unique_sources.add(article.source)
      
      // Track source breakdown
      const sourceKey = article.source.replace(' (AI Enhanced)', '') // Normalize source name
      if (!t.sources[sourceKey]) {
        t.sources[sourceKey] = 0
      }
      t.sources[sourceKey]++
      
      // Track AI enhanced articles by category
      if (article.is_ai_enhanced) {
        const category = article.category || 'Uncategorized'
        if (!t.enhancedCategories[category]) {
          t.enhancedCategories[category] = 0
        }
        t.enhancedCategories[category]++
      }
    })

    // Convert trends to array and process unique sources + flatten source & category data
    const timeTrendsArray = Object.values(timeTrends).map((t: any) => {
      const flattenedEntry = {
        ...t,
        unique_sources_count: t.unique_sources.size,
        date: t.time, // Keep 'date' for compatibility
        unique_sources_per_day: t.unique_sources.size, // Keep for compatibility
        ...t.sources, // Flatten source counts into main object
        // Flatten enhanced category counts with prefix to avoid naming conflicts
        ...Object.keys(t.enhancedCategories).reduce((acc, category) => {
          acc[`enhanced_${category}`] = t.enhancedCategories[category]
          return acc
        }, {} as Record<string, number>)
      }
      delete flattenedEntry.sources // Remove nested sources object
      delete flattenedEntry.enhancedCategories // Remove nested categories object
      delete flattenedEntry.unique_sources // Remove Set object
      return flattenedEntry
    }).sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())

    // Calculate category distribution
    const categoryDistribution: { [key: string]: any } = {}
    articles.forEach(article => {
      const category = article.category || 'Uncategorized'
      if (!categoryDistribution[category]) {
        categoryDistribution[category] = {
          category,
          count: 0,
          enhanced_count: 0,
          enhancement_rate: 0
        }
      }
      const c = categoryDistribution[category]
      c.count++
      if (article.is_ai_enhanced) c.enhanced_count++
    })

    // Calculate enhancement rates for categories
    Object.values(categoryDistribution).forEach((c: any) => {
      c.enhancement_rate = c.count > 0 ? Math.round((c.enhanced_count / c.count) * 100 * 100) / 100 : 0
    })

    const categoryDistributionArray = Object.values(categoryDistribution).sort((a: any, b: any) => b.count - a.count).slice(0, 15)

    // Format response data
    const response = {
      overall: processedOverall,
      pipeline: processedPipeline,
      sourceBreakdown: Object.values(sourceBreakdown).sort((a: any, b: any) => b.total_count - a.total_count),
      dailyTrends: timeTrendsArray,
      categoryDistribution: categoryDistributionArray,
      availableSources: availableSourcesList,
      availableCategories: availableCategoriesList,
      timeframe,
      recordsAnalyzed: totalCount || 0,
      generatedAt: new Date().toISOString(),
      cached: false
    }

    // Cache the result (only for default 24h view)
    if (timeframe === '24h' && sources.length === 0) {
      metricsCache = { ...response, cached: true }
      cacheTimestamp = nowTimestamp
    }

    console.log(`Metrics computed successfully: ${processedOverall.total_articles} articles analyzed`)

    return NextResponse.json(response)

  } catch (error) {
    console.error('Metrics API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch metrics', details: error.message },
      { status: 500 }
    )
  }
}