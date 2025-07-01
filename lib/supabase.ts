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
  category?: string
  created_at?: string
  updated_at?: string
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
          image_url: article.image_url,
          category: article.category || "General",
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

export async function getArticles(page = 0, limit = 10) {
  try {
    const { data, error } = await supabase
      .from("articles")
      .select("*")
      .order("created_at", { ascending: false })
      .range(page * limit, (page + 1) * limit - 1)

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

// Function to check if database is set up
export async function checkDatabaseSetup() {
  try {
    console.log("Checking database setup...")

    // Try to select from articles table
    const { data, error } = await supabase.from("articles").select("id").limit(1)

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
      // For other errors, assume table exists but there might be permission issues
      return true
    }

    console.log("Database setup check passed")
    return true
  } catch (error) {
    console.error("Database setup check failed:", error)
    return false
  }
}
