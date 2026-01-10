import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// Feed types for cars category
type CarFeedType = 'all' | 'hot_deals' | 'first_owner' | 'budget' | 'enthusiast' |
                   'trending' | 'new_today' | 'electric' | 'midrange' | 'luxury'

// Categories available in the mobile app
type Category = 'news' | 'politics' | 'business' | 'tech' | 'health' |
                'entertainment' | 'international' | 'transportation' | 'cars'

interface FeedItem {
  id: string
  title: string
  summary?: string
  url: string
  source: string
  category: Category
  created_at: string
  image_url?: string
  images?: string[]
  // Car-specific fields
  price_hkd?: number
  view_count?: number
  is_first_owner?: boolean
  value_score?: number
  make?: string
  feed_type?: string
  feed_types?: string[]
}

interface FeedResponse {
  items: FeedItem[]
  nextPage: number | null
  hasMore: boolean
  totalCount: number
  category: Category
  feed?: CarFeedType
  availableFeeds?: { id: string; name: string; count: number }[]
}

// Car feed metadata
const CAR_FEEDS: Record<CarFeedType, { name: string; description: string }> = {
  all: { name: 'All Cars', description: 'All available car listings' },
  hot_deals: { name: 'Hot Deals', description: 'High engagement with good value' },
  new_today: { name: 'New Today', description: 'Fresh listings from last 24 hours' },
  trending: { name: 'Trending', description: 'Rising stars with high views' },
  electric: { name: 'Electric & Hybrid', description: 'EVs and hybrid vehicles' },
  midrange: { name: 'Mid-Range', description: 'Best value HK$50-100k' },
  first_owner: { name: 'First Owner', description: 'Single ownership history' },
  budget: { name: 'Budget', description: 'Under HK$50,000' },
  enthusiast: { name: 'Enthusiast', description: 'Sports and performance' },
  luxury: { name: 'Luxury', description: 'Premium over HK$500k' },
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const category = (searchParams.get('category') || 'news') as Category
    const page = parseInt(searchParams.get('page') || '0')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = page * limit

    // Handle cars category with specialized feeds
    if (category === 'cars') {
      return handleCarsFeed(searchParams, page, limit, offset)
    }

    // Handle other categories (news, politics, etc.)
    return handleNewsFeed(category, page, limit, offset)
  } catch (error) {
    console.error('Mobile feed API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

async function handleCarsFeed(
  searchParams: URLSearchParams,
  page: number,
  limit: number,
  offset: number
): Promise<NextResponse> {
  const feed = (searchParams.get('feed') || 'all') as CarFeedType

  // If requesting feed list (no specific feed)
  if (searchParams.get('list_feeds') === 'true') {
    return getCarFeedsList()
  }

  // Query the unified cars view
  let query = supabase
    .from('mv_cars_unified')
    .select('*', { count: 'exact' })

  // Filter by specific feed type if not 'all'
  if (feed !== 'all') {
    query = query.eq('feed_type', feed)
  }

  // Apply pagination
  query = query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  const { data, error, count } = await query

  if (error) {
    console.error('Error fetching cars feed:', error)
    return NextResponse.json(
      { error: 'Failed to fetch cars feed' },
      { status: 500 }
    )
  }

  // Transform to standard feed format
  const items: FeedItem[] = (data || []).map(car => ({
    id: car.id,
    title: car.title,
    summary: car.description_text?.substring(0, 200) || undefined,
    url: car.url,
    source: '28car',
    category: 'cars' as Category,
    created_at: car.created_at,
    image_url: Array.isArray(car.images) && car.images.length > 0 ? car.images[0] : undefined,
    images: car.images || [],
    price_hkd: car.price_hkd,
    view_count: car.view_count,
    is_first_owner: car.is_first_owner,
    value_score: car.value_score,
    make: car.make_zh,
    feed_type: car.feed_type,
    feed_types: car.feed_types,
  }))

  const totalCount = count || 0
  const hasMore = offset + limit < totalCount

  const response: FeedResponse = {
    items,
    nextPage: hasMore ? page + 1 : null,
    hasMore,
    totalCount,
    category: 'cars',
    feed,
    availableFeeds: Object.entries(CAR_FEEDS).map(([id, meta]) => ({
      id,
      name: meta.name,
      count: 0, // Could be populated with actual counts
    })),
  }

  return NextResponse.json(response)
}

async function getCarFeedsList(): Promise<NextResponse> {
  // Get counts for each feed
  const feedCounts = await Promise.all(
    Object.keys(CAR_FEEDS).map(async (feedId) => {
      if (feedId === 'all') {
        const { count } = await supabase
          .from('mv_cars_unified')
          .select('*', { count: 'exact', head: true })
        return { id: feedId, count: count || 0 }
      }

      const { count } = await supabase
        .from('mv_cars_unified')
        .select('*', { count: 'exact', head: true })
        .eq('feed_type', feedId)
      return { id: feedId, count: count || 0 }
    })
  )

  const feeds = Object.entries(CAR_FEEDS).map(([id, meta]) => ({
    id,
    name: meta.name,
    description: meta.description,
    count: feedCounts.find(f => f.id === id)?.count || 0,
  }))

  return NextResponse.json({
    category: 'cars',
    feeds,
  })
}

async function handleNewsFeed(
  category: Category,
  page: number,
  limit: number,
  offset: number
): Promise<NextResponse> {
  // Query articles_unified for news categories
  const { data, error, count } = await supabase
    .from('articles_unified')
    .select('*', { count: 'exact' })
    .eq('category', category)
    .order('published_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) {
    console.error('Error fetching news feed:', error)
    return NextResponse.json(
      { error: 'Failed to fetch news feed' },
      { status: 500 }
    )
  }

  const items: FeedItem[] = (data || []).map(article => ({
    id: article.id,
    title: article.title,
    summary: article.summary || article.description_text?.substring(0, 200),
    url: article.url,
    source: article.source,
    category: article.category as Category,
    created_at: article.published_at || article.created_at,
    image_url: article.image_url,
    images: article.images || (article.image_url ? [article.image_url] : []),
  }))

  const totalCount = count || 0
  const hasMore = offset + limit < totalCount

  const response: FeedResponse = {
    items,
    nextPage: hasMore ? page + 1 : null,
    hasMore,
    totalCount,
    category,
  }

  return NextResponse.json(response)
}
