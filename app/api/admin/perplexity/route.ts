import { type NextRequest, NextResponse } from "next/server"
import { getPerplexityNews, getPerplexityNewsByCategory, getPerplexityNewsByCategoryAdmin } from "@/lib/supabase-server"

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const category = searchParams.get("category")
    const status = searchParams.get("status")
    const search = searchParams.get("search")
    const page = parseInt(searchParams.get("page") || "0")
    const limit = parseInt(searchParams.get("limit") || "20")

    console.log("Admin Perplexity API called with params:", {
      category,
      status,
      search,
      page,
      limit
    })

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

    if (status && status !== "all") {
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
    console.error("Error in admin perplexity API:", error)
    return NextResponse.json(
      { 
        error: "Failed to fetch articles", 
        debug: error.message 
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, articleIds, data } = body

    console.log("Admin Perplexity POST action:", action, "articleIds:", articleIds)

    switch (action) {
      case "regenerate":
        // Trigger regeneration for specific articles
        // This would typically call the enrichment cron job for specific articles
        return NextResponse.json({ 
          message: "Regeneration triggered", 
          articleIds,
          debug: "Regeneration functionality not yet implemented"
        })

      case "delete":
        // Delete articles (soft delete recommended)
        return NextResponse.json({ 
          message: "Articles deleted", 
          articleIds,
          debug: "Delete functionality not yet implemented"
        })

      case "update":
        // Update article data
        return NextResponse.json({ 
          message: "Article updated", 
          data,
          debug: "Update functionality not yet implemented"
        })

      default:
        return NextResponse.json(
          { error: "Unknown action", action },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error("Error in admin perplexity POST:", error)
    return NextResponse.json(
      { 
        error: "Failed to process request", 
        debug: error.message 
      },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, updates } = body

    console.log("Admin Perplexity PUT for article:", id, "updates:", updates)

    // Update specific article
    // This would typically update the perplexity_news table
    return NextResponse.json({ 
      message: "Article updated", 
      id,
      updates,
      debug: "Update functionality not yet implemented"
    })
  } catch (error) {
    console.error("Error in admin perplexity PUT:", error)
    return NextResponse.json(
      { 
        error: "Failed to update article", 
        debug: error.message 
      },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json(
        { error: "Article ID required" },
        { status: 400 }
      )
    }

    console.log("Admin Perplexity DELETE for article:", id)

    // Delete specific article
    // This would typically soft delete from perplexity_news table
    return NextResponse.json({ 
      message: "Article deleted", 
      id,
      debug: "Delete functionality not yet implemented"
    })
  } catch (error) {
    console.error("Error in admin perplexity DELETE:", error)
    return NextResponse.json(
      { 
        error: "Failed to delete article", 
        debug: error.message 
      },
      { status: 500 }
    )
  }
}