import { createClient } from "@supabase/supabase-js"
import { autoProcessArticleImage } from "./image-processor"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
// Use service role key for server-side operations, anon key for client-side
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable')
}

if (!supabaseKey) {
  throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable')
}

export const supabase = createClient(supabaseUrl, supabaseKey)

export interface Article {
  id?: string
  title: string
  content: string
  summary: string
  ai_summary?: string
  url: string
  source: string
  author?: string
  published_at?: string
  image_url?: string
  image_metadata?: {
    original?: string
    optimized?: string
    whatsapp?: string
  }
  category?: string
  created_at?: string
  updated_at?: string
  is_ai_enhanced?: boolean
  original_article_id?: string
  enhancement_metadata?: {
    searchQueries: string[]
    sources: string[]
    relatedTopics: string[]
    enhancedAt: string
    enhancementCost?: string
  }
}

export async function saveArticle(article: Article) {
  try {
    // Check if article already exists by URL
    const { data: existing } = await supabase
      .from("articles")
      .select("id, title, created_at")
      .eq("url", article.url)
      .single()

    if (existing) {
      console.log(`⏭️  Article already exists (skipping): ${article.title}`)
      console.log(`   📅 Originally saved: ${new Date(existing.created_at).toLocaleString()}`)
      return { ...existing, skipped: true }
    }

    // Insert new article
    const { data, error } = await supabase
      .from("articles")
      .insert([
        {
          title: article.title,
          content: article.content,
          summary: article.summary,
          ai_summary: article.ai_summary,
          url: article.url,
          source: article.source,
          author: article.author,
          image_url: (article as any).imageUrl || article.image_url,
          category: article.category || "General",
          is_ai_enhanced: article.is_ai_enhanced || false,
          original_article_id: article.original_article_id,
          enhancement_metadata: article.enhancement_metadata,
        },
      ])
      .select()
      .single()

    if (error) {
      console.error("Error saving article:", error)
      throw error
    }

    console.log(`✅ Saved new article: ${article.title}`)
    
    // Auto-process image if article has one
    const imageUrl = (article as any).imageUrl || article.image_url
    if (imageUrl && data.id) {
      // Process image in background (don't await to avoid blocking)
      autoProcessArticleImage(data.id, imageUrl, 'articles').catch(error => {
        console.error(`Background image processing failed for article ${data.id}:`, error)
      })
    }
    
    return { ...data, skipped: false }
  } catch (error) {
    console.error("Error in saveArticle:", error)
    throw error
  }
}

export async function getArticleStats() {
  try {
    const { data, error } = await supabase
      .from("articles")
      .select("source, created_at")
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching article stats:", error)
      return null
    }

    const stats = {
      total: data.length,
      bySource: {},
      latest: data[0]?.created_at,
      oldest: data[data.length - 1]?.created_at,
    }

    // Count by source
    data.forEach((article) => {
      stats.bySource[article.source] = (stats.bySource[article.source] || 0) + 1
    })

    return stats
  } catch (error) {
    console.error("Error getting article stats:", error)
    return null
  }
}

