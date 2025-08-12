"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import Link from "next/link"
import { Clock, ExternalLink } from "lucide-react"
import { useLanguage } from "./language-provider"
import { useHydrationSafeDate } from "@/hooks/use-hydration-safe-date"
import type { Article } from "@/lib/types"
import ArticleDetailSkeleton from "./article-detail-skeleton"
import PublicSources from "./public-sources"
import AIEnhancedContent from "./ai-enhanced-content"
import OutletFavicon from "./outlet-favicon"
import { getSourceDisplayNameWithAI } from "@/lib/source-display-name"
import KeepReadingSection from "./keep-reading-section"

interface ArticleDetailSheetProps {
  articleId: string
  onArticleSelect?: (articleId: string) => void
}

async function fetchArticle(id: string): Promise<Article> {
  console.log(`🔍 ArticleDetailSheet: Fetching article with ID: ${id}`)
  
  // Since topics feed uses the regular articles table for AI-enhanced articles,
  // we should fetch from the same source for consistency
  const response = await fetch(`/api/articles/${id}`)
  
  if (!response.ok) {
    throw new Error("Failed to fetch article")
  }
  
  const article = await response.json()
  console.log(`✅ Article fetched:`, {
    id: article.id,
    title: article.title,
    source: article.source,
    isAiEnhanced: article.isAiEnhanced
  })
  
  return article
}

export default function ArticleDetailSheet({ articleId, onArticleSelect }: ArticleDetailSheetProps) {
  const { t } = useLanguage()
  const [article, setArticle] = useState<Article | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const timeAgo = useHydrationSafeDate(article?.publishedAt || null)

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


  if (isLoading) return <ArticleDetailSkeleton isBottomSheet={true} />
  if (error) return <div className="px-6 py-4 text-center text-destructive text-body">{t("error.failedToLoad")} article</div>
  if (!article) return <div className="px-6 py-4 text-center text-body">{t("error.articleNotFound")}</div>

  return (
    <article className="px-6 pt-4 pb-8">
      <header className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-6 leading-tight">{article.title}</h1>

        <div className="flex items-center justify-between text-sm text-muted-foreground mb-6">
          <div className="flex items-center gap-2">
            {article.isAiEnhanced && article.enhancementMetadata?.sources?.length ? (
              <PublicSources 
                sources={article.enhancementMetadata.sources}
                trigger={
                  <span className="text-sm text-text-2 dark:text-text-2 font-medium hover:text-text-1 dark:hover:text-text-1 hover:underline cursor-pointer transition-colors">
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
                <span className="text-sm text-text-2 dark:text-text-2 font-medium">
                  {getSourceDisplayNameWithAI(article.source, article.isAiEnhanced)}
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Clock className="w-4 h-4" />
            <span>{timeAgo && `${timeAgo} ago`}</span>
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
            className="w-full h-48 sm:h-64 object-cover rounded-xl border border-border"
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
            isBottomSheet={true} 
            sources={article.enhancementMetadata?.sources}
          />
        ) : (
          <div className="text-muted-foreground text-center py-8">
            <p>No article content available</p>
            {/* Debug info */}
            {process.env.NODE_ENV === 'development' && (
              <div className="mt-4 text-xs text-left">
                <pre className="bg-muted p-2 rounded overflow-auto">
                  {JSON.stringify({
                    hasContent: !!article.content,
                    contentLength: article.content?.length || 0,
                    summary: article.summary,
                    isAiEnhanced: article.isAiEnhanced,
                    source: article.source
                  }, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}

      </div>

      {/* Keep Reading Section */}
      {onArticleSelect && (
        <KeepReadingSection 
          currentArticle={article}
          onArticleSelect={onArticleSelect}
        />
      )}

      {/* Only show "Read original article" button for non-AI enhanced articles */}
      {!article.isAiEnhanced && (
        <footer className="mt-10 pt-6 border-t border-border">
          <Link
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-text-2 dark:text-text-2 hover:text-text-1 dark:hover:text-text-1 transition-colors rounded-lg p-1 -m-1"
          >
            <ExternalLink className="w-4 h-4" />
            <span className="text-sm font-medium">{t("article.readOriginal")}</span>
          </Link>
        </footer>
      )}
    </article>
  )
}