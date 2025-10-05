import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-server"

export const dynamic = 'force-dynamic'

// Environment variable to control whether to use RPC or legacy implementation
const USE_RPC = process.env.USE_RPC_METRICS !== 'false'

// Legacy implementation (keeping for rollback purposes)
async function getLegacyMetrics(timeframe: string, sources: string[]) {
  // This would contain the old implementation
  // For now, returning an error to indicate legacy mode is deprecated
  throw new Error('Legacy metrics implementation is deprecated. Please use RPC mode.')
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const timeframe = searchParams.get('timeframe') || '24h'
    const sources = searchParams.get('sources')?.split(',').filter(s => s.length > 0) || []
    
    console.log(`Fetching metrics for timeframe: ${timeframe}, sources: ${sources.length > 0 ? sources.join(',') : 'all'}`)
    
    // Use RPC function for optimized performance
    if (USE_RPC) {
      const startTime = Date.now()
      
      // Single RPC call replaces 15+ individual queries
      const { data, error } = await supabaseAdmin.rpc('get_cached_admin_metrics', {
        p_timeframe: timeframe,
        p_sources: sources
      })
      
      const executionTime = Date.now() - startTime
      
      if (error) {
        console.error('Metrics RPC error:', error)
        
        // Fallback to non-cached version if cache function fails
        const { data: fallbackData, error: fallbackError } = await supabaseAdmin.rpc('get_admin_dashboard_metrics', {
          p_timeframe: timeframe,
          p_sources: sources
        })
        
        if (fallbackError) {
          console.error('Metrics fallback RPC error:', fallbackError)
          throw fallbackError
        }
        
        console.log(`Metrics fetched via fallback RPC in ${Date.now() - startTime}ms`)
        return NextResponse.json(fallbackData)
      }
      
      console.log(`Metrics fetched via RPC in ${executionTime}ms (cached: ${data?.cached || false})`)
      
      // Add execution metadata for monitoring
      const response = {
        ...data,
        _metadata: {
          executionTime,
          method: 'rpc',
          cached: data?.cached || false
        }
      }
      
      return NextResponse.json(response)
      
    } else {
      // Use legacy implementation (for rollback purposes)
      console.warn('Using legacy metrics implementation - this is deprecated')
      const data = await getLegacyMetrics(timeframe, sources)
      return NextResponse.json(data)
    }
    
  } catch (error) {
    console.error('Metrics API error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch metrics', 
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}