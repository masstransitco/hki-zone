"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Clock, ExternalLink, Eye, Image as ImageIcon, Sparkles, Edit, Trash2, Target } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { formatDistanceToNow } from "date-fns"
import type { Article } from "@/lib/types"

interface OptimisticUpdates {
  [articleId: string]: {
    type: 'updating' | 'enhancing' | 'deleting' | 'selecting'
    timestamp: number
    originalData?: Partial<Article>
  }
}

interface ArticleReviewGridProps {
  articles: Article[]
  loading: boolean
  onArticleExpand: (article: Article) => void
  onLoadMore: () => void
  hasMore: boolean
  selectedArticleIds: Set<string>
  onArticleSelect: (articleId: string, selected: boolean) => void
  isLoadingMore?: boolean
  optimisticUpdates?: OptimisticUpdates
}

export default function ArticleReviewGrid({
  articles,
  loading,
  onArticleExpand,
  onLoadMore,
  hasMore,
  selectedArticleIds,
  onArticleSelect,
  isLoadingMore = false,
  optimisticUpdates = {},
}: ArticleReviewGridProps) {
  if (loading && articles.length === 0) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-950">
            <div className="flex gap-4">
              <Skeleton className="h-16 w-16 rounded-lg" />
              <div className="flex-1 space-y-3">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {articles.map((article) => (
        <ArticleReviewCard
          key={article.id}
          article={article}
          onExpand={() => onArticleExpand(article)}
          isSelected={selectedArticleIds.has(article.id)}
          onSelect={(selected) => onArticleSelect(article.id, selected)}
          optimisticUpdate={optimisticUpdates[article.id]}
        />
      ))}
      
      {hasMore && (
        <div className="flex justify-center pt-6">
          <Button
            onClick={onLoadMore}
            variant="outline"
            disabled={loading || isLoadingMore}
            className="h-10 px-6"
          >
            {isLoadingMore ? (
              <>
                <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Loading more...
              </>
            ) : (
              "Load More Articles"
            )}
          </Button>
        </div>
      )}
      
      {articles.length === 0 && !loading && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
            <Eye className="h-6 w-6 text-gray-400" />
          </div>
          <h3 className="mb-2 text-sm font-medium text-gray-900 dark:text-gray-100">No articles found</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Try adjusting your filters or search query to find articles.
          </p>
        </div>
      )}
    </div>
  )
}

interface ArticleReviewCardProps {
  article: Article
  onExpand: () => void
  isSelected: boolean
  onSelect: (selected: boolean) => void
  optimisticUpdate?: OptimisticUpdates[string]
}

