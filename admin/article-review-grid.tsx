"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Clock, ExternalLink, Eye, Image as ImageIcon, Sparkles } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import type { Article } from "@/lib/types"

interface ArticleReviewGridProps {
  articles: Article[]
  loading: boolean
  selectedArticle: Article | null
  onArticleSelect: (article: Article) => void
  onLoadMore: () => void
  hasMore: boolean
}

export default function ArticleReviewGrid({
  articles,
  loading,
  selectedArticle,
  onArticleSelect,
  onLoadMore,
  hasMore,
}: ArticleReviewGridProps) {
  if (loading && articles.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex gap-4">
                <Skeleton className="h-20 w-20 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-3 w-1/4" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="flex flex-col">
      <ScrollArea className="flex-1">
        <CardContent className="p-6">
          <div className="space-y-4">
            {articles.map((article) => (
              <ArticleReviewCard
                key={article.id}
                article={article}
                isSelected={selectedArticle?.id === article.id}
                onClick={() => onArticleSelect(article)}
              />
            ))}
            
            {hasMore && (
              <div className="flex justify-center pt-4">
                <Button
                  onClick={onLoadMore}
                  variant="outline"
                  disabled={loading}
                >
                  {loading ? "Loading..." : "Load More"}
                </Button>
              </div>
            )}
            
            {articles.length === 0 && !loading && (
              <div className="text-center py-8 text-muted-foreground">
                No articles found. Try adjusting your filters or search query.
              </div>
            )}
          </div>
        </CardContent>
      </ScrollArea>
    </Card>
  )
}

interface ArticleReviewCardProps {
  article: Article
  isSelected: boolean
  onClick: () => void
}

function ArticleReviewCard({ article, isSelected, onClick }: ArticleReviewCardProps) {
  const publishedDate = article.publishedAt ? new Date(article.publishedAt) : new Date()
  const hasImage = article.imageUrl && !article.imageUrl.includes("placeholder")
  
  return (
    <div
      onClick={onClick}
      className={`group cursor-pointer rounded-lg border p-4 transition-all duration-200 hover:shadow-md ${
        isSelected 
          ? "border-primary bg-primary/5 shadow-md" 
          : "border-border hover:border-primary/50"
      }`}
    >
      <div className="flex gap-4">
        {/* Article Image */}
        <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg bg-muted">
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
          ) : null}
          <div className={`flex h-full w-full items-center justify-center ${hasImage ? 'hidden' : ''}`}>
            <ImageIcon className="h-8 w-8 text-muted-foreground" />
          </div>
          
          {/* AI Enhanced Indicator */}
          {article.isAiEnhanced && (
            <div className="absolute top-1 right-1">
              <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-full p-1">
                <Sparkles className="h-3 w-3 text-white" />
              </div>
            </div>
          )}
        </div>

        {/* Article Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-1 flex-1">
              <h3 className="font-medium line-clamp-2 text-sm leading-tight flex-1">
                {article.title}
              </h3>
              {article.isAiEnhanced && (
                <Sparkles className="h-4 w-4 text-purple-600 flex-shrink-0 mt-0.5" />
              )}
            </div>
            <div className="flex flex-col gap-1">
              <Badge variant="secondary" className="flex-shrink-0 text-xs">
                {article.source}
              </Badge>
              {article.isAiEnhanced && (
                <Badge variant="outline" className="text-xs bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
                  <Sparkles className="h-2.5 w-2.5 mr-1" />
                  AI
                </Badge>
              )}
            </div>
          </div>
          
          <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
            {article.summary}
          </p>
          
          <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDistanceToNow(publishedDate, { addSuffix: true })}
            </div>
            
            {article.category && (
              <Badge variant="outline" className="text-xs">
                {article.category}
              </Badge>
            )}
            
            <div className="flex items-center gap-1 ml-auto">
              <Eye className="h-3 w-3" />
              <span>View</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Quality Indicators */}
      <div className="mt-3 flex gap-2">
        <div className={`h-1 rounded ${article.isAiEnhanced ? 'w-1/4' : 'w-1/3'} ${article.content && article.content.length > 200 ? 'bg-green-500' : 'bg-yellow-500'}`} />
        <div className={`h-1 rounded ${article.isAiEnhanced ? 'w-1/4' : 'w-1/3'} ${hasImage ? 'bg-green-500' : 'bg-red-500'}`} />
        <div className={`h-1 rounded ${article.isAiEnhanced ? 'w-1/4' : 'w-1/3'} ${article.summary && article.summary.length > 50 ? 'bg-green-500' : 'bg-yellow-500'}`} />
        {article.isAiEnhanced && (
          <div className="h-1 w-1/4 rounded bg-gradient-to-r from-purple-500 to-blue-500" />
        )}
      </div>
    </div>
  )
}