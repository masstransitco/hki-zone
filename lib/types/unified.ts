// Unified types for the streamlined article system

export type ArticleStatus = 'draft' | 'published' | 'archived';
export type ProcessingStatus = 'pending' | 'processing' | 'ready' | 'failed';
export type ArticleType = 'scraped' | 'ai_generated' | 'ai_enhanced';

export interface ImageMetadata {
  original?: string;
  optimized?: string;
  whatsapp?: string;
  license?: string;
  attribution?: string;
  width?: number;
  height?: number;
}

export interface GenerationMetadata {
  model?: string;
  cost?: number;
  image_prompt?: string;
  citations?: any[];
  enhanced_title?: string;
  generated_at?: string;
}

export interface EnhancementMetadata {
  searchQueries?: string[];
  sources?: string[];
  relatedTopics?: string[];
  enhancedAt?: string;
  enhancementCost?: string;
  originalArticleId?: string;
  language?: string;
}

export interface StructuredSources {
  citations?: any[];
  sources?: string[];
  generated_at?: string;
}

export interface ContextualData {
  contextual_bullets?: string[];
  data_points?: any[];
  historical_references?: any[];
  enrichment_version?: string;
}

export interface ArticleFeatures {
  has_image: boolean;
  has_ai_content: boolean;
  has_translation: boolean;
}

export interface UnifiedArticle {
  // Core fields
  id: string;
  title: string;
  content: string;
  url: string;
  source: string;
  category: string;
  
  // Timestamps
  created_at: string;
  published_at: string;  // Primary ordering field - never changes
  updated_at: string;
  
  // Content fields
  summary?: string;
  lede?: string;
  key_points?: string[];
  why_it_matters?: string;
  
  // Media
  image_url?: string;
  image_metadata?: ImageMetadata;
  
  // Status tracking
  status: ArticleStatus;
  processing_status: ProcessingStatus;
  
  // Metadata
  article_type: ArticleType;
  generation_metadata?: GenerationMetadata;
  enhancement_metadata?: EnhancementMetadata;
  structured_sources?: StructuredSources;
  contextual_data?: ContextualData;
  
  // Author
  author?: string;
  
  // Cost tracking
  generation_cost?: number;
  
  // Features
  features: ArticleFeatures;
  
  // Search
  search_queries?: string[];
  
  // Legacy tracking (for migration)
  legacy_article_id?: string;
  legacy_table_name?: string;
}

// API Response types
export interface UnifiedArticlesResponse {
  articles: UnifiedArticle[];
  nextPage: number | null;
  totalCount?: number;
  hasMore: boolean;
  debug?: {
    source: 'database' | 'mock';
    query?: any;
    error?: string;
  };
}

// Query parameters for the unified API
export interface ArticleQueryParams {
  page?: number;
  limit?: number;
  type?: ArticleType | 'all';
  category?: string;
  source?: string;
  features?: string[];  // e.g., ['has_image', 'has_ai_content']
  sort?: 'latest' | 'popular' | 'relevance';
  status?: ArticleStatus;
  processingStatus?: ProcessingStatus;
  search?: string;
}

// Filters for frontend components
export interface ArticleFilters {
  type?: ArticleType | 'all';
  category?: string;
  source?: string;
  hasImage?: boolean;
  hasAiContent?: boolean;
  language?: string;
}

// Feed configuration
export interface FeedConfig {
  feedType: 'news' | 'ai' | 'topics' | 'headlines' | 'custom';
  filters?: ArticleFilters;
  refreshInterval?: number;  // in milliseconds
  pageSize?: number;
  showRefreshButton?: boolean;
  showLoadMore?: boolean;
  enableInfiniteScroll?: boolean;
}

// Feed header configuration
export interface FeedHeaderConfig {
  title: string;
  subtitle?: string;
  icon?: React.ComponentType;
  showRefresh?: boolean;
  customActions?: React.ReactNode;
}

// Transformation utilities type guards
export function isUnifiedArticle(article: any): article is UnifiedArticle {
  return (
    article &&
    typeof article.id === 'string' &&
    typeof article.title === 'string' &&
    typeof article.content === 'string' &&
    typeof article.url === 'string' &&
    typeof article.article_type === 'string' &&
    ['scraped', 'ai_generated', 'ai_enhanced'].includes(article.article_type)
  );
}

export function hasAiContent(article: UnifiedArticle): boolean {
  return article.features.has_ai_content || 
         article.article_type === 'ai_generated' || 
         article.article_type === 'ai_enhanced';
}

export function hasImage(article: UnifiedArticle): boolean {
  return article.features.has_image || !!article.image_url;
}

// Default values
export const DEFAULT_FEATURES: ArticleFeatures = {
  has_image: false,
  has_ai_content: false,
  has_translation: false
};

export const DEFAULT_FEED_CONFIG: FeedConfig = {
  feedType: 'news',
  refreshInterval: 0,
  pageSize: 10,
  showRefreshButton: false,
  showLoadMore: true,
  enableInfiniteScroll: true
};

// Re-export for easier imports
export default {
  DEFAULT_FEED_CONFIG,
  DEFAULT_FEATURES
};