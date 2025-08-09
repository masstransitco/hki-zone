"use client"

import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useState, useCallback, useRef } from "react"
import { useInView } from "react-intersection-observer"
import ArticleCard from "./article-card"
import ArticleBottomSheet from "./article-bottom-sheet"
import LoadingSkeleton from "./loading-skeleton"
import { useLanguage } from "./language-provider"
import PullRefreshIndicator from "./pull-refresh-indicator"
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh"
import { useHeaderVisibility } from "@/contexts/header-visibility"
import { LoadingSpinner } from "./loading-spinner"
import { useRealtimeArticles } from "@/hooks/use-realtime-articles"
import type { Article } from "@/lib/types"

async function fetchTopicsArticles({ pageParam = 0, language = "en" }): Promise<{ articles: Article[]; nextPage: number | null }> {
  const response = await fetch(`/api/topics?page=${pageParam}&language=${language}`, {
    cache: 'no-store'
  })
  if (!response.ok) throw new Error("Failed to fetch topics articles")
  return response.json()
}

interface TopicsFeedProps {
  isActive?: boolean
}

export default function TopicsFeed({ isActive = true }: TopicsFeedProps) {
  const { ref, inView } = useInView()
  const { t, language } = useLanguage()
  const queryClient = useQueryClient()
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null)
  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false)
  const { setScrollPosition } = useHeaderVisibility()
  const ticking = useRef(false)

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

  const handleArticleChange = (articleId: string) => {
    setSelectedArticleId(articleId)
    // Keep the bottom sheet open when switching articles
  }

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, error, refetch } = useInfiniteQuery({
    queryKey: ["topics-articles", language],
    queryFn: ({ pageParam }) => fetchTopicsArticles({ pageParam, language }),
    getNextPageParam: (lastPage) => lastPage.nextPage,
    initialPageParam: 0,
    // Always refetch on mount to ensure fresh data
    refetchOnMount: "always",
    // With real-time updates, we can use normal caching
    staleTime: 5 * 60 * 1000, // 5 minutes - real-time updates keep data fresh
    // Reduce background refetch since real-time handles updates
    refetchOnWindowFocus: false,
    // Retry on failure to handle temporary network issues
    retry: 2,
  })

  // Set up real-time subscription for AI enhanced articles
  const { connectionStatus, isConnected } = useRealtimeArticles({
    queryKey: ["topics-articles", language],
    isAiEnhanced: true,
    language: language,
    enabled: isActive
  })

  // Handle refresh functionality - now mainly for manual refresh when real-time is disconnected
  const handleRefresh = useCallback(async () => {
    console.log(`🔄 [TOPICS-FEED] Manual refresh START - Language: ${language}`)
    console.log(`📊 Real-time status: ${connectionStatus}`)
    console.log(`📊 Current articles count: ${data?.pages.flatMap(p => p.articles).length || 0}`)
    
    try {
      // Reset the entire query to get fresh data from page 0
      await queryClient.resetQueries({ 
        queryKey: ["topics-articles", language] 
      })
      
      // Also refetch to ensure we get the latest data
      await refetch()
      
      console.log(`✅ [TOPICS-FEED] Manual refresh COMPLETED - Language: ${language}`)
      console.log(`📊 New articles count: ${data?.pages.flatMap(p => p.articles).length || 0}`)
    } catch (error) {
      console.error("❌ [TOPICS-FEED] Manual refresh FAILED:", error)
    }
  }, [queryClient, language, refetch, data, connectionStatus])

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

  // Handle scroll events for header visibility
  useEffect(() => {
    if (!isActive) return

    let rafId: number | null = null
    let attachedElement: HTMLElement | null = null

    const handleScroll = () => {
      const element = scrollRef.current
      if (!element) return

      // Cancel any pending RAF
      if (rafId !== null) {
        cancelAnimationFrame(rafId)
      }

      rafId = requestAnimationFrame(() => {
        rafId = null
        // Double-check element still exists
        if (scrollRef.current) {
          setScrollPosition(scrollRef.current.scrollTop)
        }
      })
    }

    const attachScrollListener = () => {
      const element = scrollRef.current
      if (!element || element === attachedElement) return

      // Remove from old element if exists
      if (attachedElement) {
        attachedElement.removeEventListener('scroll', handleScroll)
      }

      // Attach to new element
      element.addEventListener('scroll', handleScroll, { passive: true })
      attachedElement = element

      // Initial position update
      setScrollPosition(element.scrollTop)
    }

    // Try to attach immediately
    attachScrollListener()

    // Set up polling as fallback for dynamic content
    const checkInterval = setInterval(() => {
      if (scrollRef.current && scrollRef.current !== attachedElement) {
        attachScrollListener()
      }
    }, 100)

    return () => {
      clearInterval(checkInterval)
      if (attachedElement) {
        attachedElement.removeEventListener('scroll', handleScroll)
      }
      if (rafId !== null) {
        cancelAnimationFrame(rafId)
      }
    }
  }, [isActive, setScrollPosition, isBottomSheetOpen])

  useEffect(() => {
    if (inView && hasNextPage) {
      fetchNextPage()
    }
  }, [inView, hasNextPage, fetchNextPage])

  if (isLoading) {
    return (
      <div className="relative h-full">
        <div className="h-full">
          <div className="h-[113px] w-full" aria-hidden="true" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-1 md:gap-[18px] lg:gap-[22px] isolate px-[1px]">
            <LoadingSkeleton variant="card" count={12} />
          </div>
        </div>
      </div>
    )
  }
  
  if (error) return (
    <div className="relative h-full">
      <div className="h-full">
        <div className="h-[110px] w-full" aria-hidden="true" />
        <div className="p-4 text-center text-destructive" suppressHydrationWarning>
          {t("error.failedToLoad")} AI-enhanced articles
        </div>
      </div>
    </div>
  )

  const articles = data?.pages.flatMap((page) => page.articles) ?? []

  if (articles.length === 0) {
    return (
      <div className="relative h-full">
        <PullRefreshIndicator 
          pullDistance={pullDistance} 
          isRefreshing={isRefreshing} 
        />
        
        {/* Pull-to-refresh transform wrapper */}
        <div 
          className="h-full"
          style={{ 
            transform: `translateY(${Math.min(pullDistance, 150)}px)`,
            transition: pullDistance > 0 ? 'none' : 'transform 0.3s ease-out'
          }}
        >
          {/* Actual scroll container */}
          <div 
            ref={scrollRef}
            className="isolate overflow-auto h-full"
            style={{ 
              overscrollBehaviorY: 'contain', 
              WebkitOverflowScrolling: 'touch',
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
      </div>
    )
  }

  return (
    <div className="relative h-full">
      <PullRefreshIndicator 
        pullDistance={pullDistance} 
        isRefreshing={isRefreshing} 
      />
      
      {/* Pull-to-refresh transform wrapper */}
      <div 
        className="h-full"
        style={{ 
          transform: `translateY(${Math.min(pullDistance, 150)}px)`,
          transition: pullDistance > 0 ? 'none' : 'transform 0.3s ease-out'
        }}
      >
        {/* Actual scroll container */}
        <div 
          ref={scrollRef}
          className="isolate overflow-auto h-full"
          style={{ 
            overscrollBehaviorY: 'contain', 
            WebkitOverflowScrolling: 'touch',
            ...(isBottomSheetOpen && {
              overflow: 'hidden',
              touchAction: 'none',
              pointerEvents: 'none'
            })
          }}
        >
        {/* Invisible spacer for header + category selector height: 57px header + ~50px category selector */}
        <div className="h-[113px] w-full" aria-hidden="true" />
        
        {/* Responsive grid layout: mobile 1col, tablet 2col, desktop 3col, large 4col */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-1 md:gap-[18px] lg:gap-[22px] isolate px-[1px]">
          {articles.map((article) => (
            <ArticleCard 
              key={article.id} 
              article={article} 
              onReadMore={handleReadMore}
              showTimestamp={false}
            />
          ))}
        </div>

        <div ref={ref}>
          {isFetchingNextPage && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-1 md:gap-[18px] lg:gap-[22px] isolate px-[1px] pb-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="aspect-[3/2] bg-neutral-200 dark:bg-neutral-700 rounded-lg mb-3"></div>
                  <div className="space-y-2 px-1">
                    <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-full"></div>
                    <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-4/5"></div>
                    <div className="h-3 bg-neutral-200 dark:bg-neutral-700 rounded w-1/3 mt-3"></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        </div>
      </div>

      <ArticleBottomSheet
        articleId={selectedArticleId}
        open={isBottomSheetOpen}
        onOpenChange={handleBottomSheetChange}
        onArticleChange={handleArticleChange}
      />
    </div>
  )
}