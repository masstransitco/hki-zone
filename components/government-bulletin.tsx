"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { 
  Loader2,
  AlertTriangle,
  Clock,
  ChevronDown,
  ChevronUp,
  RefreshCw
} from "lucide-react"
import { format } from "date-fns"

interface BulletinItem {
  id: string
  title: string
  body?: string
  category: string
  severity: number
  relevance_score: number
  source_slug: string
  source_updated_at: string
  enrichment_status?: "pending" | "enriched" | "ready" | "failed"
  enriched_title?: string
  enriched_summary?: string
  key_points?: string[]
  why_it_matters?: string
  created_at: string
}

interface GovernmentBulletinProps {
  limit?: number
  autoRefresh?: boolean
  refreshInterval?: number
  showFilters?: boolean
}

export default function GovernmentBulletin({
  limit = 20,
  autoRefresh = true,
  refreshInterval = 2 * 60 * 1000, // 2 minutes
  showFilters = false
}: GovernmentBulletinProps) {
  const [items, setItems] = useState<BulletinItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  useEffect(() => {
    loadBulletinItems(0)
  }, [])

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(() => {
        handleRefresh()
      }, refreshInterval)
      return () => clearInterval(interval)
    }
  }, [autoRefresh, refreshInterval])

  const loadBulletinItems = async (pageNum: number) => {
    try {
      if (pageNum === 0) setLoading(true)
      else setLoadingMore(true)

      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: limit.toString()
      })

      const response = await fetch(`/api/signals?${params.toString()}`)
      if (!response.ok) throw new Error('Failed to fetch bulletin items')

      const data = await response.json()
      
      if (pageNum === 0) {
        setItems(data.articles || [])
      } else {
        setItems(prev => [...prev, ...(data.articles || [])])
      }
      
      setHasMore(data.hasMore || false)
      setPage(pageNum)
    } catch (error) {
      console.error('Error loading bulletin items:', error)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadBulletinItems(0)
    setRefreshing(false)
  }

  const handleLoadMore = () => {
    if (hasMore && !loadingMore) {
      loadBulletinItems(page + 1)
    }
  }

  const toggleExpanded = (itemId: string) => {
    const newExpanded = new Set(expandedItems)
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId)
    } else {
      newExpanded.add(itemId)
    }
    setExpandedItems(newExpanded)
  }

  const getCategoryLabel = (category: string, sourceSlug: string) => {
    // Updated categorization as requested
    if (sourceSlug === 'news_gov_top') return 'Gov+'
    if (sourceSlug === 'hkma_press' || sourceSlug === 'hkma_speeches') return 'HKMA'
    
    // Keep existing categorizations as visual labels
    const categoryMap: { [key: string]: string } = {
      road: 'Road',
      rail: 'Rail',
      weather: 'Weather',
      utility: 'Utility',
      health: 'Health',
      financial: 'Financial',
      gov: 'Gov',
      ae: 'A&E',
      top_signals: 'Priority',
      environment: 'Environment'
    }
    
    return categoryMap[category] || category.charAt(0).toUpperCase() + category.slice(1)
  }

  const getCategoryColor = (category: string, sourceSlug: string) => {
    // Special handling for updated categories
    if (sourceSlug === 'news_gov_top') {
      return "bg-gradient-to-r from-amber-100 to-orange-100 text-amber-800 dark:bg-gradient-to-r dark:from-amber-900/20 dark:to-orange-900/20 dark:text-amber-400"
    }
    if (sourceSlug === 'hkma_press' || sourceSlug === 'hkma_speeches') {
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400"
    }

    const colors: { [key: string]: string } = {
      road: "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400",
      rail: "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400",
      weather: "bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400",
      utility: "bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400",
      health: "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400",
      financial: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400",
      gov: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/20 dark:text-indigo-400",
      ae: "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400",
      top_signals: "bg-gradient-to-r from-amber-100 to-orange-100 text-amber-800 dark:bg-gradient-to-r dark:from-amber-900/20 dark:to-orange-900/20 dark:text-amber-400",
      environment: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400"
    }
    return colors[category] || "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300"
  }

  const getSeverityColor = (severity: number) => {
    if (severity >= 7) return "text-red-600 dark:text-red-400"
    if (severity >= 4) return "text-orange-600 dark:text-orange-400"
    return "text-green-600 dark:text-green-400"
  }

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMM dd, HH:mm')
    } catch {
      return dateString
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="ml-2 text-muted-foreground">Loading bulletin...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="pt-6 space-y-4">
      {/* Header with refresh button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Government Bulletin
          </h2>
          <p className="text-sm text-muted-foreground">
            Latest updates from Hong Kong government sources
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleRefresh}
          disabled={refreshing}
          className="h-8 w-8"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Bulletin List */}
      <div className="space-y-2">
        {items.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              No bulletin items found
            </CardContent>
          </Card>
        ) : (
          items.map((item) => {
            const isExpanded = expandedItems.has(item.id)
            const isEnriched = item.enrichment_status === 'enriched' || item.enrichment_status === 'ready'
            const displayTitle = isEnriched ? (item.enriched_title || item.title) : item.title
            const displayContent = isEnriched && item.enriched_summary ? item.enriched_summary : item.body

            return (
              <Card 
                key={item.id} 
                className="hover:shadow-md transition-shadow duration-200 border-l-4 border-l-blue-500"
              >
                <CardContent className="p-4">
                  <div className="space-y-3">
                    {/* Header row */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge 
                          variant="outline" 
                          className={getCategoryColor(item.category, item.source_slug)}
                        >
                          {getCategoryLabel(item.category, item.source_slug)}
                        </Badge>
                        
                        <div className="flex items-center gap-1">
                          <AlertTriangle className={`h-3 w-3 ${getSeverityColor(item.severity)}`} />
                          <span className={`text-xs ${getSeverityColor(item.severity)}`}>
                            {item.severity}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">
                            {formatDate(item.source_updated_at)}
                          </span>
                        </div>
                      </div>
                      
                      {displayContent && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleExpanded(item.id)}
                          className="h-6 w-6 p-0 flex-shrink-0"
                        >
                          {isExpanded ? (
                            <ChevronUp className="h-3 w-3" />
                          ) : (
                            <ChevronDown className="h-3 w-3" />
                          )}
                        </Button>
                      )}
                    </div>

                    {/* Title */}
                    <h3 className="font-medium text-gray-900 dark:text-gray-100 leading-snug">
                      {displayTitle}
                    </h3>

                    {/* Source */}
                    <div className="text-xs text-muted-foreground">
                      <strong>Source:</strong> {item.source_slug.toUpperCase()}
                    </div>

                    {/* Expandable content */}
                    {isExpanded && displayContent && (
                      <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {displayContent}
                        </p>
                        
                        {/* AI-Enhanced Content */}
                        {isEnriched && (
                          <div className="mt-3 space-y-2">
                            {item.key_points && item.key_points.length > 0 && (
                              <div>
                                <h4 className="text-xs font-medium text-blue-700 dark:text-blue-400 mb-1">
                                  Key Points:
                                </h4>
                                <ul className="text-xs text-muted-foreground space-y-1">
                                  {item.key_points.map((point, index) => (
                                    <li key={index} className="flex items-start gap-1">
                                      <span className="text-blue-600">•</span>
                                      <span>{point}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            
                            {item.why_it_matters && (
                              <div>
                                <h4 className="text-xs font-medium text-green-700 dark:text-green-400 mb-1">
                                  Why It Matters:
                                </h4>
                                <p className="text-xs text-muted-foreground">
                                  {item.why_it_matters}
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>

      {/* Load More */}
      {hasMore && (
        <div className="flex justify-center pt-4">
          <Button
            variant="outline"
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="w-full max-w-xs"
          >
            {loadingMore ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Loading more...
              </>
            ) : (
              'Load More Bulletins'
            )}
          </Button>
        </div>
      )}
    </div>
  )
}