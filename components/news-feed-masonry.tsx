"use client"

import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useState, useRef, useCallback } from "react"
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

async function fetchArticles({ pageParam = 0 }): Promise<{ articles: Article[]; nextPage: number | null }> {
  // Exclude AI enhanced articles from the news feed masonry
  const response = await fetch(`/api/articles?page=${pageParam}&enriched=false`)
  if (!response.ok) throw new Error("Failed to fetch articles")
  return response.json()
}

// Aspect ratio options for varied masonry layout
const ASPECT_RATIOS = [
  { class: "aspect-ratio-16-9", weight: 40 }, // 40% - landscape (original)
  { class: "aspect-ratio-1-1", weight: 35 },   // 35% - square
  { class: "aspect-ratio-4-5", weight: 25 }    // 25% - portrait
] as const

type AspectRatio = typeof ASPECT_RATIOS[number]['class']

// Generate aspect ratio based on weighted distribution
function getRandomAspectRatio(articleId: string): AspectRatio {
  // Use article ID as seed for consistent aspect ratios
  const seed = articleId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  const random = (seed % 100) + 1
  
  let cumulativeWeight = 0
  for (const ratio of ASPECT_RATIOS) {
    cumulativeWeight += ratio.weight
    if (random <= cumulativeWeight) {
      return ratio.class
    }
  }
  
  return ASPECT_RATIOS[0].class // fallback
}

interface NewsFeedMasonryProps {
  isActive?: boolean
}

