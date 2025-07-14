"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, Filter, RefreshCw, Languages, Sparkles, Loader2 } from "lucide-react"
import ArticleReviewGrid from "@/components/admin/article-review-grid"
import ArticleDetailPanel from "@/components/admin/article-detail-panel"
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
    loadArticles()
  }

  const handleArticleSelect = (article: Article) => {
    setSelectedArticle(article)
  }

  const handleExpandToFullScreen = () => {
    setIsSheetOpen(true)
  }

  const handleLoadMore = () => {
    setPage(prev => prev + 1)
  }

  const handleTrilingualAutoSelect = async () => {
    try {
      setIsProcessing(true)
      setShowProgressModal(true)
      setProcessProgress({
        step: 'headlines',
        currentArticle: 0,
        totalArticles: 10,
        currentLanguage: 'en',
        completedByLanguage: {
          english: 0,
          traditionalChinese: 0,
          simplifiedChinese: 0
        },
        estimatedTimeRemaining: 960, // 16 minutes
        totalCost: 0
      })

      const response = await fetch('/api/admin/auto-select-headlines', {
        method: 'POST'
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to start auto-selection')
      }

      const result = await response.json()
      
      // Update progress to complete
      setProcessProgress({
        ...processProgress,
        step: 'complete',
        completedByLanguage: {
          english: result.articlesByLanguage.english,
          traditionalChinese: result.articlesByLanguage.traditionalChinese,
          simplifiedChinese: result.articlesByLanguage.simplifiedChinese
        },
        totalCost: parseFloat(result.estimatedCost)
      })

      // Refresh the article list after successful processing
      setTimeout(() => {
        handleRefresh()
        setShowProgressModal(false)
        setProcessProgress(null)
      }, 3000)

    } catch (error) {
      console.error('Auto-select error:', error)
      alert(error instanceof Error ? error.message : 'Failed to run auto-selection')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleSingleTrilingualAutoSelect = async () => {
    try {
      setIsProcessing(true)
      setShowProgressModal(true)
      setProcessProgress({
        step: 'headlines',
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

      const response = await fetch('/api/admin/auto-select-single', {
        method: 'POST'
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to start single article auto-selection')
      }

      const result = await response.json()
      
      // Update progress to complete
      setProcessProgress({
        ...processProgress,
        step: 'complete',
        completedByLanguage: {
          english: result.articlesByLanguage.english,
          traditionalChinese: result.articlesByLanguage.traditionalChinese,
          simplifiedChinese: result.articlesByLanguage.simplifiedChinese
        },
        totalCost: parseFloat(result.estimatedCost)
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
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Select value={sourceFilter} onValueChange={setSourceFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Filter by source" />
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
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Filter by language" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Languages</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="zh-TW">繁體中文</SelectItem>
                  <SelectItem value="zh-CN">简体中文</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={aiEnhancedFilter} onValueChange={setAiEnhancedFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Articles</SelectItem>
                  <SelectItem value="true">AI Enhanced Only</SelectItem>
                  <SelectItem value="false">Regular Articles Only</SelectItem>
                </SelectContent>
              </Select>
              
              <div className="flex gap-2 sm:ml-auto">
                <Button
                  onClick={handleSingleTrilingualAutoSelect}
                  disabled={isProcessing}
                  className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-700 hover:via-teal-700 hover:to-cyan-700 text-white"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      <span className="hidden sm:inline">AI Select & Enhance (1 → 3)</span>
                      <span className="sm:hidden">AI Single</span>
                      <span className="ml-2 text-xs opacity-75">EN | 繁 | 简</span>
                    </>
                  )}
                </Button>
                <Button
                  onClick={handleTrilingualAutoSelect}
                  disabled={isProcessing}
                  className="bg-gradient-to-r from-purple-600 via-blue-600 to-green-600 hover:from-purple-700 hover:via-blue-700 hover:to-green-700 text-white"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Languages className="mr-2 h-4 w-4" />
                      <span className="hidden sm:inline">AI Select & Enhance (10 → 30)</span>
                      <span className="sm:hidden">AI Select</span>
                      <span className="ml-2 text-xs opacity-75">EN | 繁 | 简</span>
                    </>
                  )}
                </Button>
                <Button onClick={handleRefresh} variant="outline" size="icon">
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Article Grid and Detail Panel */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ArticleReviewGrid
            articles={articles}
            loading={loading}
            onArticleSelect={handleArticleSelect}
            selectedArticle={selectedArticle}
            onLoadMore={handleLoadMore}
            hasMore={hasMore}
          />
        </div>
        
        {/* Desktop Detail Panel */}
        <div className="hidden lg:block lg:col-span-1">
          <ArticleDetailPanel 
            article={selectedArticle} 
            onExpand={handleExpandToFullScreen}
          />
        </div>
      </div>

      {/* Mobile Detail Panel - Sheet/Modal */}
      {selectedArticle && (
        <div className="lg:hidden">
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-lg">Article Details</CardTitle>
              <CardDescription>
                {selectedArticle.source} • {selectedArticle.category}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ArticleDetailPanel article={selectedArticle} />
            </CardContent>
          </Card>
        </div>
      )}

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