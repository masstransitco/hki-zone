import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-server"

export const dynamic = 'force-dynamic'

// Time-period specific caching system
interface CacheEntry {
  data: any
  timestamp: number
  timeframe: string
  sources: string[]
}

const metricsCache = new Map<string, CacheEntry>()
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

// Generate cache key based on timeframe and sources
function getCacheKey(timeframe: string, sources: string[]): string {
  return `${timeframe}-${sources.sort().join(',')}`
}

// Check if cache entry is still valid
function isCacheValid(entry: CacheEntry): boolean {
  return (Date.now() - entry.timestamp) < CACHE_DURATION
}

interface MetricsQuery {
  timeframe?: string // '2h', '3h', '6h', '12h', '24h', '7d', '14d', '30d'
  sources?: string[]
}

// Function to get aggregated time data using efficient database queries
// Helper function to generate consistent time keys based on timeframe
function getTimeKey(dateString: string, timeframe: string): string {
  const date = new Date(dateString)
  
  switch (timeframe) {
    case '2h':
    case '3h':
      // Show 15-minute intervals for very short periods
      const minutes = date.getMinutes()
      const roundedMinutes = Math.floor(minutes / 15) * 15
      date.setMinutes(roundedMinutes, 0, 0)
      return date.toISOString()
    case '6h':
    case '12h':
      // Show 30-minute intervals for short periods
      const minutes30 = date.getMinutes()
      const roundedMinutes30 = Math.floor(minutes30 / 30) * 30
      date.setMinutes(roundedMinutes30, 0, 0)
      return date.toISOString()
    case '24h':
      // Show hourly intervals  
      date.setMinutes(0, 0, 0)
      return date.toISOString()
    case '7d':
    case '14d':
    case '30d':
    default:
      // Show daily intervals - ensure consistent YYYY-MM-DD format
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
  }
}

async function getAggregatedTimeData(timeframe: string, sources: string[]) {
  const now = new Date()
  let timeBoundary: Date | null = null
  let timeGrouping = ''
  let bucketIncrement = 0
  
  // Determine time boundary and grouping strategy
  switch (timeframe) {
    case '2h':
      timeBoundary = new Date(now.getTime() - 2 * 60 * 60 * 1000)
      timeGrouping = `DATE_TRUNC('hour', created_at) + INTERVAL '15 minutes' * FLOOR(EXTRACT(MINUTE FROM created_at) / 15)`
      bucketIncrement = 15 * 60 * 1000
      break
    case '3h':
      timeBoundary = new Date(now.getTime() - 3 * 60 * 60 * 1000)
      timeGrouping = `DATE_TRUNC('hour', created_at) + INTERVAL '15 minutes' * FLOOR(EXTRACT(MINUTE FROM created_at) / 15)`
      bucketIncrement = 15 * 60 * 1000
      break
    case '6h':
      timeBoundary = new Date(now.getTime() - 6 * 60 * 60 * 1000)
      timeGrouping = `DATE_TRUNC('hour', created_at) + INTERVAL '30 minutes' * FLOOR(EXTRACT(MINUTE FROM created_at) / 30)`
      bucketIncrement = 30 * 60 * 1000
      break
    case '12h':
      timeBoundary = new Date(now.getTime() - 12 * 60 * 60 * 1000)
      timeGrouping = `DATE_TRUNC('hour', created_at) + INTERVAL '30 minutes' * FLOOR(EXTRACT(MINUTE FROM created_at) / 30)`
      bucketIncrement = 30 * 60 * 1000
      break
    case '24h':
      timeBoundary = new Date(now.getTime() - 24 * 60 * 60 * 1000)
      timeGrouping = `DATE_TRUNC('hour', created_at)`
      bucketIncrement = 60 * 60 * 1000
      break
    case '7d':
      // For "past N days", we want exactly N days ending with today
      timeBoundary = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000)
      timeBoundary.setHours(0, 0, 0, 0)
      timeGrouping = `DATE(created_at)`
      bucketIncrement = 24 * 60 * 60 * 1000
      break
    case '14d':
      timeBoundary = new Date(now.getTime() - 13 * 24 * 60 * 60 * 1000)
      timeBoundary.setHours(0, 0, 0, 0)
      timeGrouping = `DATE(created_at)`
      bucketIncrement = 24 * 60 * 60 * 1000
      break
    case '30d':
      timeBoundary = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000)
      timeBoundary.setHours(0, 0, 0, 0)
      timeGrouping = `DATE(created_at)`
      bucketIncrement = 24 * 60 * 60 * 1000
      break
    default:
      // Default to 24h
      timeBoundary = new Date(now.getTime() - 24 * 60 * 60 * 1000)
      timeGrouping = `DATE_TRUNC('hour', created_at)`
      bucketIncrement = 60 * 60 * 1000
      break
  }

  // Build the aggregation query
  let sourceFilter = ''
  if (sources.length > 0) {
    sourceFilter = `AND source = ANY(ARRAY[${sources.map(s => `'${s}'`).join(',')}])`
  }

  let timeFilter = ''
  if (timeBoundary) {
    timeFilter = `AND created_at >= '${timeBoundary.toISOString()}'`
  }

    // Use optimized data fetching strategy based on timeframe
  console.log(`Using optimized data fetching for ${timeframe}`)
  return await getOptimizedTimeData(timeframe, sources, timeBoundary)
}

