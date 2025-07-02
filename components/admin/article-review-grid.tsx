"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Clock, ExternalLink, Eye, Image as ImageIcon } from "lucide-react"
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
        </div>

        {/* Article Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-medium line-clamp-2 text-sm leading-tight">
              {article.title}
            </h3>
            <Badge variant="secondary" className="flex-shrink-0 text-xs">
              {article.source}
            </Badge>
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
        <div className={`h-1 w-1/3 rounded ${article.content && article.content.length > 200 ? 'bg-green-500' : 'bg-yellow-500'}`} />
        <div className={`h-1 w-1/3 rounded ${hasImage ? 'bg-green-500' : 'bg-red-500'}`} />
        <div className={`h-1 w-1/3 rounded ${article.summary && article.summary.length > 50 ? 'bg-green-500' : 'bg-yellow-500'}`} />
      </div>
    </div>
  )
}