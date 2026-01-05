"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Clock, ExternalLink } from "lucide-react"
import { useLanguage } from "./language-provider"
import { analytics } from "@/lib/analytics"
import { InlineSourcesBadge } from "./public-sources"
import { useHydrationSafeDate } from "@/hooks/use-hydration-safe-date"
import { useState, useEffect } from "react"
import OutletFavicon from "./outlet-favicon"
import type { Article } from "@/lib/types"

// Custom time formatting for Perplexity articles (shows minutes instead of hours)
function formatPerplexityTime(publishedAt: string): string {
  const now = new Date()
  const published = new Date(publishedAt)
  const diffInMs = now.getTime() - published.getTime()
  const diffInMinutes = Math.floor(diffInMs / (1000 * 60))
  
  if (diffInMinutes < 1) {
    return "just now"
  } else if (diffInMinutes < 60) {
    return `${diffInMinutes}m`
  } else if (diffInMinutes < 1440) { // Less than 24 hours
    const hours = Math.floor(diffInMinutes / 60)
    const remainingMinutes = diffInMinutes % 60
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`
  } else {
    const days = Math.floor(diffInMinutes / 1440)
    return `${days}d`
  }
}

interface ArticleCardProps {
  article: Article
  onReadMore?: (articleId: string) => void
  className?: string
  aspectRatio?: string
  showHkiLogo?: boolean
  showTimestamp?: boolean
}

export default function ArticleCard({ article, onReadMore, className, aspectRatio, showHkiLogo = false, showTimestamp = true }: ArticleCardProps) {
  const { t } = useLanguage()
  const timeAgo = useHydrationSafeDate(article.publishedAt)
  const [perplexityTime, setPerplexityTime] = useState("")
  
  // Use custom time formatting for Perplexity articles
  const isPerplexityArticle = article.source === "Perplexity AI"
  
  // Update Perplexity time every minute
  useEffect(() => {
    if (!isPerplexityArticle) return
    
    const updateTime = () => {
      setPerplexityTime(formatPerplexityTime(article.publishedAt))
    }
    
    // Initial update
    updateTime()
    
    // Update every minute
    const interval = setInterval(updateTime, 60000)
    
    return () => clearInterval(interval)
  }, [isPerplexityArticle, article.publishedAt])
  
  const displayTime = isPerplexityArticle ? perplexityTime : timeAgo

  const handleArticleClick = () => {
    analytics.trackArticleView(article.id, article.source, article.topic)
  }

  return (
    <Card 
      className={`group article-card cursor-pointer ${className || ''}`}
      onClick={() => {
        handleArticleClick()
        onReadMore?.(article.id)
      }}
    >
      <CardContent className="card-content h-full flex flex-col px-3 pt-3 pb-3">
        {/* Article image with dynamic aspect ratio */}
        {article.imageUrl && (
          <div className={`relative w-full overflow-hidden rounded-lg bg-surface-2 ${aspectRatio || 'aspect-video'} mb-4`}>
            <img
              src={article.imageUrl || "/placeholder.svg"}
              alt={article.title}
              className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
            />
          </div>
        )}

        {/* Title */}
        <h3 className="article-card-title line-clamp-3 text-base leading-tight transition-colors mb-4">
          {article.title}
        </h3>

        {/* Sources and time aligned to bottom */}
        <div className="flex items-center justify-between text-xs article-card-meta mt-auto">
          <div className="flex items-center gap-2">
            {showHkiLogo && article.isAiEnhanced ? (
              <div className="flex items-center gap-2">
                <div className="flex-shrink-0 flex items-center justify-center w-4 h-4 bg-text-1 rounded-sm">
                  <img
                    src="/hki-logo-white.png"
                    alt="HKI logo"
                    className="w-3 h-3 object-contain"
                  />
                </div>
              </div>
            ) : article.isAiEnhanced && article.enhancementMetadata?.sources?.length ? (
              <InlineSourcesBadge sources={article.enhancementMetadata.sources} />
            ) : (
              <div className="flex items-center gap-2">
                <OutletFavicon 
                  source={article.source} 
                  size="sm" 
                  showFallback={true}
                />
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {showTimestamp && (
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span className="truncate">
                  {displayTime && (isPerplexityArticle ? displayTime : `${displayTime.replace(/minute/g, 'min').replace(/minutes/g, 'mins')} ${t("time.ago")}`)}
                </span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
