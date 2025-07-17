import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const dynamic = 'force-dynamic'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Check if we have credentials
if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in cars API')
}

const supabase = createClient(supabaseUrl, supabaseKey)

// Mock car data with images for fallback
const mockCars = [
  {
    id: "car-1",
    title: "BMW X5 xDrive40i",
    price: "HK$850,000",
    summary: "Luxury SUV with excellent condition, full service history, and premium features.",
    content: "Make: BMW, Model: X5 xDrive40i, Year: 2022, Price: HK$850,000, Engine: 3.0L Turbo, Transmission: Automatic, Fuel: Petrol, Doors: 5, Color: Black, Mileage: 15,000 km",
    url: "https://m.28car.com/sell_dsp.php?h_vid=example1",
    source: "28car",
    publishedAt: new Date().toISOString(),
    imageUrl: "https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=800&h=400&fit=crop",
    images: [
      "https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=800&h=400&fit=crop",
      "https://images.unsplash.com/photo-1555626906-fcf10d6851b4?w=800&h=400&fit=crop",
      "https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?w=800&h=400&fit=crop",
      "https://images.unsplash.com/photo-1606220945770-b5b6c2c55bf1?w=800&h=400&fit=crop"
    ],
    category: "cars",
  },
  {
    id: "car-2", 
    title: "Toyota ALPHARD 2.5 Z",
    price: "HK$588,000 減價 [原價$628,000]",
    summary: "Premium MPV with luxury interior and advanced safety features.",
    content: "Make: Toyota, Model: ALPHARD 2.5 Z, Year: 2023, Price: HK$588,000 減價 [原價$628,000], Engine: 2.5L Hybrid, Transmission: CVT, Fuel: Hybrid, Doors: 4, Color: White, Mileage: 8,000 km",
    url: "https://m.28car.com/sell_dsp.php?h_vid=example2",
    source: "28car",
    publishedAt: new Date(Date.now() - 1800000).toISOString(),
    imageUrl: "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=800&h=400&fit=crop",
    images: [
      "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=800&h=400&fit=crop",
      "https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?w=800&h=400&fit=crop",
      "https://images.unsplash.com/photo-1549521462-5c6b92d0ff9a?w=800&h=400&fit=crop"
    ],
    category: "cars",
  },
  {
    id: "car-3",
    title: "Mercedes-Benz G300 CDI",
    price: "HK$419,000 減價 [原價$458,000]",
    summary: "Iconic G-Class with robust performance and luxurious appointments.",
    content: "Make: Mercedes-Benz, Model: G300 CDI, Year: 2021, Price: HK$419,000 減價 [原價$458,000], Engine: 3.0L Diesel, Transmission: Automatic, Fuel: Diesel, Doors: 5, Color: Silver, Mileage: 25,000 km",
    url: "https://m.28car.com/sell_dsp.php?h_vid=example3",
    source: "28car",
    publishedAt: new Date(Date.now() - 3600000).toISOString(),
    imageUrl: "https://images.unsplash.com/photo-1563720223185-11003d516935?w=800&h=400&fit=crop",
    images: [
      "https://images.unsplash.com/photo-1563720223185-11003d516935?w=800&h=400&fit=crop",
      "https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?w=800&h=400&fit=crop",
      "https://images.unsplash.com/photo-1567818735868-e71b99932e29?w=800&h=400&fit=crop",
      "https://images.unsplash.com/photo-1609521263047-f8f205293f24?w=800&h=400&fit=crop",
      "https://images.unsplash.com/photo-1606611013016-969c19ba0d15?w=800&h=400&fit=crop"
    ],
    category: "cars",
  },
]

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const page = Number.parseInt(searchParams.get("page") || "0")
    const limit = 10
    const offset = page * limit

    console.log(`Cars API: Fetching page ${page} from both tables`)

    // Get cars from both tables
    const [unifiedResult, oldResult] = await Promise.all([
      // Get from articles_unified
      supabase
        .from("articles_unified")
        .select("id, title, content, summary, url, source, author, image_url, images, category, published_at, contextual_data, spec_year, spec_fuel_type, spec_seats, spec_engine_cc, spec_transmission, spec_formatted_display")
        .eq("category", "cars")
        .order("published_at", { ascending: false }),
      
      // Get from articles (old table)
      supabase
        .from("articles")
        .select("id, title, content, summary, ai_summary, url, source, author, image_url, category, created_at")
        .eq("category", "cars")
        .order("created_at", { ascending: false })
    ])

    if (unifiedResult.error && oldResult.error) {
      console.error("Database errors:", unifiedResult.error, oldResult.error)
      
      // Return mock data if database fails
      const paginatedMocks = mockCars.slice(offset, offset + limit)
      return NextResponse.json({
        articles: paginatedMocks.map(car => ({
          ...car,
          publishedAt: car.publishedAt,
          imageUrl: car.imageUrl,
        })),
        nextPage: paginatedMocks.length === limit ? page + 1 : null,
        hasMore: offset + limit < mockCars.length,
        totalCount: mockCars.length,
        debug: {
          source: 'mock',
          error: 'Database error'
        }
      })
    }

    // Transform and combine results
    const unifiedCars = (unifiedResult.data || []).map(car => ({
      id: car.id,
      title: car.title,
      content: car.content,
      summary: car.summary || car.content?.substring(0, 200),
      url: car.url,
      source: car.source,
      author: car.author,
      imageUrl: car.image_url,
      images: car.images || (car.image_url ? [car.image_url] : []),
      category: car.category,
      publishedAt: car.published_at,
      specs: car.contextual_data?.specs || {},
      make: car.contextual_data?.make,
      model: car.contextual_data?.model,
      year: car.contextual_data?.year || car.spec_year,
      price: car.contextual_data?.price,
      // Add parsed specification fields
      specYear: car.spec_year,
      specFuelType: car.spec_fuel_type,
      specSeats: car.spec_seats,
      specEngineCC: car.spec_engine_cc,
      specTransmission: car.spec_transmission,
      specFormattedDisplay: car.spec_formatted_display,
      _source: 'unified'
    }))

    const oldCars = (oldResult.data || []).map(car => ({
      id: car.id,
      title: car.title,
      content: car.content,
      summary: car.summary || car.ai_summary || car.content?.substring(0, 200),
      url: car.url,
      source: car.source,
      author: car.author,
      imageUrl: car.image_url,
      images: car.image_url ? [car.image_url] : [],
      category: car.category,
      publishedAt: car.created_at,
      _source: 'old'
    }))

    // Combine and sort by published date
    const allCars = [...unifiedCars, ...oldCars]
      .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    
    // Apply pagination
    const paginatedCars = allCars.slice(offset, offset + limit)
    
    console.log(`Found ${unifiedCars.length} cars in articles_unified`)
    console.log(`Found ${oldCars.length} cars in articles table`)
    console.log(`Total: ${allCars.length} cars, returning ${paginatedCars.length} for page ${page}`)

    // Get total counts
    const { count: unifiedCount } = await supabase
      .from("articles_unified")
      .select("*", { count: "exact", head: true })
      .eq("category", "cars")
    
    const { count: oldCount } = await supabase
      .from("articles")
      .select("*", { count: "exact", head: true })
      .eq("category", "cars")
    
    const totalCount = (unifiedCount || 0) + (oldCount || 0)
    const hasMore = offset + paginatedCars.length < totalCount

    return NextResponse.json({
      articles: paginatedCars.map(({ _source, ...car }) => car), // Remove internal _source field
      nextPage: hasMore ? page + 1 : null,
      hasMore,
      totalCount,
      debug: {
        source: 'database',
        counts: {
          unified: unifiedCount || 0,
          old: oldCount || 0,
          total: totalCount
        },
        page,
        offset,
        limit
      }
    })

  } catch (error) {
    console.error("Cars API error:", error)
    
    return NextResponse.json({
      articles: mockCars,
      nextPage: null,
      hasMore: false,
      debug: {
        source: 'mock',
        error: 'API error'
      }
    })
  }
}