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
  const [isMasonryReady, setIsMasonryReady] = useState(false) // Track masonry initialization
  const feedRef = useRef<HTMLDivElement>(null)
  const masonryRef = useRef<any>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const touchStartY = useRef(0)
  const cleanupFnRef = useRef<(() => void) | null>(null)

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

  // Streamlined masonry initialization with proper cleanup
  useEffect(() => {
    if (!feedRef.current) return
    
    setIsMasonryReady(false) // Reset ready state
    
    // Clean up any existing masonry instance first
    if (masonryRef.current) {
      masonryRef.current.destroy()
      masonryRef.current = null
    }
    
    // Run any stored cleanup function
    if (cleanupFnRef.current) {
      cleanupFnRef.current()
      cleanupFnRef.current = null
    }
    
    // Reset any JS masonry classes and styles
    if (feedRef.current) {
      feedRef.current.classList.remove("js-masonry")
      feedRef.current.style.padding = ""
      feedRef.current.style.maxWidth = ""
      feedRef.current.style.overflow = ""
      feedRef.current.style.margin = ""
    }
    
    // Small delay to ensure DOM is stable after content switch
    const initTimeout = setTimeout(() => {
      if (!feedRef.current) return
      
      // Check if CSS columns are working properly
      const needsJSMasonry = () => {
        const testElement = feedRef.current
        if (!testElement) return true // Fallback to JS if no element
        
        // Force layout recalculation
        void testElement.offsetHeight
        
        // Check computed styles
        const computedStyle = window.getComputedStyle(testElement)
        const columnCount = computedStyle.columnCount
        
        console.log('CSS column detection:', { 
          columnCount, 
          columnGap: computedStyle.columnGap,
          display: computedStyle.display,
          width: testElement.offsetWidth
        })
        
        // iOS Chrome needs JS masonry
        const isIOSChrome = /CriOS/.test(navigator.userAgent)
        if (isIOSChrome) {
          console.log('iOS Chrome detected, using JS masonry')
          return true
        }
        
        // Check if CSS columns are properly applied
        if (!columnCount || columnCount === 'auto' || parseInt(columnCount) < 2) {
          console.log('CSS columns not working (columnCount:', columnCount, '), using JS masonry')
          return true
        }
        
        console.log('CSS columns working properly, using CSS layout')
        return false
      }
      
      if (!needsJSMasonry()) {
        setIsMasonryReady(true) // CSS masonry is ready
        return // CSS is handling it fine
      }

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

          // Simplified spacing configuration with viewport overflow fix
          const getConfig = () => {
            const width = window.innerWidth
            
            // Enforce minimum 2 columns always
            if (width >= 1280) return { columns: 5, gap: 24, padding: 8 }
            if (width >= 1024) return { columns: 4, gap: 24, padding: 8 }
            if (width >= 768) return { columns: 3, gap: 20, padding: 8 }
            if (width >= 640) return { columns: 2, gap: 16, padding: 8 }
            return { columns: 2, gap: 12, padding: 8 } // Force 2-column minimum even on mobile
          }

          // Calculate column width with proper container bounds checking
          const getColumnWidth = () => {
            const container = feedRef.current
            if (!container) return 300 // fallback
            
            const config = getConfig()
            // Use offsetWidth for actual rendered width, accounting for parent constraints
            const containerWidth = Math.min(container.offsetWidth, window.innerWidth) - (config.padding * 2)
            const columnWidth = Math.floor((containerWidth - (config.gap * (config.columns - 1))) / config.columns)
            
            // Ensure minimum column width to prevent layout breaks
            return Math.max(columnWidth, 150)
          }

          // Initialize Masonry with overflow-safe config
          const config = getConfig()
          const columnWidth = getColumnWidth()
          
          console.log('Masonry initialization config:', { 
            columns: config.columns, 
            gap: config.gap, 
            padding: config.padding,
            columnWidth,
            containerWidth: feedRef.current.offsetWidth
          })
          
          // Apply padding with viewport bounds check
          const safeMaxWidth = window.innerWidth - 16 // Leave some margin
          feedRef.current.style.padding = `0 ${config.padding}px`
          feedRef.current.style.maxWidth = `${safeMaxWidth}px`
          feedRef.current.style.overflow = 'hidden'
          feedRef.current.style.margin = '0 auto' // Center the masonry container
          
          // Ensure we have items to layout
          const items = feedRef.current.querySelectorAll('.news-card')
          console.log(`Found ${items.length} news cards to layout`)
          
          masonryRef.current = new Masonry(feedRef.current, {
            itemSelector: ".news-card",
            columnWidth: columnWidth,
            gutter: config.gap,
            percentPosition: false,
            horizontalOrder: true,
            transitionDuration: 0, // Disable animations for better performance
            resize: false,
            fitWidth: false // CRITICAL: Set to false to prevent single-column collapse
          })
          
          console.log('Masonry instance created:', masonryRef.current)

          // Re-layout when images load
          imagesLoaded(feedRef.current, () => {
            if (masonryRef.current) {
              masonryRef.current.layout()
            }
          })

          // Enhanced resize handler with bounds checking
          const handleResize = () => {
            if (!masonryRef.current || !feedRef.current) return
            
            const config = getConfig()
            const safeMaxWidth = window.innerWidth - 16
            
            feedRef.current.style.padding = `0 ${config.padding}px`
            feedRef.current.style.maxWidth = `${safeMaxWidth}px`
            feedRef.current.style.margin = '0 auto' // Ensure centering on resize too
            
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
          cleanupFnRef.current = () => {
            window.removeEventListener('resize', debouncedResize)
            clearTimeout(resizeTimeout)
          }
          
          setIsMasonryReady(true) // Mark masonry as ready
        } catch (error) {
          console.error("Failed to load masonry:", error)
        }
      })()
    }, 300) // Increased delay to ensure CSS is applied after transitions

    return () => {
      clearTimeout(initTimeout)
      if (cleanupFnRef.current) {
        cleanupFnRef.current()
        cleanupFnRef.current = null
      }
      if (masonryRef.current) {
        masonryRef.current.destroy()
        masonryRef.current = null
      }
      // Reset container styles on cleanup
      if (feedRef.current) {
        feedRef.current.classList.remove("js-masonry")
        feedRef.current.style.padding = ""
        feedRef.current.style.maxWidth = ""
        feedRef.current.style.overflow = ""
        feedRef.current.style.margin = ""
      }
      setIsMasonryReady(false)
    }
  }, []) // Keep empty dependency to run once on mount

  // Re-layout masonry when new items are added
  useEffect(() => {
    if (masonryRef.current && data && isMasonryReady) {
      console.log('Re-laying out masonry with new data')
      // Small delay to ensure DOM is updated
      setTimeout(() => {
        if (masonryRef.current) {
          const items = feedRef.current?.querySelectorAll('.news-card')
          console.log(`Re-layout: Found ${items?.length || 0} news cards`)
          
          masonryRef.current.reloadItems()
          masonryRef.current.layout()
          
          // Force a second layout after a brief delay for stubborn cases
          setTimeout(() => {
            if (masonryRef.current) {
              masonryRef.current.layout()
            }
          }, 50)
        }
      }, 100)
    }
  }, [data, isMasonryReady])

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