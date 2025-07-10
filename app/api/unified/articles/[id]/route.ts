import { type NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { checkUnifiedTableSetup } from "@/lib/supabase-unified";
import type { UnifiedArticle } from "@/lib/types/unified";

// Transform UnifiedArticle to match the Article interface expected by ArticleBottomSheet
function transformUnifiedToArticle(unified: UnifiedArticle) {
  return {
    id: unified.id,
    title: unified.generation_metadata?.enhanced_title || unified.title,
    summary: unified.summary || unified.lede || "",
    content: formatUnifiedContent(unified),
    url: unified.url,
    source: unified.source,
    publishedAt: unified.published_at,
    imageUrl: unified.image_url,
    category: unified.category,
    readTime: Math.ceil((unified.content?.length || 0) / 200) || 3,
    isAiEnhanced: unified.features.has_ai_content || unified.article_type === 'ai_generated',
    language: unified.enhancement_metadata?.language || "en",
    originalArticleId: unified.enhancement_metadata?.originalArticleId,
    enhancementMetadata: unified.article_type === 'ai_generated' ? {
      searchQueries: unified.search_queries || [],
      sources: transformSources(unified),
      relatedTopics: [unified.category],
      enhancedAt: unified.created_at,
      enhancementCost: unified.generation_cost?.toString(),
      citationsText: unified.generation_metadata?.citations?.join(", "),
      structuredContent: {
        enhancedTitle: unified.generation_metadata?.enhanced_title,
        enhancedSummary: unified.summary,
        keyPoints: unified.key_points,
        whyItMatters: unified.why_it_matters,
      }
    } : unified.enhancement_metadata
  };
}

// Format content for display, handling different article types
function formatUnifiedContent(article: UnifiedArticle): string {
  // For AI-generated articles with structured content
  if (article.article_type === 'ai_generated') {
    // Check if we have HTML content
    if (article.content && (article.content.includes('<p>') || article.content.includes('<div>'))) {
      return article.content;
    }
    
    // Build structured content for display
    let content = "";
    
    // Add lede or summary first
    if (article.lede) {
      content += `${article.lede}\n\n`;
    } else if (article.summary) {
      content += `${article.summary}\n\n`;
    }
    
    // Add contextual bullets if available
    if (article.contextual_data?.contextual_bullets && Array.isArray(article.contextual_data.contextual_bullets)) {
      content += `**Key Context**\n`;
      article.contextual_data.contextual_bullets.forEach((bullet: string, index: number) => {
        content += `${index + 1}. ${bullet}\n`;
      });
      content += `\n`;
    }
    
    // Add key points
    if (article.key_points && Array.isArray(article.key_points) && article.key_points.length > 0) {
      content += `**Key Points**\n`;
      article.key_points.forEach((point: string) => {
        content += `• ${point}\n`;
      });
      content += `\n`;
    }
    
    // Add why it matters
    if (article.why_it_matters) {
      content += `**Why It Matters**\n${article.why_it_matters}\n\n`;
    }
    
    // Add any remaining HTML content
    if (article.content && !content.includes(article.content)) {
      content += article.content;
    }
    
    return content.trim();
  }
  
  // For scraped or enhanced articles, return content as-is
  return article.content || "";
}

// Transform sources to match expected format
function transformSources(article: UnifiedArticle) {
  // First try structured_sources
  if (article.structured_sources?.sources && Array.isArray(article.structured_sources.sources)) {
    return article.structured_sources.sources.map((source: any) => {
      let domain = source.domain;
      if (!domain && source.url) {
        try {
          domain = new URL(source.url).hostname;
        } catch {
          domain = source.url;
        }
      }
      return {
        url: source.url,
        title: source.title || source.description || `Source`,
        domain: domain || "Unknown",
        snippet: source.description,
        accessedAt: article.structured_sources?.generated_at || article.created_at,
      };
    });
  }
  
  // Fallback to citations
  if (article.generation_metadata?.citations && Array.isArray(article.generation_metadata.citations)) {
    return article.generation_metadata.citations.map((citation: string, index: number) => {
      let domain = "Unknown";
      let title = `Source ${index + 1}`;
      
      try {
        const url = new URL(citation);
        domain = url.hostname;
        title = `${domain} - Source ${index + 1}`;
      } catch {
        title = citation.length > 50 ? citation.substring(0, 50) + "..." : citation;
      }
      
      return {
        url: citation,
        title: title,
        domain: domain,
        snippet: undefined,
        accessedAt: article.created_at,
      };
    });
  }
  
  return [];
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log(`🔍 Fetching unified article with ID: ${params.id}`);

    // Check if unified table is set up
    const isTableReady = await checkUnifiedTableSetup();
    
    if (!isTableReady) {
      console.warn("Unified articles table not set up");
      return NextResponse.json(
        { error: "Database not ready" },
        { status: 503 }
      );
    }

    // Fetch the article from unified table
    const { data: article, error } = await supabaseAdmin
      .from("articles_unified")
      .select("*")
      .eq("id", params.id)
      .single();

    if (error) {
      console.error(`❌ Database error for article ${params.id}:`, error);
      
      // If not found, try with legacy_article_id for backward compatibility
      if (error.code === 'PGRST116') {
        const { data: legacyArticle, error: legacyError } = await supabaseAdmin
          .from("articles_unified")
          .select("*")
          .eq("legacy_article_id", params.id)
          .single();
          
        if (!legacyError && legacyArticle) {
          console.log(`✅ Found article by legacy ID: ${legacyArticle.title}`);
          const transformedArticle = transformUnifiedToArticle(legacyArticle);
          return NextResponse.json(transformedArticle);
        }
      }
      
      return NextResponse.json(
        { error: "Article not found" },
        { status: 404 }
      );
    }

    console.log(`✅ Found unified article: ${article.title} (type: ${article.article_type})`);

    // Transform to expected format
    const transformedArticle = transformUnifiedToArticle(article);

    return NextResponse.json(transformedArticle);

  } catch (error) {
    console.error("Error fetching unified article:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}