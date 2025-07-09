import { type NextRequest, NextResponse } from "next/server"
import { getHeadlinesByCategory, checkHeadlinesTableSetup } from "@/lib/supabase"

export const dynamic = 'force-dynamic'

// Mock headlines data based on news-curation.md categories
const mockHeadlines = {
  "Politics": [
    {
      id: "1",
      category: "Politics",
      title: "Legislative Council Discusses New Housing Policy Framework",
      url: "https://example.com/politics/housing-policy",
      source: "HKFP",
      published_at: "2024-01-15T10:30:00Z",
      created_at: "2024-01-15T10:35:00Z",
      image_url: "/placeholder.svg?height=200&width=300",
      author: "Political Reporter"
    },
    {
      id: "2",
      category: "Politics",
      title: "Chief Executive Announces Budget Consultation Timeline",
      url: "https://example.com/politics/budget-consultation",
      source: "RTHK",
      published_at: "2024-01-15T09:20:00Z",
      created_at: "2024-01-15T09:25:00Z",
      image_url: "/placeholder.svg?height=200&width=300",
      author: "Government Reporter"
    },
    {
      id: "3",
      category: "Politics",
      title: "District Council Elections: New Candidate Registration Process",
      url: "https://example.com/politics/dc-elections",
      source: "SingTao",
      published_at: "2024-01-15T08:45:00Z",
      created_at: "2024-01-15T08:50:00Z",
      image_url: "/placeholder.svg?height=200&width=300",
      author: "Election Reporter"
    }
  ],
  "Economy": [
    {
      id: "4",
      category: "Economy",
      title: "Hong Kong Property Prices Show Slight Decline in December",
      url: "https://example.com/economy/property-prices",
      source: "HK01",
      published_at: "2024-01-15T11:00:00Z",
      created_at: "2024-01-15T11:05:00Z",
      image_url: "/placeholder.svg?height=200&width=300",
      author: "Finance Reporter"
    },
    {
      id: "5",
      category: "Economy",
      title: "Stock Market Opens Higher on Positive Economic Data",
      url: "https://example.com/economy/stock-market",
      source: "ONCC",
      published_at: "2024-01-15T09:30:00Z",
      created_at: "2024-01-15T09:35:00Z",
      image_url: "/placeholder.svg?height=200&width=300",
      author: "Market Analyst"
    }
  ],
  "Crime": [
    {
      id: "6",
      category: "Crime",
      title: "Police Arrest Three in Cross-Border Smuggling Operation",
      url: "https://example.com/crime/smuggling-arrest",
      source: "ONCC",
      published_at: "2024-01-15T12:15:00Z",
      created_at: "2024-01-15T12:20:00Z",
      image_url: "/placeholder.svg?height=200&width=300",
      author: "Crime Reporter"
    },
    {
      id: "7",
      category: "Crime",
      title: "Traffic Accident on Cross-Harbour Tunnel Causes Major Delays",
      url: "https://example.com/crime/traffic-accident",
      source: "RTHK",
      published_at: "2024-01-15T07:45:00Z",
      created_at: "2024-01-15T07:50:00Z",
      image_url: "/placeholder.svg?height=200&width=300",
      author: "Traffic Reporter"
    }
  ],
  "Lifestyle": [
    {
      id: "8",
      category: "Lifestyle",
      title: "New Michelin-Starred Restaurant Opens in Central District",
      url: "https://example.com/lifestyle/michelin-restaurant",
      source: "HK01",
      published_at: "2024-01-15T13:30:00Z",
      created_at: "2024-01-15T13:35:00Z",
      image_url: "/placeholder.svg?height=200&width=300",
      author: "Food Critic"
    },
    {
      id: "9",
      category: "Lifestyle",
      title: "Hong Kong Film Festival Announces 2024 Program Lineup",
      url: "https://example.com/lifestyle/film-festival",
      source: "SingTao",
      published_at: "2024-01-15T14:00:00Z",
      created_at: "2024-01-15T14:05:00Z",
      image_url: "/placeholder.svg?height=200&width=300",
      author: "Entertainment Reporter"
    }
  ],
  "Health": [
    {
      id: "10",
      category: "Health",
      title: "Hospital Authority Launches New Mental Health Support Program",
      url: "https://example.com/health/mental-health-program",
      source: "HKFP",
      published_at: "2024-01-15T15:20:00Z",
      created_at: "2024-01-15T15:25:00Z",
      image_url: "/placeholder.svg?height=200&width=300",
      author: "Health Reporter"
    }
  ],
  "International": [
    {
      id: "11",
      category: "International",
      title: "China-US Trade Relations Impact on Hong Kong's Financial Sector",
      url: "https://example.com/international/trade-impact",
      source: "HKFP",
      published_at: "2024-01-15T16:00:00Z",
      created_at: "2024-01-15T16:05:00Z",
      image_url: "/placeholder.svg?height=200&width=300",
      author: "International Correspondent"
    }
  ]
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const category = searchParams.get("category")

    console.log("Headlines API called, checking database setup...")

    // Check if headlines table is set up
    const isTableReady = await checkHeadlinesTableSetup()
    console.log("Headlines table ready status:", isTableReady)

    if (!isTableReady) {
      console.warn("Headlines table not set up, using mock data")
      
      if (category) {
        return NextResponse.json({
          headlines: mockHeadlines[category] || [],
          usingMockData: true,
          debug: "Headlines table not set up, using mock data for category: " + category,
        })
      }

      return NextResponse.json({
        headlines: mockHeadlines,
        usingMockData: true,
        debug: "Headlines table not set up, using mock data",
      })
    }

    console.log("Fetching headlines from database...")
    const headlines = await getHeadlinesByCategory()
    console.log(`Fetched headlines from database:`, Object.keys(headlines))

    // If no headlines in database, fall back to mock data
    if (Object.keys(headlines).length === 0) {
      console.warn("No headlines in database, using mock data")
      return NextResponse.json({
        headlines: category ? mockHeadlines[category] || [] : mockHeadlines,
        usingMockData: true,
        debug: "No headlines found in database",
      })
    }

    if (category) {
      return NextResponse.json({
        headlines: headlines[category] || [],
        usingMockData: false,
        debug: "Using real database data for category: " + category,
      })
    }

    console.log("Returning real headlines from database")
    return NextResponse.json({
      headlines,
      usingMockData: false,
      debug: "Using real database data",
    })
  } catch (error) {
    console.error("Error fetching headlines:", error)

    // Return mock data as fallback
    const searchParams = request.nextUrl.searchParams
    const category = searchParams.get("category")

    return NextResponse.json({
      headlines: category ? mockHeadlines[category] || [] : mockHeadlines,
      usingMockData: true,
      error: "Database connection failed, using mock data",
      debug: error.message,
    })
  }
}