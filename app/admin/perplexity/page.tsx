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
import PerplexityArticleGrid from "@/components/admin/perplexity-article-grid"
import PerplexityArticleDetail from "@/components/admin/perplexity-article-detail"
import PerplexityBulkOperations from "@/components/admin/perplexity-bulk-operations"
import PerplexityManualTriggers from "@/components/admin/perplexity-manual-triggers"
import type { PerplexityArticle, PerplexityNewsResponse } from "@/lib/types"

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

const ARTICLE_LIMITS = [
  { value: "20", label: "20 articles" },
  { value: "50", label: "50 articles" },
  { value: "100", label: "100 articles" },
  { value: "200", label: "200 articles" },
  { value: "all", label: "All articles" },
]

export default function PerplexityPage() {
  const [articles, setArticles] = useState<PerplexityArticle[]>([])
  const [filteredArticles, setFilteredArticles] = useState<PerplexityArticle[]>([])
  const [selectedArticle, setSelectedArticle] = useState<PerplexityArticle | null>(null)
  const [selectedArticles, setSelectedArticles] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [articleLimit, setArticleLimit] = useState("100")
  const [usingMockData, setUsingMockData] = useState(false)
  const [showManualTriggers, setShowManualTriggers] = useState(false)

  useEffect(() => {
    loadArticles()
  }, [categoryFilter, statusFilter, articleLimit])

  useEffect(() => {
    filterArticles()
  }, [articles, searchQuery])

  const loadArticles = async () => {
    try {
      setLoading(true)
      
      // Build query parameters
      const params = new URLSearchParams()
      if (categoryFilter !== "all") params.set("category", categoryFilter)
      if (statusFilter !== "all") params.set("status", statusFilter)
      if (articleLimit !== "all") params.set("limit", articleLimit)
      
      const response = await fetch(`/api/admin/perplexity?${params.toString()}`)
      if (!response.ok) throw new Error('Failed to fetch articles')
      
      const data = await response.json()
      setUsingMockData(false) // Admin API doesn't use mock data
      
      // Set articles from admin API response
      setArticles(data.articles || [])
    } catch (error) {
      console.error('Error loading articles:', error)
      // Fallback to public API if admin API fails
      try {
        const response = await fetch('/api/perplexity-news')
        if (!response.ok) throw new Error('Failed to fetch articles')
        
        const data: PerplexityNewsResponse = await response.json()
        setUsingMockData(data.usingMockData)
        
        // Flatten the categorized data into a single array
        let allArticles: PerplexityArticle[] = []
        if (Array.isArray(data.news)) {
          allArticles = data.news
        } else {
          allArticles = Object.values(data.news).flat()
        }
        
        setArticles(allArticles)
      } catch (fallbackError) {
        console.error('Fallback API also failed:', fallbackError)
      }
    } finally {
      setLoading(false)
    }
  }

  const filterArticles = () => {
    let filtered = articles

    // Only apply search filter here since category and status are handled by API
    if (searchQuery) {
      filtered = filtered.filter(article => 
        article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        article.lede?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    setFilteredArticles(filtered)
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    filterArticles()
  }

  const handleRefresh = () => {
    setSelectedArticle(null)
    setSelectedArticles([])
    loadArticles()
  }

  const handleBulkDelete = async (articleIds: string[]) => {
    console.log('Bulk delete:', articleIds)
    // TODO: Implement bulk delete API call
  }

  const handleBulkRegenerate = async (articleIds: string[]) => {
    console.log('Bulk regenerate:', articleIds)
    // TODO: Implement bulk regenerate API call
  }

  const handleBulkCategoryUpdate = async (articleIds: string[], category: string) => {
    console.log('Bulk category update:', articleIds, category)
    // TODO: Implement bulk category update API call
  }

  const handleBulkExport = async (articleIds: string[]) => {
    console.log('Bulk export:', articleIds)
    // TODO: Implement bulk export functionality
  }

  const totalArticles = filteredArticles.length
  const totalCost = filteredArticles.reduce((sum, article) => sum + (article.generation_cost || 0), 0)
  const statusCounts = filteredArticles.reduce((acc, article) => {
    acc[article.article_status] = (acc[article.article_status] || 0) + 1
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
        {usingMockData && (
          <Badge variant="outline" className="bg-yellow-100 text-yellow-800">
            Using Mock Data
          </Badge>
        )}
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
            <div className="text-2xl font-bold">{totalArticles}</div>
            <p className="text-xs text-muted-foreground">
              AI-generated articles
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalCost.toFixed(4)}</div>
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
            <div className="text-2xl font-bold">{statusCounts.ready || 0}</div>
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
            <div className="text-2xl font-bold">{statusCounts.enriched || 0}</div>
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
            <div className="text-2xl font-bold">{statusCounts.pending || 0}</div>
            <p className="text-xs text-muted-foreground">
              Processing
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <CardTitle>Article Management</CardTitle>
          <CardDescription>
            Browse and manage AI-generated news articles from Perplexity
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
                <SelectTrigger className="w-full sm:w-[200px]">
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
                <SelectTrigger className="w-full sm:w-[200px]">
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
              
              <Select value={articleLimit} onValueChange={setArticleLimit}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="Articles to show" />
                </SelectTrigger>
                <SelectContent>
                  {ARTICLE_LIMITS.map(limit => (
                    <SelectItem key={limit.value} value={limit.value}>
                      {limit.label}
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
          articles={filteredArticles}
          onClearSelection={() => setSelectedArticles([])}
          onBulkDelete={handleBulkDelete}
          onBulkRegenerate={handleBulkRegenerate}
          onBulkCategoryUpdate={handleBulkCategoryUpdate}
          onBulkExport={handleBulkExport}
        />
      )}

      {/* Article Grid and Detail Layout */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <PerplexityArticleGrid
            articles={filteredArticles}
            loading={loading}
            selectedArticles={selectedArticles}
            onArticleSelect={setSelectedArticle}
            onSelectionChange={setSelectedArticles}
            onRefresh={handleRefresh}
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