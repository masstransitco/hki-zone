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
  const limit = Math.min(parseInt(searchParams.get('limit') || '30'), 100);
  const offset = Math.max(parseInt(searchParams.get('offset') || '0'), 0);

  try {
    // Use the optimized search function
    const { data: cars, error } = await supabase
      .rpc('search_car_listings', {
        search_query: query || null,
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

    // Transform the data to match the expected format
    const transformedCars = (cars || []).map((car: any) => ({
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
      rank: car.rank
    }));

    // Calculate if there are more results
    const hasMore = transformedCars.length === limit;

    return NextResponse.json({
      cars: transformedCars,
      totalCount: transformedCars.length,
      hasMore,
      nextOffset: hasMore ? offset + limit : null,
      query,
      debug: {
        source: 'database',
        searchTerm: query,
        limit,
        offset,
        resultsReturned: transformedCars.length
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