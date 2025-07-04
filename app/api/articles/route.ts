import { type NextRequest, NextResponse } from "next/server"
import { getArticles, checkDatabaseSetup } from "@/lib/supabase"

export const dynamic = 'force-dynamic'

// Mock data as fallback
const mockArticles = [
  {
    id: "1",
    title: "AI Revolution: How Machine Learning is Transforming Healthcare",
    summary:
      "Artificial intelligence is revolutionizing healthcare with breakthrough applications in diagnosis, treatment planning, and drug discovery. Recent studies show AI can detect diseases earlier than traditional methods.",
    content:
      "The healthcare industry is experiencing a paradigm shift as artificial intelligence technologies become increasingly sophisticated and accessible...",
    url: "https://example.com/ai-healthcare",
    source: "TechHealth Today",
    publishedAt: "2024-01-15T10:30:00Z",
    imageUrl: "/placeholder.svg?height=200&width=300",
    category: "Technology",
    readTime: 5,
  },
  {
    id: "2",
    title: "Climate Change: New Carbon Capture Technology Shows Promise",
    summary:
      "Scientists have developed a revolutionary carbon capture system that could remove millions of tons of CO2 from the atmosphere annually. The technology uses advanced materials to trap carbon efficiently.",
    content:
      "A breakthrough in carbon capture technology has emerged from research laboratories, offering new hope in the fight against climate change...",
    url: "https://example.com/carbon-capture",
    source: "Environmental Science Weekly",
    publishedAt: "2024-01-14T14:20:00Z",
    imageUrl: "/placeholder.svg?height=200&width=300",
    category: "Science",
    readTime: 4,
  },
  {
    id: "3",
    title: "Cryptocurrency Market Sees Major Institutional Adoption",
    summary:
      "Major financial institutions are increasingly adopting cryptocurrency solutions, with several banks announcing new digital asset services. This marks a significant shift in traditional finance.",
    content:
      "The cryptocurrency landscape is evolving rapidly as traditional financial institutions embrace digital assets...",
    url: "https://example.com/crypto-adoption",
    source: "Financial Times",
    publishedAt: "2024-01-13T09:15:00Z",
    imageUrl: "/placeholder.svg?height=200&width=300",
    category: "Finance",
    readTime: 3,
  },
]

// Add better logging and debugging for the articles API
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const page = Number.parseInt(searchParams.get("page") || "0")
    const limit = 10

    console.log("Articles API called, checking database setup...")

    // Check if database is set up with more detailed logging
    const isDatabaseReady = await checkDatabaseSetup()
    console.log("Database ready status:", isDatabaseReady)

    if (!isDatabaseReady) {
      console.warn("Database not set up, using mock data")
      // Return mock data with pagination
      const startIndex = page * limit
      const endIndex = startIndex + limit
      const paginatedArticles = mockArticles.slice(startIndex, endIndex)

      return NextResponse.json({
        articles: paginatedArticles,
        nextPage: endIndex < mockArticles.length ? page + 1 : null,
        usingMockData: true,
        debug: "Database setup check failed",
      })
    }

    console.log("Fetching articles from database...")
    const articles = await getArticles(page, limit)
    console.log(`Fetched ${articles.length} articles from database`)

    // If no articles in database, fall back to mock data
    if (articles.length === 0 && page === 0) {
      console.warn("No articles in database, using mock data")
      return NextResponse.json({
        articles: mockArticles.slice(0, limit),
        nextPage: null,
        usingMockData: true,
        debug: "No articles found in database",
      })
    }

    // Transform to match frontend interface
    const transformedArticles = articles.map((article) => ({
      id: article.id,
      title: article.title,
      summary: article.ai_summary || article.summary,
      content: article.content,
      url: article.url,
      source: article.source,
      publishedAt: article.published_at || article.created_at,
      imageUrl: article.image_url || "/placeholder.svg?height=200&width=300",
      category: article.category || "General",
      readTime: Math.ceil((article.content?.length || 0) / 200) || 3,
      isAiEnhanced: article.is_ai_enhanced || false,
      originalArticleId: article.original_article_id,
      enhancementMetadata: article.enhancement_metadata
    }))

    console.log("Returning real articles from database")
    return NextResponse.json({
      articles: transformedArticles,
      nextPage: transformedArticles.length === limit ? page + 1 : null,
      usingMockData: false,
      debug: "Using real database data",
    })
  } catch (error) {
    console.error("Error fetching articles:", error)

    // Return mock data as fallback
    const searchParams = request.nextUrl.searchParams
    const page = Number.parseInt(searchParams.get("page") || "0")
    const limit = 10
    const startIndex = page * limit
    const endIndex = startIndex + limit
    const paginatedArticles = mockArticles.slice(startIndex, endIndex)

    return NextResponse.json({
      articles: paginatedArticles,
      nextPage: endIndex < mockArticles.length ? page + 1 : null,
      usingMockData: true,
      error: "Database connection failed, using mock data",
      debug: error.message,
    })
  }
}
