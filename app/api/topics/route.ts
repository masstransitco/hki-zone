import { type NextRequest, NextResponse } from "next/server"
import { getArticles, checkDatabaseSetup, supabase } from "@/lib/supabase"

export const dynamic = 'force-dynamic'

// Helper function to add cache control headers
function addCacheHeaders(response: NextResponse, articles: any[] = []) {
  // Determine freshness based on latest article
  const latestArticleTime = articles.length > 0 
    ? Math.max(...articles.map(a => new Date(a.publishedAt || a.created_at || 0).getTime()))
    : Date.now()
  
  const lastModified = new Date(latestArticleTime).toUTCString()
  const etag = `"topics-${articles.length}-${latestArticleTime}"`
  
  // No caching - articles update every minute, always serve fresh data
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
  response.headers.set('Pragma', 'no-cache')
  response.headers.set('Vary', 'Accept-Language, X-Lang, Cookie')
  response.headers.set('Last-Modified', lastModified)
  response.headers.set('ETag', etag)
  
  return response
}

// Mock AI-enhanced articles as fallback
const mockAiArticles = [
  {
    id: "ai-1",
    title: "AI Revolution: How Machine Learning is Transforming Healthcare",
    summary: "Artificial intelligence is revolutionizing healthcare with breakthrough applications in diagnosis, treatment planning, and drug discovery. Recent studies show AI can detect diseases earlier than traditional methods.",
    content: "The healthcare industry is experiencing a paradigm shift as artificial intelligence technologies become increasingly sophisticated and accessible...",
    url: "https://example.com/ai-healthcare",
    source: "TechHealth Today",
    publishedAt: "2024-01-15T10:30:00Z",
    imageUrl: "/placeholder.svg?height=200&width=300",
    category: "Technology",
    readTime: 5,
    isAiEnhanced: true,
    language: "en",
    enhancementMetadata: {
      searchQueries: ["AI in healthcare", "machine learning medical diagnosis"],
      sources: [
        {
          url: "https://example.com/ai-medical-research",
          title: "Medical AI Research Study",
          domain: "research.example.com",
          snippet: "AI shows 95% accuracy in early disease detection",
          accessedAt: "2024-01-15T10:00:00Z"
        }
      ],
      relatedTopics: ["healthcare", "artificial intelligence", "medical technology"],
      enhancedAt: "2024-01-15T10:30:00Z"
    }
  },
  {
    id: "ai-2",
    title: "氣候變化：新的碳捕獲技術顯示希望",
    summary: "科學家開發了一種革命性的碳捕獲系統，每年可以從大氣中清除數百萬噸二氧化碳。該技術使用先進材料高效地捕獲碳。",
    content: "氣候變化研究實驗室出現了碳捕獲技術的突破，為應對氣候變化提供了新的希望...",
    url: "https://example.com/carbon-capture-zh",
    source: "環境科學週刊",
    publishedAt: "2024-01-14T14:20:00Z",
    imageUrl: "/placeholder.svg?height=200&width=300",
    category: "Science",
    readTime: 4,
    isAiEnhanced: true,
    language: "zh-CN",
    enhancementMetadata: {
      searchQueries: ["碳捕獲技術", "氣候變化解決方案"],
      sources: [
        {
          url: "https://example.com/carbon-tech-research",
          title: "碳捕獲技術研究",
          domain: "tech.example.com",
          snippet: "新技術可捕獲90%的工業排放",
          accessedAt: "2024-01-14T14:00:00Z"
        }
      ],
      relatedTopics: ["climate change", "carbon capture", "environmental technology"],
      enhancedAt: "2024-01-14T14:20:00Z"
    }
  },
  {
    id: "ai-3",
    title: "加密貨幣市場見證重大機構採用",
    summary: "主要金融機構越來越多地採用加密貨幣解決方案，幾家銀行宣布新的數字資產服務。這標誌著傳統金融的重大轉變。",
    content: "隨著傳統金融機構擁抱數字資產，加密貨幣格局正在迅速發展...",
    url: "https://example.com/crypto-adoption-zh",
    source: "金融時報",
    publishedAt: "2024-01-13T09:15:00Z",
    imageUrl: "/placeholder.svg?height=200&width=300",
    category: "Finance",
    readTime: 3,
    isAiEnhanced: true,
    language: "zh-TW",
    enhancementMetadata: {
      searchQueries: ["加密貨幣機構採用", "數字資產銀行"],
      sources: [
        {
          url: "https://example.com/crypto-banks",
          title: "銀行數字資產服務",
          domain: "finance.example.com",
          snippet: "70%的大型銀行計劃提供加密服務",
          accessedAt: "2024-01-13T09:00:00Z"
        }
      ],
      relatedTopics: ["cryptocurrency", "financial institutions", "digital assets"],
      enhancedAt: "2024-01-13T09:15:00Z"
    }
  },
]

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const page = Number.parseInt(searchParams.get("page") || "0")
    const language = searchParams.get("language") || "en"
    const category = searchParams.get("category") // Category filter
    const limit = 10

    console.log(`Topics API called for language: ${language}, page: ${page}, category: ${category || 'all'}`)

    // Check if database is set up
    const isDatabaseReady = await checkDatabaseSetup()
    console.log("Database ready status:", isDatabaseReady)

    if (!isDatabaseReady) {
      console.warn("Database not set up, using mock AI-enhanced articles")
      // Filter mock articles by language and category
      const filteredMockArticles = mockAiArticles.filter(article => {
        const languageMatch = article.language === language
        const categoryMatch = !category || article.category === category
        return languageMatch && categoryMatch
      })
      
      const startIndex = page * limit
      const endIndex = startIndex + limit
      const paginatedArticles = filteredMockArticles.slice(startIndex, endIndex)

      const response = NextResponse.json({
        articles: paginatedArticles,
        nextPage: endIndex < filteredMockArticles.length ? page + 1 : null,
        usingMockData: true,
        debug: "Database setup check failed",
      })
      
      return addCacheHeaders(response, paginatedArticles)
    }

    console.log("Fetching AI-enhanced articles from database...")

    // Build query using proper language_variant column (indexed, reliable)
    try {
      let query = supabase
        .from("articles")
        .select("*")
        .eq('is_ai_enhanced', true)
        .is('deleted_at', null)
        .not('original_article_id', 'is', null) // Only enhanced versions
        .order("published_at", { ascending: false, nullsFirst: false })

      // Filter by language using language_variant column
      // This is the proper indexed column for language filtering
      query = query.eq('language_variant', language)

      // Filter by category
      if (category) {
        // Specific category selected
        query = query.eq('category', category)
      } else {
        // "Top Stories" feed = Top Stories + Local + General merged
        query = query.in('category', ['Top Stories', 'Local', 'General'])
      }

      const { data: articles, error } = await query.range(page * limit, (page + 1) * limit - 1)
      
      if (error) {
        console.error("Database query error:", error)
        throw error
      }
      
      console.log(`Fetched ${articles?.length || 0} AI-enhanced articles from database`)
      
      // If we got articles, continue with processing
      if (articles && articles.length > 0) {
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
          language: article.language_variant || article.enhancement_metadata?.language || language,
          originalArticleId: article.original_article_id,
          enhancementMetadata: article.enhancement_metadata
        }))

        console.log("Returning real AI-enhanced articles from database")
        console.log("Article IDs being returned:", transformedArticles.map(a => a.id))
        
        const response = NextResponse.json({
          articles: transformedArticles,
          nextPage: transformedArticles.length === limit ? page + 1 : null,
          usingMockData: false,
          debug: "Using real database data",
        })
        
        return addCacheHeaders(response, transformedArticles)
      }
    } catch (queryError) {
      console.error("Database query failed:", queryError)
      // Fall through to mock data fallback
    }

    // If no AI-enhanced articles in database, fall back to mock data
    console.warn("No AI-enhanced articles in database, using mock data")
    const filteredMockArticles = mockAiArticles.filter(article => {
      const languageMatch = article.language === language
      const categoryMatch = !category || article.category === category
      return languageMatch && categoryMatch
    })
    
    const response = NextResponse.json({
      articles: filteredMockArticles.slice(0, limit),
      nextPage: null,
      usingMockData: true,
      debug: "No AI-enhanced articles found in database",
    })
    
    return addCacheHeaders(response, filteredMockArticles.slice(0, limit))

  } catch (error) {
    console.error("Error fetching AI-enhanced articles:", error)

    // Return mock data as fallback
    const searchParams = request.nextUrl.searchParams
    const page = Number.parseInt(searchParams.get("page") || "0")
    const language = searchParams.get("language") || "en"
    const category = searchParams.get("category")
    const limit = 10
    
    const filteredMockArticles = mockAiArticles.filter(article => {
      const languageMatch = article.language === language
      const categoryMatch = !category || article.category === category
      return languageMatch && categoryMatch
    })
    
    const startIndex = page * limit
    const endIndex = startIndex + limit
    const paginatedArticles = filteredMockArticles.slice(startIndex, endIndex)

    const response = NextResponse.json({
      articles: paginatedArticles,
      nextPage: endIndex < filteredMockArticles.length ? page + 1 : null,
      usingMockData: true,
      error: "Database connection failed, using mock data",
      debug: error instanceof Error ? error.message : "Unknown error",
    })
    
    return addCacheHeaders(response, paginatedArticles)
  }
}