export default function NewsFeedMasonry({ isActive = true }: NewsFeedMasonryProps) {
  const { ref, inView } = useInView({ rootMargin: "600px" })
  const { t } = useLanguage()
  const queryClient = useQueryClient()
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null)
  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false)
  const [isVisible, setIsVisible] = useState(true)
  const feedRef = useRef<HTMLDivElement>(null)
  const visibilityCheckInterval = useRef<NodeJS.Timeout | null>(null)
  const { setScrollPosition } = useHeaderVisibility()
  const tickingRef = useRef(false)

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
    queryKey: ["articles"],
    queryFn: fetchArticles,
    getNextPageParam: (lastPage) => lastPage.nextPage,
    initialPageParam: 0,
    // With real-time updates, we can use normal caching
    staleTime: 5 * 60 * 1000, // 5 minutes - real-time updates keep data fresh
    // Reduce background refetch since real-time handles updates
    refetchOnWindowFocus: false,
  })

  // Set up real-time subscription for regular (non-AI enhanced) articles
  const { connectionStatus, isConnected } = useRealtimeArticles({
    queryKey: ["articles"],
    isAiEnhanced: false,
    enabled: isActive
  })

  // Handle refresh functionality - now mainly for manual refresh when real-time is disconnected
  const handleRefresh = useCallback(async () => {
    console.log('🔄 [NEWS-FEED] Manual refresh START')
    console.log(`📊 Real-time status: ${connectionStatus}`)
    console.log(`📊 Current articles count: ${data?.pages.flatMap(p => p.articles).length || 0}`)
    
    try {
      // Reset the entire query to get fresh data from page 0
      await queryClient.resetQueries({ 
        queryKey: ["articles"] 
      })
      
      // Also refetch to ensure we get the latest data
      await refetch()
      
      console.log('✅ [NEWS-FEED] Manual refresh COMPLETED')
      console.log(`📊 New articles count: ${data?.pages.flatMap(p => p.articles).length || 0}`)
    } catch (error) {
      console.error("❌ [NEWS-FEED] Manual refresh FAILED:", error)
    }
  }, [queryClient, refetch, data, connectionStatus])

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

    const handleScroll = () => {
      const element = scrollRef.current
      if (!element) return

      if (!tickingRef.current) {
        window.requestAnimationFrame(() => {
          setScrollPosition(element.scrollTop)
          tickingRef.current = false
        })
        tickingRef.current = true
      }
    }

    const checkInterval = setInterval(() => {
      const element = scrollRef.current
      if (element) {
        clearInterval(checkInterval)
        element.addEventListener('scroll', handleScroll, { passive: true })
        // Initial check
        setScrollPosition(element.scrollTop)
      }
    }, 100)

    return () => {
      clearInterval(checkInterval)
      const element = scrollRef.current
      if (element) {
        element.removeEventListener('scroll', handleScroll)
      }
      tickingRef.current = false
    }
  }, [isActive, setScrollPosition])

  // Check if component is visible in the DOM
  useEffect(() => {
    const checkVisibility = () => {
      if (!feedRef.current) return
      
      const rect = feedRef.current.getBoundingClientRect()
      const isNowVisible = rect.width > 0 && rect.height > 0 && feedRef.current.offsetParent !== null
      
      if (isNowVisible && !isVisible) {
        console.log('NewsFeedMasonry became visible')
        setIsVisible(true)
      } else if (!isNowVisible && isVisible) {
        setIsVisible(false)
      }
    }
    
    // Check visibility periodically
    visibilityCheckInterval.current = setInterval(checkVisibility, 500)
    
    return () => {
      if (visibilityCheckInterval.current) {
        clearInterval(visibilityCheckInterval.current)
      }
    }
  }, [isVisible])

  // Simple effect to ensure container is properly set up when active
  useEffect(() => {
    if (!feedRef.current || !isActive) return
    
    console.log('NewsFeedMasonry: Simple CSS Grid layout active')
    
    // Ensure container has proper styles for CSS Grid
    if (feedRef.current) {
      // Force reflow to ensure accurate dimensions
      void feedRef.current.offsetHeight
      
      console.log('NewsFeedMasonry: Container dimensions:', {
        width: feedRef.current.offsetWidth,
        height: feedRef.current.offsetHeight
      })
    }
  }, [isActive])

  // CSS Grid automatically handles layout when new items are added - no JS needed!

  // Infinite scroll trigger
  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage()
    }
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage])


  // Conditional returns must come after all hooks
  if (isLoading) {
    return (
      <div className="relative h-full">
        <div className="h-full">
          <div className="h-[113px] w-full" aria-hidden="true" />
          <div className="news-feed isolate">
            <LoadingSkeleton variant="masonry" count={15} />
          </div>
        </div>
      </div>
    )
  }
  
  if (error) return (
    <div className="relative h-full">
      <div className="h-full">
        <div className="h-[113px] w-full" aria-hidden="true" />
        <div className="p-8 text-center text-red-600 dark:text-red-400">
          {t("error.failedToLoad")} articles
        </div>
      </div>
    </div>
  )

  const articles = data?.pages.flatMap((page) => page.articles) ?? []

  if (articles.length === 0) {
    return (
      <div className="p-8 text-center text-neutral-600 dark:text-neutral-400">
        No articles found
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
          className="w-full isolate overflow-auto h-full"
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
        
        {/* Masonry news feed container */}
        <div ref={feedRef} className="news-feed isolate">
        {articles.map((article) => {
          const aspectRatio = getRandomAspectRatio(article.id)
          return (
            <div key={article.id} className="news-card">
              <ArticleCard 
                article={article} 
                onReadMore={handleReadMore}
                className="w-full"
                aspectRatio={aspectRatio}
              />
            </div>
          )
        })}
      </div>

      {/* Infinite scroll sentinel - separate from loading content */}
      <div ref={ref} className="h-10 mt-8" />
      
      {/* Loading skeleton for infinite scroll */}
      {isFetchingNextPage && (
        <div className="news-feed isolate px-1">
          {Array.from({ length: 6 }).map((_, i) => {
            // Vary heights for visual variety
            const heights = ['h-48', 'h-64', 'h-52', 'h-56', 'h-60', 'h-44'];
            const height = heights[i % heights.length];
            
            return (
              <div key={i} className="news-card">
                <div className={`animate-pulse ${height} bg-neutral-200 dark:bg-neutral-700 rounded-lg`}>
                </div>
              </div>
            );
          })}
        </div>
      )}
      </div>
      </div>

      {/* Article detail bottom sheet */}
      <ArticleBottomSheet
        articleId={selectedArticleId}
        open={isBottomSheetOpen}
        onOpenChange={handleBottomSheetChange}
      />
    </div>
  )
}