// Optimized data fetching strategy based on timeframe
async function getOptimizedTimeData(timeframe: string, sources: string[], timeBoundary: Date | null) {
  const strategy = getOptimalFetchingStrategy(timeframe, sources)
  
  switch (strategy) {
    case 'single_query':
      return await fetchWithSingleQuery(timeframe, sources, timeBoundary)
    case 'paginated':
      return await fetchWithPagination(timeframe, sources, timeBoundary)
    case 'daily_batches':
      return await fetchWithDailyBatches(timeframe, sources, timeBoundary)
    default:
      return await fetchWithSingleQuery(timeframe, sources, timeBoundary)
  }
}

// Determine the optimal fetching strategy based on timeframe and expected data volume
function getOptimalFetchingStrategy(timeframe: string, sources: string[]): 'single_query' | 'paginated' | 'daily_batches' {
  // Estimate articles based on timeframe duration
  const hoursMap = {
    '2h': 2, '3h': 3, '6h': 6, '12h': 12, '24h': 24,
    '7d': 7 * 24, '14d': 14 * 24, '30d': 30 * 24
  }
  
  const hours = hoursMap[timeframe as keyof typeof hoursMap] || 24
  const avgArticlesPerHour = 75 // ~1800 articles/day = 75/hour
  const estimatedArticles = hours * avgArticlesPerHour
  
  // For periods with estimated < 5000 articles, use single query
  if (estimatedArticles <= 5000) {
    return 'single_query'
  }
  
  // For all longer periods (7d, 14d, 30d), use pagination to preserve natural variation
  return 'paginated'
}

// Strategy 1: Single query (for short periods)
async function fetchWithSingleQuery(timeframe: string, sources: string[], timeBoundary: Date | null) {
  console.log(`Using single query strategy for ${timeframe}`)
  
  let query = supabaseAdmin
    .from('articles')
    .select('created_at, source, category, is_ai_enhanced, selected_for_enhancement')
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(15000)

  if (timeBoundary) {
    query = query.gte('created_at', timeBoundary.toISOString())
  }

  if (sources.length > 0) {
    query = query.in('source', sources)
  }

  const { data: articles, error } = await query

  if (error || !articles) {
    console.error('Single query error:', error)
    return { timeTrendsArray: [], availableSourcesList: [], availableCategoriesList: [] }
  }

  return processArticlesIntoTimeBuckets(articles, timeframe, timeBoundary)
}

