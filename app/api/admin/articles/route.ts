import { type NextRequest, NextResponse } from "next/server"
import { getArticles, searchArticles, checkDatabaseSetup } from "@/lib/supabase"

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const page = Number.parseInt(searchParams.get("page") || "0")
    const limit = Number.parseInt(searchParams.get("limit") || "20")
    const source = searchParams.get("source")
    const search = searchParams.get("search")
    const category = searchParams.get("category")
    const language = searchParams.get("language")
    const aiEnhanced = searchParams.get("aiEnhanced")

    console.log("Admin articles API called with params:", { page, limit, source, search, category, language, aiEnhanced })

    // Check if database is set up
    const isDatabaseReady = await checkDatabaseSetup()
    if (!isDatabaseReady) {
      return NextResponse.json({
        articles: [],
        hasMore: false,
        total: 0,
        usingMockData: true,
        error: "Database not set up"
      })
    }

    let articles = []

    // If search query is provided, use search function
    if (search && search.trim()) {
      articles = await searchArticles(search)
      // Apply additional filters to search results
      if (source && source !== "all") {
        articles = articles.filter(article => article.source === source)
      }
      if (category && category !== "all") {
        articles = articles.filter(article => article.category === category)
      }
      if (language && language !== "all") {
        articles = articles.filter(article => {
          const articleLang = article.enhancement_metadata?.language || 'en'
          return articleLang === language
        })
      }
      if (aiEnhanced && aiEnhanced !== "all") {
        articles = articles.filter(article => {
          const isEnhanced = article.is_ai_enhanced || false
          return aiEnhanced === "true" ? isEnhanced : !isEnhanced
        })
      }
    } else {
      // Get articles with pagination
      const offset = page * limit
      articles = await getArticlesWithFilters({ 
        offset, 
        limit: limit + 1, // Get one extra to check if there are more
        source: source !== "all" ? source : undefined,
        category: category !== "all" ? category : undefined,
        language: language !== "all" ? language : undefined,
        aiEnhanced: aiEnhanced !== "all" ? aiEnhanced : undefined
      })
    }

    // Check if there are more articles
    const hasMore = articles.length > limit
    if (hasMore) {
      articles = articles.slice(0, limit) // Remove the extra article
    }

    // Transform articles to match frontend interface
    const transformedArticles = articles.map((article) => ({
      id: article.id,
      title: article.title,
      summary: article.ai_summary || article.summary,
      content: article.content,
      url: article.url,
      source: article.source,
      author: article.author,
      publishedAt: article.published_at || article.created_at,
      imageUrl: article.image_url || "/placeholder.svg?height=200&width=300",
      category: article.category || "General",
      readTime: Math.ceil((article.content?.length || 0) / 200) || 3,
      isAiEnhanced: article.is_ai_enhanced || false,
      language: article.enhancement_metadata?.language || 'en',
      enhancementMetadata: article.enhancement_metadata,
    }))

    return NextResponse.json({
      articles: transformedArticles,
      hasMore,
      total: transformedArticles.length,
      page,
      limit,
      usingMockData: false,
    })

  } catch (error) {
    console.error("Error in admin articles API:", error)
    
    return NextResponse.json({
      articles: [],
      hasMore: false,
      total: 0,
      error: "Failed to fetch articles",
      usingMockData: true,
    }, { status: 500 })
  }
}

// Helper function to get articles with filters
async function getArticlesWithFilters({
  offset = 0,
  limit = 20,
  source,
  category,
  language,
  aiEnhanced
}: {
  offset?: number
  limit?: number
  source?: string
  category?: string
  language?: string
  aiEnhanced?: string
}) {
  try {
    const { supabase } = await import("@/lib/supabase")
    
    let query = supabase
      .from("articles")
      .select("*")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1)

    if (source) {
      query = query.eq("source", source)
    }
    
    if (category) {
      query = query.eq("category", category)
    }
    
    if (language) {
      // Use metadata-based language filtering (same logic as Topics API)
      if (language !== "en") {
        query = query.eq('enhancement_metadata->>language', language)
      } else {
        query = query.or(`enhancement_metadata->>language.eq.en,enhancement_metadata->>language.is.null`)
      }
    }
    
    if (aiEnhanced) {
      const isEnhanced = aiEnhanced === "true"
      query = query.eq("is_ai_enhanced", isEnhanced)
    }

    const { data, error } = await query

    if (error) {
      console.error("Error fetching filtered articles:", error)
      return []
    }

    return data || []
  } catch (error) {
    console.error("Error in getArticlesWithFilters:", error)
    return []
  }
}