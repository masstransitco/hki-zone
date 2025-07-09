import type { Article, PerplexityArticle } from "@/lib/types"

/**
 * Transform a PerplexityArticle to an Article for compatibility with existing components
 */
export function transformPerplexityToArticle(perplexityArticle: PerplexityArticle): Article {
  return {
    id: perplexityArticle.id,
    title: perplexityArticle.enhanced_title || perplexityArticle.title,
    summary: perplexityArticle.summary || perplexityArticle.lede || "",
    content: perplexityArticle.article_html || "",
    url: perplexityArticle.url,
    source: perplexityArticle.source,
    publishedAt: perplexityArticle.published_at,
    imageUrl: perplexityArticle.image_url,
    category: perplexityArticle.category,
    readTime: Math.ceil((perplexityArticle.article_html?.length || 0) / 200) || 3,
    isAiEnhanced: true,
    language: "en", // Perplexity articles are in English for now
    enhancementMetadata: {
      searchQueries: perplexityArticle.search_queries || [],
      sources: perplexityArticle.structured_sources?.sources?.map(source => {
        let domain = source.domain
        if (!domain && source.url) {
          try {
            domain = new URL(source.url).hostname
          } catch {
            domain = source.url
          }
        }
        return {
          url: source.url,
          title: source.title,
          domain: domain || "Unknown",
          snippet: source.description,
          accessedAt: perplexityArticle.structured_sources?.generated_at || perplexityArticle.created_at,
        }
      }) || [],
      relatedTopics: [perplexityArticle.category],
      enhancedAt: perplexityArticle.created_at,
      enhancementCost: perplexityArticle.generation_cost?.toString(),
      citationsText: perplexityArticle.citations?.join(", "),
      structuredContent: {
        enhancedTitle: perplexityArticle.enhanced_title,
        enhancedSummary: perplexityArticle.summary,
        keyPoints: perplexityArticle.key_points,
        whyItMatters: perplexityArticle.why_it_matters,
      }
    }
  }
}