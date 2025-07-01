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
