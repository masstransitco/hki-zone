"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  Eye, 
  Trash2,
  Calendar,
  ChevronUp,
  ChevronDown,
  Filter,
  Download
} from "lucide-react"
import { format } from "date-fns"

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
  generation_cost?: number
  citations?: string[]
  perplexity_model?: string
}

interface PerplexityArticleListProps {
  articles: PerplexityArticle[]
  loading: boolean
  selectedArticles: string[]
  onArticleSelect: (article: PerplexityArticle) => void
  onSelectionChange: (articleIds: string[]) => void
  onRefresh: () => void
  onDelete?: (article: PerplexityArticle) => void
  onLoadMore?: () => void
  hasMore?: boolean
}

type SortField = 'created_at' | 'updated_at' | 'title' | 'category' | 'status'
type SortOrder = 'asc' | 'desc'

export default function PerplexityArticleList({
  articles,
  loading,
  selectedArticles,
  onArticleSelect,
  onSelectionChange,
  onRefresh,
  onDelete,
  onLoadMore,
  hasMore
}: PerplexityArticleListProps) {
  const [sortField, setSortField] = useState<SortField>('created_at')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [showFilters, setShowFilters] = useState(true)

  // Filter and sort articles
  const processedArticles = useMemo(() => {
    let filtered = [...articles]

    // Date filtering
    if (dateFrom) {
      const fromDate = new Date(dateFrom)
      filtered = filtered.filter(article => 
        new Date(article.created_at) >= fromDate
      )
    }

    if (dateTo) {
      const toDate = new Date(dateTo)
      toDate.setHours(23, 59, 59, 999) // Include the entire day
      filtered = filtered.filter(article => 
        new Date(article.created_at) <= toDate
      )
    }

    // Sorting
    filtered.sort((a, b) => {
      let aValue: any
      let bValue: any

      switch (sortField) {
        case 'created_at':
          aValue = new Date(a.created_at).getTime()
          bValue = new Date(b.created_at).getTime()
          break
        case 'updated_at':
          aValue = new Date(a.updated_at || a.created_at).getTime()
          bValue = new Date(b.updated_at || b.created_at).getTime()
          break
        case 'title':
          aValue = a.title.toLowerCase()
          bValue = b.title.toLowerCase()
          break
        case 'category':
          aValue = a.category
          bValue = b.category
          break
        case 'status':
          aValue = a.article_status
          bValue = b.article_status
          break
        default:
          return 0
      }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1
      } else {
        return aValue < bValue ? 1 : -1
      }
    })

    return filtered
  }, [articles, dateFrom, dateTo, sortField, sortOrder])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('desc')
    }
  }

  const handleSelectAll = () => {
    if (selectedArticles.length === processedArticles.length) {
      onSelectionChange([])
    } else {
      onSelectionChange(processedArticles.map(a => a.id))
    }
  }

  const handleSelectArticle = (articleId: string) => {
    if (selectedArticles.includes(articleId)) {
      onSelectionChange(selectedArticles.filter(id => id !== articleId))
    } else {
      onSelectionChange([...selectedArticles, articleId])
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ready':
        return <CheckCircle className="h-4 w-4 text-green-500 dark:text-green-400" />
      case 'enriched':
        return <Clock className="h-4 w-4 text-blue-500 dark:text-blue-400" />
      case 'pending':
        return <AlertCircle className="h-4 w-4 text-yellow-500 dark:text-yellow-400" />
      default:
        return null
    }
  }

  const getCategoryColor = (category: string) => {
    const colors = {
      politics: "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400",
      business: "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400",
      tech: "bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400",
      health: "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400",
      lifestyle: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400",
      entertainment: "bg-pink-100 text-pink-800 dark:bg-pink-900/20 dark:text-pink-400"
    }
    return colors[category as keyof typeof colors] || "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300"
  }

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMM dd, yyyy HH:mm')
    } catch {
      return dateString
    }
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null
    return sortOrder === 'asc' 
      ? <ChevronUp className="h-3 w-3" />
      : <ChevronDown className="h-3 w-3" />
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

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Articles List</CardTitle>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                // Export to CSV
                const headers = ['Title', 'Category', 'Status', 'Created Date', 'URL']
                const rows = processedArticles.map(article => [
                  article.title,
                  article.category,
                  article.article_status,
                  formatDate(article.created_at),
                  article.url
                ])
                
                const csv = [
                  headers.join(','),
                  ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
                ].join('\n')
                
                const blob = new Blob([csv], { type: 'text/csv' })
                const url = window.URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `perplexity-articles-${format(new Date(), 'yyyy-MM-dd')}.csv`
                a.click()
                window.URL.revokeObjectURL(url)
              }}
            >
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="h-4 w-4 mr-2" />
              {showFilters ? 'Hide' : 'Show'} Filters
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Date Filters */}
        {showFilters && (
          <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg space-y-3 border border-gray-200 dark:border-gray-800">
            <h3 className="text-sm font-medium flex items-center gap-2 text-gray-700 dark:text-gray-300">
              <Calendar className="h-4 w-4" />
              Date Range Filter
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">From Date</label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">To Date</label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2 items-center justify-between">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const today = new Date()
                    setDateFrom(today.toISOString().split('T')[0])
                    setDateTo(today.toISOString().split('T')[0])
                  }}
                >
                  Today
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const today = new Date()
                    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
                    setDateFrom(weekAgo.toISOString().split('T')[0])
                    setDateTo(today.toISOString().split('T')[0])
                  }}
                >
                  Last 7 Days
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const today = new Date()
                    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)
                    setDateFrom(monthAgo.toISOString().split('T')[0])
                    setDateTo(today.toISOString().split('T')[0])
                  }}
                >
                  Last 30 Days
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setDateFrom('')
                    setDateTo('')
                  }}
                >
                  Clear
                </Button>
              </div>
              <div className="text-sm text-muted-foreground">
                Showing {processedArticles.length} of {articles.length} articles
              </div>
            </div>
          </div>
        )}

        {/* List Header */}
        <div className="border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-800">
              <tr>
                <th className="w-10 p-3">
                  <Checkbox
                    checked={selectedArticles.length === processedArticles.length && processedArticles.length > 0}
                    onCheckedChange={handleSelectAll}
                  />
                </th>
                <th className="text-left p-3">
                  <button
                    className="flex items-center gap-1 font-medium text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100"
                    onClick={() => handleSort('title')}
                  >
                    Title
                    <SortIcon field="title" />
                  </button>
                </th>
                <th className="text-left p-3">
                  <button
                    className="flex items-center gap-1 font-medium text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100"
                    onClick={() => handleSort('category')}
                  >
                    Category
                    <SortIcon field="category" />
                  </button>
                </th>
                <th className="text-left p-3">
                  <button
                    className="flex items-center gap-1 font-medium text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100"
                    onClick={() => handleSort('status')}
                  >
                    Status
                    <SortIcon field="status" />
                  </button>
                </th>
                <th className="text-left p-3">
                  <button
                    className="flex items-center gap-1 font-medium text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100"
                    onClick={() => handleSort('created_at')}
                  >
                    Created
                    <SortIcon field="created_at" />
                  </button>
                </th>
                <th className="text-left p-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {processedArticles.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">
                    No articles found
                  </td>
                </tr>
              ) : (
                processedArticles.map((article) => (
                  <tr
                    key={article.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-900/50 cursor-pointer transition-colors"
                    onClick={() => onArticleSelect(article)}
                  >
                    <td className="p-3" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedArticles.includes(article.id)}
                        onCheckedChange={() => handleSelectArticle(article.id)}
                      />
                    </td>
                    <td className="p-3">
                      <div className="max-w-md">
                        <p className="font-medium truncate text-gray-900 dark:text-gray-100">{article.title}</p>
                        {article.lede && (
                          <p className="text-sm text-muted-foreground truncate mt-1">
                            {article.lede}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="p-3">
                      <Badge variant="outline" className={getCategoryColor(article.category)}>
                        {article.category}
                      </Badge>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(article.article_status)}
                        <span className="text-sm capitalize text-gray-700 dark:text-gray-300">{article.article_status}</span>
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="text-sm">
                        <div className="text-gray-700 dark:text-gray-300">{formatDate(article.created_at)}</div>
                        {article.updated_at && article.updated_at !== article.created_at && (
                          <div className="text-xs text-muted-foreground">
                            Updated: {formatDate(article.updated_at)}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="p-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onArticleSelect(article)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {onDelete && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onDelete(article)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Load More Button */}
        {hasMore && onLoadMore && (
          <div className="mt-4 flex justify-center">
            <Button
              onClick={onLoadMore}
              variant="outline"
              className="w-full sm:w-auto"
            >
              Load More Articles
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}