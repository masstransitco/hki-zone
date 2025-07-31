"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import Link from "next/link"
import { Clock, ExternalLink } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { useLanguage } from "./language-provider"
import type { Article } from "@/lib/types"
import ArticleDetailSkeleton from "./article-detail-skeleton"
import PublicSources from "./public-sources"
import AIEnhancedContent from "./ai-enhanced-content"
import OutletFavicon from "./outlet-favicon"

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
  const [article, setArticle] = useState<Article | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  // Fallback to regular fetch if QueryClient is not available
  useEffect(() => {
    let mounted = true

    const loadArticle = async () => {
      try {
        setIsLoading(true)
        setError(null)
        const data = await fetchArticle(articleId)
        if (mounted) {
          setArticle(data)
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err : new Error("Failed to fetch article"))
        }
      } finally {
        if (mounted) {
          setIsLoading(false)
        }
      }
    }

    loadArticle()

    return () => {
      mounted = false
    }
  }, [articleId])

  if (isLoading) return <ArticleDetailSkeleton isBottomSheet={false} />
  if (error) return <div className="p-6 text-center text-destructive text-body">{t("error.failedToLoad")} article</div>
  if (!article) return <div className="p-6 text-center text-body">{t("error.articleNotFound")}</div>

  return (
    <article className="max-w-2xl mx-auto p-6">
      <header className="mb-8">
        <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6 leading-tight">{article.title}</h1>

        <div className="flex items-center justify-between text-footnote text-[rgb(var(--apple-gray-1))] mb-6">
          <div className="flex items-center gap-2">
            {article.isAiEnhanced && article.enhancementMetadata?.sources?.length ? (
              <PublicSources 
                sources={article.enhancementMetadata.sources}
                trigger={
                  <span className="text-subhead text-[rgb(var(--apple-blue))] font-medium hover:underline cursor-pointer">
                    {article.enhancementMetadata.sources.length} sources
                  </span>
                }
              />
            ) : (
              <div className="flex items-center gap-2">
                <OutletFavicon 
                  source={article.source} 
                  size="md" 
                  showFallback={true}
                />
                <span className="text-subhead text-[rgb(var(--apple-blue))] font-medium">
                  {article.source.replace(' (AI Enhanced)', '')}
                  {article.isAiEnhanced && ' + AI Enhanced'}
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Clock className="w-4 h-4" />
            <span>{formatDistanceToNow(new Date(article.publishedAt), { addSuffix: true })}</span>
          </div>
        </div>
      </header>

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

      <div className="space-y-8">
        {article.content ? (
          <AIEnhancedContent 
            content={article.content} 
            isBottomSheet={false} 
            sources={article.enhancementMetadata?.sources}
          />
        ) : (
          <div className="text-muted-foreground text-center py-8">
            <p>No article content available</p>
          </div>
        )}
      </div>

      {/* Only show "Read original article" button for non-AI enhanced articles */}
      {!article.isAiEnhanced && (
        <footer className="mt-12 pt-8 border-t border-[rgb(var(--apple-gray-5))]">
          <Link
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-[rgb(var(--apple-blue))] hover:opacity-70 transition-opacity apple-focus rounded-lg p-1 -m-1"
          >
            <ExternalLink className="w-4 h-4" />
            <span className="text-base font-medium">{t("article.readOriginal")}</span>
          </Link>
        </footer>
      )}
    </article>
  )
}
