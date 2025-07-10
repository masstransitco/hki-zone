import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable')
}

if (!supabaseServiceKey) {
  throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable')
}

// Server-only client with service role key for admin operations
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

// Re-export types and interfaces for convenience 
export * from './supabase'
import type { PerplexityNews } from './supabase'

// Server-side Perplexity functions that need admin privileges
export async function savePerplexityHeadlines(headlines: Omit<PerplexityNews, 'id' | 'created_at' | 'updated_at'>[]) {
  try {
    console.log(`💾 Attempting to save ${headlines.length} Perplexity headlines to database...`)
    
    // Log each headline being saved
    headlines.forEach((headline, i) => {
      console.log(`  ${i + 1}. [${headline.category}] ${headline.title}`)
      console.log(`     URL: ${headline.url}`)
      console.log(`     Status: ${headline.article_status}`)
    })

    // Insert headlines one by one to get accurate count of successful inserts
    const savedHeadlines = []
    const duplicateCount = []
    
    for (const headline of headlines) {
      try {
        // Remove published_at field if present (using only created_at/updated_at pattern)
        const { published_at, ...headlineData } = headline as any
        
        const { data, error } = await supabaseAdmin
          .from("perplexity_news")
          .insert(headlineData)
          .select()
          .single()

        if (error) {
          if (error.code === '23505') { // Unique constraint violation
            duplicateCount.push(headline.title)
          } else {
            console.error(`❌ Error saving headline "${headline.title}":`, error.message)
          }
        } else {
          savedHeadlines.push(data)
        }
      } catch (err) {
        console.error(`❌ Unexpected error saving headline "${headline.title}":`, err)
      }
    }

    console.log(`✅ Database operation completed:`)
    console.log(`  - Headlines generated: ${headlines.length}`)
    console.log(`  - Successfully saved: ${savedHeadlines.length}`)
    console.log(`  - Duplicates skipped: ${duplicateCount.length}`)
    
    if (savedHeadlines.length > 0) {
      console.log("📋 Saved headlines IDs:", savedHeadlines.map(h => h.id))
    }
    
    if (duplicateCount.length > 0) {
      console.log("🔄 Duplicate headlines skipped:", duplicateCount.slice(0, 3).map(title => `"${title}"`).join(", "))
    }

    return { data: savedHeadlines, count: savedHeadlines.length }
  } catch (error) {
    console.error("💥 Critical error in savePerplexityHeadlines:")
    console.error("  - Error type:", error.constructor.name)
    console.error("  - Error message:", error.message)
    console.error("  - Error stack:", error.stack)
    throw error
  }
}

export async function getPendingPerplexityNews(limit = 10) {
  try {
    console.log(`📊 getPendingPerplexityNews: Looking for up to ${limit} articles needing processing...`)
    const { data, error } = await supabaseAdmin
      .from("perplexity_news")
      .select("*")
      .or("article_status.eq.pending,image_status.eq.failed,image_status.eq.pending")
      .order("created_at", { ascending: true })
      .limit(limit)

    if (error) {
      if (error.code === "42P01" || error.message.includes("does not exist")) {
        console.warn("Perplexity news table does not exist. Please run the database setup.")
        return []
      }
      throw error
    }

    console.log(`📊 getPendingPerplexityNews: Found ${data?.length || 0} pending articles`)
    if (data?.length) {
      data.forEach((article, i) => {
        console.log(`  ${i + 1}. [${article.category}] ${article.title} (${article.article_status})`)
      })
    }

    return data || []
  } catch (error) {
    console.error("Error fetching pending Perplexity news:", error)
    return []
  }
}

export async function updatePerplexityArticle(id: string, updates: Partial<PerplexityNews>) {
  try {
    const { data, error } = await supabaseAdmin
      .from("perplexity_news")
      .update(updates)
      .eq("id", id)
      .select()
      .single()

    if (error) {
      // Check if the error is about missing enhanced fields
      if (error.code === 'PGRST204' && error.message.includes('enhanced_title')) {
        console.warn("⚠️  Enhanced fields not available in schema, using legacy fields only")
        
        // Filter out enhanced fields and retry with legacy fields only
        const legacyUpdates = Object.fromEntries(
          Object.entries(updates).filter(([key]) => 
            !['enhanced_title', 'summary', 'key_points', 'why_it_matters', 'structured_sources'].includes(key)
          )
        )
        
        if (Object.keys(legacyUpdates).length > 0) {
          console.log("🔄 Retrying with legacy fields only:", Object.keys(legacyUpdates))
          const { data: legacyData, error: legacyError } = await supabaseAdmin
            .from("perplexity_news")
            .update(legacyUpdates)
            .eq("id", id)
            .select()
            .single()
          
          if (legacyError) {
            console.error("Error updating with legacy fields:", legacyError)
            throw legacyError
          }
          
          return legacyData
        }
      }
      
      console.error("Error updating Perplexity article:", error)
      throw error
    }

    return data
  } catch (error) {
    console.error("Error in updatePerplexityArticle:", error)
    throw error
  }
}

export async function getPerplexityNews(category?: string, limit = 20) {
  try {
    let query = supabaseAdmin
      .from("perplexity_news")
      .select("*")
      .in("article_status", ["ready", "pending", "enriched"]) // Include all statuses for now
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

    console.log(`📊 getPerplexityNews: Found ${data?.length || 0} articles for category: ${category || 'all'}`)
    return data || []
  } catch (error) {
    console.error("Error fetching Perplexity news:", error)
    return []
  }
}

