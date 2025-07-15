"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { 
  Loader2,
  AlertTriangle,
  MapPin,
  Clock,
  Activity,
  Sparkles,
  CheckCircle,
  XCircle
} from "lucide-react"
import { format } from "date-fns"
import ArticleCard from "@/components/article-card"

interface PerplexityArticle {
  id: string
  title: string
  category: string
  url: string
  article_status: "pending" | "enriched" | "ready"
  image_status: "pending" | "ready" | "failed"
  article_html?: string
  lede?: string
  image_url?: string
  source: string
  author: string
  published_at?: string
  created_at: string
  updated_at?: string
  summary?: string
  key_points?: string[]
  why_it_matters?: string
  enhanced_title?: string
  
  // Incident-specific fields
  severity?: number
  relevance_score?: number
  longitude?: number
  latitude?: number
  starts_at?: string
  source_updated_at?: string
  source_slug?: string
  enrichment_status?: "pending" | "enriched" | "ready" | "failed"
}

interface SignalsListProps {
  articles: PerplexityArticle[]
  loading: boolean
  onLoadMore?: () => void
  hasMore?: boolean
  viewMode?: 'list' | 'grid'
}

export default function SignalsList({
  articles,
  loading,
  onLoadMore,
  hasMore,
  viewMode = 'grid'
}: SignalsListProps) {
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set())
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const observerRef = useRef<IntersectionObserver>()
  const loadMoreRef = useRef<HTMLDivElement>(null)

  // Infinite scroll implementation
  const handleObserver = useCallback((entries: IntersectionObserverEntry[]) => {
    const target = entries[0]
    if (target.isIntersecting && hasMore && !isLoadingMore && onLoadMore) {
      setIsLoadingMore(true)
      onLoadMore()
    }
  }, [hasMore, isLoadingMore, onLoadMore])

  useEffect(() => {
    const option = {
      root: null,
      rootMargin: "100px",
      threshold: 0
    }
    observerRef.current = new IntersectionObserver(handleObserver, option)
    
    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current)
    }
    
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect()
      }
    }
  }, [handleObserver])

  useEffect(() => {
    setIsLoadingMore(false)
  }, [articles])

  const getCategoryColor = (category: string) => {
    const colors = {
      // Incident categories
      road: "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400",
      rail: "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400",
      weather: "bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400",
      utility: "bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400",
      
      // Legacy categories (fallback)
      politics: "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400",
      business: "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400",
      tech: "bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400",
      health: "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400",
      lifestyle: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400",
      entertainment: "bg-pink-100 text-pink-800 dark:bg-pink-900/20 dark:text-pink-400"
    }
    return colors[category as keyof typeof colors] || "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300"
  }

  const getSeverityColor = (severity: number) => {
    if (severity >= 7) return "text-red-600 dark:text-red-400"
    if (severity >= 4) return "text-orange-600 dark:text-orange-400"
    return "text-green-600 dark:text-green-400"
  }

  const getEnrichmentStatusBadge = (status: string) => {
    const statusConfig = {
      pending: {
        label: "Direct",
        color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
        icon: Clock,
        description: "Direct government content"
      },
      enriched: {
        label: "AI Enhanced",
        color: "bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400",
        icon: Sparkles,
        description: "Enhanced with AI analysis"
      },
      ready: {
        label: "Ready",
        color: "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400",
        icon: CheckCircle,
        description: "Fully processed"
      },
      failed: {
        label: "Failed",
        color: "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400",
        icon: XCircle,
        description: "Enhancement failed"
      }
    }
    
    return statusConfig[status as keyof typeof statusConfig] || statusConfig.pending
  }

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMM dd, yyyy HH:mm')
    } catch {
      return dateString
    }
  }

  const toggleCardExpansion = (articleId: string) => {
    const newExpanded = new Set(expandedCards)
    if (newExpanded.has(articleId)) {
      newExpanded.delete(articleId)
    } else {
      newExpanded.add(articleId)
    }
    setExpandedCards(newExpanded)
  }


  if (loading) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Grid view using ArticleCard component
  if (viewMode === 'grid') {
    return (
      <div>
        {/* Article Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {articles.length === 0 ? (
            <Card className="col-span-full">
              <CardContent className="p-8 text-center text-muted-foreground">
                No articles found
              </CardContent>
            </Card>
          ) : (
            articles.map((article) => {
              const isEnriched = article.enrichment_status === 'enriched' || article.enrichment_status === 'ready'
              
              return (
                <ArticleCard
                  key={article.id}
                  article={{
                    id: article.id,
                    title: isEnriched ? (article.enhanced_title || article.title) : article.title,
                    url: article.url,
                    content: article.article_html || '',
                    summary: isEnriched && article.summary ? article.summary : (article.lede || ''),
                    category: article.category,
                    source: article.source,
                    author: article.author,
                    published_at: article.published_at || article.created_at,
                    created_at: article.created_at,
                    imageUrl: article.image_url,
                    has_image: !!article.image_url,
                    key_points: article.key_points,
                    why_it_matters: article.why_it_matters,
                    has_ai_content: !!(article.summary || article.key_points || article.why_it_matters),
                    article_type: 'ai_generated'
                  }}
                  isExpanded={expandedCards.has(article.id)}
                  onToggleExpand={() => toggleCardExpansion(article.id)}
                />
              )
            })
          )}
        </div>
        
        {/* Infinite scroll trigger */}
        {hasMore && (
          <div 
            ref={loadMoreRef}
            className="mt-6 flex justify-center py-4"
          >
            {isLoadingMore && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Loading more signals...</span>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  // List view with modern card-style items
  return (
    <div className="space-y-4">
      {articles.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            No signals found
          </CardContent>
        </Card>
      ) : (
        articles.map((article) => (
          <Card 
            key={article.id} 
            className="hover:shadow-lg transition-shadow duration-200 overflow-hidden"
          >
            <CardContent className="p-4">
              <div className="flex gap-4">
                {/* Square thumbnail */}
                {article.image_url && (
                  <div className="flex-shrink-0">
                    <div className="w-24 h-24 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800">
                      <img
                        src={article.image_url}
                        alt={article.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </div>
                  </div>
                )}
                
                {/* Content */}
                <div className="flex-1 min-w-0">
                  {/* Category and metadata */}
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <Badge variant="outline" className={getCategoryColor(article.category)}>
                      {article.category}
                    </Badge>
                    
                    
                    {article.severity && (
                      <div className="flex items-center gap-1">
                        <AlertTriangle className={`h-3 w-3 ${getSeverityColor(article.severity)}`} />
                        <span className={`text-xs ${getSeverityColor(article.severity)}`}>
                          {article.severity}
                        </span>
                      </div>
                    )}
                    {article.relevance_score && (
                      <div className="flex items-center gap-1">
                        <Activity className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">
                          {article.relevance_score}
                        </span>
                      </div>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {formatDate(article.source_updated_at || article.created_at)}
                    </span>
                  </div>
                  
                  {/* Title */}
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 line-clamp-2 mb-1">
                    {article.enrichment_status === 'enriched' || article.enrichment_status === 'ready' 
                      ? (article.enhanced_title || article.title)
                      : article.title
                    }
                  </h3>
                  
                  {/* Location */}
                  {(article.longitude && article.latitude) && (
                    <div className="flex items-center gap-1 mb-1">
                      <MapPin className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        {article.latitude.toFixed(4)}, {article.longitude.toFixed(4)}
                      </span>
                    </div>
                  )}
                  
                  {/* Summary - show enriched content if available, otherwise show direct content */}
                  {(() => {
                    const isEnriched = article.enrichment_status === 'enriched' || article.enrichment_status === 'ready'
                    const content = isEnriched && article.summary ? article.summary : article.lede
                    
                    if (content) {
                      return (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {content}
                        </p>
                      )
                    }
                    return null
                  })()}
                  
                  {/* AI-Enhanced Content Indicators */}
                  {(article.enrichment_status === 'enriched' || article.enrichment_status === 'ready') && (
                    <div className="flex items-center gap-2 mt-2">
                      {article.key_points && article.key_points.length > 0 && (
                        <span className="text-xs text-blue-600 dark:text-blue-400">
                          • {article.key_points.length} key points
                        </span>
                      )}
                      {article.why_it_matters && (
                        <span className="text-xs text-green-600 dark:text-green-400">
                          • Impact analysis
                        </span>
                      )}
                    </div>
                  )}
                  
                  {/* Source */}
                  <div className="flex items-center gap-1 mt-2">
                    <span className="text-xs text-muted-foreground">
                      <strong>Source:</strong> {article.source_slug?.toUpperCase() || article.source}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))
      )}
      
      {/* Infinite scroll trigger */}
      {hasMore && (
        <div 
          ref={loadMoreRef}
          className="flex justify-center py-4"
        >
          {isLoadingMore && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Loading more signals...</span>
            </div>
          )}
        </div>
      )}
      
    </div>
  )
}