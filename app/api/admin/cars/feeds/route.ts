import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

type FeedType = 'hot_deals' | 'first_owner' | 'budget' | 'enthusiast' | 'trending' | 'new_today' | 'electric' | 'midrange' | 'luxury'

const FEED_VIEWS: Record<FeedType, string> = {
  hot_deals: 'mv_cars_hot_deals',
  first_owner: 'mv_cars_first_owner',
  budget: 'mv_cars_budget',
  enthusiast: 'mv_cars_enthusiast',
  trending: 'mv_cars_trending',
  new_today: 'mv_cars_new_today',
  electric: 'mv_cars_electric',
  midrange: 'mv_cars_midrange',
  luxury: 'mv_cars_luxury',
}

const FEED_DESCRIPTIONS: Record<FeedType, { title: string; description: string }> = {
  hot_deals: {
    title: 'Hot Deals',
    description: 'High engagement listings with good value scores'
  },
  first_owner: {
    title: 'First Owner',
    description: 'Premium cars with single ownership history (0首)'
  },
  budget: {
    title: 'Budget Finds',
    description: 'Quality cars under HK$50,000'
  },
  enthusiast: {
    title: 'Enthusiast Cars',
    description: 'Sports and performance vehicles'
  },
  trending: {
    title: 'Trending',
    description: 'Highest views per day - rising stars'
  },
  new_today: {
    title: 'New Today',
    description: 'Fresh listings from the last 24 hours'
  },
  electric: {
    title: 'Electric & Hybrid',
    description: 'EVs and hybrids - Tesla, BYD, Prius, and more'
  },
  midrange: {
    title: 'Mid-Range (50k-100k)',
    description: 'Best value in the popular HK$50-100k range'
  },
  luxury: {
    title: 'Luxury (500k+)',
    description: 'Premium vehicles over HK$500,000'
  },
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const feedType = searchParams.get('feed') as FeedType | null
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')

    // If no feed specified, return feed metadata with counts
    if (!feedType) {
      const feedCounts = await Promise.all(
        Object.entries(FEED_VIEWS).map(async ([key, view]) => {
          const { count } = await supabase
            .from(view)
            .select('*', { count: 'exact', head: true })

          return {
            id: key,
            ...FEED_DESCRIPTIONS[key as FeedType],
            count: count || 0
          }
        })
      )

      return NextResponse.json({
        feeds: feedCounts,
        totalFeeds: feedCounts.length
      })
    }

    // Validate feed type
    if (!FEED_VIEWS[feedType]) {
      return NextResponse.json(
        { error: `Invalid feed type: ${feedType}. Valid types: ${Object.keys(FEED_VIEWS).join(', ')}` },
        { status: 400 }
      )
    }

    const viewName = FEED_VIEWS[feedType]

    // Fetch from materialized view
    const { data, error, count } = await supabase
      .from(viewName)
      .select('*', { count: 'exact' })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error(`Error fetching ${feedType} feed:`, error)
      return NextResponse.json(
        { error: `Failed to fetch ${feedType} feed` },
        { status: 500 }
      )
    }

    // Transform listings to extract image_url from images array
    const listings = (data || []).map((item: Record<string, unknown>) => ({
      ...item,
      image_url: Array.isArray(item.images) && item.images.length > 0 ? item.images[0] : null,
    }))

    return NextResponse.json({
      feed: feedType,
      ...FEED_DESCRIPTIONS[feedType],
      listings,
      total: count || 0,
      hasMore: (offset + limit) < (count || 0),
      pagination: {
        offset,
        limit,
        nextOffset: (offset + limit) < (count || 0) ? offset + limit : null
      }
    })

  } catch (error) {
    console.error('Error in car feeds API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST to refresh materialized views
export async function POST(request: NextRequest) {
  try {
    const { data, error } = await supabase.rpc('refresh_car_materialized_views')

    if (error) {
      console.error('Error refreshing materialized views:', error)
      return NextResponse.json(
        { error: 'Failed to refresh feeds' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Car feeds refreshed successfully',
      refreshedAt: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error refreshing feeds:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
