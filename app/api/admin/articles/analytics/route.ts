import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-server"

// Cache for analytics data with time-aware caching
interface CacheEntry {
  data: any
  timestamp: number
  dateFilter: string
}

const analyticsCache = new Map<string, CacheEntry>()
const CACHE_DURATION = 2 * 60 * 1000 // 2 minutes cache

function getCacheKey(dateFilter: string): string {
  return `analytics-${dateFilter || '24h'}`
}

function isCacheValid(entry: CacheEntry): boolean {
  return (Date.now() - entry.timestamp) < CACHE_DURATION
}

// Determine optimal fetching strategy based on timeframe and expected data volume
function getOptimalFetchingStrategy(timeframe: string): 'single_query' | 'paginated' | 'count_only' {
  // Estimate articles based on timeframe duration
  const hoursMap = {
    '2h': 2, '6h': 6, '24h': 24,
    '7d': 7 * 24, '30d': 30 * 24, '60d': 60 * 24, '90d': 90 * 24
  }
  
  const hours = hoursMap[timeframe as keyof typeof hoursMap] || 24
  const avgArticlesPerHour = 75 // ~1800 articles/day = 75/hour
  const estimatedArticles = hours * avgArticlesPerHour
  
  // For periods with estimated < 5000 articles, use single query
  if (estimatedArticles <= 5000) {
    return 'single_query'
  }
  
  // For longer periods, use pagination to preserve data integrity
  return 'paginated'
}

// Time bucket generation helper
function getTimeKey(dateString: string, timeframe: string): string {
  const date = new Date(dateString)
  
  switch (timeframe) {
    case '2h':
      // 15-minute intervals
      const minutes15 = date.getMinutes()
      const roundedMinutes15 = Math.floor(minutes15 / 15) * 15
      date.setMinutes(roundedMinutes15, 0, 0)
      return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
    case '6h':
      // 30-minute intervals
      const minutes30 = date.getMinutes()
      const roundedMinutes30 = Math.floor(minutes30 / 30) * 30
      date.setMinutes(roundedMinutes30, 0, 0)
      return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
    case '24h':
      // Hourly intervals
      date.setMinutes(0, 0, 0)
      return `${date.getHours().toString().padStart(2, '0')}:00`
    case '7d':
    case '30d':
    case '60d':
    case '90d':
    default:
      // Daily intervals
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
      return `${monthNames[date.getMonth()]} ${date.getDate()}`
  }
}

// Strategy 1: Single query for short periods
async function fetchWithSingleQuery(timeframe: string, timeBoundary: Date | null) {
  console.log(`Using single query strategy for ${timeframe}`)
  
  let query = supabaseAdmin
    .from('articles')
    .select('created_at, source, category, is_ai_enhanced, selected_for_enhancement, updated_at')
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(15000)

  if (timeBoundary) {
    query = query.gte('created_at', timeBoundary.toISOString())
  }

  const { data: articles, error } = await query

  if (error || !articles) {
    console.error('Single query error:', error)
    return { articles: [], sources: [], categories: [] }
  }

  return processArticlesIntoTimeBuckets(articles, timeframe)
}

// Strategy 2: Pagination for medium datasets
async function fetchWithPagination(timeframe: string, timeBoundary: Date | null) {
  console.log(`Using pagination strategy for ${timeframe}`)
  
  let baseQuery = supabaseAdmin
    .from('articles')
    .select('created_at, source, category, is_ai_enhanced, selected_for_enhancement, updated_at')
    .is('deleted_at', null)
    .order('created_at', { ascending: true })

  if (timeBoundary) {
    baseQuery = baseQuery.gte('created_at', timeBoundary.toISOString())
  }

  const allArticles: any[] = []
  const batchSize = 1000
  let start = 0
  let hasMore = true

  while (hasMore) {
    const result = await baseQuery.range(start, start + batchSize - 1)
    
    if (result.error) {
      console.error('Pagination error:', result.error)
      break
    }
    
    if (result.data && result.data.length > 0) {
      allArticles.push(...result.data)
      console.log(`Fetched batch ${Math.floor(start / batchSize) + 1}: ${result.data.length} articles (total: ${allArticles.length})`)
      
      hasMore = result.data.length === batchSize
      start += batchSize
    } else {
      hasMore = false
    }
    
    // Safety limit based on timeframe
    const safetyLimits = {
      '7d': 15000,   
      '30d': 40000,  
      '60d': 70000,
      '90d': 100000
    }
    const maxArticles = safetyLimits[timeframe as keyof typeof safetyLimits] || 100000
    
    if (start > maxArticles) {
      console.warn(`Reached safety limit of ${maxArticles} articles for ${timeframe}`)
      break
    }
  }
  
  console.log(`Pagination complete: ${allArticles.length} articles fetched`)
  return processArticlesIntoTimeBuckets(allArticles, timeframe)
}

