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
  selectedForEnhancement?: boolean
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

// Government Incident Types
export type IncidentCategory = 'road' | 'rail' | 'weather' | 'utility' | 'health' | 'financial' | 'administrative' | 'gov' | 'ae' | 'top_signals' | 'environment'
export type EnrichmentStatus = 'pending' | 'enriched' | 'ready' | 'failed'

export interface GovFeed {
  id: string
  slug: string
  url: string
  active: boolean
  last_seen_pubdate?: string
  created_at: string
  updated_at: string
}

export interface Incident {
  id: string
  source_slug: string
  title: string
  body?: string
  category: IncidentCategory
  severity: number
  longitude?: number
  latitude?: number
  starts_at?: string
  source_updated_at: string
  
  // Enrichment fields
  enrichment_status: EnrichmentStatus
  relevance_score: number
  enriched_title?: string
  enriched_summary?: string
  enriched_content?: string
  key_points?: string[]
  why_it_matters?: string
  image_url?: string
  image_prompt?: string
  
  // New enrichment fields
  additional_sources?: Array<{
    title: string
    url: string
    description?: string
    domain?: string
    accessed_at: string
  }>
  key_facts?: string[]
  reporting_score?: number
  
  // Metadata
  sources?: {
    citations: string[]
    sources: Array<{
      title: string
      url: string
      description?: string
      domain?: string
    }>
    generated_at: string
  }
  citations?: string[]
  enrichment_metadata?: {
    enriched_at: string
    enrichment_cost?: string
    ai_model?: string
    search_queries?: string[]
  }
  
  // Timestamps
  created_at: string
  updated_at: string
}

export interface IncidentsResponse {
  incidents: Incident[]
  total: number
  page: number
  limit: number
  hasMore: boolean
  error?: string
}

export interface SignalResponse {
  signals: (PerplexityArticle | Incident)[]
  total: number
  page: number
  limit: number
  hasMore: boolean
  error?: string
}
