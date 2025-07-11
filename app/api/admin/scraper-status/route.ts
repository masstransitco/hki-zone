import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    
    if (type !== 'cars') {
      return NextResponse.json(
        { error: 'Invalid scraper type' },
        { status: 400 }
      )
    }
    
    // Get the latest car from the database to determine when scraper last ran
    const { data: latestCar, error } = await supabase
      .from('articles')
      .select('created_at')
      .eq('category', 'cars')
      .eq('source', '28car')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    
    if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned"
      console.error('Error fetching latest car:', error)
      return NextResponse.json(
        { error: 'Failed to check scraper status' },
        { status: 500 }
      )
    }
    
    // Get count of cars added in the last 24 hours
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { count: recentCount, error: countError } = await supabase
      .from('articles')
      .select('*', { count: 'exact', head: true })
      .eq('category', 'cars')
      .eq('source', '28car')
      .gte('created_at', dayAgo)
    
    if (countError) {
      console.error('Error counting recent cars:', countError)
    }
    
    return NextResponse.json({
      lastRun: latestCar?.created_at || null,
      recentCount: recentCount || 0,
      status: latestCar ? 'has_data' : 'no_data'
    })
    
  } catch (error) {
    console.error('Error checking scraper status:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}