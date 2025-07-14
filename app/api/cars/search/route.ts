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

// Calculate search relevance rank
function calculateRank(car: any, query: string): number {
  const queryLower = query.toLowerCase();
  let rank = 0;

  // Title match (highest priority)
  if (car.title?.toLowerCase().includes(queryLower)) {
    rank += 1.0;
  }

  // Make/model match (high priority)
  const make = car.contextual_data?.make || car.make || '';
  const model = car.contextual_data?.model || car.model || '';
  
  if (make.toLowerCase().includes(queryLower)) {
    rank += 0.9;
  }
  if (model.toLowerCase().includes(queryLower)) {
    rank += 0.9;
  }

  // Content match (lower priority)
  if (car.content?.toLowerCase().includes(queryLower)) {
    rank += 0.6;
  }

  return rank;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q') || '';
  const limit = Math.min(parseInt(searchParams.get('limit') || '30'), 100);
  const offset = Math.max(parseInt(searchParams.get('offset') || '0'), 0);

  try {
    // Search both tables directly since the RPC function only searches articles table
    let allCars = [];

    if (query && query.trim()) {
      // Search articles_unified table (where most cars are)
      const { data: unifiedCars, error: unifiedError } = await supabase
        .from('articles_unified')
        .select('id, title, contextual_data, image_url, images, url, published_at, content')
        .eq('category', 'cars')
        .or(`title.ilike.%${query}%,content.ilike.%${query}%`)
        .order('published_at', { ascending: false })
        .range(0, limit * 2); // Get more to allow for ranking

      // Search articles table (legacy cars)
      const { data: legacyCars, error: legacyError } = await supabase
        .from('articles')
        .select('id, title, make, model, specs, image_url, url, created_at, content')
        .eq('category', 'cars')
        .or(`title.ilike.%${query}%,make.ilike.%${query}%,model.ilike.%${query}%,content.ilike.%${query}%`)
        .order('created_at', { ascending: false })
        .range(0, limit);

      // Transform unified cars
      const transformedUnified = (unifiedCars || []).map((car: any) => ({
        id: car.id,
        title: car.title,
        make: car.contextual_data?.make || '',
        model: car.contextual_data?.model || '',
        price: car.contextual_data?.price || '',
        year: car.contextual_data?.year || '',
        imageUrl: car.image_url,
        images: car.images,
        url: car.url,
        publishedAt: car.published_at,
        specs: car.contextual_data || {},
        source: '28car',
        category: 'cars',
        rank: calculateRank(car, query)
      }));

      // Transform legacy cars
      const transformedLegacy = (legacyCars || []).map((car: any) => ({
        id: car.id,
        title: car.title,
        make: car.make || '',
        model: car.model || '',
        price: car.specs?.price || car.specs?.['售價'] || '',
        year: car.specs?.year || car.specs?.['年份'] || '',
        imageUrl: car.image_url,
        images: car.image_url ? [car.image_url] : [],
        url: car.url,
        publishedAt: car.created_at,
        specs: car.specs || {},
        source: '28car',
        category: 'cars',
        rank: calculateRank(car, query)
      }));

      // Combine and sort by rank
      allCars = [...transformedUnified, ...transformedLegacy]
        .sort((a, b) => b.rank - a.rank)
        .slice(offset, offset + limit);

    } else {
      // If no query, fall back to the original RPC function for general listing
      const { data: cars, error } = await supabase
        .rpc('search_car_listings', {
          search_query: null,
          result_limit: limit,
          result_offset: offset
        });

      if (error) {
        console.error('Car search error:', error);
        return NextResponse.json(
          { 
            error: 'Search failed', 
            details: error.message,
            cars: [],
            totalCount: 0,
            hasMore: false
          },
          { status: 500 }
        );
      }

      // Transform legacy cars for no-query case
      allCars = (cars || []).map((car: any) => ({
        id: car.id,
        title: car.title,
        make: car.make,
        model: car.model,
        price: car.price,
        year: car.year,
        imageUrl: car.image_url,
        images: car.images,
        url: car.url,
        publishedAt: car.created_at,
        specs: car.specs,
        source: '28car',
        category: 'cars',
        rank: car.rank || 0
      }));
    }

    // Calculate if there are more results
    const hasMore = allCars.length === limit;

    return NextResponse.json({
      cars: allCars,
      totalCount: allCars.length,
      hasMore,
      nextOffset: hasMore ? offset + limit : null,
      query,
      debug: {
        source: 'database',
        searchTerm: query,
        limit,
        offset,
        resultsReturned: allCars.length,
        searchedBothTables: query.trim().length > 0
      }
    });

  } catch (error) {
    console.error('Car search API error:', error);
    
    // Return mock data as fallback
    const mockCars = [
      {
        id: 'mock-1',
        title: 'TOYOTA ALPHARD',
        make: 'TOYOTA',
        model: 'ALPHARD',
        price: 'HK$850,000',
        year: '2023',
        imageUrl: '/placeholder.jpg',
        images: [],
        url: '#',
        publishedAt: new Date().toISOString(),
        specs: {},
        source: '28car',
        category: 'cars',
        rank: 1.0
      }
    ];

    return NextResponse.json({
      cars: query ? [] : mockCars,
      totalCount: query ? 0 : mockCars.length,
      hasMore: false,
      nextOffset: null,
      query,
      debug: {
        source: 'mock',
        error: error instanceof Error ? error.message : 'Unknown error',
        searchTerm: query
      }
    });
  }
}