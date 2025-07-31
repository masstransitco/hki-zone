"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { 
  Search, 
  Filter, 
  RefreshCw, 
  Plus, 
  Brain, 
  DollarSign, 
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle
} from "lucide-react"
import PerplexityArticleList from "@/components/admin/perplexity-article-list"
import PerplexityArticleDetail from "@/components/admin/perplexity-article-detail"
import PerplexityBulkOperations from "@/components/admin/perplexity-bulk-operations"
import PerplexityManualTriggers from "@/components/admin/perplexity-manual-triggers"
import type { PerplexityArticle } from "@/lib/types"

const CATEGORIES = [
  { value: "all", label: "All Categories" },
  { value: "politics", label: "Politics" },
  { value: "business", label: "Business" },
  { value: "tech", label: "Technology" },
  { value: "health", label: "Health" },
  { value: "lifestyle", label: "Lifestyle" },
  { value: "entertainment", label: "Entertainment" },
]

const STATUSES = [
  { value: "all", label: "All Status" },
  { value: "pending", label: "Pending" },
  { value: "enriched", label: "Enriched" },
  { value: "ready", label: "Ready" },
]


export default function PerplexityPage() {
  const [articles, setArticles] = useState<PerplexityArticle[]>([])
  const [selectedArticle, setSelectedArticle] = useState<PerplexityArticle | null>(null)
  const [selectedArticles, setSelectedArticles] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [showManualTriggers, setShowManualTriggers] = useState(false)
  const [totalStats, setTotalStats] = useState({
    total: 0,
    byStatus: {} as Record<string, number>,
    byCategory: {} as Record<string, number>,
    totalCost: 0
  })

  useEffect(() => {
    setPage(0)
    setArticles([])
    loadArticles(0)
  }, [categoryFilter, statusFilter, searchQuery])

  useEffect(() => {
    if (page > 0) {
      loadArticles(page)
    }
  }, [page])

  useEffect(() => {
    loadTotalStats()
  }, [])

  const loadArticles = async (pageNum: number) => {
    try {
      if (pageNum === 0) setLoading(true)
      
      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: "20"
      })
      
      if (categoryFilter !== "all") params.set("category", categoryFilter)
      if (statusFilter !== "all") params.set("status", statusFilter)
      if (searchQuery) params.set("search", searchQuery)
      
      const response = await fetch(`/api/admin/perplexity?${params.toString()}`)
      if (!response.ok) throw new Error('Failed to fetch articles')
      
      const data = await response.json()
      
      if (pageNum === 0) {
        setArticles(data.articles || [])
      } else {
        setArticles(prev => [...prev, ...(data.articles || [])])
      }
      
      setHasMore(data.hasMore || false)
    } catch (error) {
      console.error('Error loading articles:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadTotalStats = async () => {
    try {
      const response = await fetch('/api/admin/perplexity/stats')
      if (!response.ok) return
      
      const stats = await response.json()
      setTotalStats(stats)
    } catch (error) {
      console.error('Error loading stats:', error)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(0)
    setArticles([])
    loadArticles(0)
  }


  const handleRefresh = () => {
    setPage(0)
    setSelectedArticle(null)
    setSelectedArticles([])
    setArticles([])
    loadArticles(0)
    loadTotalStats()
  }

  const handleLoadMore = () => {
    setPage(prev => prev + 1)
  }

  const handleBulkOperations = async (operation: string, data?: any) => {
    try {
      const response = await fetch('/api/admin/perplexity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: operation,
          articleIds: selectedArticles,
          data
        })
      })
      
      if (response.ok) {
        handleRefresh()
        setSelectedArticles([])
      }
    } catch (error) {
      console.error('Bulk operation error:', error)
    }
  }

  // Calculate stats from loaded articles for display
  const categoryStats = articles.reduce((acc, article) => {
    acc[article.category] = (acc[article.category] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  return (
    <div className="flex flex-1 flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Brain className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Perplexity News Management</h1>
        </div>
        <Button
          variant="outline"
          onClick={() => setShowManualTriggers(!showManualTriggers)}
          className="ml-auto"
        >
          {showManualTriggers ? 'Hide' : 'Show'} Manual Controls
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Articles</CardTitle>
            <Brain className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalStats.total}</div>
            <p className="text-xs text-muted-foreground">
              {articles.length < totalStats.total ? `Showing ${articles.length}` : 'All articles'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalStats.totalCost.toFixed(4)}</div>
            <p className="text-xs text-muted-foreground">
              Generation cost
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ready</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalStats.byStatus.ready || 0}</div>
            <p className="text-xs text-muted-foreground">
              Complete articles
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Enriched</CardTitle>
            <Clock className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalStats.byStatus.enriched || 0}</div>
            <p className="text-xs text-muted-foreground">
              Content ready
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <AlertCircle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalStats.byStatus.pending || 0}</div>
            <p className="text-xs text-muted-foreground">
              Processing
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <CardTitle>Perplexity Articles</CardTitle>
          <CardDescription>
            Manage AI-generated articles from Perplexity
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
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Filter by category" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(category => (
                    <SelectItem key={category.value} value={category.value}>
                      {category.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map(status => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Button onClick={handleRefresh} variant="outline" size="icon" className="sm:ml-auto">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Manual Triggers */}
      {showManualTriggers && (
        <PerplexityManualTriggers onRefresh={handleRefresh} />
      )}

      {/* Bulk Operations */}
      {selectedArticles.length > 0 && (
        <PerplexityBulkOperations
          selectedArticles={selectedArticles}
          articles={articles}
          onClearSelection={() => setSelectedArticles([])}
          onBulkDelete={(ids) => handleBulkOperations('delete')}
          onBulkRegenerate={(ids) => handleBulkOperations('regenerate')}
          onBulkCategoryUpdate={(ids, cat) => handleBulkOperations('update', { category: cat })}
          onBulkExport={(ids) => handleBulkOperations('export')}
        />
      )}

      {/* Article List and Detail Layout */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <PerplexityArticleList
            articles={articles}
            loading={loading}
            selectedArticles={selectedArticles}
            onArticleSelect={setSelectedArticle}
            onSelectionChange={setSelectedArticles}
            onRefresh={handleRefresh}
            onLoadMore={handleLoadMore}
            hasMore={hasMore}
            onDelete={async (article) => {
              if (confirm(`Delete article "${article.title}"?`)) {
                try {
                  const response = await fetch(`/api/admin/perplexity/${article.id}`, {
                    method: 'DELETE'
                  })
                  if (response.ok) {
                    handleRefresh()
                  }
                } catch (error) {
                  console.error('Error deleting article:', error)
                }
              }
            }}
          />
        </div>
        
        {/* Desktop Detail Panel */}
        <div className="hidden lg:block lg:col-span-1">
          <PerplexityArticleDetail 
            article={selectedArticle}
          />
        </div>
      </div>

      {/* Mobile Detail Panel */}
      {selectedArticle && (
        <div className="lg:hidden">
          <PerplexityArticleDetail 
            article={selectedArticle}
            onClose={() => setSelectedArticle(null)}
          />
        </div>
      )}
    </div>
  )
}