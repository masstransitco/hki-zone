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
import { Button } from "@/components/ui/button"
import { ChevronDown, ChevronUp } from "lucide-react"
import OutletFavicon from "./outlet-favicon"
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

// Predefined list of all available news sources - always shows full list regardless of loaded articles
const ALL_AVAILABLE_SOURCES = [
  "Bloomberg",
  "SCMP", 
  "HKFP",
  "RTHK",
  "HK01",
  "TVB",
  "AM730",
  "HKEJ",
  "On.cc",
  "SingTao",
  "Ming Pao",
  "Oriental Daily",
  "The Standard",
  "Now News",
  "InMedia",
  "Coconuts Hong Kong",
  "Hong Kong Government News",
  "Bastille Post",
  "Metro Radio",
  "Commercial Radio"
].sort()

// Map between display names and actual source names for filtering
const SOURCE_MAPPING = {
  // Display Name -> Possible actual source names (case-insensitive matching)
  "Bloomberg": ["bloomberg", "Bloomberg"],
  "SCMP": ["scmp", "SCMP", "South China Morning Post"],
  "HKFP": ["hkfp", "HKFP", "Hong Kong Free Press"],
  "RTHK": ["rthk", "RTHK", "Radio Television Hong Kong"],
  "HK01": ["hk01", "HK01", "Hong Kong 01", "HK 01"],
  "TVB": ["tvb", "TVB", "TVB News", "Television Broadcasts Limited"],
  "AM730": ["am730", "AM730"],
  "HKEJ": ["hkej", "HKEJ", "Hong Kong Economic Journal", "Economic Journal"],
  "On.cc": ["on.cc", "On.cc", "ON.CC", "ONCC"],
  "SingTao": ["singtao", "SingTao", "Sing Tao Daily", "Sing Tao"],
  "Ming Pao": ["mingpao", "Ming Pao", "Ming Pao Daily"],
  "Oriental Daily": ["oriental", "Oriental Daily", "Oriental Daily News"],
  "The Standard": ["standard", "The Standard", "The Standard HK"],
  "Now News": ["nownews", "Now News", "Now TV", "Now"],
  "InMedia": ["inmedia", "InMedia", "InMedia HK"],
  "Coconuts Hong Kong": ["coconuts", "Coconuts", "Coconuts Hong Kong"],
  "Hong Kong Government News": ["newsgov", "Gov News", "Government News", "Hong Kong Government News"],
  "Bastille Post": ["bastille", "Bastille", "Bastille Post"],
  "Metro Radio": ["metro", "metroradio", "Metro Radio", "Metro Broadcast"],
  "Commercial Radio": ["crhk", "881903", "Commercial Radio", "Commercial Radio Hong Kong"]
}

// Get translated source name
const getTranslatedSourceName = (source: string, t: (key: string) => string): string => {
  return t(`outlets.${source}`) || source
}