// Strategy 2: Pagination (for medium datasets)
async function fetchWithPagination(timeframe: string, sources: string[], timeBoundary: Date | null) {
  console.log(`Using pagination strategy for ${timeframe}`)
  
  let baseQuery = supabaseAdmin
    .from('articles')
    .select('created_at, source, category, is_ai_enhanced, selected_for_enhancement')
    .is('deleted_at', null)
    .order('created_at', { ascending: true })

  if (timeBoundary) {
    baseQuery = baseQuery.gte('created_at', timeBoundary.toISOString())
  }

  if (sources.length > 0) {
    baseQuery = baseQuery.in('source', sources)
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
      '7d': 15000,   // ~2100 articles/day * 7 days
      '14d': 30000,  // ~2100 articles/day * 14 days  
      '30d': 60000   // ~2000 articles/day * 30 days
    }
    const maxArticles = safetyLimits[timeframe as keyof typeof safetyLimits] || 60000
    
    if (start > maxArticles) {
      console.warn(`Reached safety limit of ${maxArticles} articles for ${timeframe}`)
      break
    }
  }
  
  console.log(`Pagination complete: ${allArticles.length} articles fetched`)
  return processArticlesIntoTimeBuckets(allArticles, timeframe, timeBoundary)
}

// Strategy 3: Daily batches (for large datasets - ensures even distribution)
async function fetchWithDailyBatches(timeframe: string, sources: string[], timeBoundary: Date | null) {
  console.log(`Using daily batches strategy for ${timeframe}`)
  
  if (!timeBoundary) {
    console.warn('Daily batches strategy requires time boundary, falling back to pagination')
    return await fetchWithPagination(timeframe, sources, timeBoundary)
  }
  
  const now = new Date()
  const days = timeframe === '7d' ? 7 : timeframe === '30d' ? 30 : timeframe === '60d' ? 60 : 90
  const articlesPerDay = Math.floor(2000 / days) // Sample ~2000 articles distributed across days
  
  const allArticles: any[] = []
  let currentDate = new Date(timeBoundary)
  
  for (let day = 0; day < days && currentDate <= now; day++) {
    const dayStart = new Date(currentDate)
    dayStart.setHours(0, 0, 0, 0)
    
    const dayEnd = new Date(currentDate)
    dayEnd.setHours(23, 59, 59, 999)
    
    let dayQuery = supabaseAdmin
      .from('articles')
      .select('created_at, source, category, is_ai_enhanced, selected_for_enhancement')
      .is('deleted_at', null)
      .gte('created_at', dayStart.toISOString())
      .lt('created_at', dayEnd.toISOString())
      .order('created_at', { ascending: false }) // Get most recent articles from each day
      .limit(Math.max(articlesPerDay, 50)) // At least 50 articles per day if available
    
    if (sources.length > 0) {
      dayQuery = dayQuery.in('source', sources)
    }
    
    const { data: dayArticles, error } = await dayQuery
    
    if (error) {
      console.error(`Error fetching articles for ${dayStart.toDateString()}:`, error)
      continue
    }
    
    if (dayArticles && dayArticles.length > 0) {
      allArticles.push(...dayArticles)
      console.log(`Day ${day + 1} (${dayStart.toDateString()}): ${dayArticles.length} articles`)
    }
    
    currentDate.setDate(currentDate.getDate() + 1)
  }
  
  console.log(`Daily batches complete: ${allArticles.length} articles from ${days} days`)
  return processArticlesIntoTimeBuckets(allArticles, timeframe, timeBoundary)
}

