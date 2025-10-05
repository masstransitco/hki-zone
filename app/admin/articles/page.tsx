"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Switch } from "@/components/ui/switch"
import { 
  Search, Filter, RefreshCw, Languages, Loader2, Trash2, CheckSquare, Copy,
  BarChart3, Target, Zap, Clock, TrendingUp, AlertCircle, Wand2, Brain, Bot, Wifi, WifiOff, Newspaper, PieChart, Activity
} from "lucide-react"
import { PieChart as RechartsPieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts"
import ArticleReviewGrid from "@/components/admin/article-review-grid"
import ArticleDetailSheet from "@/components/admin/article-detail-sheet"
import TrilingualAutoSelectModal from "@/components/admin/trilingual-auto-select-modal"
import { useLanguage } from "@/components/language-provider"
import { useRealtimeArticles } from "@/hooks/use-realtime-articles"
import { toast } from "sonner"
import type { Article } from "@/lib/types"
import HKIIcon from "@/components/hki-icon"
import { DeduplicationMetrics } from "./components/DeduplicationMetrics"

interface QuickStats {
  total: number
  enhanced: number
  selected: number
  recentlyAdded: number
  topSources: Array<{ name: string; count: number }>
}

// Optimistic update states
interface OptimisticUpdates {
  [articleId: string]: {
    type: 'updating' | 'enhancing' | 'deleting' | 'selecting'
    timestamp: number
    originalData?: Partial<Article>
  }
}

// Modern color palette for analytics charts
const COLORS = [
  '#8b5cf6', // violet-500 - Top Stories
  '#10b981', // emerald-500 - Finance  
  '#f59e0b', // amber-500 - Tech & Science
  '#ef4444', // red-500 - Arts & Culture
  '#3b82f6', // blue-500 - Entertainment
  '#ec4899', // pink-500 - Sports
  '#06b6d4', // cyan-500 - International
  '#84cc16', // lime-500 - General
  '#f97316', // orange-500
  '#6366f1', // indigo-500
]

// Environment flag to control RPC usage
const USE_RPC_ARTICLES = process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_USE_RPC_ARTICLES !== 'false'

async function fetchAdminArticles({ 
  pageParam = 0, 
  sourceFilter = "all",
  languageFilter = "all", 
  aiEnhancedFilter = "all",
  categoryFilter = "all",
  dateFilter = "all",
  searchQuery = ""
}): Promise<{ articles: Article[]; nextPage: number | null; hasMore: boolean }> {
  
  // Use search operation if there's a search query
  if (searchQuery && searchQuery.trim()) {
    return fetchAdminArticlesSearch(searchQuery, pageParam)
  }
  
  const startTime = Date.now()
  
  if (USE_RPC_ARTICLES) {
    // Use optimized RPC endpoint
    const params = new URLSearchParams({
      operation: "list",
      page: pageParam.toString(),
      limit: "20",
    })
    
    if (sourceFilter !== "all") params.set("source", sourceFilter)
    if (languageFilter !== "all") params.set("language", languageFilter)
    if (aiEnhancedFilter !== "all") params.set("aiEnhanced", aiEnhancedFilter)
    if (categoryFilter !== "all") params.set("category", categoryFilter)
    if (dateFilter !== "all") params.set("dateFilter", dateFilter)

    const response = await fetch(`/api/admin/articles-optimized?${params}`)
    if (!response.ok) throw new Error("Failed to fetch articles via RPC")
    
    const data = await response.json()
    
    // Log performance metrics
    if (data._metadata) {
      console.log(`📄 Articles fetched in ${data._metadata.executionTime}ms via RPC (${data._metadata.cached ? 'cached' : 'fresh'})`)
    }
    
    return {
      articles: data.articles || [],
      nextPage: data.hasMore ? pageParam + 1 : null,
      hasMore: data.hasMore || false
    }
  } else {
    // Legacy implementation
    const params = new URLSearchParams({
      page: pageParam.toString(),
      limit: "20",
    })
    
    if (sourceFilter !== "all") params.set("source", sourceFilter)
    if (languageFilter !== "all") params.set("language", languageFilter)
    if (aiEnhancedFilter !== "all") params.set("aiEnhanced", aiEnhancedFilter)
    if (categoryFilter !== "all") params.set("category", categoryFilter)
    if (dateFilter !== "all") params.set("dateFilter", dateFilter)
    if (searchQuery) params.set("search", searchQuery)

    const response = await fetch(`/api/admin/articles?${params}`)
    if (!response.ok) throw new Error("Failed to fetch articles")
    
    const data = await response.json()
    const executionTime = Date.now() - startTime
    console.log(`📄 Articles fetched in ${executionTime}ms via legacy API`)
    
    return {
      articles: data.articles,
      nextPage: data.hasMore ? pageParam + 1 : null,
      hasMore: data.hasMore
    }
  }
}

// Optimized search function
async function fetchAdminArticlesSearch(
  query: string, 
  pageParam = 0
): Promise<{ articles: Article[]; nextPage: number | null; hasMore: boolean }> {
  if (USE_RPC_ARTICLES) {
    const params = new URLSearchParams({
      operation: "search",
      query: query.trim(),
      limit: "20"
    })

    const response = await fetch(`/api/admin/articles-optimized?${params}`)
    if (!response.ok) throw new Error("Failed to search articles via RPC")
    
    const data = await response.json()
    
    // Log performance metrics
    if (data._metadata) {
      console.log(`🔍 Search completed in ${data._metadata.executionTime}ms via RPC (${data.total} results)`)
    }
    
    return {
      articles: data.articles || [],
      nextPage: null, // Search doesn't support pagination yet
      hasMore: false
    }
  } else {
    // Legacy search - fall back to regular fetch with search param
    return fetchAdminArticles({ 
      pageParam, 
      searchQuery: query,
      sourceFilter: "all",
      languageFilter: "all",
      aiEnhancedFilter: "all", 
      categoryFilter: "all",
      dateFilter: "all"
    })
  }
}

export default function ArticlesPage() {
  const { t } = useLanguage()
  const queryClient = useQueryClient()
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null)
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [sourceFilter, setSourceFilter] = useState("all")
  const [languageFilter, setLanguageFilter] = useState("en")
  const [aiEnhancedFilter, setAiEnhancedFilter] = useState("true")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [dateFilter, setDateFilter] = useState("24h")
  const [isProcessing, setIsProcessing] = useState(false)
  const [showProgressModal, setShowProgressModal] = useState(false)
  const [processProgress, setProcessProgress] = useState<any>(null)
  const [selectedArticleIds, setSelectedArticleIds] = useState<Set<string>>(new Set())
  const [isDeleting, setIsDeleting] = useState(false)
  const [isBulkCloning, setIsBulkCloning] = useState(false)
  const [activeTab, setActiveTab] = useState("articles")
  const [quickStats, setQuickStats] = useState<QuickStats | null>(null)
  const [optimisticUpdates, setOptimisticUpdates] = useState<OptimisticUpdates>({})
  const [analyticsData, setAnalyticsData] = useState<any>(null)
  const [analyticsDateFilter, setAnalyticsDateFilter] = useState("24h")
  
  // Generate query key for React Query and real-time subscriptions
  const queryKey = useMemo(() => [
    'admin-articles', 
    sourceFilter, 
    languageFilter, 
    aiEnhancedFilter, 
    categoryFilter,
    dateFilter,
    searchQuery
  ], [sourceFilter, languageFilter, aiEnhancedFilter, categoryFilter, dateFilter, searchQuery])

  // Use React Query for infinite scrolling with real-time updates
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    refetch
  } = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam = 0 }) => fetchAdminArticles({
      pageParam,
      sourceFilter,
      languageFilter: aiEnhancedFilter === "true" ? languageFilter : "all", // Reset language to all for Original articles
      aiEnhancedFilter,
      categoryFilter,
      dateFilter,
      searchQuery
    }),
    getNextPageParam: (lastPage) => lastPage.nextPage,
    staleTime: 30000, // 30 seconds
    refetchOnWindowFocus: false
  })

  // Setup real-time subscriptions with intelligent filtering
  const aiEnhancedBool = aiEnhancedFilter === "true" ? true : aiEnhancedFilter === "false" ? false : undefined
  const effectiveLanguageFilter = aiEnhancedFilter === "true" ? languageFilter : "all"
  const { connectionStatus, isConnected } = useRealtimeArticles({
    queryKey,
    isAiEnhanced: aiEnhancedBool,
    language: effectiveLanguageFilter === "all" ? undefined : effectiveLanguageFilter,
    enabled: true
  })

  // Flatten articles from all pages
  const articles = useMemo(() => {
    return data?.pages.flatMap(page => page.articles) || []
  }, [data])

  // Apply optimistic updates to articles
  const articlesWithOptimisticUpdates = useMemo(() => {
    return articles.map(article => {
      const update = optimisticUpdates[article.id]
      if (!update) return article
      
      // Apply optimistic changes based on update type
      switch (update.type) {
        case 'selecting':
          return { ...article, selectedForEnhancement: true }
        case 'enhancing':
          return { ...article, isAiEnhanced: true }
        case 'deleting':
          return { ...article, deletedAt: new Date().toISOString() }
        default:
          return article
      }
    }).filter(article => {
      // Filter out articles being deleted
      const update = optimisticUpdates[article.id]
      return !(update?.type === 'deleting')
    })
  }, [articles, optimisticUpdates])

  const loadQuickStats = useCallback(async () => {
    try {
      const startTime = Date.now()
      
      if (USE_RPC_ARTICLES) {
        // Use optimized RPC endpoint
        const response = await fetch('/api/admin/articles-optimized?operation=stats')
        if (response.ok) {
          const data = await response.json()
          
          // Log performance metrics
          if (data._metadata) {
            console.log(`📊 Stats loaded in ${data._metadata.executionTime}ms via RPC (${data._metadata.cached ? 'cached' : 'fresh'})`)
          }
          
          setQuickStats(data)
        }
      } else {
        // Legacy implementation
        const response = await fetch('/api/admin/articles/stats')
        if (response.ok) {
          const stats = await response.json()
          const executionTime = Date.now() - startTime
          console.log(`📊 Stats loaded in ${executionTime}ms via legacy API`)
          setQuickStats(stats)
        }
      }
    } catch (error) {
      console.error('Error loading stats:', error)
    }
  }, [])

  const loadAnalyticsData = useCallback(async (timeFilter?: string) => {
    try {
      const startTime = Date.now()
      
      if (USE_RPC_ARTICLES) {
        // Use optimized RPC endpoint
        const params = new URLSearchParams({
          operation: "analytics"
        })
        if (timeFilter && timeFilter !== "all") {
          params.set("dateFilter", timeFilter)
        }
        
        const response = await fetch(`/api/admin/articles-optimized?${params}`)
        if (response.ok) {
          const data = await response.json()
          
          // Log performance metrics
          if (data._metadata) {
            console.log(`📈 Analytics loaded in ${data._metadata.executionTime}ms via RPC (${data.totalArticlesAnalyzed} articles analyzed)`)
          }
          
          setAnalyticsData(data)
        }
      } else {
        // Legacy implementation
        const params = new URLSearchParams()
        if (timeFilter && timeFilter !== "all") {
          params.set("dateFilter", timeFilter)
        }
        const response = await fetch(`/api/admin/articles/analytics?${params}`)
        if (response.ok) {
          const data = await response.json()
          const executionTime = Date.now() - startTime
          console.log(`📈 Analytics loaded in ${executionTime}ms via legacy API`)
          setAnalyticsData(data)
        }
      }
    } catch (error) {
      console.error('Error loading analytics:', error)
    }
  }, [])

  useEffect(() => {
    loadQuickStats()
    loadAnalyticsData()
  }, [])

  // Optimistic update helper function
  const addOptimisticUpdate = useCallback((articleId: string, type: OptimisticUpdates[string]['type'], originalData?: Partial<Article>) => {
    setOptimisticUpdates(prev => ({
      ...prev,
      [articleId]: {
        type,
        timestamp: Date.now(),
        originalData
      }
    }))
    
    // Auto-remove optimistic update after 10 seconds
    setTimeout(() => {
      setOptimisticUpdates(prev => {
        const { [articleId]: removed, ...rest } = prev
        return rest
      })
    }, 10000)
  }, [])

  const removeOptimisticUpdate = useCallback((articleId: string) => {
    setOptimisticUpdates(prev => {
      const { [articleId]: removed, ...rest } = prev
      return rest
    })
  }, [])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    refetch()
  }

  const handleRefresh = useCallback(() => {
    setSelectedArticle(null)
    setIsSheetOpen(false)
    setSelectedArticleIds(new Set())
    setOptimisticUpdates({})
    refetch()
    loadQuickStats()
    loadAnalyticsData(analyticsDateFilter)
  }, [refetch, loadQuickStats, loadAnalyticsData, analyticsDateFilter])

  const handleAnalyticsDateFilterChange = useCallback((newFilter: string) => {
    setAnalyticsDateFilter(newFilter)
    loadAnalyticsData(newFilter)
  }, [loadAnalyticsData])

  const handleAiEnhancedToggle = (checked: boolean) => {
    setAiEnhancedFilter(checked ? "true" : "false")
    // Reset language filter to English when switching to AI Enhanced
    if (checked && languageFilter === "all") {
      setLanguageFilter("en")
    }
  }

  const handleArticleExpand = (article: Article) => {
    setSelectedArticle(article)
    setIsSheetOpen(true)
  }

  const handleLoadMore = () => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage()
    }
  }

  const handleArticleSelect = (articleId: string, selected: boolean) => {
    setSelectedArticleIds(prev => {
      const newSelected = new Set(prev)
      if (selected) {
        newSelected.add(articleId)
      } else {
        newSelected.delete(articleId)
      }
      return newSelected
    })
  }

  const handleSelectAll = () => {
    const allIds = new Set(articles.map(article => article.id))
    setSelectedArticleIds(allIds)
  }

  const handleSelectNone = () => {
    setSelectedArticleIds(new Set())
  }

  const handleBatchDelete = async () => {
    if (selectedArticleIds.size === 0) {
      toast.error('Please select articles to delete')
      return
    }

    if (!confirm(`Are you sure you want to delete ${selectedArticleIds.size} selected articles?`)) {
      return
    }

    setIsDeleting(true)
    
    // Add optimistic updates
    selectedArticleIds.forEach(articleId => {
      addOptimisticUpdate(articleId, 'deleting')
    })
    
    try {
      const response = await fetch('/api/admin/articles/batch-delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          articleIds: Array.from(selectedArticleIds)
        })
      })

      const data = await response.json()

      if (!response.ok) {
        // Revert optimistic updates on error
        selectedArticleIds.forEach(articleId => {
          removeOptimisticUpdate(articleId)
        })
        throw new Error(data.error || 'Failed to delete articles')
      }

      toast.success(`Successfully deleted ${data.deletedCount} articles`)
      setSelectedArticleIds(new Set())
      loadQuickStats() // Refresh stats
    } catch (error) {
      console.error('Batch delete error:', error)
      toast.error('Failed to delete articles: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setIsDeleting(false)
    }
  }

  const handleBulkClone = async () => {
    if (selectedArticleIds.size === 0) {
      alert('Please select articles to enhance')
      return
    }

    if (selectedArticleIds.size > 10) {
      alert('Maximum 10 articles allowed per bulk operation to prevent overload')
      return
    }

    if (!confirm(`Enhance ${selectedArticleIds.size} selected articles into all 3 languages (${selectedArticleIds.size * 3} total new articles)?\n\nThis will:\n1. Mark selected articles for enhancement\n2. Process them through the new enhancement pipeline\n3. Create trilingual versions with contextual enrichment\n\nEstimated time: ${Math.ceil(selectedArticleIds.size * 2)} minutes`)) {
      return
    }

    setIsBulkCloning(true)
    let processedCount = 0
    let successCount = 0
    const results = []
    const errors = []

    try {
      // Step 1: Mark all selected articles for enhancement
      console.log(`Marking ${selectedArticleIds.size} articles for enhancement...`)
      let markedCount = 0
      
      for (const articleId of selectedArticleIds) {
        try {
          const markResponse = await fetch('/api/admin/articles/mark-for-enhancement', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              articleId,
              reason: 'Manual admin selection for bulk enhancement'
            })
          })

          if (markResponse.ok) {
            markedCount++
          } else {
            const errorData = await markResponse.json()
            errors.push(`Article ${articleId}: ${errorData.error}`)
            console.warn(`Failed to mark article ${articleId}:`, errorData.error)
            
            // Skip already selected/enhanced articles
            if (errorData.error?.includes('already')) {
              continue
            }
          }
        } catch (error) {
          console.warn(`Error marking article ${articleId}:`, error)
          errors.push(`Article ${articleId}: Network error`)
        }
      }
      
      console.log(`Marked ${markedCount}/${selectedArticleIds.size} articles for enhancement`)

      // Step 2: Process each article through the enhancement pipeline
      console.log('Processing articles through enhancement pipeline...')
      
      for (const articleId of selectedArticleIds) {
        processedCount++
        try {
          console.log(`Processing article ${processedCount}/${selectedArticleIds.size}...`)
          
          // Call the admin enhancement endpoint
          const enhanceResponse = await fetch('/api/admin/articles/enhance-selected', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            }
          })

          if (enhanceResponse.ok) {
            const result = await enhanceResponse.json()
            if (result.success) {
              successCount++
              results.push(result)
            }
          }

          // Small delay between requests to avoid overwhelming the API
          await new Promise(resolve => setTimeout(resolve, 1000))
          
        } catch (error) {
          console.error(`Error processing article ${articleId}:`, error)
        }
      }

      const totalEnhanced = results.reduce((sum, r) => sum + (r.totalSaved || 0), 0)
      const estimatedCost = results.reduce((sum, r) => sum + parseFloat(r.estimatedCost || '0'), 0)

      let message = `Bulk enhancement completed!\n\n✅ Successfully enhanced: ${successCount}/${selectedArticleIds.size} articles\n🌐 Total trilingual articles created: ${totalEnhanced}\n💰 Total estimated cost: $${estimatedCost.toFixed(4)}`
      
      if (errors.length > 0) {
        message += `\n\n⚠️ Errors encountered:\n${errors.slice(0, 5).join('\n')}${errors.length > 5 ? `\n... and ${errors.length - 5} more errors` : ''}`
      }
      
      message += '\n\nThe enhanced articles will appear automatically via real-time updates.'
      
      toast.success(message)
      
      setSelectedArticleIds(new Set())
      loadQuickStats() // Refresh stats only
    } catch (error) {
      console.error('Bulk enhancement error:', error)
      toast.error('Failed to enhance articles: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setIsBulkCloning(false)
    }
  }


  // AI Article Selection - Step 1: Select newsworthy articles
  const handleAIArticleSelection = async () => {
    try {
      setIsProcessing(true)

      // Step 1: Select article using admin API
      console.log('🎯 AI selecting article with Perplexity...')
      const selectResponse = await fetch('/api/admin/articles/select-article', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (!selectResponse.ok) {
        const error = await selectResponse.json()
        throw new Error(error.error || 'Failed to select article')
      }

      const selectResult = await selectResponse.json()
      console.log('✅ Article selected:', selectResult.article.title)
      
      toast.success(`Article selected: "${selectResult.article.title.substring(0, 50)}..." (Category: ${selectResult.article.category})`)
      loadQuickStats() // Refresh stats

    } catch (error) {
      console.error('AI article selection error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to select article')
    } finally {
      setIsProcessing(false)
    }
  }

  // AI Enhancement - Step 2: Enhance selected articles
  const handleAIEnhanceSelected = async () => {
    try {
      setIsProcessing(true)

      // Enhance selected articles using admin endpoint
      console.log('✨ Enhancing selected articles...')
      const enhanceResponse = await fetch('/api/admin/articles/enhance-selected', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (!enhanceResponse.ok) {
        const error = await enhanceResponse.json()
        throw new Error(error.error || 'Failed to enhance selected articles')
      }

      const result = await enhanceResponse.json()
      
      if (result.success) {
        toast.success(`Enhanced ${result.processed} articles into ${result.totalSaved} trilingual versions. Cost: $${result.estimatedCost}`)
      } else {
        throw new Error(result.error || 'Enhancement failed')
      }
      
      loadQuickStats() // Refresh stats

    } catch (error) {
      console.error('AI enhancement error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to enhance articles')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleSingleTrilingualAutoSelect = async () => {
    try {
      setIsProcessing(true)
      setShowProgressModal(true)
      setProcessProgress({
        step: 'selection',
        currentArticle: 0,
        totalArticles: 1,
        currentLanguage: 'en',
        completedByLanguage: {
          english: 0,
          traditionalChinese: 0,
          simplifiedChinese: 0
        },
        estimatedTimeRemaining: 180, // 3 minutes
        totalCost: 0
      })

      // Step 1: Select article using admin API
      console.log('Step 1: AI selecting article with Perplexity...')
      const selectResponse = await fetch('/api/admin/articles/select-article', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (!selectResponse.ok) {
        const error = await selectResponse.json()
        throw new Error(error.error || 'Failed to select article')
      }

      const selectResult = await selectResponse.json()
      console.log('Article selected:', selectResult)

      // Update progress - selection complete
      setProcessProgress(prev => ({
        ...prev,
        step: 'enhancement',
        currentArticle: 1
      }))

      // Step 2: Enhance selected article using admin endpoint
      console.log('Step 2: Enhancing selected article...')
      const enhanceResponse = await fetch('/api/admin/articles/enhance-selected', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (!enhanceResponse.ok) {
        const error = await enhanceResponse.json()
        throw new Error(error.error || 'Failed to enhance selected article')
      }

      const result = await enhanceResponse.json()
      
      // Update progress to complete
      setProcessProgress((prev: any) => ({
        ...prev,
        step: 'complete',
        completedByLanguage: {
          english: result.articlesByLanguage?.english || 1,
          traditionalChinese: result.articlesByLanguage?.traditionalChinese || 1,
          simplifiedChinese: result.articlesByLanguage?.simplifiedChinese || 1
        },
        totalCost: parseFloat(result.estimatedCost || '0.075')
      }))

      // Close modal after successful processing - articles will update via real-time
      setTimeout(() => {
        setShowProgressModal(false)
        setProcessProgress(null)
        loadQuickStats() // Refresh stats
      }, 3000)

    } catch (error) {
      console.error('Single auto-select error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to run single article auto-selection')
    } finally {
      setIsProcessing(false)
    }
  }

  const totalArticles = articlesWithOptimisticUpdates.length
  const sourceStats = articlesWithOptimisticUpdates.reduce((acc, article) => {
    acc[article.source] = (acc[article.source] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  return (
    <div className="flex flex-1 flex-col gap-4">
      {/* Enhanced Header Section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Article Management</h1>
          <p className="text-muted-foreground">
            Review, edit, and enhance articles from all sources with AI-powered tools
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleRefresh} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Real-time Connection Status */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {isConnected ? (
            <>
              <Wifi className="h-4 w-4 text-green-500" />
              <span>Real-time updates active</span>
            </>
          ) : (
            <>
              <WifiOff className="h-4 w-4 text-amber-500" />
              <span>Connecting to real-time updates...</span>
            </>
          )}
        </div>
        <div className="text-xs text-muted-foreground">
          {optimisticUpdates && Object.keys(optimisticUpdates).length > 0 && (
            <span>{Object.keys(optimisticUpdates).length} operations in progress</span>
          )}
        </div>
      </div>

      {/* Modern Stats Dashboard */}
      <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
        <Card className="border-0 shadow-sm bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-900 dark:to-slate-800/50 hover:shadow-md transition-all duration-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-300">Total Articles</CardTitle>
            <div className="p-1.5 rounded-lg bg-gradient-to-r from-slate-500 to-slate-600 text-white">
              <BarChart3 className="h-3.5 w-3.5" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100 mb-1">
              {quickStats?.total?.toLocaleString() || totalArticles.toLocaleString()}
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-gradient-to-r from-slate-500 to-slate-600"></div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Loaded: {totalArticles.toLocaleString()}
              </p>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-0 shadow-sm bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-900 dark:to-slate-800/50 hover:shadow-md transition-all duration-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-300">AI Enhanced</CardTitle>
            <div className="p-1.5 rounded-lg bg-gradient-to-r from-slate-600 to-slate-700 text-white">
              <HKIIcon className="h-3.5 w-3.5" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl sm:text-3xl font-bold text-slate-700 dark:text-slate-200 mb-1">
              {quickStats?.enhanced?.toLocaleString() || 0}
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-gradient-to-r from-slate-600 to-slate-700"></div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {quickStats?.total ? ((quickStats.enhanced / quickStats.total) * 100).toFixed(1) : 0}% enhanced
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-900 dark:to-slate-800/50 hover:shadow-md transition-all duration-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-300">Selected</CardTitle>
            <div className="p-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-600 text-white">
              <Target className="h-3.5 w-3.5" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl sm:text-3xl font-bold text-amber-700 dark:text-amber-400 mb-1">
              {quickStats?.selected?.toLocaleString() || 0}
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-gradient-to-r from-amber-500 to-orange-600"></div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Ready for enhancement
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-900 dark:to-slate-800/50 hover:shadow-md transition-all duration-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-300">Recent</CardTitle>
            <div className="p-1.5 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-600 text-white">
              <Clock className="h-3.5 w-3.5" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl sm:text-3xl font-bold text-blue-700 dark:text-blue-400 mb-1">
              {quickStats?.recentlyAdded?.toLocaleString() || 0}
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600"></div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Added today
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-900 dark:to-slate-800/50 hover:shadow-md transition-all duration-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-300">Top Source</CardTitle>
            <div className="p-1.5 rounded-lg bg-gradient-to-r from-emerald-500 to-green-600 text-white">
              <TrendingUp className="h-3.5 w-3.5" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl sm:text-3xl font-bold text-emerald-700 dark:text-emerald-400 mb-1">
              {quickStats?.topSources?.[0]?.count?.toLocaleString() || 0}
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-gradient-to-r from-emerald-500 to-green-600"></div>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {quickStats?.topSources?.[0]?.name || 'N/A'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Modern Tabbed Interface */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-slate-50 to-white dark:from-slate-800 dark:to-slate-900 rounded-t-lg p-1">
          <TabsList className="grid w-full grid-cols-3 bg-transparent">
            <TabsTrigger 
              value="articles" 
              className="flex items-center gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-slate-200 dark:data-[state=active]:border-slate-700 transition-all duration-200"
            >
              <div className="p-1 rounded-md bg-gradient-to-r from-slate-500 to-slate-600 text-white">
                <BarChart3 className="h-3.5 w-3.5" />
              </div>
              <span className="font-medium">Article Browser</span>
            </TabsTrigger>
            <TabsTrigger 
              value="analytics" 
              className="flex items-center gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-slate-200 dark:data-[state=active]:border-slate-700 transition-all duration-200"
            >
              <div className="p-1 rounded-md bg-gradient-to-r from-blue-500 to-indigo-600 text-white">
                <TrendingUp className="h-3.5 w-3.5" />
              </div>
              <span className="font-medium">Analytics</span>
            </TabsTrigger>
            <TabsTrigger 
              value="automation" 
              className="flex items-center gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-slate-200 dark:data-[state=active]:border-slate-700 transition-all duration-200"
            >
              <div className="p-1 rounded-md bg-gradient-to-r from-violet-500 to-purple-600 text-white">
                <Wand2 className="h-3.5 w-3.5" />
              </div>
              <span className="font-medium">AI Tools</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="articles" className="space-y-6">
          <Card className="border-0 shadow-sm bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-900 dark:to-slate-800/50">
            <CardContent className="p-4 sm:p-6">
              {/* Modern Header with Enhanced Controls */}
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className="p-2 rounded-xl bg-gradient-to-r from-slate-500 to-slate-600 text-white shadow-lg">
                    <BarChart3 className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100">Article Management</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Browse, filter, and manage articles with real-time updates</p>
                  </div>
                  <div className="flex items-center gap-2 bg-green-50 dark:bg-green-950/20 px-3 py-1.5 rounded-full border border-green-200 dark:border-green-800">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-xs font-medium text-green-700 dark:text-green-400">Live Updates</span>
                  </div>
                </div>
                
                {/* Enhanced Search */}
                <form onSubmit={handleSearch} className="flex gap-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      placeholder="Search articles by title, content, or source..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 h-10 w-72 text-sm bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 shadow-sm hover:border-slate-300 dark:hover:border-slate-500 focus:border-blue-500 dark:focus:border-blue-400 transition-colors"
                    />
                  </div>
                  <Button type="submit" variant="outline" size="sm" className="h-10 px-4 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm transition-colors">
                    <Search className="h-4 w-4 mr-2" />
                    Search
                  </Button>
                  <Button onClick={handleRefresh} variant="ghost" size="sm" className="h-10 w-10 p-0 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </form>
              </div>

              {/* Modern Filters Section */}
              <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4 mb-6 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <Filter className="h-4 w-4 text-slate-500" />
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Filters</span>
                  <div className="flex-1 border-b border-slate-200 dark:border-slate-700 ml-2"></div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                  {/* Source Filter */}
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Source</label>
                    <Select value={sourceFilter} onValueChange={setSourceFilter}>
                      <SelectTrigger className="h-9 text-sm bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500 transition-colors">
                        <SelectValue placeholder="All Sources" />
                      </SelectTrigger>
                      <SelectContent className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                        <SelectItem value="all">All Sources</SelectItem>
                        <SelectItem value="HKFP">HKFP</SelectItem>
                        <SelectItem value="SingTao">SingTao</SelectItem>
                        <SelectItem value="HK01">HK01</SelectItem>
                        <SelectItem value="ONCC">ONCC</SelectItem>
                        <SelectItem value="RTHK">RTHK</SelectItem>
                        <SelectItem value="on.cc">on.cc</SelectItem>
                        <SelectItem value="scmp">SCMP</SelectItem>
                        <SelectItem value="am730">AM730</SelectItem>
                        <SelectItem value="bloomberg">Bloomberg</SelectItem>
                        <SelectItem value="TheStandard">TheStandard</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* Enhanced Article Type Toggle */}
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Article Type</label>
                    <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-1 border border-slate-200 dark:border-slate-700">
                      {/* Original Button */}
                      <button
                        onClick={() => handleAiEnhancedToggle(false)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 flex-1 justify-center ${
                          aiEnhancedFilter === "false"
                            ? "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 shadow-sm border border-slate-200 dark:border-slate-600"
                            : "text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                        }`}
                      >
                        <Newspaper className={`h-3 w-3 transition-colors ${
                          aiEnhancedFilter === "false" ? "text-slate-600 dark:text-slate-400" : "text-slate-400 dark:text-slate-500"
                        }`} />
                        Original
                      </button>
                      
                      {/* AI Enhanced Button */}
                      <button
                        onClick={() => handleAiEnhancedToggle(true)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 flex-1 justify-center ${
                          aiEnhancedFilter === "true"
                            ? "bg-gradient-to-r from-slate-600 to-slate-700 dark:from-slate-500 dark:to-slate-600 text-white shadow-md shadow-slate-500/20"
                            : "text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                        }`}
                      >
                        <HKIIcon className={`h-3 w-3 transition-colors ${
                          aiEnhancedFilter === "true" ? "text-white" : "text-slate-400 dark:text-slate-500"
                        }`} />
                        AI Enhanced
                      </button>
                    </div>
                  </div>
                  
                  {/* Language Filter */}
                  <div className={`space-y-2 transition-all duration-200 ${aiEnhancedFilter === "true" ? "opacity-100" : "opacity-50 pointer-events-none"}`}>
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Language</label>
                    <Select value={languageFilter} onValueChange={setLanguageFilter} disabled={aiEnhancedFilter !== "true"}>
                      <SelectTrigger className="h-9 text-sm bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500 transition-colors">
                        <SelectValue placeholder="All Languages" />
                      </SelectTrigger>
                      <SelectContent className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                        <SelectItem value="all">All Languages</SelectItem>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="zh-TW">繁體中文</SelectItem>
                        <SelectItem value="zh-CN">简体中文</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* Category Filter */}
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Category</label>
                    <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                      <SelectTrigger className="h-9 text-sm bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500 transition-colors">
                        <SelectValue placeholder="All Categories" />
                      </SelectTrigger>
                      <SelectContent className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                        <SelectItem value="all">All Categories</SelectItem>
                        <SelectItem value="Top Stories">Top Stories</SelectItem>
                        <SelectItem value="Finance">Finance</SelectItem>
                        <SelectItem value="Tech & Science">Tech & Science</SelectItem>
                        <SelectItem value="Arts & Culture">Arts & Culture</SelectItem>
                        <SelectItem value="Entertainment">Entertainment</SelectItem>
                        <SelectItem value="Sports">Sports</SelectItem>
                        <SelectItem value="International">International</SelectItem>
                        <SelectItem value="General">General</SelectItem>
                        <SelectItem value="Local">Local</SelectItem>
                        <SelectItem value="News">News</SelectItem>
                        <SelectItem value="Politics">Politics</SelectItem>
                        <SelectItem value="cars">Cars</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* Time Filter */}
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Time Range</label>
                    <Select value={dateFilter} onValueChange={setDateFilter}>
                      <SelectTrigger className="h-9 text-sm bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500 transition-colors">
                        <SelectValue placeholder="Select time range" />
                      </SelectTrigger>
                      <SelectContent className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                        <SelectItem value="2h">Past 2 Hours</SelectItem>
                        <SelectItem value="6h">Past 6 Hours</SelectItem>
                        <SelectItem value="24h">Past 24 Hours</SelectItem>
                        <SelectItem value="7d">Past 7 Days</SelectItem>
                        <SelectItem value="30d">Past 30 Days</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Modern Bulk Actions */}
              {selectedArticleIds.size > 0 ? (
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 rounded-lg border border-blue-200 dark:border-blue-800 p-4 mb-6 shadow-sm">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-blue-500 text-white">
                        <CheckSquare className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                          {selectedArticleIds.size} {selectedArticleIds.size === 1 ? 'article' : 'articles'} selected
                        </div>
                        <div className="text-xs text-blue-700 dark:text-blue-300">
                          Choose an action to perform on selected articles
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleSelectNone}
                        className="h-8 px-3 text-xs text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                      >
                        Clear Selection
                      </Button>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleBulkClone}
                          disabled={isBulkCloning}
                          className="h-8 px-3 text-xs bg-white dark:bg-slate-800 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 shadow-sm transition-colors"
                        >
                          {isBulkCloning ? (
                            <div className="mr-2 h-3 w-3 animate-spin rounded-full border border-current border-t-transparent" />
                          ) : (
                            <Wand2 className="h-3 w-3 mr-2" />
                          )}
                          Enhance Articles
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleBatchDelete}
                          disabled={isDeleting}
                          className="h-8 px-3 text-xs bg-white dark:bg-slate-800 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 shadow-sm transition-colors"
                        >
                          {isDeleting ? (
                            <div className="mr-2 h-3 w-3 animate-spin rounded-full border border-current border-t-transparent" />
                          ) : (
                            <Trash2 className="h-3 w-3 mr-2" />
                          )}
                          Delete Articles
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-dashed border-slate-200 dark:border-slate-700 p-4 mb-6">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-500">
                        <CheckSquare className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-slate-600 dark:text-slate-400">No articles selected</div>
                        <div className="text-xs text-slate-500 dark:text-slate-500">Select articles to perform bulk actions</div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleSelectAll}
                      className="h-8 px-3 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                    >
                      <CheckSquare className="h-3 w-3 mr-2" />
                      Select All Articles
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Article Grid */}
          <ArticleReviewGrid
            articles={articlesWithOptimisticUpdates}
            loading={isLoading}
            onArticleExpand={handleArticleExpand}
            onLoadMore={handleLoadMore}
            hasMore={hasNextPage || false}
            selectedArticleIds={selectedArticleIds}
            onArticleSelect={handleArticleSelect}
            isLoadingMore={isFetchingNextPage}
            optimisticUpdates={optimisticUpdates}
          />
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          {/* Modern Analytics Dashboard Header */}
          <Card className="border-0 shadow-sm bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-900 dark:to-slate-800/50">
            <CardContent className="p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg">
                    <TrendingUp className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100">Analytics Dashboard</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400">View comprehensive pipeline analytics for selected time period</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 bg-white dark:bg-slate-800 rounded-lg p-3 border border-slate-200 dark:border-slate-700 shadow-sm">
                  <Clock className="h-4 w-4 text-slate-500 flex-shrink-0" />
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">Time Period:</span>
                  <Select value={analyticsDateFilter} onValueChange={handleAnalyticsDateFilterChange}>
                    <SelectTrigger className="w-40 h-9 text-sm bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-600 shadow-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-xl">
                      <SelectItem value="2h" className="flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-700">
                        <span>Past 2 Hours</span>
                      </SelectItem>
                      <SelectItem value="6h" className="flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-700">
                        <span>Past 6 Hours</span>
                      </SelectItem>
                      <SelectItem value="24h" className="flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-700">
                        <span>Past 24 Hours</span>
                      </SelectItem>
                      <SelectItem value="7d" className="flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-700">
                        <span>Past 7 Days</span>
                      </SelectItem>
                      <SelectItem value="30d" className="flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-700">
                        <span>Past 30 Days</span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card className="border-0 shadow-sm bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-900 dark:to-slate-800/50">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                      <div className="p-1.5 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-600 text-white">
                        <BarChart3 className="h-4 w-4" />
                      </div>
                      Source Performance
                    </CardTitle>
                    <CardDescription className="text-sm text-slate-600 dark:text-slate-400">
                      Article distribution by news source ({analyticsData?.timePeriod || 'selected time period'})
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="text-xs font-medium px-2 py-1">
                    {analyticsData?.sourceEnhancement ? 
                      `${analyticsData.sourceEnhancement.reduce((sum: number, source: any) => sum + source.total, 0).toLocaleString()} total` : 
                      'Loading...'
                    }
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-2">
                {analyticsData?.sourceEnhancement ? (
                  <div className="space-y-4">
                    {analyticsData.sourceEnhancement.slice(0, 8).map((source: any) => {
                      const maxCount = analyticsData.sourceEnhancement[0]?.total || 1
                      const barWidth = (source.total / maxCount) * 100
                      return (
                        <div key={source.name} className="group">
                          {/* Header with source name and badge */}
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-blue-500 to-cyan-600 flex-shrink-0"></div>
                              <span className="text-sm sm:text-base font-medium text-slate-900 dark:text-slate-100 truncate">
                                {source.name}
                              </span>
                            </div>
                            <Badge 
                              variant={source.rate >= 50 ? "default" : source.rate >= 20 ? "secondary" : "outline"}
                              className="text-xs px-2 py-1 flex-shrink-0 ml-2"
                            >
                              {source.rate}%
                            </Badge>
                          </div>
                          
                          {/* Progress bar with left-aligned count */}
                          <div className="relative">
                            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5 sm:h-3 overflow-hidden">
                              <div 
                                className="bg-gradient-to-r from-blue-500 to-cyan-600 h-full rounded-full transition-all duration-700 ease-out group-hover:shadow-lg group-hover:shadow-blue-500/25 relative" 
                                style={{ width: `${Math.max(barWidth, 25)}%` }}
                              >
                                {/* Count positioned inside bar, left-aligned */}
                                <div className="absolute inset-y-0 left-0 flex items-center pl-2 sm:pl-3">
                                  <span className="text-xs sm:text-sm font-semibold text-white drop-shadow-sm">
                                    {source.total.toLocaleString()}
                                  </span>
                                </div>
                              </div>
                            </div>
                            
                            {/* Fallback count for very small bars */}
                            {barWidth < 25 && (
                              <div className="absolute top-1/2 -translate-y-1/2 right-2">
                                <span className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300">
                                  {source.total.toLocaleString()}
                                </span>
                              </div>
                            )}
                          </div>
                          
                          {/* Additional metrics for larger screens */}
                          <div className="hidden sm:flex items-center justify-between mt-2 text-xs text-slate-500 dark:text-slate-400">
                            <span>Enhanced: {source.enhanced.toLocaleString()}</span>
                            <span className="text-right">
                              {((source.total / analyticsData.sourceEnhancement.reduce((sum: number, s: any) => sum + s.total, 0)) * 100).toFixed(1)}% of total
                            </span>
                          </div>
                        </div>
                      )
                    })}
                    
                    {/* Summary stats for mobile */}
                    <div className="sm:hidden mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                      <div className="grid grid-cols-2 gap-4 text-center">
                        <div>
                          <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                            {analyticsData.sourceEnhancement.reduce((sum: number, s: any) => sum + s.total, 0).toLocaleString()}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">Total Articles</div>
                        </div>
                        <div>
                          <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                            {analyticsData.sourceEnhancement.length}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">Active Sources</div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-[280px] sm:h-[320px] text-slate-500 dark:text-slate-400">
                    <div className="relative">
                      <Loader2 className="h-7 w-7 sm:h-8 sm:w-8 animate-spin text-blue-500" />
                      <div className="absolute inset-0 rounded-full border-2 border-blue-200 dark:border-blue-900"></div>
                    </div>
                    <p className="mt-3 text-sm sm:text-base font-medium text-center">Loading source performance...</p>
                    <p className="text-xs sm:text-sm text-slate-400 dark:text-slate-500 text-center">Analyzing article distribution</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-900 dark:to-slate-800/50">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                      <div className="p-1.5 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600 text-white">
                        <Zap className="h-4 w-4" />
                      </div>
                      Enhancement Pipeline
                    </CardTitle>
                    <CardDescription className="text-sm text-slate-600 dark:text-slate-400">
                      AI processing statistics ({analyticsData?.timePeriod || 'selected time period'})
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="text-xs font-medium px-2 py-1">
                    {analyticsData?.pipelineMetrics ? 
                      `${analyticsData.pipelineMetrics.enhancementConversionRate}% rate` : 
                      'Loading...'
                    }
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-2">
                {analyticsData?.pipelineMetrics ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <div className="group p-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:shadow-sm transition-all duration-200">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Enhancement Rate</span>
                          <Badge 
                            variant={analyticsData.pipelineMetrics.enhancementConversionRate >= 30 ? "default" : "secondary"} 
                            className="text-xs"
                          >
                            {analyticsData.pipelineMetrics.enhancementConversionRate}%
                          </Badge>
                        </div>
                        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5">
                          <div 
                            className="bg-gradient-to-r from-emerald-500 to-teal-600 h-1.5 rounded-full transition-all duration-500" 
                            style={{ width: `${analyticsData.pipelineMetrics.enhancementConversionRate}%` }}
                          />
                        </div>
                      </div>
                      
                      <div className="group p-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:shadow-sm transition-all duration-200">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Processing Efficiency</span>
                          <Badge 
                            variant={analyticsData.pipelineMetrics.processingEfficiency >= 70 ? "default" : analyticsData.pipelineMetrics.processingEfficiency >= 40 ? "secondary" : "outline"} 
                            className="text-xs"
                          >
                            {analyticsData.pipelineMetrics.processingEfficiency}%
                          </Badge>
                        </div>
                        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5">
                          <div 
                            className="bg-gradient-to-r from-blue-500 to-cyan-600 h-1.5 rounded-full transition-all duration-500" 
                            style={{ width: `${analyticsData.pipelineMetrics.processingEfficiency}%` }}
                          />
                        </div>
                      </div>
                      
                      <div className="group p-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:shadow-sm transition-all duration-200">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Source Coverage</span>
                          <Badge 
                            variant={analyticsData.pipelineMetrics.sourceCoverageScore >= 70 ? "default" : "secondary"} 
                            className="text-xs"
                          >
                            {analyticsData.pipelineMetrics.sourceCoverageScore}%
                          </Badge>
                        </div>
                        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5">
                          <div 
                            className="bg-gradient-to-r from-violet-500 to-purple-600 h-1.5 rounded-full transition-all duration-500" 
                            style={{ width: `${analyticsData.pipelineMetrics.sourceCoverageScore}%` }}
                          />
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-slate-500" />
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Processing Time</span>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {analyticsData.pipelineMetrics.avgTimeToEnhancement}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center justify-between p-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                        <div className="flex items-center gap-2">
                          <Target className="h-4 w-4 text-slate-500" />
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Queue Size</span>
                        </div>
                        <Badge 
                          variant={analyticsData.pipelineMetrics.queueSize > 0 ? "destructive" : "outline"} 
                          className="text-xs"
                        >
                          {analyticsData.pipelineMetrics.queueSize}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center justify-between p-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="h-4 w-4 text-slate-500" />
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Stale Selections</span>
                        </div>
                        <Badge 
                          variant={analyticsData.pipelineMetrics.staleSelections > 0 ? "destructive" : "outline"} 
                          className="text-xs"
                        >
                          {analyticsData.pipelineMetrics.staleSelections}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center justify-between p-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                        <div className="flex items-center gap-2">
                          <RefreshCw className="h-4 w-4 text-slate-500" />
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Operations</span>
                        </div>
                        <Badge 
                          variant={Object.keys(optimisticUpdates).length > 0 ? "default" : "outline"}
                          className="text-xs"
                        >
                          {Object.keys(optimisticUpdates).length}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-[280px] text-slate-500 dark:text-slate-400">
                    <div className="relative">
                      <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
                      <div className="absolute inset-0 rounded-full border-2 border-emerald-200 dark:border-emerald-900"></div>
                    </div>
                    <p className="mt-3 text-sm font-medium">Loading pipeline metrics...</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">Processing enhancement statistics</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* New Analytics Cards */}
          <div className="grid gap-4 md:grid-cols-2 mt-4">
            {/* Category Distribution for Enhanced Articles */}
            <Card className="border-0 shadow-sm bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-900 dark:to-slate-800/50">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                      <div className="p-1.5 rounded-lg bg-gradient-to-r from-violet-500 to-purple-600 text-white">
                        <PieChart className="h-4 w-4" />
                      </div>
                      Enhanced Articles by Category
                    </CardTitle>
                    <CardDescription className="text-sm text-slate-600 dark:text-slate-400">
                      Distribution of AI-enhanced content across news categories ({analyticsData?.timePeriod || 'selected time period'})
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="text-xs font-medium px-2 py-1">
                    {analyticsData?.categoryDistribution ? 
                      `${analyticsData.categoryDistribution.reduce((sum: number, cat: any) => sum + cat.value, 0).toLocaleString()} total` : 
                      'Loading...'
                    }
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-2">
                {analyticsData?.categoryDistribution ? (
                  <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-center">
                    {/* Pie Chart */}
                    <div className="lg:col-span-3">
                      <ResponsiveContainer width="100%" height={280}>
                        <RechartsPieChart>
                          <Pie
                            data={analyticsData.categoryDistribution}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            outerRadius={100}
                            innerRadius={50}
                            fill="#8884d8"
                            dataKey="value"
                            strokeWidth={2}
                            stroke="rgba(255,255,255,0.8)"
                          >
                            {analyticsData.categoryDistribution.map((entry: any, index: number) => (
                              <Cell 
                                key={`cell-${index}`} 
                                fill={COLORS[index % COLORS.length]}
                                className="hover:opacity-80 transition-opacity duration-200"
                              />
                            ))}
                          </Pie>
                          <Tooltip 
                            content={({ active, payload }) => {
                              if (active && payload && payload.length) {
                                const data = payload[0].payload;
                                const total = analyticsData.categoryDistribution.reduce((sum: number, cat: any) => sum + cat.value, 0);
                                const percentage = ((data.value / total) * 100).toFixed(1);
                                return (
                                  <div className="bg-white dark:bg-slate-800 p-3 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700">
                                    <p className="font-semibold text-sm">{data.name}</p>
                                    <p className="text-xs text-slate-600 dark:text-slate-400">
                                      {data.value.toLocaleString()} articles ({percentage}%)
                                    </p>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                        </RechartsPieChart>
                      </ResponsiveContainer>
                    </div>
                    
                    {/* Legend with Stats */}
                    <div className="lg:col-span-2 space-y-3">
                      <div className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-4">
                        Category Breakdown
                      </div>
                      <div className="space-y-2.5 max-h-64 overflow-y-auto pr-2" style={{
                        scrollbarWidth: 'thin',
                        scrollbarColor: '#cbd5e1 #f1f5f9'
                      }}>
                        {analyticsData.categoryDistribution.map((entry: any, index: number) => {
                          const total = analyticsData.categoryDistribution.reduce((sum: number, cat: any) => sum + cat.value, 0);
                          const percentage = ((entry.value / total) * 100).toFixed(1);
                          return (
                            <div key={entry.name} className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                <div 
                                  className="w-3 h-3 rounded-full flex-shrink-0 ring-2 ring-white dark:ring-slate-800"
                                  style={{ backgroundColor: COLORS[index % COLORS.length] }}
                                />
                                <span className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">
                                  {entry.name}
                                </span>
                              </div>
                              <div className="text-right flex-shrink-0 ml-3">
                                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                  {entry.value.toLocaleString()}
                                </div>
                                <div className="text-xs text-slate-500 dark:text-slate-400">
                                  {percentage}%
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-[280px] text-slate-500 dark:text-slate-400">
                    <div className="relative">
                      <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
                      <div className="absolute inset-0 rounded-full border-2 border-violet-200 dark:border-violet-900"></div>
                    </div>
                    <p className="mt-3 text-sm font-medium">Loading category distribution...</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">Analyzing enhanced articles</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Selection Pipeline Health */}
            <Card className="border-0 shadow-sm bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-900 dark:to-slate-800/50">
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <CardTitle className="flex items-center gap-2 text-base sm:text-lg font-semibold mb-1.5">
                      <div className="p-1.5 rounded-lg bg-gradient-to-r from-orange-500 to-red-600 text-white flex-shrink-0">
                        <Activity className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      </div>
                      <span className="truncate">Selection Pipeline Health</span>
                    </CardTitle>
                    <CardDescription className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                      Pipeline metrics ({analyticsData?.timePeriod || 'selected time period'})
                      {analyticsData?.systemEvolution && (
                        <div className="text-xs text-amber-600 dark:text-amber-400 mt-1 font-medium">
                          ⚠️ System performance has improved significantly over time
                        </div>
                      )}
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="text-xs font-medium px-2 py-1 flex-shrink-0 whitespace-nowrap">
                    {analyticsData?.pipelineMetrics ? 
                      `${analyticsData.pipelineMetrics.processingEfficiency}% efficiency` : 
                      'Loading...'
                    }
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {analyticsData?.pipelineMetrics ? (
                  <div className="space-y-4">
                    {/* Primary metrics - always stacked for consistency */}
                    <div className="space-y-3">
                      <div className="p-3 sm:p-4 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Enhancement Rate</span>
                          <Badge 
                            variant={analyticsData.pipelineMetrics.enhancementConversionRate >= 30 ? "default" : "secondary"} 
                            className="text-xs"
                          >
                            {analyticsData.pipelineMetrics.enhancementConversionRate}%
                          </Badge>
                        </div>
                        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                          <div 
                            className="bg-gradient-to-r from-blue-500 to-cyan-600 h-2 rounded-full transition-all duration-500" 
                            style={{ width: `${analyticsData.pipelineMetrics.enhancementConversionRate}%` }}
                          />
                        </div>
                      </div>
                      
                      <div className="p-3 sm:p-4 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Source Coverage</span>
                          <Badge 
                            variant={analyticsData.pipelineMetrics.sourceCoverageScore >= 70 ? "default" : "secondary"} 
                            className="text-xs"
                          >
                            {analyticsData.pipelineMetrics.sourceCoverageScore}%
                          </Badge>
                        </div>
                        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                          <div 
                            className="bg-gradient-to-r from-emerald-500 to-teal-600 h-2 rounded-full transition-all duration-500" 
                            style={{ width: `${analyticsData.pipelineMetrics.sourceCoverageScore}%` }}
                          />
                        </div>
                      </div>
                      
                      <div className="p-3 sm:p-4 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Selection Opportunity</span>
                          <Badge 
                            variant={analyticsData.pipelineMetrics.selectionOpportunityRate >= 10 ? "default" : analyticsData.pipelineMetrics.selectionOpportunityRate >= 5 ? "secondary" : "outline"} 
                            className="text-xs"
                          >
                            {analyticsData.pipelineMetrics.selectionOpportunityRate || 0}%
                          </Badge>
                        </div>
                        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                          <div 
                            className="bg-gradient-to-r from-cyan-500 to-blue-600 h-2 rounded-full transition-all duration-500" 
                            style={{ width: `${Math.min(100, (analyticsData.pipelineMetrics.selectionOpportunityRate || 0) * 5)}%` }}
                          />
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          Articles with selection chance vs total scraped
                        </p>
                      </div>
                      
                      <div className="p-3 sm:p-4 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Processing Efficiency</span>
                          <Badge 
                            variant={analyticsData.pipelineMetrics.processingEfficiency >= 70 ? "default" : analyticsData.pipelineMetrics.processingEfficiency >= 40 ? "secondary" : "outline"} 
                            className="text-xs"
                          >
                            {analyticsData.pipelineMetrics.processingEfficiency}%
                          </Badge>
                        </div>
                        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                          <div 
                            className="bg-gradient-to-r from-orange-500 to-red-600 h-2 rounded-full transition-all duration-500" 
                            style={{ width: `${analyticsData.pipelineMetrics.processingEfficiency}%` }}
                          />
                        </div>
                      </div>
                    </div>
                    
                    {/* Operational metrics in responsive grid */}
                    <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
                      <h4 className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">Operational Status</h4>
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        <div className="flex flex-col items-center p-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center">
                          <Clock className="h-4 w-4 text-slate-500 mb-2" />
                          <div className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Processing Time</div>
                          <Badge variant="outline" className="text-xs">
                            {analyticsData.pipelineMetrics.avgTimeToEnhancement}
                          </Badge>
                        </div>
                        
                        <div className="flex flex-col items-center p-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center">
                          <Target className="h-4 w-4 text-slate-500 mb-2" />
                          <div className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Queue Size</div>
                          <Badge 
                            variant={analyticsData.pipelineMetrics.queueSize > 0 ? "destructive" : "outline"} 
                            className="text-xs"
                          >
                            {analyticsData.pipelineMetrics.queueSize}
                          </Badge>
                        </div>
                        
                        <div className="flex flex-col items-center p-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center">
                          <AlertCircle className="h-4 w-4 text-slate-500 mb-2" />
                          <div className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Stale Items</div>
                          <Badge 
                            variant={analyticsData.pipelineMetrics.staleSelections > 0 ? "destructive" : "outline"} 
                            className="text-xs"
                          >
                            {analyticsData.pipelineMetrics.staleSelections}
                          </Badge>
                        </div>
                        
                        <div className="flex flex-col items-center p-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center">
                          <RefreshCw className="h-4 w-4 text-slate-500 mb-2" />
                          <div className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Operations</div>
                          <Badge 
                            variant={Object.keys(optimisticUpdates).length > 0 ? "default" : "outline"}
                            className="text-xs"
                          >
                            {Object.keys(optimisticUpdates).length}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-[280px] text-slate-500 dark:text-slate-400">
                    <div className="relative">
                      <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
                      <div className="absolute inset-0 rounded-full border-2 border-orange-200 dark:border-orange-900"></div>
                    </div>
                    <p className="mt-3 text-sm font-medium text-center">Loading pipeline health...</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 text-center">Analyzing selection metrics</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Story Deduplication Metrics */}
          <div className="mt-4">
            <DeduplicationMetrics />
          </div>

          {/* Enhancement Trends */}
          <div className="mt-4">
            <Card className="border-0 shadow-sm bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-900 dark:to-slate-800/50">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                      <div className="p-1.5 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600 text-white">
                        <TrendingUp className="h-4 w-4" />
                      </div>
                      Enhancement Trends
                    </CardTitle>
                    <CardDescription className="text-sm text-slate-600 dark:text-slate-400">
                      Article enhancement pipeline flow ({analyticsData?.timePeriod || 'selected time period'})
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="outline" className="text-xs px-2 py-1 bg-slate-50 text-slate-700 border-slate-200">
                      <div className="w-2 h-2 bg-slate-400 rounded-full mr-1.5"></div>
                      Scraped
                    </Badge>
                    <Badge variant="outline" className="text-xs px-2 py-1 bg-emerald-50 text-emerald-700 border-emerald-200">
                      <div className="w-2 h-2 bg-emerald-500 rounded-full mr-1.5"></div>
                      Enhanced
                    </Badge>
                    <Badge variant="outline" className="text-xs px-2 py-1 bg-violet-50 text-violet-700 border-violet-200">
                      <div className="w-2 h-2 bg-violet-500 rounded-full mr-1.5"></div>
                      Selected
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {analyticsData?.enhancementTrends ? (
                  <ResponsiveContainer width="100%" height={320}>
                    <BarChart data={analyticsData.enhancementTrends} barCategoryGap="20%">
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.5} />
                      <XAxis 
                        dataKey="date"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: analyticsDateFilter === '2h' || analyticsDateFilter === '6h' ? 10 : 11, fill: '#64748b' }}
                        dy={10}
                        angle={analyticsDateFilter === '2h' || analyticsDateFilter === '6h' ? -45 : 0}
                        textAnchor={analyticsDateFilter === '2h' || analyticsDateFilter === '6h' ? 'end' : 'middle'}
                        height={analyticsDateFilter === '2h' || analyticsDateFilter === '6h' ? 80 : 60}
                        interval={analyticsDateFilter === '2h' ? 0 : analyticsDateFilter === '6h' || analyticsDateFilter === '24h' ? 'preserveStartEnd' : 0}
                        minTickGap={analyticsDateFilter === '2h' || analyticsDateFilter === '6h' ? 5 : 10}
                      />
                      <YAxis 
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 12, fill: '#64748b' }}
                        dx={-10}
                      />
                      <Tooltip 
                        content={({ active, payload, label }) => {
                          if (active && payload && payload.length) {
                            // Format label based on time filter for better readability
                            let formattedLabel = label
                            if (analyticsDateFilter === '2h' || analyticsDateFilter === '6h' || analyticsDateFilter === '24h') {
                              // For hourly/minute intervals, show as time
                              const timeMatch = label?.match(/(\d{2}):(\d{2})/)
                              if (timeMatch) {
                                formattedLabel = `${timeMatch[0]} ${new Date().toDateString()}`
                              }
                            } else {
                              // For daily intervals, label should already be properly formatted
                              formattedLabel = label
                            }
                            
                            return (
                              <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700">
                                <p className="font-semibold text-sm mb-2 text-slate-900 dark:text-slate-100">{formattedLabel}</p>
                                <div className="space-y-1">
                                  {payload.map((entry, index) => (
                                    <div key={index} className="flex items-center gap-2">
                                      <div 
                                        className="w-3 h-3 rounded-full"
                                        style={{ backgroundColor: entry.color }}
                                      />
                                      <span className="text-xs font-medium text-slate-700 dark:text-slate-300 capitalize">
                                        {entry.dataKey === 'articles_scraped' ? 'Scraped' : entry.dataKey}: {entry.value?.toLocaleString()}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar 
                        dataKey="articles_scraped" 
                        name="Scraped" 
                        fill="#94a3b8" 
                        radius={[2, 2, 0, 0]}
                        opacity={0.6}
                      />
                      <Bar 
                        dataKey="enhanced" 
                        name="Enhanced" 
                        fill="#10b981" 
                        radius={[2, 2, 0, 0]}
                        opacity={0.9}
                      />
                      <Bar 
                        dataKey="selected" 
                        name="Selected" 
                        fill="#8b5cf6" 
                        radius={[2, 2, 0, 0]}
                        opacity={0.8}
                      />
                      <Bar 
                        dataKey="pending" 
                        name="Pending" 
                        fill="#f59e0b" 
                        radius={[2, 2, 0, 0]}
                        opacity={0.7}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex flex-col items-center justify-center h-[320px] text-slate-500 dark:text-slate-400">
                    <div className="relative">
                      <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
                      <div className="absolute inset-0 rounded-full border-2 border-emerald-200 dark:border-emerald-900"></div>
                    </div>
                    <p className="mt-3 text-sm font-medium">Loading enhancement trends...</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">Analyzing 7-day pipeline performance</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Source Enhancement Coverage */}
          <div className="mt-4">
            <Card className="border-0 shadow-sm bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-900 dark:to-slate-800/50">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                      <div className="p-1.5 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 text-white">
                        <BarChart3 className="h-4 w-4" />
                      </div>
                      Source Enhancement Coverage
                    </CardTitle>
                    <CardDescription className="text-sm text-slate-600 dark:text-slate-400">
                      Enhancement rates by news source ({analyticsData?.timePeriod || 'selected time period'})
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="text-xs font-medium px-2 py-1">
                    {analyticsData?.sourceEnhancement ? 
                      `${analyticsData.sourceEnhancement.length} sources` : 
                      'Loading...'
                    }
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-2">
                {analyticsData?.sourceEnhancement ? (
                  <div className="space-y-4">
                    {analyticsData.sourceEnhancement.map((source: any) => {
                      // Calculate performance tier for dynamic styling
                      const getPerformanceColor = (rate: number) => {
                        if (rate >= 50) return 'from-emerald-500 to-green-600'
                        if (rate >= 20) return 'from-blue-500 to-indigo-600'
                        if (rate >= 10) return 'from-amber-500 to-orange-600'
                        return 'from-red-500 to-rose-600'
                      }
                      
                      const getPerformanceBadge = (rate: number) => {
                        if (rate >= 50) return 'default'
                        if (rate >= 20) return 'secondary' 
                        if (rate >= 10) return 'outline'
                        return 'destructive'
                      }

                      return (
                        <div key={source.name} className="group">
                          {/* Header with source name and metrics */}
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3 gap-2">
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              <div className={`w-2.5 h-2.5 rounded-full bg-gradient-to-r ${getPerformanceColor(source.rate)} flex-shrink-0`}></div>
                              <span className="text-sm sm:text-base font-medium text-slate-900 dark:text-slate-100 truncate">
                                {source.name}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <Badge 
                                variant={getPerformanceBadge(source.rate)}
                                className="text-xs px-2 py-1"
                              >
                                {source.rate}%
                              </Badge>
                              <span className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 whitespace-nowrap">
                                {source.enhanced.toLocaleString()}/{source.total.toLocaleString()}
                              </span>
                            </div>
                          </div>
                          
                          {/* Enhanced progress bar */}
                          <div className="relative mb-2">
                            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5 sm:h-3 overflow-hidden">
                              <div 
                                className={`bg-gradient-to-r ${getPerformanceColor(source.rate)} h-full rounded-full transition-all duration-700 ease-out group-hover:shadow-lg`}
                                style={{ width: `${Math.max(source.rate, 2)}%` }}
                              />
                            </div>
                          </div>
                          
                          {/* Additional context for larger screens */}
                          <div className="hidden sm:flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                            <span>
                              Enhanced: {source.enhanced.toLocaleString()} articles
                            </span>
                            <span className="text-right">
                              {source.rate >= 30 ? '🟢 Excellent' : 
                               source.rate >= 15 ? '🟡 Good' : 
                               source.rate >= 5 ? '🟠 Fair' : '🔴 Needs attention'}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                    
                    {/* Summary stats */}
                    <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div className="text-center">
                          <div className="text-lg sm:text-xl font-semibold text-slate-900 dark:text-slate-100">
                            {analyticsData.sourceEnhancement.filter((s: any) => s.rate >= 30).length}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">High Performers</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg sm:text-xl font-semibold text-slate-900 dark:text-slate-100">
                            {Math.round(analyticsData.sourceEnhancement.reduce((avg: number, s: any) => avg + s.rate, 0) / analyticsData.sourceEnhancement.length)}%
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">Avg Rate</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg sm:text-xl font-semibold text-slate-900 dark:text-slate-100">
                            {analyticsData.sourceEnhancement.reduce((sum: number, s: any) => sum + s.enhanced, 0).toLocaleString()}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">Total Enhanced</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg sm:text-xl font-semibold text-slate-900 dark:text-slate-100">
                            {analyticsData.sourceEnhancement.reduce((sum: number, s: any) => sum + s.total, 0).toLocaleString()}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">Total Articles</div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-[280px] sm:h-[320px] text-slate-500 dark:text-slate-400">
                    <div className="relative">
                      <Loader2 className="h-7 w-7 sm:h-8 sm:w-8 animate-spin text-indigo-500" />
                      <div className="absolute inset-0 rounded-full border-2 border-indigo-200 dark:border-indigo-900"></div>
                    </div>
                    <p className="mt-3 text-sm sm:text-base font-medium text-center">Loading coverage data...</p>
                    <p className="text-xs sm:text-sm text-slate-400 dark:text-slate-500 text-center">Analyzing source performance</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="automation" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>AI Selection Tools</CardTitle>
                <CardDescription>Automated article selection and enhancement workflow</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* AI Article Selection */}
                <div className="space-y-2">
                  <Button
                    onClick={handleAIArticleSelection}
                    disabled={isProcessing}
                    className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white"
                  >
                    {isProcessing ? (
                      <>
                        <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        Selecting Article...
                      </>
                    ) : (
                      <>
                        <Target className="mr-2 h-4 w-4" />
                        AI Article Selection
                      </>
                    )}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Uses Perplexity AI to intelligently select and categorize the most newsworthy article for enhancement.
                  </p>
                </div>

                {/* AI Enhancement */}
                <div className="space-y-2">
                  <Button
                    onClick={handleAIEnhanceSelected}
                    disabled={isProcessing}
                    className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white"
                  >
                    {isProcessing ? (
                      <>
                        <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        Enhancing Articles...
                      </>
                    ) : (
                      <>
                        <HKIIcon className="mr-2 h-4 w-4" />
                        AI Enhance Selected Articles
                      </>
                    )}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Process all selected articles through AI enhancement to create trilingual versions with contextual enrichment.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Manual Operations</CardTitle>
                <CardDescription>Work with manually selected articles</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  {selectedArticleIds.size > 0 ? (
                    <div className="space-y-3">
                      <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                        <p className="font-medium text-blue-900 dark:text-blue-100">
                          {selectedArticleIds.size} articles selected manually
                        </p>
                        <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                          Use "Mark for Enhancement" to prepare selected articles, then use AI Enhancement tool above.
                        </p>
                      </div>
                      
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleBulkClone}
                          disabled={isBulkCloning || isDeleting}
                          className="flex-1"
                        >
                          {isBulkCloning ? (
                            <>
                              <div className="mr-1 h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                              Marking...
                            </>
                          ) : (
                            <>
                              <Target className="h-3 w-3 mr-1" />
                              Mark for Enhancement
                            </>
                          )}
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={handleBatchDelete}
                          disabled={isDeleting || isBulkCloning}
                        >
                          {isDeleting ? (
                            <>
                              <div className="mr-1 h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                              Deleting...
                            </>
                          ) : (
                            <>
                              <Trash2 className="h-3 w-3 mr-1" />
                              Delete
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-muted-foreground">
                      <p className="font-medium mb-2">Manual Article Selection Workflow:</p>
                      <div className="text-xs space-y-1 ml-4">
                        <p>1. Select articles using checkboxes in Article Browser tab</p>
                        <p>2. Click "Mark for Enhancement" to prepare articles</p>
                        <p>3. Use "AI Enhance Selected Articles" tool above</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Full-Screen Article Detail Sheet */}
      <ArticleDetailSheet
        article={selectedArticle}
        open={isSheetOpen}
        onOpenChange={setIsSheetOpen}
        onArticleUpdate={(updatedArticle) => {
          // Update the article in the React Query cache
          queryClient.setQueryData(queryKey, (oldData: any) => {
            if (!oldData) return oldData
            
            return {
              ...oldData,
              pages: oldData.pages.map((page: any) => ({
                ...page,
                articles: page.articles.map((article: Article) =>
                  article.id === updatedArticle.id ? updatedArticle : article
                )
              }))
            }
          })
          
          // Update the selected article state
          setSelectedArticle(updatedArticle)
          
          // Refresh stats
          loadQuickStats()
        }}
        onArticleDelete={(articleId) => {
          // Deletion will be handled by real-time subscriptions
          setSelectedArticle(null)
          setIsSheetOpen(false)
          loadQuickStats() // Refresh stats
        }}
      />

      {/* Trilingual Auto-Select Progress Modal */}
      <TrilingualAutoSelectModal
        isOpen={showProgressModal}
        onClose={() => setShowProgressModal(false)}
        progress={processProgress}
      />
    </div>
  )
}