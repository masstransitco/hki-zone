import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// GET: Fetch refresh schedule status
export async function GET() {
  try {
    const { data, error } = await supabase.rpc('get_car_feed_refresh_status')

    if (error) {
      console.error('Error fetching refresh status:', error)
      return NextResponse.json(
        { error: 'Failed to fetch refresh status' },
        { status: 500 }
      )
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error in refresh schedule API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST: Trigger manual refresh
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { view_name, refresh_all } = body

    if (refresh_all) {
      // Refresh all views
      const { data, error } = await supabase.rpc('refresh_all_car_views', {
        p_triggered_by: 'manual'
      })

      if (error) {
        console.error('Error refreshing all views:', error)
        return NextResponse.json(
          { error: 'Failed to refresh views' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        message: 'All views refreshed successfully',
        ...data
      })
    } else if (view_name) {
      // Refresh specific view
      const { data, error } = await supabase.rpc('refresh_car_view', {
        p_view_name: view_name,
        p_triggered_by: 'manual'
      })

      if (error) {
        console.error(`Error refreshing ${view_name}:`, error)
        return NextResponse.json(
          { error: `Failed to refresh ${view_name}` },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        message: `${view_name} refreshed successfully`,
        ...data
      })
    } else {
      return NextResponse.json(
        { error: 'Either view_name or refresh_all must be provided' },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error('Error in refresh API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PATCH: Update schedule settings (enable/disable)
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { view_name, is_enabled } = body

    if (!view_name) {
      return NextResponse.json(
        { error: 'view_name is required' },
        { status: 400 }
      )
    }

    const { error } = await supabase
      .from('car_feed_refresh_schedule')
      .update({
        is_enabled,
        updated_at: new Date().toISOString()
      })
      .eq('view_name', view_name)

    if (error) {
      console.error('Error updating schedule:', error)
      return NextResponse.json(
        { error: 'Failed to update schedule' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `Schedule for ${view_name} updated`
    })
  } catch (error) {
    console.error('Error updating schedule:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