export async function getRecentPerplexityTitles(days = 7) {
  try {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - days)
    
    console.log(`📊 getRecentPerplexityTitles: Fetching titles from last ${days} days...`)
    const { data, error } = await supabaseAdmin
      .from("perplexity_news")
      .select("title, category")
      .gte("created_at", cutoffDate.toISOString())
      .order("created_at", { ascending: false })
    
    if (error) {
      if (error.code === "42P01" || error.message.includes("does not exist")) {
        console.warn("Perplexity news table does not exist. Please run the database setup.")
        return []
      }
      throw error
    }
    
    console.log(`📊 getRecentPerplexityTitles: Found ${data?.length || 0} recent titles`)
    return data || []
  } catch (error) {
    console.error("Error fetching recent Perplexity titles:", error)
    return []
  }
}

export async function getPerplexityNewsByCategory(limitPerCategory: number = 10) {
  try {
    console.log("📊 getPerplexityNewsByCategory: Fetching all articles...")
    const { data, error } = await supabaseAdmin
      .from("perplexity_news")
      .select("*")
      .in("article_status", ["ready", "pending", "enriched"]) // Include all statuses for now
      .neq("source", "Perplexity AI (Fallback)") // Exclude fallback articles
      .order("updated_at", { ascending: false })

    if (error) {
      if (error.code === "42P01" || error.message.includes("does not exist")) {
        console.warn("Perplexity news table does not exist. Please run the database setup.")
        return {}
      }
      throw error
    }

    console.log(`📊 getPerplexityNewsByCategory: Found ${data?.length || 0} total articles`)

    // Group by category with configurable limit
    const groupedNews = (data || []).reduce((acc, article) => {
      if (!acc[article.category]) {
        acc[article.category] = []
      }
      // Apply limit only if limitPerCategory > 0 (0 means no limit)
      if (limitPerCategory === 0 || acc[article.category].length < limitPerCategory) {
        acc[article.category].push(article)
      }
      return acc
    }, {} as Record<string, PerplexityNews[]>)

    console.log(`📊 getPerplexityNewsByCategory: Grouped into categories:`, Object.keys(groupedNews))
    Object.keys(groupedNews).forEach(cat => {
      console.log(`  - ${cat}: ${groupedNews[cat].length} articles`)
    })

    return groupedNews
  } catch (error) {
    console.error("Error fetching Perplexity news by category:", error)
    return {}
  }
}

export async function getPerplexityNewsByCategoryAdmin() {
  // Admin version with no per-category limit
  return getPerplexityNewsByCategory(0)
}

export async function checkPerplexityNewsTableSetup() {
  try {
    const { data, error } = await supabaseAdmin
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

// Image history tracking functions
export async function trackImageUsage(imageUrl: string, articleId: string, category: string, source: string, searchQuery?: string) {
  try {
    console.log(`📸 Tracking image usage: ${imageUrl} for article ${articleId}`)
    
    const { data, error } = await supabaseAdmin
      .from("perplexity_image_history")
      .insert({
        image_url: imageUrl,
        article_id: articleId,
        category,
        image_source: source,
        search_query: searchQuery
      })
      .select()
      .single()

    if (error) {
      // If it's a unique constraint violation, that's ok - image is already tracked
      if (error.code === '23505') {
        console.log(`ℹ️ Image already tracked for this article`)
        return null
      }
      console.error("Error tracking image usage:", error)
      throw error
    }

    return data
  } catch (error) {
    console.error("Error in trackImageUsage:", error)
    // Don't throw - image tracking shouldn't break the enrichment process
    return null
  }
}

export async function getRecentlyUsedImages(days = 30, category?: string) {
  try {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - days)
    
    let query = supabaseAdmin
      .from("perplexity_image_history")
      .select("image_url, image_source, category, used_at")
      .gte("used_at", cutoffDate.toISOString())
      .order("used_at", { ascending: false })
    
    if (category) {
      query = query.eq("category", category)
    }
    
    const { data, error } = await query

    if (error) {
      // If table doesn't exist yet, return empty array
      if (error.code === "42P01" || error.message.includes("does not exist")) {
        console.log("Image history table not yet created")
        return []
      }
      throw error
    }

    // Create a map of unique images with their usage count
    const imageMap = new Map<string, { source: string, count: number, lastUsed: Date }>()
    
    data?.forEach(record => {
      const key = record.image_url
      if (imageMap.has(key)) {
        const existing = imageMap.get(key)!
        existing.count++
        if (new Date(record.used_at) > existing.lastUsed) {
          existing.lastUsed = new Date(record.used_at)
        }
      } else {
        imageMap.set(key, {
          source: record.image_source,
          count: 1,
          lastUsed: new Date(record.used_at)
        })
      }
    })

    // Convert to array and sort by usage count and recency
    const recentImages = Array.from(imageMap.entries()).map(([url, info]) => ({
      image_url: url,
      image_source: info.source,
      used_count: info.count,
      last_used: info.lastUsed
    }))
    
    console.log(`📊 Found ${recentImages.length} unique images used in last ${days} days${category ? ` for category ${category}` : ''}`)
    
    return recentImages
  } catch (error) {
    console.error("Error fetching recently used images:", error)
    return []
  }
}

export async function isImageRecentlyUsed(imageUrl: string, days = 7): Promise<boolean> {
  try {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - days)
    
    const { data, error } = await supabaseAdmin
      .from("perplexity_image_history")
      .select("id")
      .eq("image_url", imageUrl)
      .gte("used_at", cutoffDate.toISOString())
      .limit(1)

    if (error) {
      // If table doesn't exist, return false
      if (error.code === "42P01" || error.message.includes("does not exist")) {
        return false
      }
      throw error
    }

    return (data?.length || 0) > 0
  } catch (error) {
    console.error("Error checking if image recently used:", error)
    return false
  }
}