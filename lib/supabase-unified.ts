import { supabaseAdmin } from "./supabase-server";
import type { 
  UnifiedArticle, 
  ArticleType, 
  ArticleStatus, 
  ProcessingStatus,
  ArticleQueryParams 
} from "./types/unified";

// Check if the unified articles table exists
export async function checkUnifiedTableSetup(): Promise<boolean> {
  try {
    const { error } = await supabaseAdmin
      .from("articles_unified")
      .select("id")
      .limit(1);
    
    if (error && (error.code === "42P01" || error.message.includes("does not exist"))) {
      console.warn("Unified articles table does not exist");
      return false;
    }
    
    return !error;
  } catch (error) {
    console.error("Error checking unified table setup:", error);
    return false;
  }
}

// Get articles with unified query interface
export async function getUnifiedArticles(params: ArticleQueryParams): Promise<{
  articles: UnifiedArticle[];
  totalCount: number;
  error?: any;
}> {
  try {
    let query = supabaseAdmin
      .from("articles_unified")
      .select("*", { count: "exact" });

    // Apply filters
    if (params.type && params.type !== "all") {
      query = query.eq("article_type", params.type);
    }

    if (params.category) {
      query = query.eq("category", params.category);
    }

    if (params.source) {
      query = query.eq("source", params.source);
    }

    if (params.status) {
      query = query.eq("status", params.status);
    }

    if (params.processingStatus) {
      query = query.eq("processing_status", params.processingStatus);
    }

    // Apply search
    if (params.search) {
      query = query.or(
        `title.ilike.%${params.search}%,summary.ilike.%${params.search}%,content.ilike.%${params.search}%`
      );
    }

    // Apply sorting (always use published_at for stable ordering)
    query = query.order("published_at", { ascending: false });
    query = query.order("id", { ascending: false }); // Secondary sort

    // Apply pagination
    const page = params.page || 0;
    const limit = params.limit || 10;
    const startRange = page * limit;
    const endRange = startRange + limit - 1;
    query = query.range(startRange, endRange);

    const { data, error, count } = await query;

    if (error) {
      console.error("Error fetching unified articles:", error);
      return { articles: [], totalCount: 0, error };
    }

    return {
      articles: data || [],
      totalCount: count || 0
    };
  } catch (error) {
    console.error("Error in getUnifiedArticles:", error);
    return { articles: [], totalCount: 0, error };
  }
}

// Save a new article to the unified table
export async function saveUnifiedArticle(article: Omit<UnifiedArticle, "id" | "created_at" | "updated_at">): Promise<{
  article?: UnifiedArticle;
  error?: any;
}> {
  try {
    // Check if article already exists by URL
    const { data: existing } = await supabaseAdmin
      .from("articles_unified")
      .select("id, title, created_at")
      .eq("url", article.url)
      .single();

    if (existing) {
      console.log(`⏭️  Article already exists: ${article.title}`);
      return { article: existing as UnifiedArticle };
    }

    // Set published_at to current time if not provided
    const publishedAt = article.published_at || new Date().toISOString();

    // Insert new article
    const { data, error } = await supabaseAdmin
      .from("articles_unified")
      .insert({
        ...article,
        published_at: publishedAt,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error("Error saving unified article:", error);
      return { error };
    }

    console.log(`✅ Saved new article: ${article.title}`);
    return { article: data };
  } catch (error) {
    console.error("Error in saveUnifiedArticle:", error);
    return { error };
  }
}

// Update an existing article (preserves published_at)
export async function updateUnifiedArticle(
  id: string, 
  updates: Partial<Omit<UnifiedArticle, "id" | "created_at" | "published_at">>
): Promise<{
  article?: UnifiedArticle;
  error?: any;
}> {
  try {
    // Never update published_at - this is key to stable ordering
    const { published_at, ...safeUpdates } = updates as any;
    
    const { data, error } = await supabaseAdmin
      .from("articles_unified")
      .update({
        ...safeUpdates,
        updated_at: new Date().toISOString()
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating unified article:", error);
      return { error };
    }

    return { article: data };
  } catch (error) {
    console.error("Error in updateUnifiedArticle:", error);
    return { error };
  }
}

// Get articles that need processing
export async function getPendingUnifiedArticles(
  limit = 10,
  articleType?: ArticleType
): Promise<UnifiedArticle[]> {
  try {
    let query = supabaseAdmin
      .from("articles_unified")
      .select("*")
      .in("processing_status", ["pending", "failed"])
      .order("created_at", { ascending: true })
      .limit(limit);

    if (articleType) {
      query = query.eq("article_type", articleType);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching pending articles:", error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error("Error in getPendingUnifiedArticles:", error);
    return [];
  }
}

// Update article processing status
export async function updateArticleProcessingStatus(
  id: string,
  status: ProcessingStatus,
  additionalUpdates?: Partial<UnifiedArticle>
): Promise<boolean> {
  try {
    const { error } = await supabaseAdmin
      .from("articles_unified")
      .update({
        processing_status: status,
        ...additionalUpdates,
        updated_at: new Date().toISOString()
      })
      .eq("id", id);

    if (error) {
      console.error("Error updating processing status:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error in updateArticleProcessingStatus:", error);
    return false;
  }
}

// Get article by ID
export async function getUnifiedArticleById(id: string): Promise<UnifiedArticle | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from("articles_unified")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      console.error("Error fetching article by ID:", error);
      return null;
    }

    return data;
  } catch (error) {
    console.error("Error in getUnifiedArticleById:", error);
    return null;
  }
}

// Check if article exists by URL
export async function articleExistsByUrl(url: string): Promise<boolean> {
  try {
    const { data, error } = await supabaseAdmin
      .from("articles_unified")
      .select("id")
      .eq("url", url)
      .single();

    return !error && !!data;
  } catch {
    return false;
  }
}

// Batch check for existing articles by URLs
export async function checkExistingArticlesByUrls(urls: string[]): Promise<Set<string>> {
  try {
    const { data, error } = await supabaseAdmin
      .from("articles_unified")
      .select("url")
      .in("url", urls);

    if (error) {
      console.error("Error checking existing articles:", error);
      return new Set();
    }

    return new Set(data?.map(a => a.url) || []);
  } catch (error) {
    console.error("Error in checkExistingArticlesByUrls:", error);
    return new Set();
  }
}