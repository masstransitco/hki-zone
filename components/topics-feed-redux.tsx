"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useInView } from "react-intersection-observer"
import { useSelector } from "react-redux"
import ArticleCard from "./article-card"
import ArticleBottomSheet from "./article-bottom-sheet"
import TopicsFeedSkeleton from "./topics-feed-skeleton"
import TopicsFeedLoadingMore from "./topics-feed-loading-more"
import PullRefreshIndicator from "./pull-refresh-indicator"
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh"
import { useHeaderVisibility } from "@/contexts/header-visibility"
import { useRealtimeArticles } from "@/hooks/use-realtime-articles"
import { useTopicsRedux } from "@/hooks/use-topics-redux"
import { selectLanguage } from "@/store/languageSlice"
import type { RootState } from "@/store"

interface TopicsFeedProps {
  isActive?: boolean
}

export default function TopicsFeedRedux({ isActive = true }: TopicsFeedProps) {
  const { ref, inView } = useInView()
  const language = useSelector(selectLanguage)
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null)
  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false)
  const { setScrollPosition } = useHeaderVisibility()
  const ticking = useRef(false)

  // Use Redux-based topics hook
  const {
    articles,
    isLoading,
    isRefreshing,
    isLoadingMore,
    error,
    hasMore,
    loadMore,
    refresh,
    handleRealtimeUpdate,
    handleRealtimeDelete
  } = useTopicsRedux({ language, enabled: isActive })

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
  }

  // Set up real-time subscription for AI enhanced articles
  const { connectionStatus, isConnected } = useRealtimeArticles({
    queryKey: ["topics-articles", language],
    isAiEnhanced: true,
    language: language,
    enabled: isActive,
    onUpdate: handleRealtimeUpdate,
    onDelete: handleRealtimeDelete
  })

  // Use the clean pull-to-refresh hook
  const {
    scrollRef,
    pullDistance,
    isRefreshing: isPullRefreshing,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd
  } = usePullToRefresh({
    onRefresh: refresh,
    enabled: !isBottomSheetOpen
  })

  // Force re-initialization of scroll listeners after refresh completes
  const prevIsRefreshing = useRef(isPullRefreshing)
  useEffect(() => {
    if (prevIsRefreshing.current && !isPullRefreshing) {
      // Refresh just completed - reset scroll position
      const element = scrollRef.current
      if (element) {
        setTimeout(() => {
          setScrollPosition(element.scrollTop)
        }, 100)
      }
    }
    prevIsRefreshing.current = isPullRefreshing
  }, [isPullRefreshing, setScrollPosition])

  // Handle scroll events for header visibility
  useEffect(() => {
    if (!isActive) return

    let timeoutId: NodeJS.Timeout | null = null
    let attachedElement: HTMLElement | null = null

    const handleScroll = () => {
      if (!ticking.current && scrollRef.current) {
        window.requestAnimationFrame(() => {
          if (scrollRef.current) {
            setScrollPosition(scrollRef.current.scrollTop)
          }
          ticking.current = false
        })
        ticking.current = true
      }
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
      
      // Update initial position
      setScrollPosition(element.scrollTop)
    }

    // Check and attach immediately
    attachScrollListener()

    // Set up polling to catch the element when it becomes available
    const checkInterval = setInterval(() => {
      if (scrollRef.current && scrollRef.current !== attachedElement) {
        attachScrollListener()
        clearInterval(checkInterval)
      }
    }, 100)

    // Set timeout to stop checking after 5 seconds
    timeoutId = setTimeout(() => {
      clearInterval(checkInterval)
    }, 5000)

    // Cleanup function
    return () => {
      if (timeoutId) clearTimeout(timeoutId)
      clearInterval(checkInterval)
      if (attachedElement) {
        attachedElement.removeEventListener('scroll', handleScroll)
      }
      ticking.current = false
    }
  }, [isActive, setScrollPosition, isPullRefreshing])

  // Infinite scroll
  useEffect(() => {
    if (inView && hasMore && !isLoading && !isRefreshing) {
      loadMore()
    }
  }, [inView, hasMore, isLoading, isRefreshing, loadMore])

  // Show skeleton during initial load or refresh
  if ((isLoading && articles.length === 0) || (isRefreshing && articles.length === 0)) {
    return <TopicsFeedSkeleton count={12} />
  }
  
  if (error) return (
    <div className="relative h-full">
      <div className="h-full">
        <div className="h-[110px] w-full" aria-hidden="true" />
        <div className="p-4 text-center text-destructive">
          Error: {error}
        </div>
      </div>
    </div>
  )

  // During refresh, show loading state instead of empty message
  if (articles.length === 0 && !isLoading && !isRefreshing) {
    return (
      <div className="relative h-full">
        <PullRefreshIndicator 
          pullDistance={pullDistance} 
          isRefreshing={isRefreshing || isPullRefreshing} 
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
              No AI-enhanced articles yet
            </h3>
            <p className="text-stone-600 dark:text-neutral-400 mb-4">
              AI-enhanced articles will appear here as they are processed
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
        isRefreshing={isRefreshing || isPullRefreshing} 
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
        
        {/* Real-time connection status */}
        {isActive && (
          <div className="flex items-center justify-end gap-2 text-xs text-muted-foreground px-4 pb-2">
            <div className={`h-2 w-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-orange-500'} animate-pulse`} />
            <span>{isConnected ? 'Real-time active' : 'Connecting...'}</span>
          </div>
        )}
        
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

        {/* Infinite scroll trigger */}
        {hasMore && (
          <div ref={ref} className="pt-4">
            {isLoadingMore && <TopicsFeedLoadingMore />}
          </div>
        )}
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