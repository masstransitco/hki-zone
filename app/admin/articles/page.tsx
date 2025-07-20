"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, Filter, RefreshCw, Languages, Sparkles, Loader2, Trash2, CheckSquare, Copy } from "lucide-react"
import ArticleReviewGrid from "@/components/admin/article-review-grid"
import ArticleDetailSheet from "@/components/admin/article-detail-sheet"
import TrilingualAutoSelectModal from "@/components/admin/trilingual-auto-select-modal"
import { useLanguage } from "@/components/language-provider"
import type { Article } from "@/lib/types"

export default function ArticlesPage() {
  const { t } = useLanguage()
  const [articles, setArticles] = useState<Article[]>([])
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null)
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [sourceFilter, setSourceFilter] = useState("all")
  const [languageFilter, setLanguageFilter] = useState("all")
  const [aiEnhancedFilter, setAiEnhancedFilter] = useState("all")
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)
  const [showProgressModal, setShowProgressModal] = useState(false)
  const [processProgress, setProcessProgress] = useState<any>(null)
  const [selectedArticleIds, setSelectedArticleIds] = useState<Set<string>>(new Set())
  const [isDeleting, setIsDeleting] = useState(false)
  const [isBulkCloning, setIsBulkCloning] = useState(false)

  useEffect(() => {
    loadArticles()
  }, [page, sourceFilter, languageFilter, aiEnhancedFilter])

  const loadArticles = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "20",
      })
      
      if (sourceFilter !== "all") {
        params.set("source", sourceFilter)
      }
      
      if (languageFilter !== "all") {
        params.set("language", languageFilter)
      }
      
      if (aiEnhancedFilter !== "all") {
        params.set("aiEnhanced", aiEnhancedFilter)
      }
      
      if (searchQuery) {
        params.set("search", searchQuery)
      }

      const response = await fetch(`/api/admin/articles?${params}`)
      if (!response.ok) throw new Error("Failed to fetch articles")
      
      const data = await response.json()
      
      if (page === 0) {
        setArticles(data.articles)
      } else {
        setArticles(prev => [...prev, ...data.articles])
      }
      
      setHasMore(data.hasMore)
    } catch (error) {
      console.error("Error loading articles:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(0)
    loadArticles()
  }

  const handleRefresh = () => {
    setPage(0)
    setSelectedArticle(null)
    setIsSheetOpen(false)
    setSelectedArticleIds(new Set())
    loadArticles()
  }

  const handleArticleExpand = (article: Article) => {
    setSelectedArticle(article)
    setIsSheetOpen(true)
  }

  const handleLoadMore = () => {
    setPage(prev => prev + 1)
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
      alert('Please select articles to delete')
      return
    }

    if (!confirm(`Are you sure you want to delete ${selectedArticleIds.size} selected articles?`)) {
      return
    }

    setIsDeleting(true)
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
        throw new Error(data.error || 'Failed to delete articles')
      }

      alert(`Successfully deleted ${data.deletedCount} articles`)
      setSelectedArticleIds(new Set())
      handleRefresh()
    } catch (error) {
      console.error('Batch delete error:', error)
      alert('Failed to delete articles: ' + (error instanceof Error ? error.message : 'Unknown error'))
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
      
      message += '\n\nThe enhanced articles will appear in the list shortly.'
      
      alert(message)
      
      setSelectedArticleIds(new Set())
      handleRefresh()
    } catch (error) {
      console.error('Bulk enhancement error:', error)
      alert('Failed to enhance articles: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setIsBulkCloning(false)
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
      setProcessProgress({
        ...processProgress,
        step: 'complete',
        completedByLanguage: {
          english: result.articlesByLanguage?.english || 1,
          traditionalChinese: result.articlesByLanguage?.traditionalChinese || 1,
          simplifiedChinese: result.articlesByLanguage?.simplifiedChinese || 1
        },
        totalCost: parseFloat(result.estimatedCost || '0.075')
      })

      // Refresh the article list after successful processing
      setTimeout(() => {
        handleRefresh()
        setShowProgressModal(false)
        setProcessProgress(null)
      }, 3000)

    } catch (error) {
      console.error('Single auto-select error:', error)
      alert(error instanceof Error ? error.message : 'Failed to run single article auto-selection')
    } finally {
      setIsProcessing(false)
    }
  }

  const totalArticles = articles.length
  const sourceStats = articles.reduce((acc, article) => {
    acc[article.source] = (acc[article.source] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  return (
    <div className="flex flex-1 flex-col gap-4">
      {/* Stats Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Articles</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalArticles}</div>
            <p className="text-xs text-muted-foreground">
              Currently loaded
            </p>
          </CardContent>
        </Card>
        
        {Object.entries(sourceStats).map(([source, count]) => (
          <Card key={source}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{source}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{count}</div>
              <p className="text-xs text-muted-foreground">
                {((count / totalArticles) * 100).toFixed(1)}% of total
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <CardTitle>Article Review</CardTitle>
          <CardDescription>
            Browse and review scraped articles from all sources
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            {/* Search Bar */}
            <form onSubmit={handleSearch} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search articles..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button type="submit" variant="outline" size="icon">
                <Search className="h-4 w-4" />
              </Button>
            </form>
            
            {/* Filters Row */}
            <div className="space-y-4">
              {/* Primary Filters */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Select value={sourceFilter} onValueChange={setSourceFilter}>
                  <SelectTrigger className="w-full sm:w-[160px]">
                    <SelectValue placeholder="Source" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sources</SelectItem>
                    <SelectItem value="HKFP">HKFP</SelectItem>
                    <SelectItem value="SingTao">SingTao</SelectItem>
                    <SelectItem value="HK01">HK01</SelectItem>
                    <SelectItem value="ONCC">ONCC</SelectItem>
                    <SelectItem value="RTHK">RTHK</SelectItem>
                    <SelectItem value="on.cc">on.cc</SelectItem>
                  </SelectContent>
                </Select>
                
                <Select value={languageFilter} onValueChange={setLanguageFilter}>
                  <SelectTrigger className="w-full sm:w-[160px]">
                    <SelectValue placeholder="Language" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Languages</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="zh-TW">繁體中文</SelectItem>
                    <SelectItem value="zh-CN">简体中文</SelectItem>
                  </SelectContent>
                </Select>
                
                <Select value={aiEnhancedFilter} onValueChange={setAiEnhancedFilter}>
                  <SelectTrigger className="w-full sm:w-[160px]">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Articles</SelectItem>
                    <SelectItem value="true">AI Enhanced</SelectItem>
                    <SelectItem value="false">Regular</SelectItem>
                  </SelectContent>
                </Select>

                <Button onClick={handleRefresh} variant="outline" size="icon" className="ml-auto">
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>

              {/* Action Controls */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                {/* Selection Controls */}
                <div className="flex items-center gap-3">
                  {selectedArticleIds.size > 0 ? (
                    <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                      <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                        {selectedArticleIds.size} selected
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleSelectNone}
                        className="h-7 px-2 text-xs"
                      >
                        Clear
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleBulkClone}
                        disabled={isBulkCloning}
                        className="h-7 px-3 text-xs bg-gradient-to-r from-emerald-50 to-blue-50 border-emerald-200 text-emerald-700 hover:from-emerald-100 hover:to-blue-100"
                      >
                        {isBulkCloning ? (
                          <div className="mr-1 h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        ) : (
                          <Copy className="h-3 w-3 mr-1" />
                        )}
                        Enhance to 3 Languages
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={handleBatchDelete}
                        disabled={isDeleting}
                        className="h-7 px-3 text-xs"
                      >
                        {isDeleting ? (
                          <div className="mr-1 h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        ) : (
                          <Trash2 className="h-3 w-3 mr-1" />
                        )}
                        Delete
                      </Button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleSelectAll}
                        className="h-8 px-3 text-xs"
                      >
                        <CheckSquare className="h-3 w-3 mr-1" />
                        Select All
                      </Button>
                    </div>
                  )}
                </div>

                {/* AI Enhancement Actions */}
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={handleSingleTrilingualAutoSelect}
                    disabled={isProcessing}
                    size="sm"
                    className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white h-8"
                  >
                    {isProcessing ? (
                      <>
                        <div className="mr-2 h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-3 w-3" />
                        AI Select & Enhance (1→3)
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Article Grid */}
      <ArticleReviewGrid
        articles={articles}
        loading={loading}
        onArticleExpand={handleArticleExpand}
        onLoadMore={handleLoadMore}
        hasMore={hasMore}
        selectedArticleIds={selectedArticleIds}
        onArticleSelect={handleArticleSelect}
      />

      {/* Full-Screen Article Detail Sheet */}
      <ArticleDetailSheet
        article={selectedArticle}
        open={isSheetOpen}
        onOpenChange={setIsSheetOpen}
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