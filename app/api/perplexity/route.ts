import { type NextRequest, NextResponse } from "next/server"
import { getPerplexityNews, checkPerplexityNewsTableSetup, supabaseAdmin } from "@/lib/supabase-server"
import type { PerplexityArticle } from "@/lib/types"

export const dynamic = 'force-dynamic'

// Mock Perplexity news data as fallback
const mockPerplexityNews: PerplexityArticle[] = [
  {
    id: "ppl-1",
    title: "Hong Kong Government Unveils 2024 Digital Governance Initiative",
    category: "politics",
    url: "https://example.com/hk-digital-governance-2024",
    published_at: "2024-01-15T10:30:00Z",
    inserted_at: "2024-01-15T10:32:00Z",
    created_at: "2024-01-15T10:32:00Z",
    updated_at: "2024-01-15T10:32:00Z",
    article_status: "ready",
    image_status: "ready",
    article_html: "<p>The Hong Kong government has announced a comprehensive digital governance initiative for 2024, focusing on streamlining public services and enhancing citizen engagement through technology.</p><p>The initiative includes plans for a unified digital identity system, online service portals, and AI-powered citizen support services.</p>",
    lede: "The Hong Kong government has announced a comprehensive digital governance initiative for 2024, focusing on streamlining public services and enhancing citizen engagement through technology.",
    image_url: "https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?w=800&h=400&fit=crop",
    image_license: "Unsplash License - Photo by Unsplash",
    source: "Perplexity AI",
    author: "AI Generated",
    perplexity_model: "sonar-pro",
    generation_cost: 0.0001,
  },
  {
    id: "ppl-2",
    title: "Legislative Council Passes New Climate Action Framework",
    category: "politics", 
    url: "https://example.com/hk-climate-action-framework",
    published_at: "2024-01-15T09:15:00Z",
    inserted_at: "2024-01-15T09:17:00Z",
    created_at: "2024-01-15T09:17:00Z",
    updated_at: "2024-01-15T09:17:00Z",
    article_status: "ready",
    image_status: "ready",
    article_html: "<p>Hong Kong's Legislative Council has unanimously passed a new climate action framework aimed at achieving carbon neutrality by 2050.</p><p>The framework includes ambitious targets for renewable energy adoption, green building standards, and sustainable transportation initiatives.</p>",
    lede: "Hong Kong's Legislative Council has unanimously passed a new climate action framework aimed at achieving carbon neutrality by 2050.",
    image_url: "https://images.unsplash.com/photo-1569163139394-de4e4f43e4e3?w=800&h=400&fit=crop",
    image_license: "Unsplash License - Photo by Unsplash",
    source: "Perplexity AI",
    author: "AI Generated",
    perplexity_model: "sonar-pro",
    generation_cost: 0.0001,
  },
  {
    id: "ppl-3",
    title: "Hong Kong Stock Exchange Launches New Tech Board for Startups",
    category: "business",
    url: "https://example.com/hkex-tech-board-startups",
    published_at: "2024-01-15T11:20:00Z",
    inserted_at: "2024-01-15T11:22:00Z",
    created_at: "2024-01-15T11:22:00Z",
    updated_at: "2024-01-15T11:22:00Z",
    article_status: "ready",
    image_status: "ready",
    article_html: "<p>The Hong Kong Stock Exchange has officially launched a new technology board designed to attract innovative startups and provide easier access to capital markets.</p><p>The new board features streamlined listing requirements and enhanced support for technology companies seeking growth capital.</p>",
    lede: "The Hong Kong Stock Exchange has officially launched a new technology board designed to attract innovative startups and provide easier access to capital markets.",
    image_url: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&h=400&fit=crop",
    image_license: "Unsplash License - Photo by Unsplash",
    source: "Perplexity AI",
    author: "AI Generated",
    perplexity_model: "sonar-pro",
    generation_cost: 0.0001,
  },
  {
    id: "ppl-4",
    title: "Hong Kong Unveils AI Research Hub at Science Park",
    category: "tech",
    url: "https://example.com/hk-ai-research-hub-science-park",
    published_at: "2024-01-15T12:30:00Z",
    inserted_at: "2024-01-15T12:32:00Z",
    created_at: "2024-01-15T12:32:00Z",
    updated_at: "2024-01-15T12:32:00Z",
    article_status: "ready",
    image_status: "ready",
    article_html: "<p>Hong Kong Science Park has unveiled a state-of-the-art AI research hub, bringing together leading universities, tech companies, and government agencies to advance artificial intelligence development.</p><p>The facility will focus on applications in healthcare, finance, and smart city technologies, positioning Hong Kong as a regional AI innovation center.</p>",
    lede: "Hong Kong Science Park has unveiled a state-of-the-art AI research hub, bringing together leading universities, tech companies, and government agencies to advance artificial intelligence development.",
    image_url: "https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=800&h=400&fit=crop",
    image_license: "Unsplash License - Photo by Unsplash",
    source: "Perplexity AI",
    author: "AI Generated",
    perplexity_model: "sonar-pro",
    generation_cost: 0.0001,
  },
  {
    id: "ppl-5",
    title: "Hong Kong Fintech Week Attracts Record Investment",
    category: "business",
    url: "https://example.com/hk-fintech-week-investment",
    published_at: "2024-01-15T08:00:00Z",
    inserted_at: "2024-01-15T08:02:00Z",
    created_at: "2024-01-15T08:02:00Z",
    updated_at: "2024-01-15T08:02:00Z",
    article_status: "ready",
    image_status: "ready",
    article_html: "<p>Hong Kong Fintech Week has concluded with record-breaking investment announcements totaling over $2 billion in new fintech ventures.</p><p>The event showcased innovative solutions in digital payments, blockchain technology, and regulatory technology, reinforcing Hong Kong's position as a global fintech hub.</p>",
    lede: "Hong Kong Fintech Week has concluded with record-breaking investment announcements totaling over $2 billion in new fintech ventures.",
    image_url: "https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=800&h=400&fit=crop",
    image_license: "Unsplash License - Photo by Unsplash",
    source: "Perplexity AI",
    author: "AI Generated",
    perplexity_model: "sonar-pro",
    generation_cost: 0.0001,
  },
  {
    id: "ppl-6",
    title: "Hong Kong Health Department Launches Mental Health Initiative",
    category: "health",
    url: "https://example.com/hk-mental-health-initiative",
    published_at: "2024-01-15T07:30:00Z",
    inserted_at: "2024-01-15T07:32:00Z",
    created_at: "2024-01-15T07:32:00Z",
    updated_at: "2024-01-15T07:32:00Z",
    article_status: "ready",
    image_status: "ready",
    article_html: "<p>The Hong Kong Health Department has launched a comprehensive mental health initiative aimed at addressing the growing mental health needs of the population.</p><p>The program includes increased funding for mental health services, new community support centers, and expanded access to mental health professionals.</p>",
    lede: "The Hong Kong Health Department has launched a comprehensive mental health initiative aimed at addressing the growing mental health needs of the population.",
    image_url: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1f?w=800&h=400&fit=crop",
    image_license: "Unsplash License - Photo by Unsplash",
    source: "Perplexity AI",
    author: "AI Generated",
    perplexity_model: "sonar-pro",
    generation_cost: 0.0001,
  }
]

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const page = Number.parseInt(searchParams.get("page") || "0")
    const limit = 10

    console.log(`Perplexity API called for page: ${page}`)

    // Check if Perplexity news table is set up
    const isTableReady = await checkPerplexityNewsTableSetup()
    console.log("Perplexity news table ready status:", isTableReady)

    if (!isTableReady) {
      console.warn("Perplexity news table not set up, using mock data")
      
      const startIndex = page * limit
      const endIndex = startIndex + limit
      const paginatedArticles = mockPerplexityNews.slice(startIndex, endIndex)

      return NextResponse.json({
        articles: paginatedArticles,
        nextPage: endIndex < mockPerplexityNews.length ? page + 1 : null,
        usingMockData: true,
        debug: "Perplexity news table not set up, using mock data",
      })
    }

    console.log("Fetching Perplexity news from database...")

    // Use proper offset-based pagination with stable ordering
    // Sort by updated_at to show most recently enriched articles first
    const { data: articles, error } = await supabaseAdmin
      .from("perplexity_news")
      .select("*")
      .eq("article_status", "ready")
      .order("updated_at", { ascending: false })
      .order("id", { ascending: false }) // Secondary sort by ID for stability
      .range(page * limit, (page + 1) * limit - 1)

    if (error) {
      console.error("Database query error:", error)
      throw error
    }

    console.log(`📊 Pagination Summary:`)
    console.log(`   Page: ${page}, Limit: ${limit}`)
    console.log(`   Range: ${page * limit} to ${(page + 1) * limit - 1}`)
    console.log(`   Fetched: ${articles?.length || 0} articles`)
    if (articles && articles.length > 0) {
      console.log(`   Latest article: "${articles[0].title}" (ID: ${articles[0].id}, updated: ${articles[0].updated_at})`)
      console.log(`   Oldest article: "${articles[articles.length - 1].title}" (ID: ${articles[articles.length - 1].id}, updated: ${articles[articles.length - 1].updated_at})`)
      console.log(`   🔄 Articles properly ordered by updated_at DESC - most recently updated first`)
    }

    // If no articles in database, fall back to mock data
    if (!articles || articles.length === 0) {
      console.warn("No Perplexity news in database, using mock data")
      const startIndex = page * limit
      const endIndex = startIndex + limit
      const paginatedArticles = mockPerplexityNews.slice(startIndex, endIndex)

      return NextResponse.json({
        articles: paginatedArticles,
        nextPage: endIndex < mockPerplexityNews.length ? page + 1 : null,
        usingMockData: true,
        debug: "No news found in database",
      })
    }

    // Check if there are more pages by fetching one more article at the next page start
    const { data: nextPageCheck } = await supabaseAdmin
      .from("perplexity_news")
      .select("id")
      .eq("article_status", "ready")
      .order("updated_at", { ascending: false })
      .order("id", { ascending: false }) // Same ordering as main query
      .range((page + 1) * limit, (page + 1) * limit)

    const hasNextPage = nextPageCheck && nextPageCheck.length > 0
    console.log(`📄 Pagination check: hasNextPage = ${hasNextPage} (checked offset ${(page + 1) * limit})`)

    return NextResponse.json({
      articles: articles,
      nextPage: hasNextPage ? page + 1 : null,
      usingMockData: false,
      debug: "Using real database data",
    })

  } catch (error) {
    console.error("Error fetching Perplexity news:", error)

    // Return mock data as fallback
    const searchParams = request.nextUrl.searchParams
    const page = Number.parseInt(searchParams.get("page") || "0")
    const limit = 10
    
    const startIndex = page * limit
    const endIndex = startIndex + limit
    const paginatedArticles = mockPerplexityNews.slice(startIndex, endIndex)

    return NextResponse.json({
      articles: paginatedArticles,
      nextPage: endIndex < mockPerplexityNews.length ? page + 1 : null,
      usingMockData: true,
      error: "Database connection failed, using mock data",
      debug: error instanceof Error ? error.message : "Unknown error",
    })
  }
}