// Balanced query function to ensure proportional representation from all sources
export async function getBalancedArticles(page = 0, limit = 10, filters?: { source?: string, isAiEnhanced?: boolean, language?: string, category?: string, hasEnrichment?: boolean, selectedForTtsBrief?: boolean }) {
  try {
    // If specific source or category filter is applied, use regular query
    if (filters?.source || filters?.category) {
      return getArticlesRegular(page, limit, filters)
    }

    // Define known sources and their desired proportions
    const sources = ['HK01', 'on.cc', 'SingTao', 'RTHK', 'HKFP', 'ONCC', 'am730', 'scmp', 'bloomberg', 'TheStandard']
    const articlesPerSource = Math.max(1, Math.floor(limit / sources.length))
    const extraArticles = limit % sources.length
    
    const allArticles = []
    
    // Get articles from each source proportionally with proper pagination
    for (let i = 0; i < sources.length; i++) {
      const source = sources[i]
      const sourceLimit = articlesPerSource + (i < extraArticles ? 1 : 0)
      
      let query = supabase
        .from("articles")
        .select("*")
        .in('source', [source, `${source} (AI Enhanced)`])
        .order("created_at", { ascending: false })
      
      // Apply AI enhanced filter if specified
      if (filters?.isAiEnhanced !== undefined) {
        query = query.eq('is_ai_enhanced', filters.isAiEnhanced)
      }
      
      // Apply language filter if specified - use only metadata (language column doesn't exist)
      if (filters?.language) {
        if (filters.language !== "en") {
          // For non-English languages, check metadata language
          query = query.eq('enhancement_metadata->>language', filters.language)
        } else {
          // For English, include articles where metadata shows 'en' OR metadata language is null/missing
          query = query.or(`enhancement_metadata->>language.eq.en,enhancement_metadata->>language.is.null`)
        }
      }
      
      // Use proper pagination with range instead of limit + slice
      const startIndex = sourceLimit * page
      const endIndex = startIndex + sourceLimit - 1
      
      const { data, error } = await query.range(startIndex, endIndex)
      
      if (!error && data) {
        allArticles.push(...data)
      }
    }
    
    // Sort the mixed articles by creation date (newest first)
    allArticles.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    
    return allArticles.slice(0, limit)
  } catch (error) {
    console.error("Error fetching balanced articles:", error)
    // Fallback to regular query
    return getArticlesRegular(page, limit, filters)
  }
}

// Original query function (renamed for clarity)
export async function getArticlesRegular(page = 0, limit = 10, filters?: { source?: string, isAiEnhanced?: boolean, language?: string, category?: string, hasEnrichment?: boolean, selectedForTtsBrief?: boolean }) {
  try {
    let query = supabase
      .from("articles")
      .select("*")
      .order("created_at", { ascending: false })
    
    // Apply filters if provided
    if (filters?.source) {
      query = query.eq('source', filters.source)
    }
    
    if (filters?.category) {
      query = query.eq('category', filters.category)
    }
    
    if (filters?.isAiEnhanced !== undefined) {
      query = query.eq('is_ai_enhanced', filters.isAiEnhanced)
    }
    
    // Apply TTS selection filter if specified
    if (filters?.selectedForTtsBrief !== undefined) {
      query = query.eq('selected_for_tts_brief', filters.selectedForTtsBrief)
    }
    
    // Apply language filter if specified
    if (filters?.language) {
      if (filters.language === "en" || filters.language === "zh-TW" || filters.language === "zh-CN") {
        // Use language_variant field for trilingual articles
        query = query.eq('language_variant', filters.language)
      } else if (filters.language !== "en") {
        // For other languages, check enhancement metadata language
        query = query.eq('enhancement_metadata->>language', filters.language)
      } else {
        // For English, include articles where metadata shows 'en' OR metadata language is null/missing
        query = query.or(`enhancement_metadata->>language.eq.en,enhancement_metadata->>language.is.null`)
      }
    }
    
    if (filters?.hasEnrichment !== undefined) {
      if (filters.hasEnrichment) {
        query = query.not('ai_summary', 'is', null)
      } else {
        query = query.is('ai_summary', null)
      }
    }
    
    const { data, error } = await query.range(page * limit, (page + 1) * limit - 1)

    if (error) {
      // If table doesn't exist, return empty array instead of throwing
      if (error.code === "42P01" || error.message.includes("does not exist")) {
        console.warn("Articles table does not exist. Please run the database setup.")
        return []
      }
      throw error
    }
    return data || []
  } catch (error) {
    console.error("Error fetching articles:", error)
    return []
  }
}

// Main export - use regular query for better pagination reliability
export async function getArticles(page = 0, limit = 10, filters?: { source?: string, isAiEnhanced?: boolean, language?: string, category?: string, hasEnrichment?: boolean, selectedForTtsBrief?: boolean }) {
  return getArticlesRegular(page, limit, filters)
}

export async function searchArticles(query: string) {
  try {
    const { data, error } = await supabase
      .from("articles")
      .select("*")
      .or(`title.ilike.%${query}%,summary.ilike.%${query}%,ai_summary.ilike.%${query}%`)
      .order("created_at", { ascending: false })
      .limit(20)

    if (error) {
      // If table doesn't exist, return empty array instead of throwing
      if (error.code === "42P01" || error.message.includes("does not exist")) {
        console.warn("Articles table does not exist. Please run the database setup.")
        return []
      }
      throw error
    }
    return data || []
  } catch (error) {
    console.error("Error searching articles:", error)
    return []
  }
}