function ArticleReviewCard({ article, onExpand, isSelected, onSelect, optimisticUpdate }: ArticleReviewCardProps) {
  const publishedDate = article.publishedAt ? new Date(article.publishedAt) : new Date()
  const hasImage = article.imageUrl && !article.imageUrl.includes("placeholder")
  const isDeleted = article.deletedAt != null
  const isSelectedForEnhancement = article.selectedForEnhancement || false
  
  // Apply optimistic update styling
  const isUpdating = optimisticUpdate?.type === 'updating'
  const isEnhancing = optimisticUpdate?.type === 'enhancing'
  const isDeleting = optimisticUpdate?.type === 'deleting'
  const isSelecting = optimisticUpdate?.type === 'selecting'
  
  return (
    <div
      className={`group relative rounded-xl border transition-all duration-300 ${
        isDeleting
          ? "border-red-300 bg-red-50/50 opacity-60 dark:border-red-700 dark:bg-red-950/30"
          : isEnhancing
          ? "border-purple-300 bg-purple-50/30 dark:border-purple-700 dark:bg-purple-950/20"
          : isSelecting
          ? "border-amber-300 bg-amber-50/30 dark:border-amber-700 dark:bg-amber-950/20"
          : isSelected 
          ? "border-blue-200 bg-blue-50/30 dark:border-blue-800 dark:bg-blue-950/20" 
          : isDeleted 
          ? "border-red-200 bg-red-50/30 dark:border-red-800 dark:bg-red-950/20" 
          : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm dark:border-gray-800 dark:bg-gray-950 dark:hover:border-gray-700"
      } ${
        (isUpdating || isEnhancing || isDeleting || isSelecting) ? "animate-pulse" : ""
      }`}
    >
      {/* Selection Checkbox */}
      <div className="absolute top-4 left-4 z-10">
        <Checkbox
          checked={isSelected}
          onCheckedChange={onSelect}
          disabled={isDeleting || isEnhancing}
          className="h-4 w-4 bg-white shadow-sm disabled:opacity-50"
        />
      </div>

      {/* Edit Button with Operation Status */}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
        {(isUpdating || isEnhancing || isDeleting || isSelecting) && (
          <div className="flex items-center gap-1 px-2 py-1 bg-white/90 rounded-md shadow-sm text-xs">
            <div className="h-2 w-2 animate-spin rounded-full border border-current border-t-transparent" />
            <span className="text-muted-foreground">
              {isDeleting ? 'Deleting...' : isEnhancing ? 'Enhancing...' : isSelecting ? 'Selecting...' : 'Updating...'}
            </span>
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={onExpand}
          disabled={isDeleting}
          className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 shadow-sm hover:bg-white disabled:opacity-50"
          title="Edit article"
        >
          <Edit className="h-4 w-4" />
        </Button>
      </div>

      <div className="p-6">
        <div className="flex gap-4">
          {/* Article Image */}
          <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-800">
            {hasImage ? (
              <img
                src={article.imageUrl}
                alt={article.title}
                className="h-full w-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = 'none'
                  e.currentTarget.nextElementSibling?.classList.remove('hidden')
                }}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <ImageIcon className="h-6 w-6 text-gray-400" />
              </div>
            )}
            
            {/* Compact Status Indicators */}
            {(isDeleted || article.isAiEnhanced || isSelectedForEnhancement) && (
              <div className="absolute -top-1 -right-1 flex gap-1">
                {isDeleted && (
                  <div className="bg-red-600 rounded-full p-1 shadow-sm">
                    <Trash2 className="h-2.5 w-2.5 text-white" />
                  </div>
                )}
                {article.isAiEnhanced && (
                  <div className="bg-purple-600 rounded-full p-1 shadow-sm">
                    <Sparkles className="h-2.5 w-2.5 text-white" />
                  </div>
                )}
                {isSelectedForEnhancement && !article.isAiEnhanced && (
                  <div className="bg-amber-600 rounded-full p-1 shadow-sm">
                    <Target className="h-2.5 w-2.5 text-white" />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Article Content */}
          <div className="flex-1 min-w-0 space-y-3">
            {/* Header */}
            <div className="space-y-1">
              <h3 className={`font-medium text-sm leading-tight line-clamp-2 pr-16 ${
                isDeleted ? 'text-red-700 dark:text-red-400' : 'text-gray-900 dark:text-gray-100'
              }`}>
                {article.title}
              </h3>
              
              {/* Meta Information */}
              <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                <span className="font-medium">{article.source}</span>
                <span>•</span>
                <span>{formatDistanceToNow(publishedDate, { addSuffix: true })}</span>
                {article.category && (
                  <>
                    <span>•</span>
                    <span>{article.category}</span>
                  </>
                )}
              </div>
            </div>

            {/* Summary */}
            {article.summary && (
              <p className={`text-xs line-clamp-2 leading-relaxed ${
                isDeleted ? 'text-red-600/70 dark:text-red-400/70' : 'text-gray-600 dark:text-gray-400'
              }`}>
                {article.summary}
              </p>
            )}

            {/* Status Badges */}
            <div className="flex items-center gap-2">
              {isDeleted && (
                <Badge variant="destructive" className="text-xs h-5">
                  Deleted
                </Badge>
              )}
              {article.isAiEnhanced && (
                <Badge variant="secondary" className="text-xs h-5 bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">
                  AI Enhanced
                </Badge>
              )}
              {isSelectedForEnhancement && !article.isAiEnhanced && (
                <Badge variant="secondary" className="text-xs h-5 bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">
                  Selected for enhancement
                </Badge>
              )}
              
              {/* Quality Indicators - Simplified */}
              <div className="flex items-center gap-1 ml-auto">
                <div className={`w-2 h-2 rounded-full ${
                  article.content && article.content.length > 200 ? 'bg-green-500' : 'bg-gray-300'
                }`} title="Content quality" />
                <div className={`w-2 h-2 rounded-full ${
                  hasImage ? 'bg-green-500' : 'bg-gray-300'
                }`} title="Has image" />
                <div className={`w-2 h-2 rounded-full ${
                  article.summary && article.summary.length > 50 ? 'bg-green-500' : 'bg-gray-300'
                }`} title="Has summary" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}