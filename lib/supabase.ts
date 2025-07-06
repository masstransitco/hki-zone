import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

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
          published_at: article.published_at,
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
export async function getBalancedArticles(page = 0, limit = 10, filters?: { source?: string, isAiEnhanced?: boolean }) {
  try {
    // If specific source filter is applied, use regular query
    if (filters?.source) {
      return getArticlesRegular(page, limit, filters)
    }

    // Define known sources and their desired proportions
    const sources = ['HK01', 'on.cc', 'SingTao', 'RTHK', 'HKFP', 'ONCC']
    const articlesPerSource = Math.max(1, Math.floor(limit / sources.length))
    const extraArticles = limit % sources.length
    
    const allArticles = []
    
    // Get articles from each source proportionally
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
      
      const { data, error } = await query.limit(sourceLimit * (page + 1))
      
      if (!error && data) {
        // Skip articles for previous pages and take only what we need for current page
        const startIndex = sourceLimit * page
        const sourceArticles = data.slice(startIndex, startIndex + sourceLimit)
        allArticles.push(...sourceArticles)
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
export async function getArticlesRegular(page = 0, limit = 10, filters?: { source?: string, isAiEnhanced?: boolean }) {
  try {
    let query = supabase
      .from("articles")
      .select("*")
      .order("created_at", { ascending: false })
    
    // Apply filters if provided
    if (filters?.source) {
      query = query.eq('source', filters.source)
    }
    
    if (filters?.isAiEnhanced !== undefined) {
      query = query.eq('is_ai_enhanced', filters.isAiEnhanced)
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

// Main export - use balanced query by default
export async function getArticles(page = 0, limit = 10, filters?: { source?: string, isAiEnhanced?: boolean }) {
  return getBalancedArticles(page, limit, filters)
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
    const { data, error } = await supabase.from("articles").select("*").eq("id", id).single()

    if (error) {
      // If table doesn't exist, return null instead of throwing
      if (error.code === "42P01" || error.message.includes("does not exist")) {
        console.warn("Articles table does not exist. Please run the database setup.")
        return null
      }
      throw error
    }
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
