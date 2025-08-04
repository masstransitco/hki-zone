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
  BarChart3, Target, Zap, Clock, TrendingUp, AlertCircle, Wand2, Brain, Bot, Wifi, WifiOff, Newspaper
} from "lucide-react"
import ArticleReviewGrid from "@/components/admin/article-review-grid"
import ArticleDetailSheet from "@/components/admin/article-detail-sheet"
import TrilingualAutoSelectModal from "@/components/admin/trilingual-auto-select-modal"
import { useLanguage } from "@/components/language-provider"
import { useRealtimeArticles } from "@/hooks/use-realtime-articles"
import { toast } from "sonner"
import type { Article } from "@/lib/types"
import HKIIcon from "@/components/hki-icon"

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

async function fetchAdminArticles({ 
  pageParam = 0, 
  sourceFilter = "all",
  languageFilter = "all", 
  aiEnhancedFilter = "all",
  searchQuery = ""
}): Promise<{ articles: Article[]; nextPage: number | null; hasMore: boolean }> {
  const params = new URLSearchParams({
    page: pageParam.toString(),
    limit: "20",
  })
  
  if (sourceFilter !== "all") params.set("source", sourceFilter)
  if (languageFilter !== "all") params.set("language", languageFilter)
  if (aiEnhancedFilter !== "all") params.set("aiEnhanced", aiEnhancedFilter)
  if (searchQuery) params.set("search", searchQuery)

  const response = await fetch(`/api/admin/articles?${params}`)
  if (!response.ok) throw new Error("Failed to fetch articles")
  
  const data = await response.json()
  return {
    articles: data.articles,
    nextPage: data.hasMore ? pageParam + 1 : null,
    hasMore: data.hasMore
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
  const [isProcessing, setIsProcessing] = useState(false)
  const [showProgressModal, setShowProgressModal] = useState(false)
  const [processProgress, setProcessProgress] = useState<any>(null)
  const [selectedArticleIds, setSelectedArticleIds] = useState<Set<string>>(new Set())
  const [isDeleting, setIsDeleting] = useState(false)
  const [isBulkCloning, setIsBulkCloning] = useState(false)
  const [activeTab, setActiveTab] = useState("articles")
  const [quickStats, setQuickStats] = useState<QuickStats | null>(null)
  const [optimisticUpdates, setOptimisticUpdates] = useState<OptimisticUpdates>({})
  
  // Generate query key for React Query and real-time subscriptions
  const queryKey = useMemo(() => [
    'admin-articles', 
    sourceFilter, 
    languageFilter, 
    aiEnhancedFilter, 
    searchQuery
  ], [sourceFilter, languageFilter, aiEnhancedFilter, searchQuery])

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
      const response = await fetch('/api/admin/articles/stats')
      if (response.ok) {
        const stats = await response.json()
        setQuickStats(stats)
      }
    } catch (error) {
      console.error('Error loading stats:', error)
    }
  }, [])

  useEffect(() => {
    loadQuickStats()
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
  }, [refetch, loadQuickStats])

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

      {/* Enhanced Stats Dashboard */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Articles</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{quickStats?.total || totalArticles}</div>
            <p className="text-xs text-muted-foreground">
              Currently loaded: {totalArticles}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">AI Enhanced</CardTitle>
            <HKIIcon className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-600">{quickStats?.enhanced || 0}</div>
            <p className="text-xs text-muted-foreground">
              {quickStats?.total ? ((quickStats.enhanced / quickStats.total) * 100).toFixed(1) : 0}% enhanced
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Selected</CardTitle>
            <Target className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{quickStats?.selected || 0}</div>
            <p className="text-xs text-muted-foreground">
              Ready for enhancement
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recent</CardTitle>
            <Clock className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{quickStats?.recentlyAdded || 0}</div>
            <p className="text-xs text-muted-foreground">
              Added today
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Top Source</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {quickStats?.topSources?.[0]?.count || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {quickStats?.topSources?.[0]?.name || 'N/A'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Enhanced Tabbed Interface */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="articles" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Article Browser
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Analytics
          </TabsTrigger>
          <TabsTrigger value="automation" className="flex items-center gap-2">
            <Wand2 className="h-4 w-4" />
            AI Tools
          </TabsTrigger>
        </TabsList>

        <TabsContent value="articles" className="space-y-4">
          <Card className="border-slate-200 dark:border-slate-700 shadow-sm">
            <CardContent className="p-4">
              {/* Compact Header with Inline Controls */}
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div>
                    <h3 className="font-semibold text-slate-900 dark:text-slate-100">Articles</h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400">Browse and manage articles</p>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                    <span>Live</span>
                  </div>
                </div>
                
                {/* Compact Search */}
                <form onSubmit={handleSearch} className="flex gap-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                    <Input
                      placeholder="Search articles..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8 h-8 w-64 text-sm bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                    />
                  </div>
                  <Button type="submit" variant="outline" size="sm" className="h-8 w-8 p-0">
                    <Search className="h-3.5 w-3.5" />
                  </Button>
                  <Button onClick={handleRefresh} variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-500">
                    <RefreshCw className="h-3.5 w-3.5" />
                  </Button>
                </form>
              </div>

              {/* Compact Filters in Single Row */}
              <div className="flex flex-wrap items-center gap-3 p-3 bg-slate-50/50 dark:bg-slate-900/30 rounded-lg border border-slate-200 dark:border-slate-700 mb-4">
                {/* Source Filter */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Source:</span>
                  <Select value={sourceFilter} onValueChange={setSourceFilter}>
                    <SelectTrigger className="w-32 h-7 text-xs bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
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
                    </SelectContent>
                  </Select>
                </div>
                
                {/* Modern Article Type Toggle */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Type:</span>
                  <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5 border border-slate-200 dark:border-slate-700">
                    {/* Original Button */}
                    <button
                      onClick={() => handleAiEnhancedToggle(false)}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all duration-200 ${
                        aiEnhancedFilter === "false"
                          ? "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 shadow-sm border border-slate-200 dark:border-slate-600"
                          : "text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                      }`}
                    >
                      <Newspaper className={`h-2.5 w-2.5 transition-colors ${
                        aiEnhancedFilter === "false" ? "text-slate-600 dark:text-slate-400" : "text-slate-400 dark:text-slate-500"
                      }`} />
                      Original
                    </button>
                    
                    {/* AI Enhanced Button */}
                    <button
                      onClick={() => handleAiEnhancedToggle(true)}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all duration-200 ${
                        aiEnhancedFilter === "true"
                          ? "bg-gradient-to-r from-slate-600 to-slate-700 dark:from-slate-500 dark:to-slate-600 text-white shadow-md shadow-slate-500/20"
                          : "text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                      }`}
                    >
                      <HKIIcon className={`h-2.5 w-2.5 transition-colors ${
                        aiEnhancedFilter === "true" ? "text-white" : "text-slate-400 dark:text-slate-500"
                      }`} />
                      AI Enhanced
                    </button>
                  </div>
                </div>
                
                {/* Compact Language Filter */}
                {aiEnhancedFilter === "true" && (
                  <div className="flex items-center gap-2 animate-in slide-in-from-left-1 duration-200">
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Language:</span>
                    <Select value={languageFilter} onValueChange={setLanguageFilter}>
                      <SelectTrigger className="w-28 h-7 text-xs bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="zh-TW">繁體</SelectItem>
                        <SelectItem value="zh-CN">简体</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {/* Compact Bulk Actions */}
              {selectedArticleIds.size > 0 ? (
                <div className="flex flex-wrap items-center gap-2 p-2.5 bg-blue-50 dark:bg-blue-950/20 rounded border border-blue-200 dark:border-blue-800 mb-4">
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                    <span className="text-xs font-medium text-blue-900 dark:text-blue-100">
                      {selectedArticleIds.size} selected
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleSelectNone}
                      className="h-6 px-2 text-xs text-blue-700 hover:bg-blue-100"
                    >
                      Clear
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleBulkClone}
                      disabled={isBulkCloning}
                      className="h-6 px-2 text-xs bg-white border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                    >
                      {isBulkCloning ? (
                        <div className="mr-1 h-2.5 w-2.5 animate-spin rounded-full border border-current border-t-transparent" />
                      ) : (
                        <Copy className="h-2.5 w-2.5 mr-1" />
                      )}
                      Enhance
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleBatchDelete}
                      disabled={isDeleting}
                      className="h-6 px-2 text-xs bg-white border-red-200 text-red-700 hover:bg-red-50"
                    >
                      {isDeleting ? (
                        <div className="mr-1 h-2.5 w-2.5 animate-spin rounded-full border border-current border-t-transparent" />
                      ) : (
                        <Trash2 className="h-2.5 w-2.5 mr-1" />
                      )}
                      Delete
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between p-2 border border-dashed border-slate-200 dark:border-slate-700 rounded text-center mb-4">
                  <span className="text-xs text-slate-500 dark:text-slate-400">No articles selected</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSelectAll}
                    className="h-6 px-2 text-xs text-slate-600 hover:bg-slate-50"
                  >
                    <CheckSquare className="h-2.5 w-2.5 mr-1" />
                    Select All
                  </Button>
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

        <TabsContent value="analytics" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Source Performance</CardTitle>
                <CardDescription>Article distribution by news source (current view)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Object.entries(sourceStats).slice(0, 10).map(([source, count]) => (
                    <div key={source} className="flex items-center justify-between">
                      <span className="text-sm font-medium">{source}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-20 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-blue-500 h-2 rounded-full transition-all duration-300" 
                            style={{ width: `${totalArticles > 0 ? (count / totalArticles) * 100 : 0}%` }}
                          />
                        </div>
                        <span className="text-sm text-muted-foreground">{count}</span>
                      </div>
                    </div>
                  ))}
                  {Object.keys(sourceStats).length === 0 && (
                    <div className="text-center py-4 text-muted-foreground">
                      No articles loaded yet
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Enhancement Pipeline</CardTitle>
                <CardDescription>AI processing statistics (real-time)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Enhanced Articles</span>
                    <Badge variant="secondary" className="transition-all duration-300">
                      {quickStats?.enhanced || 0}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Selected for Enhancement</span>
                    <Badge variant="outline" className="transition-all duration-300">
                      {quickStats?.selected || 0}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Operations in Progress</span>
                    <Badge 
                      variant={Object.keys(optimisticUpdates).length > 0 ? "default" : "outline"}
                      className="transition-all duration-300"
                    >
                      {Object.keys(optimisticUpdates).length}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Real-time Status</span>
                    <Badge 
                      variant={isConnected ? "default" : "secondary"}
                      className="transition-all duration-300"
                    >
                      {connectionStatus}
                    </Badge>
                  </div>
                </div>
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