// Fallback function using standard Supabase queries
async function getFallbackAggregatedData(timeframe: string, sources: string[], timeBoundary: Date | null) {
  console.log('Using fallback aggregation approach')
  
  // Build a simpler query using Supabase's built-in functions
  let query = supabaseAdmin
    .from('articles')
    .select('created_at, source, category, is_ai_enhanced, selected_for_enhancement')
    .is('deleted_at', null)
    .order('created_at', { ascending: true }) // Order oldest first to get distributed data across time period

  if (timeBoundary) {
    query = query.gte('created_at', timeBoundary.toISOString())
  }

  if (sources.length > 0) {
    query = query.in('source', sources)
  }

  // For longer timeframes, we need strategic sampling to get data from all days
  // Supabase has a default limit, so we need to be smart about fetching
  let queryStrategy: 'sample' | 'full' = 'full'
  let queryLimit: number | undefined
  
  if (timeframe === '2h' || timeframe === '6h' || timeframe === '24h') {
    queryLimit = 15000 // Limit for performance on short periods
  } else {
    // For longer periods, use a very high limit to override Supabase default
    queryLimit = 100000
  }
  
  let articles, error
  if (queryLimit) {
    console.log(`Fetching up to ${queryLimit} articles for ${timeframe} aggregation (strategy: ${queryStrategy})`)
    const result = await query.limit(queryLimit)
    articles = result.data
    error = result.error
  } else {
    console.log(`Fetching ALL articles for ${timeframe} aggregation (no limit)`)
    const result = await query
    articles = result.data
    error = result.error
  }

  if (error || !articles) {
    console.error('Fallback query error:', error)
    return { timeTrendsArray: [], availableSourcesList: [], availableCategoriesList: [] }
  }

  // Process articles into time buckets using correct approach
  return processArticlesIntoTimeBuckets(articles, timeframe, timeBoundary)
}

// Process aggregated database results into chart-ready format
function processAggregatedData(aggregatedData: any[], timeframe: string, timeBoundary: Date | null, now: Date, bucketIncrement: number) {
  // Create time buckets for the full period
  const timeTrends: { [key: string]: any } = {}
  const sources = new Set<string>()
  const categories = new Set<string>()

  // Generate all time buckets for the requested period with safety limits
  if (timeBoundary) {
    let currentTime = new Date(timeBoundary)
    let safetyCounter = 0
    const maxBuckets = timeframe === '2h' ? 8 : timeframe === '6h' ? 24 : 
                       timeframe === '24h' ? 24 : timeframe === '7d' ? 7 : 
                       timeframe === '30d' ? 30 : timeframe === '60d' ? 60 : 
                       timeframe === '90d' ? 90 : 365 // 'all' case
    
    while (currentTime <= now && safetyCounter < maxBuckets) {
      const timeKey = getTimeKey(currentTime.toISOString(), timeframe)
      if (!timeTrends[timeKey]) {
        timeTrends[timeKey] = {
          time: timeKey,
          date: timeKey, // Compatibility
          articles_scraped: 0,
          selected_for_enhancement: 0,
          ai_enhanced: 0,
          sources: {},
          enhancedCategories: {}
        }
      }
      
      // Increment time safely based on timeframe
      if (timeframe === '7d' || timeframe === '30d' || timeframe === '60d' || timeframe === '90d' || timeframe === 'all') {
        // For daily buckets, increment by whole days
        currentTime.setDate(currentTime.getDate() + 1)
      } else {
        // For hour/minute buckets, use millisecond increment
        const newTime = currentTime.getTime() + bucketIncrement
        const nextTime = new Date(newTime)
        
        // Prevent infinite loops by checking if time is advancing
        if (nextTime.getTime() <= currentTime.getTime()) {
          console.warn(`Time increment issue detected, breaking loop at ${currentTime.toISOString()}`)
          break
        }
        
        currentTime = nextTime
      }
      safetyCounter++
    }
    
    console.log(`Generated ${Object.keys(timeTrends).length} time buckets for ${timeframe} (safety counter: ${safetyCounter})`)
  }

  // Fill buckets with aggregated data
  aggregatedData.forEach(row => {
    const timeKey = getTimeKey(row.time_bucket, timeframe)
    const sourceKey = row.source.replace(' (AI Enhanced)', '')
    const category = row.category || 'Uncategorized'
    
    sources.add(sourceKey)
    if (row.enhanced_count > 0) {
      categories.add(category)
    }

    if (!timeTrends[timeKey]) {
      timeTrends[timeKey] = {
        time: timeKey,
        date: timeKey,
        articles_scraped: 0,
        selected_for_enhancement: 0,
        ai_enhanced: 0,
        sources: {},
        enhancedCategories: {}
      }
    }

    const bucket = timeTrends[timeKey]
    bucket.articles_scraped += row.article_count
    bucket.selected_for_enhancement += row.selected_count
    bucket.ai_enhanced += row.enhanced_count

    // Track by source
    if (!bucket.sources[sourceKey]) {
      bucket.sources[sourceKey] = 0
    }
    bucket.sources[sourceKey] += row.article_count

    // Track enhanced by category
    if (row.enhanced_count > 0) {
      if (!bucket.enhancedCategories[category]) {
        bucket.enhancedCategories[category] = 0
      }
      bucket.enhancedCategories[category] += row.enhanced_count
    }
  })

  // Convert to array and flatten
  const timeTrendsArray = Object.values(timeTrends).map((t: any) => ({
    ...t,
    ...t.sources,
    ...Object.keys(t.enhancedCategories).reduce((acc, category) => {
      acc[`enhanced_${category}`] = t.enhancedCategories[category]
      return acc
    }, {} as Record<string, number>)
  })).sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())

  return {
    timeTrendsArray,
    availableSourcesList: Array.from(sources),
    availableCategoriesList: Array.from(categories)
  }
}

