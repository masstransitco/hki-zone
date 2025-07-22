"use client"

import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { useInView } from "react-intersection-observer"
import { RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
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
  const queryClient = useQueryClient()
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null)
  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false)
  const [isManualRefreshing, setIsManualRefreshing] = useState(false)

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

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, error, refetch } = useInfiniteQuery({
    queryKey: ["topics-articles", language],
    queryFn: ({ pageParam }) => fetchTopicsArticles({ pageParam, language }),
    getNextPageParam: (lastPage) => lastPage.nextPage,
    initialPageParam: 0,
    // PERFORMANCE FIX: Reduce stale time from 60s to 30s for fresher content
    staleTime: 30 * 1000, // 30 seconds instead of default 60s
    // Enable background refetch to detect new articles
    refetchOnWindowFocus: true,
    // Retry on failure to handle temporary network issues
    retry: 2,
  })

  // Handle manual refresh functionality
  const handleManualRefresh = async () => {
    setIsManualRefreshing(true)
    console.log(`Manual refresh triggered for language: ${language}`)
    
    try {
      // Reset the entire query to get fresh data from page 0
      await queryClient.resetQueries({ 
        queryKey: ["topics-articles", language] 
      })
      
      // Also refetch to ensure we get the latest data
      await refetch()
      
      console.log(`Manual refresh completed for language: ${language}`)
    } catch (error) {
      console.error("Manual refresh failed:", error)
    } finally {
      setIsManualRefreshing(false)
    }
  }

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
        <p className="text-stone-600 dark:text-neutral-400 mb-4">
          {t("topics.noAiArticlesDescription")}
        </p>
        <Button 
          onClick={handleManualRefresh} 
          disabled={isManualRefreshing}
          variant="outline"
          size="sm"
          className="inline-flex items-center gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${isManualRefreshing ? 'animate-spin' : ''}`} />
          {isManualRefreshing ? 'Refreshing...' : 'Check for New Articles'}
        </Button>
      </div>
    )
  }

  return (
    <div className="pt-6 pb-4 isolate">
      {/* Header with refresh button */}
      <div className="flex items-center justify-between mb-4 px-2">
        <div className="text-sm text-stone-600 dark:text-neutral-400">
          {articles.length} AI-enhanced articles
        </div>
        <Button 
          onClick={handleManualRefresh} 
          disabled={isManualRefreshing || isLoading}
          variant="ghost"
          size="sm"
          className="inline-flex items-center gap-2 text-stone-600 hover:text-stone-900 dark:text-neutral-400 dark:hover:text-neutral-100"
        >
          <RefreshCw className={`h-4 w-4 ${isManualRefreshing ? 'animate-spin' : ''}`} />
          {isManualRefreshing ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>

      {/* Responsive grid layout: mobile 1col, tablet 2col, desktop 3col, large 4col */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6 isolate">
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