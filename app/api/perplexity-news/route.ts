import { type NextRequest, NextResponse } from "next/server"
import { getPerplexityNewsByCategory, getPerplexityNews, checkPerplexityNewsTableSetup } from "@/lib/supabase-server"

export const dynamic = 'force-dynamic'

// Mock Perplexity news data as fallback
const mockPerplexityNews = {
  "politics": [
    {
      id: "ppl-1",
      category: "politics",
      title: "Hong Kong Government Unveils 2024 Digital Governance Initiative",
      url: "https://example.com/hk-digital-governance-2024",
      published_at: "2024-01-15T10:30:00Z",
      inserted_at: "2024-01-15T10:32:00Z",
      article_status: "ready",
      article_html: "<p>The Hong Kong government has announced a comprehensive digital governance initiative for 2024, focusing on streamlining public services and enhancing citizen engagement through technology.</p><p>The initiative includes plans for a unified digital identity system, online service portals, and AI-powered citizen support services.</p>",
      lede: "The Hong Kong government has announced a comprehensive digital governance initiative for 2024, focusing on streamlining public services and enhancing citizen engagement through technology.",
      image_status: "ready",
      image_url: "https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?w=800&h=400&fit=crop",
      image_license: "Unsplash License - Photo by Unsplash",
      source: "Perplexity AI",
      author: "AI Generated",
      perplexity_model: "sonar-pro",
      generation_cost: 0.0001,
      created_at: "2024-01-15T10:32:00Z"
    },
    {
      id: "ppl-2", 
      category: "politics",
      title: "Legislative Council Passes New Climate Action Framework",
      url: "https://example.com/hk-climate-action-framework",
      published_at: "2024-01-15T09:15:00Z",
      inserted_at: "2024-01-15T09:17:00Z",
      article_status: "ready",
      article_html: "<p>Hong Kong's Legislative Council has unanimously passed a new climate action framework aimed at achieving carbon neutrality by 2050.</p><p>The framework includes ambitious targets for renewable energy adoption, green building standards, and sustainable transportation initiatives.</p>",
      lede: "Hong Kong's Legislative Council has unanimously passed a new climate action framework aimed at achieving carbon neutrality by 2050.",
      image_status: "ready",
      image_url: "https://images.unsplash.com/photo-1569163139394-de4e4f43e4e3?w=800&h=400&fit=crop",
      image_license: "Unsplash License - Photo by Unsplash",
      source: "Perplexity AI",
      author: "AI Generated",
      perplexity_model: "sonar-pro",
      generation_cost: 0.0001,
      created_at: "2024-01-15T09:17:00Z"
    }
  ],
  "business": [
    {
      id: "ppl-3",
      category: "business",
      title: "Hong Kong Stock Exchange Launches New Tech Board for Startups",
      url: "https://example.com/hkex-tech-board-startups",
      published_at: "2024-01-15T11:20:00Z",
      inserted_at: "2024-01-15T11:22:00Z",
      article_status: "ready",
      article_html: "<p>The Hong Kong Stock Exchange has officially launched a new technology board designed to attract innovative startups and provide easier access to capital markets.</p><p>The new board features streamlined listing requirements and enhanced support for technology companies seeking growth capital.</p>",
      lede: "The Hong Kong Stock Exchange has officially launched a new technology board designed to attract innovative startups and provide easier access to capital markets.",
      image_status: "ready",
      image_url: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&h=400&fit=crop",
      image_license: "Unsplash License - Photo by Unsplash",
      source: "Perplexity AI",
      author: "AI Generated",
      perplexity_model: "sonar-pro",
      generation_cost: 0.0001,
      created_at: "2024-01-15T11:22:00Z"
    }
  ],
  "tech": [
    {
      id: "ppl-4",
      category: "tech",
      title: "Hong Kong Unveils AI Research Hub at Science Park",
      url: "https://example.com/hk-ai-research-hub-science-park",
      published_at: "2024-01-15T12:30:00Z",
      inserted_at: "2024-01-15T12:32:00Z",
      article_status: "ready",
      article_html: "<p>Hong Kong Science Park has unveiled a state-of-the-art AI research hub, bringing together leading universities, tech companies, and government agencies to advance artificial intelligence development.</p><p>The facility will focus on applications in healthcare, finance, and smart city technologies, positioning Hong Kong as a regional AI innovation center.</p>",
      lede: "Hong Kong Science Park has unveiled a state-of-the-art AI research hub, bringing together leading universities, tech companies, and government agencies to advance artificial intelligence development.",
      image_status: "ready",
      image_url: "https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=800&h=400&fit=crop",
      image_license: "Unsplash License - Photo by Unsplash",
      source: "Perplexity AI",
      author: "AI Generated",
      perplexity_model: "sonar-pro",
      generation_cost: 0.0001,
      created_at: "2024-01-15T12:32:00Z"
    }
  ]
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const category = searchParams.get("category")

    console.log("Perplexity news API called, checking database setup...")

    // Check if Perplexity news table is set up
    const isTableReady = await checkPerplexityNewsTableSetup()
    console.log("Perplexity news table ready status:", isTableReady)

    if (!isTableReady) {
      console.warn("Perplexity news table not set up, using mock data")
      
      if (category) {
        return NextResponse.json({
          news: mockPerplexityNews[category] || [],
          usingMockData: true,
          debug: "Perplexity news table not set up, using mock data for category: " + category,
        })
      }

      return NextResponse.json({
        news: mockPerplexityNews,
        usingMockData: true,
        debug: "Perplexity news table not set up, using mock data",
      })
    }

    console.log("Fetching Perplexity news from database...")

    if (category) {
      // Get news for specific category
      const news = await getPerplexityNews(category, 20)
      console.log(`Fetched ${news.length} articles for category: ${category}`)

      return NextResponse.json({
        news,
        usingMockData: false,
        debug: "Using real database data for category: " + category,
      })
    } else {
      // Get news grouped by category
      const newsGrouped = await getPerplexityNewsByCategory()
      console.log(`Fetched news grouped by categories:`, Object.keys(newsGrouped))

      // If no news in database, fall back to mock data
      if (Object.keys(newsGrouped).length === 0) {
        console.warn("No Perplexity news in database, using mock data")
        return NextResponse.json({
          news: mockPerplexityNews,
          usingMockData: true,
          debug: "No news found in database",
        })
      }

      return NextResponse.json({
        news: newsGrouped,
        usingMockData: false,
        debug: "Using real database data",
      })
    }
  } catch (error) {
    console.error("Error fetching Perplexity news:", error)

    // Return mock data as fallback
    const searchParams = request.nextUrl.searchParams
    const category = searchParams.get("category")

    return NextResponse.json({
      news: category ? mockPerplexityNews[category] || [] : mockPerplexityNews,
      usingMockData: true,
      error: "Database connection failed, using mock data",
      debug: error.message,
    })
  }
}