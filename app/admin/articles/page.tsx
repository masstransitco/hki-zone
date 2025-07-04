"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, Filter, RefreshCw } from "lucide-react"
import ArticleReviewGrid from "@/components/admin/article-review-grid"
import ArticleDetailPanel from "@/components/admin/article-detail-panel"
import ArticleDetailSheet from "@/components/admin/article-detail-sheet"
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
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)

  useEffect(() => {
    loadArticles()
  }, [page, sourceFilter])

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
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <form onSubmit={handleSearch} className="flex flex-1 gap-2">
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
            
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                <SelectItem value="HKFP">HKFP</SelectItem>
                <SelectItem value="SingTao">SingTao</SelectItem>
                <SelectItem value="HK01">HK01</SelectItem>
                <SelectItem value="ONCC">ONCC</SelectItem>
                <SelectItem value="RTHK">RTHK</SelectItem>
              </SelectContent>
            </Select>
            
            <Button onClick={handleRefresh} variant="outline" size="icon">
              <RefreshCw className="h-4 w-4" />
            </Button>
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
    </div>
  )
}