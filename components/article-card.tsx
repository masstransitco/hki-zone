"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Clock, ExternalLink } from "lucide-react"
import { useLanguage } from "./language-provider"
import { analytics } from "@/lib/analytics"
import { InlineSourcesBadge } from "./public-sources"
import { useHydrationSafeDate } from "@/hooks/use-hydration-safe-date"
import type { Article } from "@/lib/types"

interface ArticleCardProps {
  article: Article
  onReadMore?: (articleId: string) => void
}

export default function ArticleCard({ article, onReadMore }: ArticleCardProps) {
  const { t } = useLanguage()
  const timeAgo = useHydrationSafeDate(article.publishedAt)

  const handleArticleClick = () => {
    analytics.trackArticleView(article.id, article.source, article.topic)
  }

  return (
    <Card 
      className="group hover:shadow-lg hover:shadow-stone-200/30 dark:hover:shadow-neutral-900/40 transition-all duration-200 border-stone-200/60 dark:border-neutral-700/60 bg-stone-50/95 dark:bg-neutral-900/95 backdrop-blur-sm h-full cursor-pointer"
      onClick={() => {
        handleArticleClick()
        onReadMore?.(article.id)
      }}
    >
      <CardContent className="p-6 h-full">
        {/* Consistent vertical layout for better readability */}
        <div className="flex flex-col gap-4 h-full">
          {/* Article image */}
          {article.imageUrl && (
            <div className="relative w-full aspect-video overflow-hidden rounded-lg bg-surface">
              <img
                src={article.imageUrl || "/placeholder.svg"}
                alt={article.title}
                className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-300"
                loading="lazy"
              />
            </div>
          )}

          {/* Content area */}
          <div className="flex-1 min-w-0 space-y-3">
            {/* Header with source and time */}
            <div className="flex items-center justify-between text-xs text-stone-500 dark:text-neutral-400">
              <div className="flex items-center gap-2">
                {article.isAiEnhanced && article.enhancementMetadata?.sources?.length ? (
                  <InlineSourcesBadge sources={article.enhancementMetadata.sources} />
                ) : (
                  <Badge
                    variant="secondary"
                    className="text-xs px-2 py-1"
                  >
                    {article.source.replace(' (AI Enhanced)', '')}
                    {article.isAiEnhanced && ' + AI'}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <Clock className="h-3 w-3" />
                <span className="truncate">
                  {timeAgo && `${timeAgo} ${t("time.ago")}`}
                </span>
              </div>
            </div>

            {/* Title */}
            <h3 className="font-semibold text-stone-900 dark:text-neutral-50 line-clamp-3 text-base leading-tight group-hover:text-stone-800 dark:group-hover:text-neutral-100 transition-colors">
              {article.title}
            </h3>

            {/* Summary - always visible for better content preview */}
            {article.summary && (
              <p className="text-sm text-stone-700 dark:text-neutral-300 line-clamp-2 leading-relaxed">
                {article.summary}
              </p>
            )}

          </div>
        </div>
      </CardContent>
    </Card>
  )
}