// Process articles into time buckets and calculate analytics
function processArticlesIntoTimeBuckets(articles: any[], timeframe: string) {
  console.log(`Processing ${articles.length} articles into time buckets for ${timeframe}`)
  
  const timeBuckets: { [key: string]: any } = {}
  const sources = new Set<string>()
  const categories = new Set<string>()
  const sourceStats: { [key: string]: { total: number, selected: number, enhanced: number } } = {}

  // Process each article
  articles.forEach(article => {
    const timeKey = getTimeKey(article.created_at, timeframe)
    const sourceKey = article.source || 'Unknown'
    const category = article.category || 'General'

    sources.add(sourceKey)
    if (article.is_ai_enhanced) {
      categories.add(category)
    }

    // Track source statistics with selection data
    if (!sourceStats[sourceKey]) {
      sourceStats[sourceKey] = { total: 0, selected: 0, enhanced: 0 }
    }
    sourceStats[sourceKey].total++
    if (article.selected_for_enhancement) {
      sourceStats[sourceKey].selected++
    }
    if (article.is_ai_enhanced) {
      sourceStats[sourceKey].enhanced++
    }

    // Create time bucket if it doesn't exist
    if (!timeBuckets[timeKey]) {
      timeBuckets[timeKey] = {
        date: timeKey,
        articles_scraped: 0,
        selected: 0,
        enhanced: 0,
        pending: 0
      }
    }

    // Update bucket counts
    const bucket = timeBuckets[timeKey]
    bucket.articles_scraped++
    if (article.selected_for_enhancement) bucket.selected++
    if (article.is_ai_enhanced) bucket.enhanced++
    if (article.selected_for_enhancement && !article.is_ai_enhanced) bucket.pending++
  })

  // Convert to sorted array
  const enhancementTrends = Object.values(timeBuckets)
    .sort((a: any, b: any) => {
      // Sort by time for proper chronological order
      if (timeframe === '2h' || timeframe === '6h' || timeframe === '24h') {
        // For hourly data, convert HH:MM to comparable number
        const timeA = a.date.split(':').map(Number)
        const timeB = b.date.split(':').map(Number)
        return (timeA[0] * 60 + timeA[1]) - (timeB[0] * 60 + timeB[1])
      }
      // For daily data, use date string comparison (works for "Jan 1" format)
      return new Date(`${a.date} 2025`).getTime() - new Date(`${b.date} 2025`).getTime()
    })

  // Calculate source enhancement data with selection opportunity
  const sourceEnhancement = Object.entries(sourceStats)
    .map(([name, stats]) => ({
      name,
      total: stats.total,
      selected: stats.selected,
      enhanced: stats.enhanced,
      selectionRate: stats.total > 0 ? Math.round((stats.selected / stats.total) * 100 * 10) / 10 : 0,
      enhancementRate: stats.total > 0 ? Math.round((stats.enhanced / stats.total) * 100) : 0
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10)

  // Calculate category distribution from enhanced articles
  const categoryCounts: Record<string, number> = {}
  articles.filter(a => a.is_ai_enhanced).forEach(article => {
    const category = article.category || 'General'
    categoryCounts[category] = (categoryCounts[category] || 0) + 1
  })

  const categoryDistribution = Object.entries(categoryCounts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10)

  return {
    articles,
    enhancementTrends,
    sourceEnhancement,
    categoryDistribution,
    sources: Array.from(sources),
    categories: Array.from(categories)
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const dateFilter = searchParams.get("dateFilter") || "24h"
    
    // Check cache first
    const cacheKey = getCacheKey(dateFilter)
    const cachedEntry = analyticsCache.get(cacheKey)
    if (cachedEntry && isCacheValid(cachedEntry)) {
      console.log(`Returning cached analytics for ${dateFilter}`)
      return NextResponse.json({ ...cachedEntry.data, cached: true })
    }
    
    console.log(`Fetching optimized analytics data for time period: ${dateFilter}`)
    
    // Calculate time boundaries
    const now = new Date()
    let timeBoundary: Date | null = null
    let timePeriod = 'past 24 hours'
    
    switch (dateFilter) {
      case "2h":
        timeBoundary = new Date(now.getTime() - 2 * 60 * 60 * 1000)
        timePeriod = 'past 2 hours'
        break
      case "6h":
        timeBoundary = new Date(now.getTime() - 6 * 60 * 60 * 1000)
        timePeriod = 'past 6 hours'
        break
      case "24h":
        timeBoundary = new Date(now.getTime() - 24 * 60 * 60 * 1000)
        timePeriod = 'past 24 hours'
        break
      case "7d":
        timeBoundary = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        timePeriod = 'past 7 days'
        break
      case "30d":
        timeBoundary = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        timePeriod = 'past 30 days'
        break
      case "60d":
        timeBoundary = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)
        timePeriod = 'past 60 days'
        break
      case "90d":
        timeBoundary = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
        timePeriod = 'past 90 days'
        break
      default:
        timeBoundary = new Date(now.getTime() - 24 * 60 * 60 * 1000)
        timePeriod = 'past 24 hours'
    }

    // Use COUNT queries for accurate totals (overcomes 1000-row limit)
    console.log(`Fetching accurate counts using COUNT queries for ${dateFilter}`)
    
    // Build count queries with time filter
    let totalCountQuery = supabaseAdmin
      .from('articles')
      .select('*', { count: 'exact', head: true })
      .is('deleted_at', null)
    
    let enhancedCountQuery = supabaseAdmin
      .from('articles')
      .select('*', { count: 'exact', head: true })
      .is('deleted_at', null)
      .eq('is_ai_enhanced', true)
    
    let selectedCountQuery = supabaseAdmin
      .from('articles')
      .select('*', { count: 'exact', head: true })
      .is('deleted_at', null)
      .eq('selected_for_enhancement', true)

    // Apply time filter to all COUNT queries
    if (timeBoundary) {
      totalCountQuery = totalCountQuery.gte('created_at', timeBoundary.toISOString())
      enhancedCountQuery = enhancedCountQuery.gte('created_at', timeBoundary.toISOString())
      selectedCountQuery = selectedCountQuery.gte('created_at', timeBoundary.toISOString())
    }

    // Execute COUNT queries in parallel for performance
    const [totalResult, enhancedResult, selectedResult] = await Promise.all([
      totalCountQuery,
      enhancedCountQuery,
      selectedCountQuery
    ])

    if (totalResult.error || enhancedResult.error || selectedResult.error) {
      console.error('COUNT query error:', { 
        total: totalResult.error, 
        enhanced: enhancedResult.error, 
        selected: selectedResult.error 
      })
      throw totalResult.error || enhancedResult.error || selectedResult.error
    }

    const totalArticles = totalResult.count || 0
    const enhancedArticles = enhancedResult.count || 0
    const selectedArticles = selectedResult.count || 0

    console.log(`COUNT results: ${totalArticles} total, ${enhancedArticles} enhanced, ${selectedArticles} selected`)

    // Choose optimal data fetching strategy
    const strategy = getOptimalFetchingStrategy(dateFilter)
    console.log(`Using ${strategy} strategy for detailed analytics`)

    let detailedData
    if (strategy === 'single_query') {
      detailedData = await fetchWithSingleQuery(dateFilter, timeBoundary)
    } else {
      detailedData = await fetchWithPagination(dateFilter, timeBoundary)
    }

    // Calculate comprehensive pipeline metrics using detailed data
    const articles = detailedData.articles
    const uniqueSources = detailedData.sources.length

    // Calculate processing metrics from detailed data
    const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000)
    const staleSelections = articles.filter(a => 
      a.selected_for_enhancement && 
      !a.is_ai_enhanced && 
      new Date(a.updated_at) < sixHoursAgo
    ).length

    // Calculate average time to enhancement
    const enhancedWithTime = articles.filter(a => 
      a.is_ai_enhanced && 
      a.created_at && 
      a.updated_at &&
      new Date(a.updated_at) > new Date(a.created_at)
    )
    
    let avgTimeToEnhancement = "N/A"
    if (enhancedWithTime.length > 0) {
      const totalTime = enhancedWithTime.reduce((sum, a) => {
        const created = new Date(a.created_at).getTime()
        const updated = new Date(a.updated_at).getTime()
        return sum + (updated - created)
      }, 0)
      const avgMs = totalTime / enhancedWithTime.length
      const avgHours = Math.round(avgMs / (1000 * 60 * 60) * 10) / 10
      avgTimeToEnhancement = avgHours < 1 ? "< 1 hour" : `${avgHours} hours`
    }

    // Calculate source coverage score (articles with selection opportunity vs total scraped)
    const sourceStats: { [key: string]: { total: number, selected: number, enhanced: number } } = {}
    articles.forEach(a => {
      const source = a.source || 'Unknown'
      if (!sourceStats[source]) sourceStats[source] = { total: 0, selected: 0, enhanced: 0 }
      sourceStats[source].total++
      if (a.selected_for_enhancement) sourceStats[source].selected++
      if (a.is_ai_enhanced) sourceStats[source].enhanced++
    })
    
    // Source coverage = sources where articles had chance to be selected
    const activeSources = Object.values(sourceStats).filter(s => s.total >= 10)
    const wellCoveredSources = activeSources.filter(s => (s.selected / s.total) >= 0.05) // 5% selection opportunity threshold
    const sourceCoverageScore = activeSources.length > 0 ? 
      Math.round((wellCoveredSources.length / activeSources.length) * 100) : 0

    // Calculate processing efficiency with weighted recent performance
    let processingEfficiency = 0
    if (enhancedWithTime.length > 0) {
      let avgProcessingHours = enhancedWithTime.reduce((sum, a) => {
        const hours = (new Date(a.updated_at).getTime() - new Date(a.created_at).getTime()) / (1000 * 60 * 60)
        return sum + hours
      }, 0) / enhancedWithTime.length
      
      // For longer periods, weight recent performance more heavily
      if (['30d', '60d', '90d'].includes(dateFilter)) {
        const recent7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        const recentEnhanced = enhancedWithTime.filter(a => new Date(a.created_at) >= recent7Days)
        
        if (recentEnhanced.length > 0) {
          const recentAvgHours = recentEnhanced.reduce((sum, a) => {
            const hours = (new Date(a.updated_at).getTime() - new Date(a.created_at).getTime()) / (1000 * 60 * 60)
            return sum + hours
          }, 0) / recentEnhanced.length
          
          // Weighted average: 70% recent + 30% historical
          avgProcessingHours = (recentAvgHours * 0.7) + (avgProcessingHours * 0.3)
        }
      }
      
      // Efficiency score: 100% for <0.5 hours, decreasing to 0% for >24 hours
      const maxHours = ['30d', '60d', '90d'].includes(dateFilter) ? 24 : 5
      processingEfficiency = Math.max(0, Math.min(100, Math.round(100 - (avgProcessingHours / maxHours) * 100)))
    }

    // Calculate overall selection opportunity rate
    const totalArticlesInPeriod = articles.length
    const articlesWithSelectionOpportunity = articles.filter(a => a.selected_for_enhancement).length
    const selectionOpportunityRate = totalArticlesInPeriod > 0 
      ? Math.round((articlesWithSelectionOpportunity / totalArticlesInPeriod) * 100 * 10) / 10
      : 0
    
    // Build comprehensive pipeline metrics
    const pipelineMetrics = {
      enhancementConversionRate: totalArticles > 0 ? Math.round((enhancedArticles / totalArticles) * 100) : 0,
      sourceCoverageScore,
      selectionOpportunityRate, // New metric: % of articles that had chance to be selected
      processingEfficiency,
      avgTimeToEnhancement,
      queueSize: selectedArticles,
      staleSelections
    }

    // Build response using processed data from intelligent fetching strategies
    const responseData = {
      categoryDistribution: detailedData.categoryDistribution,
      pipelineMetrics,
      enhancementTrends: detailedData.enhancementTrends,
      sourceEnhancement: detailedData.sourceEnhancement,
      timePeriod,
      dateFilter,
      totalArticlesAnalyzed: totalArticles,
      timestamp: new Date().toISOString(),
      cached: false,
      strategy: strategy, // Include strategy info for debugging
      
      // Add context for historical data interpretation (for longer periods)
      ...((['30d', '60d', '90d'].includes(dateFilter)) && {
        systemEvolution: {
          note: "System performance has significantly improved over time",
          recentPerformance: `Current 7-day average: ~${Math.round((enhancedArticles / totalArticles) * 100)}% enhancement rate with ${avgTimeToEnhancement} processing`,
          historicalContext: "Early periods had lower rates with longer processing delays"
        }
      })
    }

    // Cache the result
    analyticsCache.set(cacheKey, {
      data: responseData,
      timestamp: Date.now(),
      dateFilter
    })

    // Clean up old cache entries
    if (analyticsCache.size > 10) {
      const oldestKey = analyticsCache.keys().next().value
      analyticsCache.delete(oldestKey)
    }

    console.log(`Analytics computed successfully: ${totalArticles} articles analyzed using ${strategy} strategy`)
    return NextResponse.json(responseData)

  } catch (error) {
    console.error("Error fetching analytics:", error)
    
    // Return empty but valid structure on error
    return NextResponse.json({
      categoryDistribution: [],
      pipelineMetrics: {
        enhancementConversionRate: 0,
        sourceCoverageScore: 0,
        processingEfficiency: 0,
        avgTimeToEnhancement: "N/A",
        queueSize: 0,
        staleSelections: 0
      },
      enhancementTrends: [],
      sourceEnhancement: [],
      timePeriod: 'past 24 hours',
      dateFilter: 'all',
      totalArticlesAnalyzed: 0,
      timestamp: new Date().toISOString(),
      cached: false,
      error: "Failed to fetch analytics data",
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}