// Process individual articles into time buckets (fallback)
function processArticlesIntoTimeBuckets(articles: any[], timeframe: string, timeBoundary: Date | null) {
  console.log(`Processing ${articles.length} articles into time buckets for ${timeframe}`)
  
  const timeTrends: { [key: string]: any } = {}
  const sources = new Set<string>()
  const categories = new Set<string>()

  // First, generate all empty time buckets for the requested period
  if (timeframe === '7d' || timeframe === '14d' || timeframe === '30d') {
    const now = new Date()
    const maxDays = timeframe === '7d' ? 7 : timeframe === '14d' ? 14 : 30
    
    // Use the same boundary calculation as the main query to ensure consistency
    let currentDate = new Date(now.getTime() - (maxDays - 1) * 24 * 60 * 60 * 1000)
    currentDate.setHours(0, 0, 0, 0) // Start at beginning of day
    
    let dayCount = 0
    
    console.log(`Generating daily buckets from ${currentDate.toDateString()} to ${now.toDateString()} (${maxDays} days)`)
    
    while (dayCount < maxDays) {
      const timeKey = getTimeKey(currentDate.toISOString(), timeframe)
      
      if (!timeTrends[timeKey]) {
        timeTrends[timeKey] = {
          time: timeKey,
          date: timeKey,
          articles_scraped: 0,
          selected_for_enhancement: 0,
          ai_enhanced: 0,
          sources: {},
          enhancedCategories: {}
        }
      }
      
      currentDate.setDate(currentDate.getDate() + 1)
      dayCount++
    }
    
    console.log(`Generated ${Object.keys(timeTrends).length} empty daily buckets for ${timeframe}`)
  }

  // Now populate buckets with article data
  articles.forEach(article => {
    const timeKey = getTimeKey(article.created_at, timeframe)
    const sourceKey = article.source.replace(' (AI Enhanced)', '')
    const category = article.category || 'Uncategorized'

    sources.add(sourceKey)
    if (article.is_ai_enhanced) {
      categories.add(category)
    }

    if (!timeTrends[timeKey]) {
      timeTrends[timeKey] = {
        time: timeKey,
        date: timeKey,
        articles_scraped: 0,
        selected_for_enhancement: 0,
        ai_enhanced: 0,
        sources: {},
        enhancedCategories: {}
      }
    }

    const t = timeTrends[timeKey]
    t.articles_scraped++
    if (article.selected_for_enhancement) t.selected_for_enhancement++
    if (article.is_ai_enhanced) t.ai_enhanced++

    if (!t.sources[sourceKey]) {
      t.sources[sourceKey] = 0
    }
    t.sources[sourceKey]++

    if (article.is_ai_enhanced) {
      if (!t.enhancedCategories[category]) {
        t.enhancedCategories[category] = 0
      }
      t.enhancedCategories[category]++
    }
  })

  // Convert to array and flatten
  const timeTrendsArray = Object.values(timeTrends).map((t: any) => ({
    ...t,
    ...t.sources,
    ...Object.keys(t.enhancedCategories).reduce((acc, category) => {
      acc[`enhanced_${category}`] = t.enhancedCategories[category]
      return acc
    }, {} as Record<string, number>)
  })).sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())

  return {
    timeTrendsArray,
    availableSourcesList: Array.from(sources),
    availableCategoriesList: Array.from(categories)
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const timeframe = searchParams.get('timeframe') || '24h'
    const sources = searchParams.get('sources')?.split(',').filter(s => s.length > 0) || []
    
    const cacheKey = getCacheKey(timeframe, sources)
    const nowTimestamp = Date.now()
    
    // Check cache for this specific timeframe and source combination
    const cachedEntry = metricsCache.get(cacheKey)
    if (cachedEntry && isCacheValid(cachedEntry)) {
      console.log(`Returning cached metrics data for ${timeframe} with ${sources.length} sources`)
      return NextResponse.json({ ...cachedEntry.data, cached: true })
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
    
    const threshold = new Date()
    switch (timeframe) {
      case '2h':
        threshold.setTime(threshold.getTime() - 2 * 60 * 60 * 1000)
        break
      case '3h':
        threshold.setTime(threshold.getTime() - 3 * 60 * 60 * 1000)
        break
      case '6h':
        threshold.setTime(threshold.getTime() - 6 * 60 * 60 * 1000)
        break
      case '12h':
        threshold.setTime(threshold.getTime() - 12 * 60 * 60 * 1000)
        break
      case '24h':
        threshold.setTime(threshold.getTime() - 24 * 60 * 60 * 1000)
        break
      case '7d':
        threshold.setDate(threshold.getDate() - 7)
        break
      case '14d':
        threshold.setDate(threshold.getDate() - 14)
        break
      case '30d':
        threshold.setDate(threshold.getDate() - 30)
        break
      default:
        threshold.setTime(threshold.getTime() - 24 * 60 * 60 * 1000) // Default to 24h
        break
    }
    countQuery = countQuery.gte('created_at', threshold.toISOString())

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

    // Use database-level aggregation instead of client-side processing
    const aggregatedData = await getAggregatedTimeData(timeframe, sources)
    const { timeTrendsArray = [], availableSourcesList = [], availableCategoriesList = [] } = aggregatedData || {}

    // console.log(`Aggregated data: ${timeTrendsArray.length} trends, ${availableSourcesList.length} sources, ${availableCategoriesList.length} categories`)

    if (!timeTrendsArray || timeTrendsArray.length === 0) {
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

    // Process data efficiently using aggregated time data + accurate counts
    const uniqueSources = availableSourcesList.length
    
    // Use accurate counts for the main metrics
    const processedOverall = {
      total_articles: totalCount || 0,
      active_articles: totalCount || 0,
      selected_for_enhancement: selectedCount || 0,
      ai_enhanced_articles: enhancedCount || 0,
      unique_sources: uniqueSources,
      enhancement_rate: totalCount && enhancedCount ? Math.round((enhancedCount / totalCount) * 100 * 100) / 100 : 0,
      earliest_article: timeTrendsArray.length > 0 ? timeTrendsArray[0]?.time : null,
      latest_article: timeTrendsArray.length > 0 ? timeTrendsArray[timeTrendsArray.length - 1]?.time : null
    }

    // Calculate pipeline health metrics (use accurate counts)
    const processedPipeline = {
      articles_last_24h: articles24hCount || 0,
      articles_last_hour: articles1hCount || 0,
      enhanced_last_24h: enhanced24hCount || 0,
      selected_last_24h: selected24hCount || 0,
      low_quality_articles: 0, // Cannot calculate without content data in aggregation
      avg_content_length: 0     // Cannot calculate without content data in aggregation
    }

    // Calculate source breakdown by aggregating from existing daily trends data
    const sourceBreakdown: { [key: string]: any } = {}
    
    // Use the existing daily trends data that already works for Article Collection
    timeTrendsArray.forEach(trend => {
      // Get all source keys from this trend (sources are flattened into the trend object)
      Object.keys(trend).forEach(key => {
        // Skip non-source keys
        if (['time', 'date', 'articles_scraped', 'selected_for_enhancement', 'ai_enhanced', 'sources', 'enhancedCategories', 'enhancedSources', 'enhancement_rate'].includes(key)) {
          return
        }
        
        // Skip enhanced category keys  
        if (key.startsWith('enhanced_')) {
          return
        }
        
        // This is a source key (e.g., "SingTao", "HK01", etc.)
        const source = key
        const sourceCount = trend[key] || 0
        
        if (sourceCount > 0) {
          if (!sourceBreakdown[source]) {
            sourceBreakdown[source] = {
              source: source,
              total_count: 0,
              active_count: 0,
              selected_count: 0,
              enhanced_count: 0,
              enhancement_rate: 0
            }
          }
          
          sourceBreakdown[source].total_count += sourceCount
          sourceBreakdown[source].active_count += sourceCount
          
          // Calculate enhanced articles for this source proportionally
          // Since we know the total enhanced articles for this time period
          if (trend.ai_enhanced > 0 && trend.articles_scraped > 0) {
            const sourceRatio = sourceCount / trend.articles_scraped
            const estimatedEnhanced = Math.round(trend.ai_enhanced * sourceRatio)
            sourceBreakdown[source].enhanced_count += estimatedEnhanced
          }
        }
      })
    })

    // Calculate enhancement rates for sources
    Object.values(sourceBreakdown).forEach((s: any) => {
      s.enhancement_rate = s.total_count > 0 ? Math.round((s.enhanced_count / s.total_count) * 100 * 100) / 100 : 0
    })
    
    // console.log(`Source breakdown calculated for ${Object.keys(sourceBreakdown).length} sources`)

    // Process aggregated time trends data directly (no client-side processing)
    const processedDailyTrends = timeTrendsArray.map(trend => ({
      ...trend,
      enhancement_rate: trend.articles_scraped > 0 ? Math.round((trend.ai_enhanced / trend.articles_scraped) * 100 * 100) / 100 : 0
    }))
    // Calculate category distribution from aggregated data
    const categoryDistribution = availableCategoriesList.map(category => {
      let totalCount = 0
      let enhancedCount = 0
      
      timeTrendsArray.forEach(trend => {
        const catCount = trend[`enhanced_${category}`] || 0
        enhancedCount += catCount
        // Estimate total count (this is approximate since we only have enhanced data)
        totalCount += catCount
      })
      
      return {
        category,
        count: totalCount,
        enhanced_count: enhancedCount, 
        enhancement_rate: totalCount > 0 ? Math.round((enhancedCount / totalCount) * 100 * 100) / 100 : 0
      }
    })

    // Format response data using processed aggregated data
    const response = {
      overall: processedOverall,
      pipeline: processedPipeline,
      sourceBreakdown: Object.values(sourceBreakdown).sort((a: any, b: any) => b.total_count - a.total_count),
      dailyTrends: processedDailyTrends,
      categoryDistribution: categoryDistribution.sort((a: any, b: any) => b.count - a.count).slice(0, 15),
      availableSources: availableSourcesList,
      availableCategories: availableCategoriesList,
      timeframe,
      recordsAnalyzed: totalCount || 0,
      generatedAt: new Date().toISOString(),
      cached: false
    }

    // Cache the result for this specific timeframe and source combination
    metricsCache.set(cacheKey, {
      data: { ...response, cached: false },
      timestamp: nowTimestamp,
      timeframe,
      sources: [...sources]
    })
    
    // Clean up old cache entries (keep only last 10 entries to prevent memory leaks)
    if (metricsCache.size > 10) {
      const oldestKey = metricsCache.keys().next().value
      metricsCache.delete(oldestKey)
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