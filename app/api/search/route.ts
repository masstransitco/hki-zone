import { type NextRequest, NextResponse } from "next/server"
import { searchArticles, checkDatabaseSetup } from "@/lib/supabase"

// Mock search results as fallback
const mockSearchResults = [
  {
    id: "1",
    title: "AI Revolution: How Machine Learning is Transforming Healthcare",
    summary:
      "Artificial intelligence is revolutionizing healthcare with breakthrough applications in diagnosis, treatment planning, and drug discovery.",
    url: "https://example.com/ai-healthcare",
    source: "TechHealth Today",
    publishedAt: "2024-01-15T10:30:00Z",
    imageUrl: "/placeholder.svg?height=200&width=300",
    category: "Technology",
  },
]

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const query = searchParams.get("q")?.toLowerCase() || ""

    if (!query) {
      return NextResponse.json([])
    }

    // Check if database is set up
    const isDatabaseReady = await checkDatabaseSetup()

    if (!isDatabaseReady) {
      console.warn("Database not set up, using mock search results")
      // Simple mock search
      const results = mockSearchResults.filter(
        (article) =>
          article.title.toLowerCase().includes(query) ||
          article.summary.toLowerCase().includes(query) ||
          article.category.toLowerCase().includes(query),
      )
      return NextResponse.json(results)
    }

    const articles = await searchArticles(query)

    // Transform to match frontend interface
    const transformedArticles = articles.map((article) => ({
      id: article.id,
      title: article.title,
      summary: article.ai_summary || article.summary,
      url: article.url,
      source: article.source,
      publishedAt: article.published_at || article.created_at,
      imageUrl: article.image_url || "/placeholder.svg?height=200&width=300",
      category: article.category || "General",
    }))

    return NextResponse.json(transformedArticles)
  } catch (error) {
    console.error("Error searching articles:", error)

    // Return mock search results as fallback
    const searchParams = request.nextUrl.searchParams
    const query = searchParams.get("q")?.toLowerCase() || ""

    const results = mockSearchResults.filter(
      (article) =>
        article.title.toLowerCase().includes(query) ||
        article.summary.toLowerCase().includes(query) ||
        article.category.toLowerCase().includes(query),
    )

    return NextResponse.json(results)
  }
}