export async function getArticleById(id: string) {
  try {
    console.log(`📍 getArticleById called with ID: ${id}`)
    
    const { data, error } = await supabase.from("articles").select("*").eq("id", id).single()

    if (error) {
      console.error(`❌ Error fetching article ${id}:`, error)
      
      // If not found, log sample IDs for debugging
      if (error.code === 'PGRST116') {
        const { data: sampleArticles } = await supabase
          .from("articles")
          .select("id")
          .limit(5)
        console.log("📋 Sample article IDs in database:", sampleArticles?.map(a => a.id))
      }
      
      // If table doesn't exist, return null instead of throwing
      if (error.code === "42P01" || error.message.includes("does not exist")) {
        console.warn("Articles table does not exist. Please run the database setup.")
        return null
      }
      throw error
    }
    
    console.log(`✅ Found article: ${data.title}`)
    return data
  } catch (error) {
    console.error("Error fetching article by ID:", error)
    return null
  }
}

// Function to get enhancement statistics
export async function getEnhancementStats() {
  try {
    const { data, error } = await supabase.rpc('get_enhancement_stats')
    
    if (error) {
      console.error('Error fetching enhancement stats:', error)
      return null
    }
    
    return data?.[0] || null
  } catch (error) {
    console.error('Error getting enhancement stats:', error)
    return null
  }
}

// Function to check if database is set up
export async function checkDatabaseSetup() {
  try {
    console.log("Checking database setup...")

    // Add timeout to prevent hanging requests
    const timeoutPromise = new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error('Database check timeout')), 3000)
    )

    // Try to select from articles table with timeout
    const dbPromise = supabase.from("articles").select("id").limit(1)
    
    const { data, error } = await Promise.race([dbPromise, timeoutPromise])

    console.log("Database check result:", { data, error })

    if (error) {
      console.error("Database check error:", error)
      // Check for specific error codes that indicate table doesn't exist
      if (
        error.code === "42P01" ||
        error.message.includes("does not exist") ||
        error.message.includes("relation") ||
        error.message.includes("table")
      ) {
        return false
      }
      // Check for RLS/permission errors (common after enabling Realtime)
      if (
        error.code === "42501" ||
        error.message.includes("permission denied") ||
        error.message.includes("RLS") ||
        error.message.includes("policy")
      ) {
        console.warn("Database exists but RLS policies may be blocking access")
        return false
      }
      // For other errors, assume table exists but there might be permission issues
      return true
    }

    console.log("Database setup check passed")
    return true
  } catch (error) {
    console.error("Database setup check failed:", error)
    // Handle timeout and other errors
    if (error.message === 'Database check timeout') {
      console.warn("Database check timed out - likely RLS policy issue")
    }
    return false
  }
}

export interface Headline {
  id?: string
  category: string
  title: string
  url: string
  source: string
  published_at: string
  created_at?: string
  image_url?: string
  author?: string
}

export async function saveHeadlines(headlines: Headline[]) {
  try {
    const { data, error } = await supabase
      .from("headlines")
      .insert(headlines)
      .select()

    if (error) {
      console.error("Error saving headlines:", error)
      throw error
    }

    console.log(`✅ Saved ${headlines.length} headlines`)
    return data
  } catch (error) {
    console.error("Error in saveHeadlines:", error)
    throw error
  }
}

export async function getHeadlines(category?: string) {
  try {
    let query = supabase
      .from("headlines")
      .select("*")
      .order("created_at", { ascending: false })

    if (category) {
      query = query.eq("category", category)
    }

    const { data, error } = await query

    if (error) {
      if (error.code === "42P01" || error.message.includes("does not exist")) {
        console.warn("Headlines table does not exist. Please run the database setup.")
        return []
      }
      throw error
    }

    return data || []
  } catch (error) {
    console.error("Error fetching headlines:", error)
    return []
  }
}

