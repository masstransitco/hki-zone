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

  const handleTouchMove = (e: React.TouchEvent) => {
    // Don't handle touch moves when bottom sheet is open
    if (isBottomSheetOpen) {
      e.stopPropagation()
      return
    }
    
    if (!scrollRef.current) return
    
    const touchY = e.touches[0].clientY
    const pullDistance = touchY - touchStartY.current
    const scrollTop = scrollRef.current.scrollTop
    
    // Check if we should handle pull-to-refresh
    if (scrollTop === 0 && pullDistance > 0) {
      // Handle pull-to-refresh
      if (pullDistance > 100 && !isPullRefreshing && !isManualRefreshing) {
        setIsPullRefreshing(true)
        setIsManualRefreshing(true)
        handleRefresh().finally(() => {
          setIsPullRefreshing(false)
          setIsManualRefreshing(false)
        })
      }
    }
  }
  
  // Add touch event listeners with passive: false to allow preventDefault
  useEffect(() => {
    const scrollElement = scrollRef.current
    if (!scrollElement) return

    const preventPullToRefresh = (e: TouchEvent) => {
      // Don't handle any touch events when bottom sheet is open
      if (isBottomSheetOpen) {
        e.stopPropagation()
        return
      }
      
      const scrollTop = scrollElement.scrollTop
      
      // Get current touch position
      const touch = e.touches[0]
      if (!touch) return
      
      const touchY = touch.clientY
      const pullDistance = touchY - touchStartY.current
      
      // Prevent default only when at top and pulling down
      if (scrollTop <= 0 && pullDistance > 0) {
        if (e.cancelable) {
          e.preventDefault()
        }
      }
    }

    // Add event listener with passive: false
    scrollElement.addEventListener('touchmove', preventPullToRefresh, { passive: false })
    
    return () => {
      scrollElement.removeEventListener('touchmove', preventPullToRefresh)
    }
  }, [isBottomSheetOpen])

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
      <div 
        ref={scrollRef}
        className="isolate overflow-auto h-full"
        style={{ 
          overscrollBehaviorY: 'contain', 
          WebkitOverflowScrolling: 'touch',
          // Disable scroll and interaction when bottom sheet is open
          ...(isBottomSheetOpen && {
            overflow: 'hidden',
            touchAction: 'none',
            pointerEvents: 'none'
          })
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
      >
        {isPullRefreshing && (
          <div className="flex justify-center py-2 mb-4 transition-all duration-300 ease-out">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-stone-600 dark:border-neutral-400"></div>
          </div>
        )}
        <div className="p-6 text-center">
          <h3 className="text-lg font-semibold text-stone-900 dark:text-neutral-50 mb-2">
            {t("topics.noAiArticles")}
          </h3>
          <p className="text-stone-600 dark:text-neutral-400 mb-4">
            {t("topics.noAiArticlesDescription")}
          </p>
          <div className="text-sm text-stone-600 dark:text-neutral-400">
            {!isPullRefreshing && 'Pull down to refresh'}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div 
      ref={scrollRef}
      className="isolate overflow-auto h-full"
      style={{ 
        overscrollBehaviorY: 'contain', 
        WebkitOverflowScrolling: 'touch',
        // Disable scroll and interaction when bottom sheet is open
        ...(isBottomSheetOpen && {
          overflow: 'hidden',
          touchAction: 'none',
          pointerEvents: 'none'
        })
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
    >
      {isPullRefreshing && (
        <div className="flex justify-center py-2 mb-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-stone-600 dark:border-neutral-400"></div>
        </div>
      )}

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

      <ArticleBottomSheet
        articleId={selectedArticleId}
        open={isBottomSheetOpen}
        onOpenChange={handleBottomSheetChange}
      />
    </div>
  )
}