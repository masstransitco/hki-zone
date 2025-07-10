import type { Article, PerplexityArticle } from "@/lib/types"

/**
 * Format perplexity article content for AI enhancement display
 */
function formatPerplexityContentForAI(article: PerplexityArticle): string {
  // If we have enhanced structured content, format it for AI enhancement display
  if (article.summary || article.key_points || article.why_it_matters) {
    let content = ""
    
    if (article.summary) {
      content += `**Summary**\n${article.summary}\n\n`
    }
    
    if (article.key_points && article.key_points.length > 0) {
      content += `**Key Points**\n`
      article.key_points.forEach(point => {
        content += `• ${point}\n`
      })
      content += `\n`
    }
    
    if (article.why_it_matters) {
      content += `**Why It Matters**\n${article.why_it_matters}\n\n`
    }
    
    // Add main content if available and it's not just the lede
    if (article.article_html && article.article_html !== `<p>${article.lede}</p>`) {
      // Strip HTML tags for clean display
      const cleanContent = article.article_html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
      if (cleanContent && cleanContent !== article.lede) {
        content += cleanContent
      }
    }
    
    return content
  }
  
  // Fall back to regular content if no enhanced structure
  return article.article_html || article.lede || ""
}

/**
 * Transform a PerplexityArticle to an Article for compatibility with existing components
 */
export function transformPerplexityToArticle(perplexityArticle: PerplexityArticle): Article {
  return {
    id: perplexityArticle.id,
    title: perplexityArticle.enhanced_title || perplexityArticle.title,
    summary: perplexityArticle.summary || perplexityArticle.lede || "",
    content: formatPerplexityContentForAI(perplexityArticle),
    url: perplexityArticle.url,
    source: perplexityArticle.source,
    publishedAt: perplexityArticle.created_at,
    imageUrl: perplexityArticle.image_url,
    category: perplexityArticle.category,
    readTime: Math.ceil((perplexityArticle.article_html?.length || 0) / 200) || 3,
    isAiEnhanced: true,
    language: "en", // Perplexity articles are in English for now
    enhancementMetadata: {
      searchQueries: perplexityArticle.search_queries || [],
      sources: (() => {
        // First try to use structured_sources if available and not empty
        if (perplexityArticle.structured_sources?.sources && perplexityArticle.structured_sources.sources.length > 0) {
          return perplexityArticle.structured_sources.sources.map(source => {
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
          })
        }
        
        // Fallback to citations for older articles
        if (perplexityArticle.citations && perplexityArticle.citations.length > 0) {
          return perplexityArticle.citations.map((citation, index) => {
            let domain = "Unknown"
            let title = `Source ${index + 1}`
            
            // Try to extract domain from URL
            try {
              const url = new URL(citation)
              domain = url.hostname
              title = `${domain} - Source ${index + 1}`
            } catch {
              // If not a valid URL, treat as a title or description
              title = citation.length > 50 ? citation.substring(0, 50) + "..." : citation
            }
            
            return {
              url: citation,
              title: title,
              domain: domain,
              snippet: undefined,
              accessedAt: perplexityArticle.created_at,
            }
          })
        }
        
        return []
      })(),
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