export async function getHeadlinesByCategory() {
  try {
    const { data, error } = await supabase
      .from("headlines")
      .select("*")
      .order("created_at", { ascending: false })

    if (error) {
      if (error.code === "42P01" || error.message.includes("does not exist")) {
        console.warn("Headlines table does not exist. Please run the database setup.")
        return {}
      }
      throw error
    }

    // Group headlines by category (max 10 per category)
    const groupedHeadlines = (data || []).reduce((acc, headline) => {
      if (!acc[headline.category]) {
        acc[headline.category] = []
      }
      if (acc[headline.category].length < 10) {
        acc[headline.category].push(headline)
      }
      return acc
    }, {} as Record<string, Headline[]>)

    return groupedHeadlines
  } catch (error) {
    console.error("Error fetching headlines by category:", error)
    return {}
  }
}

export async function cleanupOldHeadlines() {
  try {
    const { error } = await supabase
      .from("headlines")
      .delete()
      .lt("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())

    if (error) {
      console.error("Error cleaning up old headlines:", error)
      throw error
    }

    console.log("✅ Cleaned up old headlines")
  } catch (error) {
    console.error("Error in cleanupOldHeadlines:", error)
    throw error
  }
}

export async function checkHeadlinesTableSetup() {
  try {
    const { data, error } = await supabase
      .from("headlines")
      .select("id")
      .limit(1)

    if (error) {
      if (error.code === "42P01" || error.message.includes("does not exist")) {
        return false
      }
      throw error
    }

    return true
  } catch (error) {
    console.error("Headlines table setup check failed:", error)
    return false
  }
}

export interface PerplexityNews {
  id?: string
  category: string
  title: string
  title_en?: string
  url: string
  inserted_at?: string
  url_hash?: string
  article_status: 'pending' | 'enriched' | 'ready'
  article_html?: string
  lede?: string
  image_prompt?: string
  image_status: 'pending' | 'ready' | 'failed'
  image_url?: string
  image_license?: string
  
  // Enhanced structured content fields
  enhanced_title?: string
  summary?: string
  key_points?: string[]
  why_it_matters?: string
  structured_sources?: {
    citations: string[]
    sources: Array<{
      title: string
      url: string
      description?: string
      domain?: string
    }>
    generated_at: string
  }
  
  source?: string
  author?: string
  perplexity_model?: string
  generation_cost?: number
  search_queries?: string[]
  citations?: any
  created_at?: string
  updated_at?: string
}


export async function getPerplexityNews(category?: string, limit = 20) {
  try {
    let query = supabase
      .from("perplexity_news")
      .select("*")
      .eq("article_status", "ready")
      .order("updated_at", { ascending: false })

    if (category) {
      query = query.eq("category", category)
    }

    const { data, error } = await query.limit(limit)

    if (error) {
      if (error.code === "42P01" || error.message.includes("does not exist")) {
        console.warn("Perplexity news table does not exist. Please run the database setup.")
        return []
      }
      throw error
    }

    return data || []
  } catch (error) {
    console.error("Error fetching Perplexity news:", error)
    return []
  }
}

export async function getPerplexityNewsByCategory() {
  try {
    const { data, error } = await supabase
      .from("perplexity_news")
      .select("*")
      .eq("article_status", "ready")
      .order("updated_at", { ascending: false })

    if (error) {
      if (error.code === "42P01" || error.message.includes("does not exist")) {
        console.warn("Perplexity news table does not exist. Please run the database setup.")
        return {}
      }
      throw error
    }

    // Group by category (max 10 per category)
    const groupedNews = (data || []).reduce((acc, article) => {
      if (!acc[article.category]) {
        acc[article.category] = []
      }
      if (acc[article.category].length < 10) {
        acc[article.category].push(article)
      }
      return acc
    }, {} as Record<string, PerplexityNews[]>)

    return groupedNews
  } catch (error) {
    console.error("Error fetching Perplexity news by category:", error)
    return {}
  }
}

export async function checkPerplexityNewsTableSetup() {
  try {
    const { data, error } = await supabase
      .from("perplexity_news")
      .select("id")
      .limit(1)

    if (error) {
      if (error.code === "42P01" || error.message.includes("does not exist")) {
        return false
      }
      throw error
    }

    return true
  } catch (error) {
    console.error("Perplexity news table setup check failed:", error)
    return false
  }
}
