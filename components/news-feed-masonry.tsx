"use client"

import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useState, useRef, useCallback } from "react"
import { useInView } from "react-intersection-observer"
import ArticleCard from "./article-card"
import ArticleBottomSheet from "./article-bottom-sheet"
import LoadingSkeleton from "./loading-skeleton"
import { useLanguage } from "./language-provider"
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

export default function NewsFeedMasonry() {
  const { ref, inView } = useInView({ rootMargin: "600px" })
  const { t } = useLanguage()
  const queryClient = useQueryClient()
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null)
  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false)
  const [isPullRefreshing, setIsPullRefreshing] = useState(false)
  const feedRef = useRef<HTMLDivElement>(null)
  const masonryRef = useRef<any>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const touchStartY = useRef(0)

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
  })

  // Handle refresh functionality
  const handleRefresh = useCallback(async () => {
    console.log('Refresh triggered for news feed')
    
    try {
      // Reset the entire query to get fresh data from page 0
      await queryClient.resetQueries({ 
        queryKey: ["articles"] 
      })
      
      // Also refetch to ensure we get the latest data
      await refetch()
      
      console.log('Refresh completed for news feed')
    } catch (error) {
      console.error("Refresh failed:", error)
    }
  }, [queryClient, refetch])

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
    if (scrollTop === 0 && pullDistance > 100 && !isPullRefreshing) {
      setIsPullRefreshing(true)
      
      try {
        await handleRefresh()
      } finally {
        setIsPullRefreshing(false)
      }
    }
  }

  // Streamlined masonry initialization
  useEffect(() => {
    if (!feedRef.current) return
    
    // Check if we need JavaScript masonry
    // Only use JS if neither CSS Grid masonry nor CSS columns work properly
    const needsJSMasonry = () => {
      // Test if CSS columns are working properly
      const testElement = feedRef.current
      if (!testElement) return false
      
      const computedStyle = window.getComputedStyle(testElement)
      const columnCount = computedStyle.columnCount
      
      // If browser doesn't support multi-column or it's not working, use JS
      return columnCount === 'auto' || parseInt(columnCount) === 1
    }
    
    if (!needsJSMasonry()) return // CSS is handling it fine

    // Dynamic import for JavaScript fallback
    (async () => {
      try {
        if (!feedRef.current) return
        
        // Add class to enable JavaScript masonry
        feedRef.current.classList.add("js-masonry")
        
        const [{ default: Masonry }, { default: imagesLoaded }] = await Promise.all([
          import("masonry-layout"),
          import("imagesloaded")
        ])

        if (!feedRef.current) return

        // Simplified spacing configuration
        const getConfig = () => {
          const width = window.innerWidth
          
          if (width >= 1280) return { columns: 5, gap: 24, padding: 0 }
          if (width >= 1024) return { columns: 4, gap: 24, padding: 0 }
          if (width >= 768) return { columns: 3, gap: 20, padding: 24 }
          if (width >= 640) return { columns: 2, gap: 16, padding: 20 }
          return { columns: 2, gap: 12, padding: 16 } // 2-column minimum
        }

        // Calculate column width
        const getColumnWidth = () => {
          const container = feedRef.current
          if (!container) return 300 // fallback
          
          const config = getConfig()
          const containerWidth = container.offsetWidth - (config.padding * 2)
          return (containerWidth - (config.gap * (config.columns - 1))) / config.columns
        }

        // Initialize Masonry with streamlined config
        const config = getConfig()
        
        // Apply padding
        feedRef.current.style.padding = `0 ${config.padding}px`
        
        masonryRef.current = new Masonry(feedRef.current, {
          itemSelector: ".news-card",
          columnWidth: getColumnWidth(),
          gutter: config.gap,
          percentPosition: false,
          horizontalOrder: true,
          transitionDuration: 0, // Disable animations for better performance
          resize: false
        })

        // Re-layout when images load
        imagesLoaded(feedRef.current, () => {
          if (masonryRef.current) {
            masonryRef.current.layout()
          }
        })

        // Simplified resize handler
        const handleResize = () => {
          if (!masonryRef.current || !feedRef.current) return
          
          const config = getConfig()
          
          feedRef.current.style.padding = `0 ${config.padding}px`
          
          masonryRef.current.option({ 
            columnWidth: getColumnWidth(),
            gutter: config.gap
          })
          masonryRef.current.layout()
        }

        // Debounce resize handler to improve performance
        let resizeTimeout: NodeJS.Timeout
        const debouncedResize = () => {
          clearTimeout(resizeTimeout)
          resizeTimeout = setTimeout(handleResize, 100)
        }

        window.addEventListener('resize', debouncedResize)
        
        // Store cleanup function
        return () => {
          window.removeEventListener('resize', debouncedResize)
          clearTimeout(resizeTimeout)
        }
      } catch (error) {
        console.error("Failed to load masonry:", error)
      }
    })()

    return () => {
      if (masonryRef.current) {
        masonryRef.current.destroy()
      }
    }
  }, [])

  // Re-layout masonry when new items are added
  useEffect(() => {
    if (masonryRef.current && data) {
      // Small delay to ensure DOM is updated
      setTimeout(() => {
        masonryRef.current.reloadItems()
        masonryRef.current.layout()
      }, 100)
    }
  }, [data])

  // Infinite scroll trigger
  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage()
    }
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage])

  if (isLoading) return <LoadingSkeleton />
  if (error) return (
    <div className="p-8 text-center text-red-600 dark:text-red-400">
      {t("error.failedToLoad")} articles
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
    <div 
      ref={scrollRef}
      className="w-full py-6 isolate overflow-auto h-full"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
    >
      {isPullRefreshing && (
        <div className="flex justify-center py-2 mb-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-neutral-600 dark:border-neutral-400"></div>
        </div>
      )}
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

      {/* Infinite scroll sentinel */}
      <div ref={ref} className="h-10 mt-8 px-6">
        {isFetchingNextPage && (
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-neutral-600 dark:border-neutral-400"></div>
          </div>
        )}
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