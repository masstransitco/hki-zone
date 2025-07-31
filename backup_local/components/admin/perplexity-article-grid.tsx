"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { 
  CheckCircle, 
  AlertCircle, 
  XCircle, 
  Clock, 
  Eye, 
  Edit, 
  Trash2,
  RefreshCw,
  DollarSign,
  Brain
} from "lucide-react"

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
  published_at: string
  created_at: string
  generation_cost?: number
  citations?: string[]
  perplexity_model?: string
}

interface PerplexityArticleGridProps {
  articles: PerplexityArticle[]
  loading: boolean
  selectedArticles: string[]
  onArticleSelect: (article: PerplexityArticle) => void
  onSelectionChange: (articleIds: string[]) => void
  onRefresh: () => void
  onEdit?: (article: PerplexityArticle) => void
  onDelete?: (article: PerplexityArticle) => void
  onRegenerate?: (article: PerplexityArticle) => void
}

export default function PerplexityArticleGrid({
  articles,
  loading,
  selectedArticles,
  onArticleSelect,
  onSelectionChange,
  onRefresh,
  onEdit,
  onDelete,
  onRegenerate
}: PerplexityArticleGridProps) {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "ready": return <CheckCircle className="h-4 w-4 text-green-500" />
      case "enriched": return <Clock className="h-4 w-4 text-blue-500" />
      case "pending": return <AlertCircle className="h-4 w-4 text-yellow-500" />
      case "failed": return <XCircle className="h-4 w-4 text-red-500" />
      default: return <AlertCircle className="h-4 w-4 text-gray-500" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ready": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
      case "enriched": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
      case "pending": return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
      case "failed": return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
      default: return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
    }
  }

  const getCategoryColor = (category: string) => {
    const colors = {
      politics: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
      business: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      tech: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      health: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
      lifestyle: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
      entertainment: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200",
    }
    return colors[category as keyof typeof colors] || "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      onSelectionChange(articles.map(article => article.id))
    } else {
      onSelectionChange([])
    }
  }

  const handleSelectArticle = (articleId: string, checked: boolean) => {
    if (checked) {
      onSelectionChange([...selectedArticles, articleId])
    } else {
      onSelectionChange(selectedArticles.filter(id => id !== articleId))
    }
  }

  const isAllSelected = articles.length > 0 && selectedArticles.length === articles.length
  const isPartiallySelected = selectedArticles.length > 0 && selectedArticles.length < articles.length

  if (loading) {
    return (
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader>
              <div className="h-4 bg-gray-300 rounded w-3/4"></div>
              <div className="h-3 bg-gray-300 rounded w-1/2"></div>
            </CardHeader>
            <CardContent>
              <div className="h-3 bg-gray-300 rounded w-full mb-2"></div>
              <div className="h-3 bg-gray-300 rounded w-2/3"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (articles.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center">
            <Brain className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              No Perplexity articles found
            </p>
            <Button onClick={onRefresh} className="mt-4">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Selection Controls */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={isAllSelected}
                  onCheckedChange={handleSelectAll}
                  ref={(ref) => {
                    if (ref) {
                      ref.indeterminate = isPartiallySelected
                    }
                  }}
                />
                <span className="text-sm font-medium">
                  {selectedArticles.length > 0 
                    ? `${selectedArticles.length} selected` 
                    : "Select all"}
                </span>
              </div>
              
              {selectedArticles.length > 0 && (
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => onSelectionChange([])}>
                    Clear Selection
                  </Button>
                  <Button variant="outline" size="sm" disabled>
                    Bulk Delete
                  </Button>
                  <Button variant="outline" size="sm" disabled>
                    Bulk Regenerate
                  </Button>
                </div>
              )}
            </div>
            
            <Button variant="outline" size="sm" onClick={onRefresh}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Article Grid */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {articles.map((article) => (
          <Card 
            key={article.id} 
            className="transition-all hover:shadow-lg relative group"
          >
            <CardHeader className="pb-3">
              <div className="flex items-start gap-3">
                <Checkbox
                  checked={selectedArticles.includes(article.id)}
                  onCheckedChange={(checked) => handleSelectArticle(article.id, checked as boolean)}
                  className="mt-1"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-lg line-clamp-2 cursor-pointer hover:text-blue-600"
                      onClick={() => onArticleSelect(article)}>
                      {article.title}
                    </CardTitle>
                    <div className="flex items-center gap-1 shrink-0">
                      {getStatusIcon(article.article_status)}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 flex-wrap mt-2">
                    <Badge variant="secondary" className={`text-xs ${getCategoryColor(article.category)}`}>
                      {article.category}
                    </Badge>
                    <Badge className={`text-xs ${getStatusColor(article.article_status)}`}>
                      {article.article_status}
                    </Badge>
                    {article.image_status === "failed" && (
                      <Badge className="text-xs bg-red-100 text-red-800">
                        No Image
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </CardHeader>
            
            <CardContent>
              {article.lede && (
                <p className="text-sm text-muted-foreground line-clamp-3 mb-3">
                  {article.lede}
                </p>
              )}
              
              {article.image_url && (
                <div className="mb-3">
                  <img 
                    src={article.image_url} 
                    alt={article.title}
                    className="w-full h-32 object-cover rounded"
                  />
                </div>
              )}
              
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
                <span>{new Date(article.created_at).toLocaleDateString()}</span>
                {article.generation_cost && (
                  <span className="flex items-center gap-1">
                    <DollarSign className="h-3 w-3" />
                    {article.generation_cost.toFixed(4)}
                  </span>
                )}
              </div>
              
              {/* Action Buttons */}
              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => onArticleSelect(article)}
                  className="flex-1"
                >
                  <Eye className="h-4 w-4 mr-1" />
                  View
                </Button>
                {onEdit && (
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => onEdit(article)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                )}
                {onRegenerate && (
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => onRegenerate(article)}
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                )}
                {onDelete && (
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => onDelete(article)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}