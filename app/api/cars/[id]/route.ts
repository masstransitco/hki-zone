import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const dynamic = 'force-dynamic'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Check if we have credentials
if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in cars/[id] API')
}

const supabase = createClient(supabaseUrl, supabaseKey)

// Mock car data for fallback
const mockCar = {
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
  specs: {
    make: "BMW",
    model: "X5 xDrive40i",
    year: "2022",
    price: "HK$850,000"
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    console.log(`🔍 Cars/[id] API: Fetching car with ID: ${id}`)

    // Try unified table first (preferred for new system)
    try {
      const { data: unifiedCar, error: unifiedError } = await supabase
        .from('articles_unified')
        .select('*')
        .eq('id', id)
        .eq('category', 'cars')
        .single()

      if (!unifiedError && unifiedCar) {
        console.log(`✅ Found car in articles_unified: ${unifiedCar.title}`)
        
        const transformedCar = {
          id: unifiedCar.id,
          title: unifiedCar.title,
          content: unifiedCar.content,
          summary: unifiedCar.summary || unifiedCar.content?.substring(0, 200),
          url: unifiedCar.url,
          source: unifiedCar.source,
          author: unifiedCar.author,
          imageUrl: unifiedCar.image_url,
          images: unifiedCar.images || (unifiedCar.image_url ? [unifiedCar.image_url] : []),
          category: unifiedCar.category,
          publishedAt: unifiedCar.published_at,
          specs: unifiedCar.contextual_data?.specs || {},
          make: unifiedCar.contextual_data?.make,
          model: unifiedCar.contextual_data?.model,
          year: unifiedCar.contextual_data?.year,
          price: unifiedCar.contextual_data?.price,
        }

        return NextResponse.json(transformedCar)
      }
    } catch (error) {
      console.log(`⚠️ articles_unified failed for ${id}, trying articles table`)
    }

    // Fall back to old articles table
    const { data: car, error } = await supabase
      .from('articles')
      .select('*')
      .eq('id', id)
      .eq('category', 'cars')
      .single()

    if (!error && car) {
      console.log(`✅ Found car in articles table: ${car.title}`)
      
      const transformedCar = {
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
        ai_summary: car.ai_summary,
      }

      return NextResponse.json(transformedCar)
    }

    console.log(`❌ Car not found in database for ID: ${id}`)

    // Return mock data if not found
    if (id === mockCar.id) {
      console.log(`🔄 Returning mock car data for ID: ${id}`)
      return NextResponse.json({
        ...mockCar,
        usingMockData: true,
        debug: { source: 'mock', reason: 'not_found_in_database' }
      })
    }

    return NextResponse.json(
      { error: "Car not found", id },
      { status: 404 }
    )

  } catch (error) {
    console.error("Cars/[id] API error:", error)
    
    return NextResponse.json({
      ...mockCar,
      usingMockData: true,
      debug: { source: 'mock', error: 'API error' }
    })
  }
}