"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Clock, ExternalLink } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import Link from "next/link"
import { useLanguage } from "./language-provider"
import { analytics } from "@/lib/analytics"
import type { Article } from "@/lib/types"

interface ArticleCardProps {
  article: Article
}

export default function ArticleCard({ article }: ArticleCardProps) {
  const { t } = useLanguage()

  const handleArticleClick = () => {
    analytics.trackArticleView(article.id, article.source, article.topic)
  }

  return (
    <Card className="group hover:shadow-elevated transition-all duration-200 border-border/60 bg-card/90 backdrop-blur-sm">
      <CardContent className="p-3 md:p-4">
        {/* Mobile: Horizontal layout, Tablet+: Vertical layout */}
        <div className="flex gap-3 md:flex-col md:gap-3">
          {/* Article image */}
          {article.imageUrl && (
            <div className="relative flex-shrink-0 w-20 h-20 md:w-full md:h-auto md:aspect-video overflow-hidden rounded-lg bg-surface">
              <img
                src={article.imageUrl || "/placeholder.svg"}
                alt={article.title}
                className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-300"
                loading="lazy"
              />
            </div>
          )}

          {/* Content area */}
          <div className="flex-1 min-w-0 space-y-2">
            {/* Header with source and time */}
            <div className="flex items-center justify-between text-xs text-muted">
              <Badge
                variant="secondary"
                className="bg-surface text-text-secondary border-border text-xs px-2 py-0.5"
              >
                {article.source}
              </Badge>
              <div className="flex items-center gap-1 flex-shrink-0">
                <Clock className="h-3 w-3" />
                <span className="truncate">
                  {formatDistanceToNow(new Date(article.publishedAt))} {t("time.ago")}
                </span>
              </div>
            </div>

            {/* Title */}
            <h3 className="font-semibold text-text-primary line-clamp-2 text-sm md:text-base group-hover:text-text-secondary transition-colors">
              {article.title}
            </h3>

            {/* Summary - hidden on mobile, visible on tablet+ */}
            {article.summary && (
              <p className="hidden md:block text-sm text-text-secondary line-clamp-2">
                {article.summary}
              </p>
            )}

            {/* Footer with topic and read more */}
            <div className="flex items-center justify-between gap-2">
              {article.topic && (
                <Badge
                  variant="outline"
                  className="text-xs border-border text-text-muted px-2 py-0.5 flex-shrink-0"
                >
                  {t(`topics.${article.topic.toLowerCase()}`)}
                </Badge>
              )}
              <Link
                href={`/article/${article.id}`}
                onClick={handleArticleClick}
                className="inline-flex items-center gap-1 text-xs text-text-muted hover:text-interactive-primary transition-colors flex-shrink-0 ml-auto"
              >
                {t("article.readMore")}
                <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
