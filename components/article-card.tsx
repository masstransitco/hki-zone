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
    <Card className="group hover:shadow-md transition-all duration-200 border-slate-200/60 dark:border-slate-800/60 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
      <CardContent className="p-4">
        <div className="flex flex-col gap-3">
          {/* Header with source and time */}
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <Badge
              variant="secondary"
              className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700"
            >
              {article.source}
            </Badge>
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>
                {formatDistanceToNow(new Date(article.publishedAt))} {t("time.ago")}
              </span>
            </div>
          </div>

          {/* Article image */}
          {article.imageUrl && (
            <div className="relative aspect-video overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800">
              <img
                src={article.imageUrl || "/placeholder.svg"}
                alt={article.title}
                className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-300"
                loading="lazy"
              />
            </div>
          )}

          {/* Title and summary */}
          <div className="space-y-2">
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 line-clamp-2 group-hover:text-slate-700 dark:group-hover:text-slate-300 transition-colors">
              {article.title}
            </h3>
            {article.summary && (
              <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-3">{article.summary}</p>
            )}
          </div>

          {/* Topic and read more */}
          <div className="flex items-center justify-between">
            {article.topic && (
              <Badge
                variant="outline"
                className="text-xs border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400"
              >
                {t(`topics.${article.topic.toLowerCase()}`)}
              </Badge>
            )}
            <Link
              href={`/article/${article.id}`}
              onClick={handleArticleClick}
              className="inline-flex items-center gap-1 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
            >
              {t("article.readMore")}
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