// Check if an article matches a selected display source
const articleMatchesSource = (article: Article, selectedDisplaySource: string): boolean => {
  const possibleSources = SOURCE_MAPPING[selectedDisplaySource as keyof typeof SOURCE_MAPPING] || []
  const articleSource = article.source.replace(' (AI Enhanced)', '').replace(/ \+ AI$/, '').trim()
  
  return possibleSources.some(possibleSource => 
    articleSource.toLowerCase() === possibleSource.toLowerCase()
  )
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
  const [selectedSource, setSelectedSource] = useState<string>('all')
  const [showSourceFilter, setShowSourceFilter] = useState(false)
  const filterDropdownRef = useRef<HTMLDivElement>(null)
  
  // State for tracking database-available sources
  const [databaseAvailableSources, setDatabaseAvailableSources] = useState<Set<string>>(new Set())
  const [useHardcodedSources, setUseHardcodedSources] = useState(false) // Default to database approach
  const [sourcesLoading, setSourcesLoading] = useState(false)

  // Fetch available sources from database
  const checkDatabaseAvailableSources = useCallback(async () => {
    try {
      setSourcesLoading(true)
      const response = await fetch('/api/articles/available-sources')
      if (response.ok) {
        const data = await response.json()
        console.log('📊 [NEWS-FILTER] Available sources response:', data)
        
        const availableSet = new Set(data.sources || [])
        console.log('📊 [NEWS-FILTER] Setting available sources:', Array.from(availableSet))
        setDatabaseAvailableSources(availableSet)
        
        // If database failed, fall back to hardcoded sources
        if (data.usingFallbackData) {
          console.warn('Database not available, using fallback sources')
          setUseHardcodedSources(true)
        }
      } else {
        console.error('Failed to fetch available sources, using hardcoded fallback')
        setUseHardcodedSources(true)
      }
    } catch (error) {
      console.error('Error fetching available sources:', error)
      setUseHardcodedSources(true)
    } finally {
      setSourcesLoading(false)
    }
  }, [])

  // Check database sources on mount
  useEffect(() => {
    checkDatabaseAvailableSources()
  }, [checkDatabaseAvailableSources])

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

  const handleSourceFilter = (source: string) => {
    setSelectedSource(source)
    setShowSourceFilter(false)
  }

  // Close filter dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(event.target as Node)) {
        setShowSourceFilter(false)
      }
    }

    if (showSourceFilter) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showSourceFilter])

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

  // Force re-initialization of scroll listeners after refresh completes
  const prevIsRefreshing = useRef(isRefreshing)
  useEffect(() => {
    if (prevIsRefreshing.current && !isRefreshing) {
      // Refresh just completed - reset scroll position
      const element = scrollRef.current
      if (element) {
        setTimeout(() => {
          setScrollPosition(element.scrollTop)
        }, 100)
      }
    }
    prevIsRefreshing.current = isRefreshing
  }, [isRefreshing, setScrollPosition])

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
      
      // Update initial position
      setScrollPosition(element.scrollTop)
    }

    // Check and attach immediately
    attachScrollListener()

    // Set up polling to catch the element when it becomes available
    const checkInterval = setInterval(() => {
      if (scrollRef.current && scrollRef.current !== attachedElement) {
        attachScrollListener()
      }
    }, 100)

    // Cleanup function
    return () => {
      clearInterval(checkInterval)
      if (attachedElement) {
        attachedElement.removeEventListener('scroll', handleScroll)
      }
      if (rafId !== null) {
        cancelAnimationFrame(rafId)
      }
    }
  }, [isActive, setScrollPosition, isRefreshing, isBottomSheetOpen])

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
    return <LoadingSkeleton variant="masonry-full" count={12} />
  }
  
  if (error) return (
    <div className="relative h-full">
      <div className="h-full">
        <div className="h-[113px] w-full" aria-hidden="true" />
        <div className="p-8 text-center text-red-600">
          {t("error.failedToLoad")} articles
        </div>
      </div>
    </div>
  )

  const articles = data?.pages.flatMap((page) => page.articles) ?? []

  // Hardcoded list of sources we know have content available
  // This should be updated based on actual content availability
  const KNOWN_AVAILABLE_SOURCES = new Set([
    "Bloomberg",
    "SCMP", 
    "HKFP",
    "RTHK",
    "HK01",
    "TVB",
    "The Standard",
    "Now News",
    "Hong Kong Government News"
    // Add more as content becomes available
  ])

  // Use database sources if available, otherwise fallback to hardcoded
  const sourcesWithArticles = useHardcodedSources 
    ? KNOWN_AVAILABLE_SOURCES 
    : databaseAvailableSources
    
  // For enabling/disabling, check if the display source has a match in database sources
  const isSourceAvailable = (displaySource: string): boolean => {
    if (useHardcodedSources) {
      return KNOWN_AVAILABLE_SOURCES.has(displaySource)
    }
    
    // Check if any database source matches this display source
    const possibleSources = SOURCE_MAPPING[displaySource as keyof typeof SOURCE_MAPPING] || []
    return Array.from(databaseAvailableSources).some(dbSource => 
      possibleSources.some(possibleSource => 
        dbSource.toLowerCase() === possibleSource.toLowerCase()
      )
    )
  }

  // Filter articles based on selected source using the new matching system
  const filteredArticles = selectedSource === 'all' 
    ? articles 
    : articles.filter(article => articleMatchesSource(article, selectedSource))

  if (articles.length === 0) {
    return (
      <div className="p-8 text-center text-2">
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
        
        <div className="pt-6 space-y-4 px-4 md:px-6 lg:px-8">
          {/* Filter and Real-time status row */}
          <div className="flex items-center justify-between text-xs">
            {/* Source filter on the left */}
            <div className="relative" ref={filterDropdownRef}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSourceFilter(!showSourceFilter)}
                className="h-7 px-3 text-xs border-neutral-300 dark:border-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                <span className="mr-1.5">📰</span>
                {selectedSource === 'all' ? t('outlets.allSources') : getTranslatedSourceName(selectedSource, t)}
                <ChevronDown className="h-3 w-3 ml-1.5" />
              </Button>
              
              {/* Dropdown menu */}
              {showSourceFilter && (
                <div className="absolute top-8 left-0 z-50 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-md shadow-lg min-w-[140px] max-h-60 overflow-y-auto">
                  <div className="py-1">
                    {sourcesLoading ? (
                      <div className="px-3 py-2 text-xs text-muted-foreground text-center">
                        Loading sources...
                      </div>
                    ) : (
                      <>
                    
                    <button
                      onClick={() => handleSourceFilter('all')}
                      className={`w-full text-left px-3 py-1.5 text-xs hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors ${
                        selectedSource === 'all'
                          ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100'
                          : 'text-neutral-700 dark:text-neutral-300'
                      }`}
                    >
                      <span className="mr-2">📰</span>
                      {t('outlets.allSources')}
                      {selectedSource === 'all' && (
                        <span className="ml-2 text-neutral-500">✓</span>
                      )}
                    </button>
                    {ALL_AVAILABLE_SOURCES.map((source) => {
                      const hasArticles = isSourceAvailable(source)
                      return (
                        <button
                          key={source}
                          onClick={hasArticles ? () => handleSourceFilter(source) : undefined}
                          disabled={!hasArticles}
                          className={`w-full text-left px-3 py-1.5 text-xs transition-colors flex items-center ${
                            !hasArticles 
                              ? 'cursor-not-allowed opacity-50 text-neutral-400 dark:text-neutral-600'
                              : selectedSource === source
                              ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                              : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                          }`}
                        >
                          <div className="mr-2 flex-shrink-0">
                            <OutletFavicon 
                              source={source} 
                              size="sm" 
                              showFallback={true}
                            />
                          </div>
                          <span className="flex-1 truncate">{getTranslatedSourceName(source, t)}</span>
                          {selectedSource === source && hasArticles && (
                            <span className="ml-2 text-neutral-500 flex-shrink-0">✓</span>
                          )}
                        </button>
                      )
                    })}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Real-time connection status on the right */}
            {isActive && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <div className={`h-2 w-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-orange-500'} animate-pulse`} />
                <span>{isConnected ? t('realtime.active') : t('realtime.connecting')}</span>
              </div>
            )}
          </div>
        </div>
        
        {/* Masonry news feed container */}
        <div ref={feedRef} className="news-feed isolate">
        {filteredArticles.length === 0 ? (
          <div className="p-8 text-center text-2">
            {selectedSource === 'all' 
              ? t('search.noResults') 
              : `${t('search.noResults')} ${getTranslatedSourceName(selectedSource, t)}`}
          </div>
        ) : (
          filteredArticles.map((article) => {
            const aspectRatio = getRandomAspectRatio(article.id)
            return (
              <div key={article.id} className="news-card">
                <ArticleCard 
                  article={article} 
                  onReadMore={handleReadMore}
                  className="w-full"
                  aspectRatio={aspectRatio}
                  showTimestamp={true}
                />
              </div>
            )
          })
        )}
      </div>

      {/* Infinite scroll sentinel - separate from loading content */}
      <div ref={ref} className="h-10 mt-8" />
      
      {/* Loading skeleton for infinite scroll */}
      {isFetchingNextPage && (
        <div className="news-feed isolate">
          <LoadingSkeleton variant="masonry" count={6} />
        </div>
      )}
      </div>
      </div>

      {/* Article detail bottom sheet */}
      <ArticleBottomSheet
        articleId={selectedArticleId}
        open={isBottomSheetOpen}
        onOpenChange={handleBottomSheetChange}
        onArticleChange={handleArticleChange}
      />
    </div>
  )
}