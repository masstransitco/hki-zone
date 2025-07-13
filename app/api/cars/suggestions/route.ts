import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client for server-side operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q') || '';
  const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 20);

  // Return empty suggestions for very short queries
  if (query.length < 2) {
    return NextResponse.json({
      suggestions: [],
      query,
      debug: { reason: 'Query too short' }
    });
  }

  try {
    // Use the optimized suggestions function
    const { data: suggestions, error } = await supabase
      .rpc('get_car_suggestions', {
        search_query: query,
        suggestion_limit: limit
      });

    if (error) {
      console.error('Car suggestions error:', error);
      return NextResponse.json({
        suggestions: [],
        query,
        debug: { error: error.message, source: 'database_error' }
      });
    }

    // Transform suggestions to include display text
    const transformedSuggestions = (suggestions || []).map((item: any) => ({
      text: item.suggestion,
      type: item.type,
      count: item.count,
      display: `${item.suggestion} (${item.count})`
    }));

    return NextResponse.json({
      suggestions: transformedSuggestions,
      query,
      debug: {
        source: 'database',
        resultsReturned: transformedSuggestions.length
      }
    });

  } catch (error) {
    console.error('Car suggestions API error:', error);
    
    // Return mock suggestions as fallback
    const mockSuggestions = query.toLowerCase().includes('toy') ? [
      { text: 'TOYOTA', type: 'make', count: 50, display: 'TOYOTA (50)' },
      { text: 'TOYOTA ALPHARD', type: 'model', count: 15, display: 'TOYOTA ALPHARD (15)' },
      { text: 'TOYOTA CAMRY', type: 'model', count: 8, display: 'TOYOTA CAMRY (8)' }
    ] : [];

    return NextResponse.json({
      suggestions: mockSuggestions,
      query,
      debug: {
        source: 'mock',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    });
  }
}