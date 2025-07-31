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
    // Search both tables directly for suggestions
    const [unifiedResult, legacyResult] = await Promise.all([
      // Search articles_unified table
      supabase
        .from('articles_unified')
        .select('title, contextual_data')
        .eq('category', 'cars')
        .or(`title.ilike.%${query}%,contextual_data->>make.ilike.%${query}%,contextual_data->>model.ilike.%${query}%`)
        .limit(limit * 2),
      
      // Search articles table (legacy)
      supabase
        .from('articles')
        .select('title, make, model')
        .eq('category', 'cars')
        .or(`title.ilike.%${query}%,make.ilike.%${query}%,model.ilike.%${query}%`)
        .limit(limit)
    ]);

    // Extract suggestions from both tables
    const suggestions = new Map();
    
    // Process unified table results
    (unifiedResult.data || []).forEach(car => {
      const make = car.contextual_data?.make;
      const model = car.contextual_data?.model;
      
      if (make && make.toLowerCase().includes(query.toLowerCase())) {
        const key = make.toUpperCase();
        suggestions.set(key, {
          text: key,
          type: 'make',
          count: (suggestions.get(key)?.count || 0) + 1
        });
      }
      
      if (model && model.toLowerCase().includes(query.toLowerCase())) {
        const key = model.toUpperCase();
        suggestions.set(key, {
          text: key,
          type: 'model',
          count: (suggestions.get(key)?.count || 0) + 1
        });
      }
    });

    // Process legacy table results
    (legacyResult.data || []).forEach(car => {
      if (car.make && car.make.toLowerCase().includes(query.toLowerCase())) {
        const key = car.make.toUpperCase();
        suggestions.set(key, {
          text: key,
          type: 'make',
          count: (suggestions.get(key)?.count || 0) + 1
        });
      }
      
      if (car.model && car.model.toLowerCase().includes(query.toLowerCase())) {
        const key = car.model.toUpperCase();
        suggestions.set(key, {
          text: key,
          type: 'model',
          count: (suggestions.get(key)?.count || 0) + 1
        });
      }
    });

    // Transform suggestions to include display text
    const transformedSuggestions = Array.from(suggestions.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, limit)
      .map(item => ({
        text: item.text,
        type: item.type,
        count: item.count,
        display: `${item.text} (${item.count})`
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