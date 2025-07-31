import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Missing Supabase environment variables')
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

export async function GET() {
  try {
    // Get total articles count
    const { count: totalCount, error: totalError } = await supabase
      .from('articles')
      .select('*', { count: 'exact', head: true })
      .is('deleted_at', null)

    if (totalError && totalError.code !== 'PGRST116') {
      throw totalError
    }

    // Get enhanced articles count
    const { count: enhancedCount, error: enhancedError } = await supabase
      .from('articles')
      .select('*', { count: 'exact', head: true })
      .eq('is_ai_enhanced', true)
      .is('deleted_at', null)

    if (enhancedError && enhancedError.code !== 'PGRST116') {
      throw enhancedError
    }

    // Get selected articles count
    const { count: selectedCount, error: selectedError } = await supabase
      .from('articles')
      .select('*', { count: 'exact', head: true })
      .eq('selected_for_enhancement', true)
      .is('deleted_at', null)

    if (selectedError && selectedError.code !== 'PGRST116') {
      throw selectedError
    }

    // Get recently added articles (today)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const { count: recentCount, error: recentError } = await supabase
      .from('articles')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', today.toISOString())
      .is('deleted_at', null)

    if (recentError && recentError.code !== 'PGRST116') {
      throw recentError
    }

    // Get source distribution
    const { data: sourceData, error: sourceError } = await supabase
      .from('articles')
      .select('source')
      .is('deleted_at', null)

    if (sourceError) {
      throw sourceError
    }

    // Count articles by source
    const sourceCounts = sourceData?.reduce((acc: Record<string, number>, article) => {
      const source = article.source || 'Unknown'
      acc[source] = (acc[source] || 0) + 1
      return acc
    }, {}) || {}

    // Get top sources (sorted by count)
    const topSources = Object.entries(sourceCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    const stats = {
      total: totalCount || 0,
      enhanced: enhancedCount || 0,
      selected: selectedCount || 0,
      recentlyAdded: recentCount || 0,
      topSources
    }

    return NextResponse.json(stats)

  } catch (error) {
    console.error('Error fetching article stats:', error)
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch article statistics',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}