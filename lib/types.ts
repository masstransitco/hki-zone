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
