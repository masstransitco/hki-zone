export interface Article {
  id: string
  title: string
  summary: string
  content?: string
  url: string
  source: string
  publishedAt: string
  imageUrl?: string
  category: string
  readTime?: number
  isAiEnhanced?: boolean
  originalArticleId?: string
  language?: string // 'en' | 'zh-TW' | 'zh-CN'
  deletedAt?: string | null
  enhancementMetadata?: {
    searchQueries: string[]
    sources: {
      url: string
      title: string
      domain: string
      snippet?: string
      accessedAt: string
    }[]
    relatedTopics: string[]
    enhancedAt: string
    enhancementCost?: string
    extractedImages?: {
      url: string
      alt?: string
      caption?: string
      source?: string
    }[]
    citationsText?: string
    structuredContent?: {
      enhancedTitle?: string
      enhancedSummary?: string
      keyPoints?: string[]
      whyItMatters?: string
    }
  }
}

export interface User {
  id: string
  name: string
  email: string
  preferences: {
    darkMode: boolean
    fontSize: "small" | "medium" | "large"
    notifications: boolean
    preferredTopics: string[]
  }
}

export interface SearchResult {
  articles: Article[]
  total: number
  query: string
}

export interface PerplexityArticle {
  id: string
  title: string
  category: string
  url: string
  url_hash?: string
  article_status: "pending" | "enriched" | "ready"
  image_status: "pending" | "ready" | "failed"
  article_html?: string
  lede?: string
  image_url?: string
  image_prompt?: string
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
  
  source: string
  author: string
  published_at: string
  inserted_at: string
  created_at: string
  updated_at: string
  perplexity_model?: string
  generation_cost?: number
  search_queries?: string[]
  citations?: string[]
}

export interface PerplexityNewsResponse {
  news: {
    [category: string]: PerplexityArticle[]
  } | PerplexityArticle[]
  usingMockData: boolean
  debug: string
  error?: string
}
