"use client"

import { useQuery } from "@tanstack/react-query"
import Image from "next/image"
import Link from "next/link"
import { Clock, ExternalLink } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { useLanguage } from "./language-provider"
import type { Article } from "@/lib/types"
import LoadingSkeleton from "./loading-skeleton"

interface ArticleDetailProps {
  articleId: string
}

async function fetchArticle(id: string): Promise<Article> {
  const response = await fetch(`/api/articles/${id}`)
  if (!response.ok) throw new Error("Failed to fetch article")
  return response.json()
}

export default function ArticleDetail({ articleId }: ArticleDetailProps) {
  const { t } = useLanguage()
  const {
    data: article,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["article", articleId],
    queryFn: () => fetchArticle(articleId),
  })

  if (isLoading) return <LoadingSkeleton />
  if (error) return <div className="p-6 text-center text-destructive text-body">{t("error.failedToLoad")} article</div>
  if (!article) return <div className="p-6 text-center text-body">{t("error.articleNotFound")}</div>

  return (
    <article className="max-w-2xl mx-auto p-6">
      {article.imageUrl && (
        <div className="mb-8">
          <Image
            src={article.imageUrl || "/placeholder.svg"}
            alt={article.title}
            width={800}
            height={400}
            className="w-full h-48 sm:h-64 md:h-80 object-cover rounded-xl apple-shadow-sm border border-[rgb(var(--apple-gray-5))]"
            onError={(e) => {
              e.currentTarget.style.display = "none"
            }}
          />
        </div>
      )}

      <header className="mb-8">
        <h1 className="text-title-1 text-foreground mb-4 leading-tight">{article.title}</h1>

        <div className="flex items-center gap-4 text-footnote text-[rgb(var(--apple-gray-1))] mb-6">
          <span className="text-subhead text-[rgb(var(--apple-blue))] font-medium">{article.source}</span>
          <div className="flex items-center gap-1">
            <Clock className="w-4 h-4" />
            <span>{formatDistanceToNow(new Date(article.publishedAt), { addSuffix: true })}</span>
          </div>
        </div>
      </header>

      <div className="space-y-6">
        <div className="bg-[rgb(var(--apple-gray-6))] dark:bg-[rgb(var(--apple-gray-6))] p-6 rounded-xl">
          <h3 className="text-subhead text-[rgb(var(--apple-gray-1))] mb-3">{t("article.aiSummary")}</h3>
          <p className="text-body text-foreground leading-relaxed">{article.summary}</p>
        </div>

        {article.content && (
          <div className="space-y-4">
            <h3 className="text-title-3 text-foreground">{t("article.fullArticle")}</h3>
            <div className="text-body text-foreground leading-relaxed whitespace-pre-wrap">{article.content}</div>
          </div>
        )}
      </div>

      <footer className="mt-12 pt-8 border-t border-[rgb(var(--apple-gray-5))]">
        <Link
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-[rgb(var(--apple-blue))] hover:opacity-70 transition-opacity apple-focus rounded-lg p-1 -m-1"
        >
          <ExternalLink className="w-4 h-4" />
          <span className="text-body font-medium">{t("article.readOriginal")}</span>
        </Link>
      </footer>
    </article>
  )
}
