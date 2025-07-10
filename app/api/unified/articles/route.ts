import { type NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, checkDatabaseSetup } from "@/lib/supabase-server";
import type { 
  UnifiedArticle, 
  UnifiedArticlesResponse, 
  ArticleQueryParams,
  ArticleType,
  ArticleStatus,
  ProcessingStatus 
} from "@/lib/types/unified";

export const dynamic = 'force-dynamic';

// Mock data for fallback
const mockUnifiedArticles: UnifiedArticle[] = [
  {
    id: "unified-1",
    title: "Hong Kong's Tech Innovation Hub Expands with New AI Research Center",
    content: "Hong Kong Science Park has unveiled a state-of-the-art AI research hub...",
    url: "https://example.com/hk-ai-research-hub",
    source: "Perplexity AI",
    category: "tech",
    created_at: "2024-01-16T10:00:00Z",
    published_at: "2024-01-16T10:00:00Z",
    updated_at: "2024-01-16T10:00:00Z",
    summary: "A new AI research center opens at Hong Kong Science Park, bringing together universities and tech companies.",
    status: "published",
    processing_status: "ready",
    article_type: "ai_generated",
    features: { has_image: true, has_ai_content: true, has_translation: false },
    image_url: "https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=800",
    author: "AI Generated"
  },
  {
    id: "unified-2",
    title: "Legislative Council Passes Climate Action Framework",
    content: "Hong Kong's Legislative Council has unanimously passed a new climate action framework...",
    url: "https://example.com/hk-climate-framework",
    source: "RTHK",
    category: "politics",
    created_at: "2024-01-16T09:00:00Z",
    published_at: "2024-01-16T09:00:00Z",
    updated_at: "2024-01-16T09:00:00Z",
    summary: "New legislation aims for carbon neutrality by 2050 with ambitious renewable energy targets.",
    status: "published",
    processing_status: "ready",
    article_type: "scraped",
    features: { has_image: false, has_ai_content: false, has_translation: false },
    author: "RTHK News Team"
  }
];

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    
    // Parse query parameters
    const params: ArticleQueryParams = {
      page: parseInt(searchParams.get("page") || "0"),
      limit: parseInt(searchParams.get("limit") || "10"),
      type: (searchParams.get("type") || "all") as ArticleType | "all",
      category: searchParams.get("category") || undefined,
      source: searchParams.get("source") || undefined,
      features: searchParams.getAll("features") || undefined,
      sort: (searchParams.get("sort") || "latest") as "latest" | "popular" | "relevance",
      status: (searchParams.get("status") || "published") as ArticleStatus,
      processingStatus: searchParams.get("processingStatus") as ProcessingStatus | undefined,
      search: searchParams.get("search") || undefined
    };

    console.log("🔍 Unified Articles API called with params:", params);

    // Check if database is ready
    const isDatabaseReady = await checkDatabaseSetup();
    
    if (!isDatabaseReady) {
      console.warn("Database not ready, using mock data");
      return returnMockData(params);
    }

    // Build the query
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

    // Apply feature filters
    if (params.features && params.features.length > 0) {
      params.features.forEach(feature => {
        if (feature === "has_image") {
          query = query.eq("features->has_image", true);
        } else if (feature === "has_ai_content") {
          query = query.eq("features->has_ai_content", true);
        } else if (feature === "has_translation") {
          query = query.eq("features->has_translation", true);
        }
      });
    }

    // Apply search
    if (params.search) {
      query = query.or(`title.ilike.%${params.search}%,summary.ilike.%${params.search}%,content.ilike.%${params.search}%`);
    }

    // Apply sorting
    if (params.sort === "latest") {
      query = query.order("published_at", { ascending: false });
      query = query.order("id", { ascending: false }); // Secondary sort for stability
    } else if (params.sort === "popular") {
      // TODO: Implement popularity tracking
      query = query.order("published_at", { ascending: false });
    }

    // Apply pagination
    const startRange = params.page * params.limit;
    const endRange = startRange + params.limit - 1;
    query = query.range(startRange, endRange);

    // Execute query
    const { data: articles, error, count } = await query;

    if (error) {
      console.error("Database query error:", error);
      
      // Check if it's a table not found error
      if (error.code === "42P01" || error.message.includes("does not exist")) {
        console.warn("Unified articles table does not exist, using mock data");
        return returnMockData(params);
      }
      
      throw error;
    }

    console.log(`✅ Query successful: Found ${articles?.length || 0} articles (total: ${count})`);

    // Check if there are more pages
    const hasMore = count ? startRange + params.limit < count : false;
    const nextPage = hasMore ? params.page + 1 : null;

    // If no articles and it's the first page, return mock data
    if ((!articles || articles.length === 0) && params.page === 0) {
      console.warn("No articles in database, using mock data");
      return returnMockData(params);
    }

    const response: UnifiedArticlesResponse = {
      articles: articles || [],
      nextPage,
      totalCount: count || 0,
      hasMore,
      debug: {
        source: 'database',
        query: { 
          filters: params,
          range: { start: startRange, end: endRange }
        }
      }
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error("Error in unified articles API:", error);
    
    // Return mock data as fallback
    return returnMockData(request.nextUrl.searchParams);
  }
}

function returnMockData(params: ArticleQueryParams | URLSearchParams): NextResponse {
  const page = params instanceof URLSearchParams 
    ? parseInt(params.get("page") || "0") 
    : params.page || 0;
  const limit = params instanceof URLSearchParams
    ? parseInt(params.get("limit") || "10")
    : params.limit || 10;

  const startIndex = page * limit;
  const endIndex = startIndex + limit;
  const paginatedArticles = mockUnifiedArticles.slice(startIndex, endIndex);

  const response: UnifiedArticlesResponse = {
    articles: paginatedArticles,
    nextPage: endIndex < mockUnifiedArticles.length ? page + 1 : null,
    totalCount: mockUnifiedArticles.length,
    hasMore: endIndex < mockUnifiedArticles.length,
    debug: {
      source: 'mock',
      error: 'Database not available'
    }
  };

  return NextResponse.json(response);
}