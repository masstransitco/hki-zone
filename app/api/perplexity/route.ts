import { type NextRequest, NextResponse } from "next/server"
import { getPerplexityNews, getPerplexityNewsByCategoryAdmin } from "@/lib/supabase-server"

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const category = searchParams.get("category")
    const status = searchParams.get("status")
    const search = searchParams.get("search")
    const page = parseInt(searchParams.get("page") || "0")
    const limit = parseInt(searchParams.get("limit") || "20")

    // Fetch all articles for filtering
    let allArticles = []
    if (category && category !== "all") {
      allArticles = await getPerplexityNews(category, 1000)
    } else {
      const newsGrouped = await getPerplexityNewsByCategoryAdmin()
      allArticles = Object.values(newsGrouped).flat()
    }

    // Apply filters
    let filteredArticles = allArticles

    // For public view, only show ready or enriched articles by default
    if (!status || status === "all") {
      filteredArticles = filteredArticles.filter(article => 
        article.article_status === "ready" || article.article_status === "enriched"
      )
    } else {
      filteredArticles = filteredArticles.filter(article => article.article_status === status)
    }

    if (search) {
      const searchLower = search.toLowerCase()
      filteredArticles = filteredArticles.filter(article => 
        article.title.toLowerCase().includes(searchLower) ||
        article.lede?.toLowerCase().includes(searchLower)
      )
    }

    // Sort by creation date (newest first)
    filteredArticles.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    // Apply pagination
    const startIndex = page * limit
    const articles = filteredArticles.slice(startIndex, startIndex + limit + 1)
    
    // Check if there are more articles
    const hasMore = articles.length > limit
    const paginatedArticles = hasMore ? articles.slice(0, limit) : articles

    return NextResponse.json({
      articles: paginatedArticles,
      total: filteredArticles.length,
      page,
      limit,
      hasMore,
    })
  } catch (error) {
    console.error("Error in perplexity API:", error)
    return NextResponse.json(
      { 
        error: "Failed to fetch articles", 
        debug: error.message 
      },
      { status: 500 }
    )
  }
}