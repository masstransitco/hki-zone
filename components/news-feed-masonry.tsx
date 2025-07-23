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
  const [isMasonryReady, setIsMasonryReady] = useState(false) // Track masonry initialization
  const [isVisible, setIsVisible] = useState(true)
  const feedRef = useRef<HTMLDivElement>(null)
  const masonryRef = useRef<any>(null)
  const cleanupFnRef = useRef<(() => void) | null>(null)
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
  })

  // Handle refresh functionality
  const handleRefresh = useCallback(async () => {
    console.log('🔄 [NEWS-FEED] Refresh START')
    console.log(`📊 Current articles count: ${data?.pages.flatMap(p => p.articles).length || 0}`)
    
    try {
      // Reset the entire query to get fresh data from page 0
      await queryClient.resetQueries({ 
        queryKey: ["articles"] 
      })
      
      // Also refetch to ensure we get the latest data
      await refetch()
      
      console.log('✅ [NEWS-FEED] Refresh COMPLETED')
      console.log(`📊 New articles count: ${data?.pages.flatMap(p => p.articles).length || 0}`)
    } catch (error) {
      console.error("❌ [NEWS-FEED] Refresh FAILED:", error)
    }
  }, [queryClient, refetch, data])

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
        console.log('NewsFeedMasonry became visible, triggering layout recalculation')
        setIsVisible(true)
        
        // Force masonry layout recalculation for iOS Chrome
        if (masonryRef.current && /CriOS/.test(navigator.userAgent)) {
          setTimeout(() => {
            if (masonryRef.current) {
              masonryRef.current.layout()
              // Double layout for stubborn iOS Chrome
              setTimeout(() => {
                if (masonryRef.current) {
                  masonryRef.current.layout()
                }
              }, 100)
            }
          }, 300)
        }
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

          // Compact spacing configuration matching topics feed
          const getConfig = () => {
            const width = window.innerWidth
            
            // Enforce minimum 2 columns always with compact gaps
            if (width >= 1280) return { columns: 5, gap: 22, padding: 1 } // lg gap
            if (width >= 1024) return { columns: 4, gap: 22, padding: 1 } // lg gap  
            if (width >= 768) return { columns: 3, gap: 18, padding: 1 } // md gap
            if (width >= 640) return { columns: 2, gap: 18, padding: 1 } // md gap
            return { columns: 2, gap: 4, padding: 1 } // mobile gap-1 (4px)
          }

          // Calculate column width with proper container bounds checking
          const getColumnWidth = () => {
            const container = feedRef.current
            if (!container) return 300 // fallback
            
            const config = getConfig()
            
            // iOS Chrome specific: Wait for proper dimensions
            if (/CriOS/.test(navigator.userAgent)) {
              // Force a layout reflow to get accurate dimensions
              void container.offsetHeight
              
              // Use parent container width if available
              const parentWidth = container.parentElement?.offsetWidth || window.innerWidth
              const containerWidth = Math.min(container.offsetWidth || parentWidth, parentWidth) - (config.padding * 2)
              
              // Extra check for iOS Chrome
              if (containerWidth < 100) {
                console.log('iOS Chrome: Invalid container width detected, using fallback')
                const fallbackWidth = window.innerWidth - 32 - (config.padding * 2)
                const columnWidth = Math.floor((fallbackWidth - (config.gap * (config.columns - 1))) / config.columns)
                return Math.max(columnWidth, 150)
              }
              
              const columnWidth = Math.floor((containerWidth - (config.gap * (config.columns - 1))) / config.columns)
              return Math.max(columnWidth, 150)
            }
            
            // Standard calculation for other browsers
            const containerWidth = Math.min(container.offsetWidth, window.innerWidth) - (config.padding * 2)
            const columnWidth = Math.floor((containerWidth - (config.gap * (config.columns - 1))) / config.columns)
            
            // Ensure minimum column width to prevent layout breaks
            return Math.max(columnWidth, 150)
          }

          // Initialize Masonry
          const config = getConfig()
          const columnWidth = getColumnWidth()
          
          console.log('Masonry initialization config:', { 
            columns: config.columns, 
            gap: config.gap, 
            padding: config.padding,
            columnWidth,
            containerWidth: feedRef.current.offsetWidth,
            isIOSChrome: /CriOS/.test(navigator.userAgent)
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
          
          // iOS Chrome specific: Multiple initialization attempts
          const createMasonryInstance = () => {
            if (!feedRef.current) return
            
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
            
            // iOS Chrome: Force immediate layout
            if (/CriOS/.test(navigator.userAgent)) {
              setTimeout(() => {
                if (masonryRef.current) {
                  masonryRef.current.layout()
                }
              }, 50)
            }
          }
          
          createMasonryInstance()
          
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
    }, /CriOS/.test(navigator.userAgent) ? 500 : 300) // Extra delay for iOS Chrome

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


  // Conditional returns must come after all hooks
  if (isLoading) {
    return (
      <div className="relative h-full overflow-hidden">
        <div className="h-full overflow-auto">
          <div className="h-[110px] w-full" aria-hidden="true" />
          <div className="news-feed isolate">
            <LoadingSkeleton variant="masonry" count={15} />
          </div>
        </div>
      </div>
    )
  }
  
  if (error) return (
    <div className="relative h-full overflow-hidden">
      <div className="h-full overflow-auto">
        <div className="h-[110px] w-full" aria-hidden="true" />
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
    <div className="relative h-full overflow-hidden">
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
        <div className="h-[110px] w-full" aria-hidden="true" />
        
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
      <div ref={ref} className="h-10 mt-8">
        {isFetchingNextPage && (
          <div className="flex items-center justify-center">
            <LoadingSpinner size="lg" />
          </div>
        )}
      </div>
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