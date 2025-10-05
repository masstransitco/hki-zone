import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-server"

export const dynamic = 'force-dynamic'

// Environment variable to control whether to use RPC or legacy implementation
const USE_RPC_ARTICLES = process.env.USE_RPC_ARTICLES !== 'false'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const operation = searchParams.get('operation') || 'list'
    
    if (!USE_RPC_ARTICLES) {
      return NextResponse.json({ error: 'Legacy mode not implemented for articles optimization' }, { status: 501 })
    }
    
    const startTime = Date.now()
    let result
    
    console.log(`Articles ${operation} request with params:`, Object.fromEntries(searchParams.entries()))
    
    switch (operation) {
      case 'list':
        result = await handleArticlesList(searchParams)
        break
      case 'stats':
        result = await handleArticlesStats()
        break
      case 'analytics':
        result = await handleArticlesAnalytics(searchParams)
        break
      case 'search':
        result = await handleArticlesSearch(searchParams)
        break
      default:
        return NextResponse.json({ error: 'Invalid operation. Supported: list, stats, analytics, search' }, { status: 400 })
    }
    
    const executionTime = Date.now() - startTime
    console.log(`Articles ${operation} completed in ${executionTime}ms via RPC`)
    
    return NextResponse.json({
      ...result,
      _metadata: {
        operation,
        executionTime,
        method: 'rpc',
        cached: result?.cached || false
      }
    })
    
  } catch (error) {
    console.error('Articles API error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch articles data', 
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}

async function handleArticlesList(searchParams: URLSearchParams) {
  const page = parseInt(searchParams.get('page') || '0')
  const limit = parseInt(searchParams.get('limit') || '20')
  const search = searchParams.get('search') || null
  const source = searchParams.get('source')
  const category = searchParams.get('category')
  const language = searchParams.get('language')
  const aiEnhanced = searchParams.get('aiEnhanced')
  const dateFilter = searchParams.get('dateFilter')
  const selectedForEnhancement = searchParams.get('selectedForEnhancement')
  
  // Convert string parameters to appropriate types
  const aiEnhancedBool = aiEnhanced === 'all' ? null : aiEnhanced === 'true'
  const selectedBool = selectedForEnhancement === 'all' ? null : selectedForEnhancement === 'true'
  
  const { data, error } = await supabaseAdmin.rpc('get_admin_articles_paginated', {
    p_page: page,
    p_limit: limit,
    p_search: search,
    p_source: source === 'all' ? null : source,
    p_category: category === 'all' ? null : category,
    p_language: language === 'all' ? null : language,
    p_ai_enhanced: aiEnhancedBool,
    p_date_filter: dateFilter === 'all' ? null : dateFilter,
    p_selected_for_enhancement: selectedBool
  })
  
  if (error) {
    console.error('Articles list RPC error:', error)
    throw error
  }
  
  return data
}

async function handleArticlesStats() {
  // Try cached version first for better performance
  const { data: cachedData, error: cachedError } = await supabaseAdmin.rpc('get_cached_admin_articles_stats')
  
  if (!cachedError && cachedData) {
    return cachedData
  }
  
  // Fallback to non-cached version
  const { data, error } = await supabaseAdmin.rpc('get_admin_articles_stats')
  
  if (error) {
    console.error('Articles stats RPC error:', error)
    throw error
  }
  
  return data
}

async function handleArticlesAnalytics(searchParams: URLSearchParams) {
  const dateFilter = searchParams.get('dateFilter') || '24h'
  
  const { data, error } = await supabaseAdmin.rpc('get_admin_articles_analytics', {
    p_date_filter: dateFilter
  })
  
  if (error) {
    console.error('Articles analytics RPC error:', error)
    throw error
  }
  
  return data
}

async function handleArticlesSearch(searchParams: URLSearchParams) {
  const query = searchParams.get('query') || searchParams.get('search')
  const limit = parseInt(searchParams.get('limit') || '20')
  
  if (!query || query.trim().length === 0) {
    return { 
      articles: [], 
      total: 0, 
      hasMore: false,
      query: '',
      usingMockData: false
    }
  }
  
  const { data, error } = await supabaseAdmin.rpc('search_admin_articles', {
    p_query: query.trim(),
    p_limit: limit
  })
  
  if (error) {
    console.error('Articles search RPC error:', error)
    throw error
  }
  
  return data
}

// POST endpoint for operations that modify data (future enhancement)
export async function POST(request: NextRequest) {
  try {
    const { operation, ...params } = await request.json()
    
    switch (operation) {
      case 'bulk_select':
        return NextResponse.json({ error: 'Bulk operations not yet implemented in RPC mode' }, { status: 501 })
      case 'bulk_delete':
        return NextResponse.json({ error: 'Bulk operations not yet implemented in RPC mode' }, { status: 501 })
      default:
        return NextResponse.json({ error: 'Invalid POST operation' }, { status: 400 })
    }
  } catch (error) {
    console.error('Articles POST error:', error)
    return NextResponse.json(
      { error: 'Failed to process request', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}