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
    // Get filter data from both tables directly
    const [unifiedResult, legacyResult] = await Promise.all([
      // Get data from articles_unified table
      supabase
        .from('articles_unified')
        .select('contextual_data, spec_year')
        .eq('category', 'cars'),
      
      // Get data from articles table (legacy)
      supabase
        .from('articles')
        .select('make, model, specs')
        .eq('category', 'cars')
    ]);

    // Process filter data
    const makesMap = new Map();
    const yearsMap = new Map();
    const priceRanges = {
      under_100k: 0,
      range_100_300k: 0,
      range_300_500k: 0,
      range_500k_1m: 0,
      over_1m: 0
    };

    // Process unified table results
    (unifiedResult.data || []).forEach(car => {
      const make = car.contextual_data?.make;
      const year = car.contextual_data?.year || car.spec_year;
      const price = car.contextual_data?.price;
      
      if (make) {
        const key = make.toUpperCase();
        makesMap.set(key, (makesMap.get(key) || 0) + 1);
      }
      
      if (year) {
        const yearStr = year.toString();
        yearsMap.set(yearStr, (yearsMap.get(yearStr) || 0) + 1);
      }
      
      if (price) {
        const priceNum = parseFloat(price.replace(/[^\d.]/g, ''));
        if (priceNum < 100000) priceRanges.under_100k++;
        else if (priceNum < 300000) priceRanges.range_100_300k++;
        else if (priceNum < 500000) priceRanges.range_300_500k++;
        else if (priceNum < 1000000) priceRanges.range_500k_1m++;
        else priceRanges.over_1m++;
      }
    });

    // Process legacy table results
    (legacyResult.data || []).forEach(car => {
      if (car.make) {
        const key = car.make.toUpperCase();
        makesMap.set(key, (makesMap.get(key) || 0) + 1);
      }
      
      const year = car.specs?.year || car.specs?.['年份'];
      if (year) {
        const yearStr = year.toString();
        yearsMap.set(yearStr, (yearsMap.get(yearStr) || 0) + 1);
      }
      
      const price = car.specs?.price || car.specs?.['售價'];
      if (price) {
        const priceNum = parseFloat(price.replace(/[^\d.]/g, ''));
        if (priceNum < 100000) priceRanges.under_100k++;
        else if (priceNum < 300000) priceRanges.range_100_300k++;
        else if (priceNum < 500000) priceRanges.range_300_500k++;
        else if (priceNum < 1000000) priceRanges.range_500k_1m++;
        else priceRanges.over_1m++;
      }
    });

    // Transform to expected format
    const makes = Array.from(makesMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([value, count]) => ({
        value,
        label: value,
        count
      }));

    const years = Array.from(yearsMap.entries())
      .sort((a, b) => parseInt(b[0]) - parseInt(a[0]))
      .map(([value, count]) => ({
        value,
        label: value,
        count
      }));

    return NextResponse.json({
      makes,
      years,
      priceRanges,
      debug: {
        source: 'database',
        makesCount: makes.length,
        yearsCount: years.length
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