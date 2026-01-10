import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // Get stats from materialized view
    const { data: statsData, error: statsError } = await supabase
      .from('mv_cars_stats')
      .select('*')
      .single()

    if (statsError) {
      console.error('Error fetching car stats from materialized view:', statsError)
      // Fallback to direct query if materialized view doesn't exist
      return await getFallbackStats()
    }

    // Get top makes
    const { data: topMakes, error: makesError } = await supabase
      .from('mv_cars_top_makes')
      .select('*')
      .limit(15)

    if (makesError) {
      console.error('Error fetching top makes:', makesError)
    }

    // Get feed counts
    const feedCounts = await getFeedCounts()

    return NextResponse.json({
      // Core stats
      total: statsData.total_listings,
      recent24h: statsData.last_24h,
      recent7d: statsData.last_7d,

      // Price ranges
      priceRanges: {
        budget: statsData.budget_count,        // < 50K
        midLow: statsData.mid_low_count,       // 50K-100K
        mid: statsData.mid_count,              // 100K-200K
        premium: statsData.premium_count,      // 200K-500K
        luxury: statsData.luxury_count,        // > 500K
      },

      // Quality metrics
      qualityMetrics: {
        firstOwner: statsData.first_owner_count,
        highEngagement: statsData.high_engagement,
        enriched: statsData.enriched_count,
      },

      // Averages
      averages: {
        views: parseFloat(statsData.avg_views) || 0,
        price: parseInt(statsData.avg_price) || 0,
      },

      // Top makes - transform make_zh to make and parse avg_price
      topMakes: (topMakes || []).map((m: { make_zh: string; count: number; avg_price: string }) => ({
        make: m.make_zh,
        count: m.count,
        avg_price: parseInt(m.avg_price) || 0,
      })),

      // Feed counts
      feeds: feedCounts,

      // Metadata
      lastListingAt: statsData.last_listing_at,
      statsRefreshedAt: statsData.refreshed_at,
    })

  } catch (error) {
    console.error('Error fetching car statistics:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

async function getFallbackStats() {
  // Fallback if materialized views don't exist
  const { count: totalCount } = await supabase
    .from('articles_unified')
    .select('*', { count: 'exact', head: true })
    .eq('category', 'cars')
    .eq('source', '28car')

  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { count: recentCount } = await supabase
    .from('articles_unified')
    .select('*', { count: 'exact', head: true })
    .eq('category', 'cars')
    .eq('source', '28car')
    .gte('created_at', dayAgo)

  return NextResponse.json({
    total: totalCount || 0,
    recent24h: recentCount || 0,
    recent7d: 0,
    priceRanges: {
      budget: 0,
      midLow: 0,
      mid: 0,
      premium: 0,
      luxury: 0,
    },
    qualityMetrics: {
      firstOwner: 0,
      highEngagement: 0,
      enriched: 0,
    },
    averages: {
      views: 0,
      price: 0,
    },
    topMakes: [],
    feeds: {},
    lastListingAt: null,
    statsRefreshedAt: null,
  })
}

async function getFeedCounts() {
  const feeds = ['mv_cars_hot_deals', 'mv_cars_first_owner', 'mv_cars_budget',
                 'mv_cars_enthusiast', 'mv_cars_trending', 'mv_cars_new_today']

  const counts: Record<string, number> = {}

  for (const feed of feeds) {
    try {
      const { count } = await supabase
        .from(feed)
        .select('*', { count: 'exact', head: true })

      const feedName = feed.replace('mv_cars_', '')
      counts[feedName] = count || 0
    } catch {
      // Ignore errors for missing views
    }
  }

  return counts
}

// POST to refresh stats
export async function POST() {
  try {
    // Refresh the stats materialized view
    const { error } = await supabase.rpc('refresh_car_materialized_views')

    if (error) {
      console.error('Error refreshing stats:', error)
      return NextResponse.json(
        { error: 'Failed to refresh stats' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Stats refreshed successfully'
    })
  } catch (error) {
    console.error('Error refreshing stats:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
