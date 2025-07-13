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
  try {
    // Use the optimized filters function
    const { data: filters, error } = await supabase
      .rpc('get_car_filters');

    if (error) {
      console.error('Car filters error:', error);
      return NextResponse.json({
        makes: [],
        years: [],
        priceRanges: {},
        debug: { error: error.message, source: 'database_error' }
      });
    }

    const filterData = filters?.[0] || {};

    return NextResponse.json({
      makes: filterData.makes || [],
      years: filterData.years || [],
      priceRanges: filterData.price_ranges || {},
      debug: {
        source: 'database',
        makesCount: (filterData.makes || []).length,
        yearsCount: (filterData.years || []).length
      }
    });

  } catch (error) {
    console.error('Car filters API error:', error);
    
    // Return mock filters as fallback
    const mockFilters = {
      makes: [
        { value: 'TOYOTA', label: 'TOYOTA', count: 50 },
        { value: 'HONDA', label: 'HONDA', count: 35 },
        { value: 'BMW', label: 'BMW', count: 25 },
        { value: 'MERCEDES-BENZ', label: 'MERCEDES-BENZ', count: 20 },
        { value: 'AUDI', label: 'AUDI', count: 18 }
      ],
      years: [
        { value: '2024', label: '2024', count: 25 },
        { value: '2023', label: '2023', count: 45 },
        { value: '2022', label: '2022', count: 35 },
        { value: '2021', label: '2021', count: 30 },
        { value: '2020', label: '2020', count: 20 }
      ],
      priceRanges: {
        under_100k: 15,
        range_100_300k: 45,
        range_300_500k: 35,
        range_500k_1m: 25,
        over_1m: 8
      }
    };

    return NextResponse.json({
      ...mockFilters,
      debug: {
        source: 'mock',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    });
  }
}