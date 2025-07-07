"use client"

import { useInfiniteQuery } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { useInView } from "react-intersection-observer"
import ArticleCard from "./article-card"
import ArticleBottomSheet from "./article-bottom-sheet"
import LoadingSkeleton from "./loading-skeleton"
import { useLanguage } from "./language-provider"
import type { Article } from "@/lib/types"

async function fetchTopicsArticles({ pageParam = 0, language = "en" }): Promise<{ articles: Article[]; nextPage: number | null }> {
  const response = await fetch(`/api/topics?page=${pageParam}&language=${language}`)
  if (!response.ok) throw new Error("Failed to fetch topics articles")
  return response.json()
}

export default function TopicsFeed() {
  const { ref, inView } = useInView()
  const { t, language } = useLanguage()
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null)
  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false)

  const handleReadMore = (articleId: string) => {
    setSelectedArticleId(articleId)
    setIsBottomSheetOpen(true)
  }

  const handleBottomSheetChange = (open: boolean) => {
    setIsBottomSheetOpen(open)
    if (!open) {
      setSelectedArticleId(null)
    }
  }

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, error } = useInfiniteQuery({
    queryKey: ["topics-articles", language],
    queryFn: ({ pageParam }) => fetchTopicsArticles({ pageParam, language }),
    getNextPageParam: (lastPage) => lastPage.nextPage,
    initialPageParam: 0,
  })

  useEffect(() => {
    if (inView && hasNextPage) {
      fetchNextPage()
    }
  }, [inView, hasNextPage, fetchNextPage])

  if (isLoading) return <LoadingSkeleton />
  if (error) return <div className="p-4 text-center text-destructive" suppressHydrationWarning>{t("error.failedToLoad")} AI-enhanced articles</div>

  const articles = data?.pages.flatMap((page) => page.articles) ?? []

  if (articles.length === 0) {
    return (
      <div className="p-6 text-center">
        <h3 className="text-lg font-semibold text-stone-900 dark:text-neutral-50 mb-2">
          {t("topics.noAiArticles")}
        </h3>
        <p className="text-stone-600 dark:text-neutral-400">
          {t("topics.noAiArticlesDescription")}
        </p>
      </div>
    )
  }

  return (
    <div className="px-6 pb-4">
      {/* Header for AI-enhanced articles */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-stone-900 dark:text-neutral-50 mb-2">
          {t("topics.aiEnhancedFeed")}
        </h2>
        <p className="text-sm text-stone-600 dark:text-neutral-400">
          {t("topics.aiEnhancedDescription")}
        </p>
      </div>

      {/* Responsive grid layout: mobile 1col, tablet 2col, desktop 3col, large 4col */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
        {articles.map((article) => (
          <ArticleCard 
            key={article.id} 
            article={article} 
            onReadMore={handleReadMore}
          />
        ))}
      </div>

      <div ref={ref} className="h-10">
        {isFetchingNextPage && <LoadingSkeleton />}
      </div>

      <ArticleBottomSheet
        articleId={selectedArticleId}
        open={isBottomSheetOpen}
        onOpenChange={handleBottomSheetChange}
      />
    </div>
  )
}