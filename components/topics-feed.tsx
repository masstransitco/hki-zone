"use client"

import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useState, useCallback, useRef } from "react"
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
  const queryClient = useQueryClient()
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null)
  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false)
  const [isManualRefreshing, setIsManualRefreshing] = useState(false)
  const [isPullRefreshing, setIsPullRefreshing] = useState(false)
  const touchStartY = useRef(0)
  const scrollRef = useRef<HTMLDivElement>(null)

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

  // Handle refresh functionality
  const handleRefresh = useCallback(async () => {
    console.log(`Refresh triggered for language: ${language}`)
    
    try {
      // Reset the entire query to get fresh data from page 0
      await queryClient.resetQueries({ 
        queryKey: ["topics-articles", language] 
      })
      
      // Also refetch to ensure we get the latest data
      await refetch()
      
      console.log(`Refresh completed for language: ${language}`)
    } catch (error) {
      console.error("Refresh failed:", error)
    }
  }, [queryClient, language, refetch])

  // Pull-to-refresh handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY
  }

  const handleTouchMove = async (e: React.TouchEvent) => {
    if (!scrollRef.current) return
    
    const touchY = e.touches[0].clientY
    const pullDistance = touchY - touchStartY.current
    const scrollTop = scrollRef.current.scrollTop
    
    // Only trigger pull-to-refresh when at the top of the scroll and pulling down
    if (scrollTop === 0 && pullDistance > 100 && !isPullRefreshing && !isManualRefreshing) {
      setIsPullRefreshing(true)
      setIsManualRefreshing(true)
      
      try {
        await handleRefresh()
      } finally {
        setIsPullRefreshing(false)
        setIsManualRefreshing(false)
      }
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
        <div className="text-sm text-stone-600 dark:text-neutral-400">
          {isPullRefreshing ? 'Refreshing...' : 'Pull down to refresh'}
        </div>
      </div>
    )
  }

  return (
    <div 
      ref={scrollRef}
      className="pt-6 pb-4 isolate overflow-auto h-full"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
    >
      {isPullRefreshing && (
        <div className="flex justify-center py-2 mb-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-stone-600 dark:border-neutral-400"></div>
        </div>
      )}

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