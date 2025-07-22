"use client"

import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useState, useCallback } from "react"
import { useInView } from "react-intersection-observer"
import ArticleCard from "./article-card"
import ArticleBottomSheet from "./article-bottom-sheet"
import LoadingSkeleton from "./loading-skeleton"
import { useLanguage } from "./language-provider"
import PullRefreshIndicator from "./pull-refresh-indicator"
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh"
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
    // No stale time - always fetch fresh data since articles update every minute
    staleTime: 0, // Always consider data stale to get fresh articles
    // Enable background refetch to detect new articles
    refetchOnWindowFocus: true,
    // Retry on failure to handle temporary network issues
    retry: 2,
  })

  // Handle refresh functionality
  const handleRefresh = useCallback(async () => {
    console.log(`🔄 [TOPICS-FEED] Refresh START - Language: ${language}`)
    console.log(`📊 Current articles count: ${data?.pages.flatMap(p => p.articles).length || 0}`)
    
    try {
      // Reset the entire query to get fresh data from page 0
      await queryClient.resetQueries({ 
        queryKey: ["topics-articles", language] 
      })
      
      // Also refetch to ensure we get the latest data
      await refetch()
      
      console.log(`✅ [TOPICS-FEED] Refresh COMPLETED - Language: ${language}`)
      console.log(`📊 New articles count: ${data?.pages.flatMap(p => p.articles).length || 0}`)
    } catch (error) {
      console.error("❌ [TOPICS-FEED] Refresh FAILED:", error)
    }
  }, [queryClient, language, refetch, data])

  // Use the clean pull-to-refresh hook
  const {
    scrollRef,
    pullDistance,
    isRefreshing,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd
  } = usePullToRefresh({
    onRefresh: handleRefresh,
    enabled: !isBottomSheetOpen
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
      <div className="relative h-full overflow-hidden">
        <PullRefreshIndicator 
          pullDistance={pullDistance} 
          isRefreshing={isRefreshing} 
        />
        
        <div 
          ref={scrollRef}
          className="isolate overflow-auto h-full"
          style={{ 
            overscrollBehaviorY: 'contain', 
            WebkitOverflowScrolling: 'touch',
            transform: `translateY(${Math.min(pullDistance, 150)}px)`,
            transition: pullDistance > 0 ? 'none' : 'transform 0.3s ease-out',
            ...(isBottomSheetOpen && {
              overflow: 'hidden',
              touchAction: 'none',
              pointerEvents: 'none'
            })
          }}
        >
          <div className="p-6 text-center">
            <h3 className="text-lg font-semibold text-stone-900 dark:text-neutral-50 mb-2">
              {t("topics.noAiArticles")}
            </h3>
            <p className="text-stone-600 dark:text-neutral-400 mb-4">
              {t("topics.noAiArticlesDescription")}
            </p>
            <div className="text-sm text-stone-600 dark:text-neutral-400">
              Pull down to refresh
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative h-full overflow-hidden">
      <PullRefreshIndicator 
        pullDistance={pullDistance} 
        isRefreshing={isRefreshing} 
      />
      
      <div 
        ref={scrollRef}
        className="isolate overflow-auto h-full"
        style={{ 
          overscrollBehaviorY: 'contain', 
          WebkitOverflowScrolling: 'touch',
          transform: `translateY(${Math.min(pullDistance, 150)}px)`,
          transition: pullDistance > 0 ? 'none' : 'transform 0.3s ease-out',
          ...(isBottomSheetOpen && {
            overflow: 'hidden',
            touchAction: 'none',
            pointerEvents: 'none'
          })
        }}
      >
        {/* Responsive grid layout: mobile 1col, tablet 2col, desktop 3col, large 4col */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-1 md:gap-[18px] lg:gap-[22px] isolate px-[1px]">
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
      </div>

      <ArticleBottomSheet
        articleId={selectedArticleId}
        open={isBottomSheetOpen}
        onOpenChange={handleBottomSheetChange}
      />
    </div>
  )
}