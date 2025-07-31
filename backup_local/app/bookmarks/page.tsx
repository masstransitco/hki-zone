"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { useInView } from "react-intersection-observer"
import { useHeaderVisibility } from "@/contexts/header-visibility"
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh"
import { useBookmarksPage } from "@/hooks/use-bookmarks"
import { useUIRedux } from "@/hooks/use-ui-redux"
import { useLanguage } from "@/components/language-provider"
import AuthProtectedPage from "@/components/auth-protected-page"
import ArticleCard from "@/components/article-card"
import ArticleBottomSheet from "@/components/article-bottom-sheet"
import LoadingSkeleton from "@/components/loading-skeleton"
import PullRefreshIndicator from "@/components/pull-refresh-indicator"
import { Input } from "@/components/ui/input"
import { Search, X } from "lucide-react"
import TurnedInIcon from '@mui/icons-material/TurnedIn'

// SearchBar component extracted to prevent re-creation on every render
interface SearchBarProps {
  searchQuery: string
  onSearchChange: (query: string) => void
  onClearSearch: () => void
  language: string
  t: (key: string) => string
}

const BookmarkSearchBar = ({ searchQuery, onSearchChange, onClearSearch, language, t }: SearchBarProps) => (
  <div className="relative mb-4">
    <div className="relative">
      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        type="text"
        placeholder={t("bookmarks.search.placeholder") || "Search bookmarks..."}
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        className={`pl-10 pr-10 py-2 w-full bg-background border-border focus:border-ring focus:ring-ring ${
          language === 'zh-CN' ? 'chinese-text-sc' : 
          language === 'zh-TW' ? 'chinese-text-tc' : ''
        }`}
        style={{
          overscrollBehavior: 'none',
          touchAction: 'manipulation'
        }}
      />
      {searchQuery && (
        <button
          onClick={onClearSearch}
          className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Clear search"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  </div>
)

export default function BookmarksPage() {
  const { ref, inView } = useInView()
  const { setScrollPosition } = useHeaderVisibility()
  const { isMenuOpen, setMenuOpen } = useUIRedux()
  const { language, t } = useLanguage()
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null)
  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const ticking = useRef(false)

  // Disable browser-level scrolling for this page
  useEffect(() => {
    // Disable body scroll
    document.body.style.overflow = 'hidden'
    document.body.style.overscrollBehavior = 'none'
    document.body.style.touchAction = 'none'
    
    return () => {
      // Re-enable body scroll when leaving the page
      document.body.style.overflow = ''
      document.body.style.overscrollBehavior = ''
      document.body.style.touchAction = ''
    }
  }, [])

  // Use the new bookmarks hook
  const {
    bookmarks,
    isLoading,
    isError,
    error,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    refreshBookmarks
  } = useBookmarksPage()

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

  // Use the pull-to-refresh hook
  const {
    scrollRef,
    pullDistance,
    isRefreshing,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd
  } = usePullToRefresh({
    onRefresh: refreshBookmarks,
    enabled: !isBottomSheetOpen
  })

  // Handle scroll events for header visibility
  useEffect(() => {
    const handleScroll = () => {
      const element = scrollRef.current
      if (!element) return

      if (!ticking.current) {
        window.requestAnimationFrame(() => {
          setScrollPosition(element.scrollTop)
          ticking.current = false
        })
        ticking.current = true
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
      ticking.current = false
    }
  }, [setScrollPosition])

  // Infinite scroll trigger
  useEffect(() => {
    if (inView && hasNextPage) {
      fetchNextPage()
    }
  }, [inView, hasNextPage, fetchNextPage])

  // Filter bookmarks based on search query
  const filteredBookmarks = bookmarks.filter(bookmark => 
    bookmark.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    bookmark.source.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Stable handlers using useCallback
  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query)
  }, [])

  const handleClearSearch = useCallback(() => {
    setSearchQuery("")
  }, [])

  // Render the page content
  const renderBookmarksContent = () => {
    // Show loading skeleton while fetching bookmarks
    if (isLoading) {
      return (
        <div className="relative h-full overflow-hidden">
          <div 
            className="h-full overflow-auto"
            style={{
              overscrollBehavior: 'none',
              touchAction: 'pan-y pinch-zoom'
            }}
          >
            <div className="h-[70px] w-full" aria-hidden="true" />
            <div className="px-4 py-4">
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-3">
                  <TurnedInIcon sx={{ fontSize: 20 }} className="text-foreground" />
                  <h1 className="text-xl font-semibold text-foreground">Bookmarks</h1>
                </div>
                <BookmarkSearchBar 
                  searchQuery={searchQuery}
                  onSearchChange={handleSearchChange}
                  onClearSearch={handleClearSearch}
                  language={language}
                  t={t}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <LoadingSkeleton variant="card" count={8} />
              </div>
            </div>
          </div>
        </div>
      )
    }

    // Show error state
    if (isError) {
      return (
        <div className="relative h-full overflow-hidden">
          <div 
            className="h-full overflow-auto"
            style={{
              overscrollBehavior: 'none',
              touchAction: 'pan-y pinch-zoom'
            }}
          >
            <div className="h-[70px] w-full" aria-hidden="true" />
            <div className="px-4 py-4">
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-3">
                  <TurnedInIcon sx={{ fontSize: 20 }} className="text-foreground" />
                  <h1 className="text-xl font-semibold text-foreground">Bookmarks</h1>
                </div>
                <BookmarkSearchBar 
                  searchQuery={searchQuery}
                  onSearchChange={handleSearchChange}
                  onClearSearch={handleClearSearch}
                  language={language}
                  t={t}
                />
              </div>
              
              <div className="text-center py-16">
                <h2 className="text-lg font-medium text-foreground mb-2">
                  Failed to load bookmarks
                </h2>
                <p className="text-sm text-muted-foreground mb-4">
                  There was an error loading your bookmarked articles.
                </p>
                <button 
                  onClick={() => refreshBookmarks()}
                  className="text-primary hover:underline text-sm"
                >
                  Try again
                </button>
              </div>
            </div>
          </div>
        </div>
      )
    }

    // Common content wrapper with pull-to-refresh
    const contentWrapper = (children: React.ReactNode) => (
      <>
        <div className="relative h-full overflow-hidden">
          <PullRefreshIndicator 
            pullDistance={pullDistance} 
            isRefreshing={isRefreshing} 
          />
          
          <div 
            className="h-full"
            style={{ 
              transform: `translateY(${Math.min(pullDistance, 150)}px)`,
              transition: pullDistance > 0 ? 'none' : 'transform 0.3s ease-out'
            }}
          >
            <div 
              ref={scrollRef}
              className="isolate overflow-auto h-full"
              style={{ 
                overscrollBehavior: 'none', 
                touchAction: 'pan-y pinch-zoom',
                WebkitOverflowScrolling: 'touch',
                ...(isBottomSheetOpen && {
                  overflow: 'hidden',
                  touchAction: 'none',
                  pointerEvents: 'none'
                })
              }}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              <div className="h-[70px] w-full" aria-hidden="true" />
              {children}
            </div>
          </div>
        </div>
        
        <ArticleBottomSheet
          articleId={selectedArticleId}
          open={isBottomSheetOpen}
          onOpenChange={handleBottomSheetChange}
        />
      </>
    )

    // Show empty state
    if (bookmarks.length === 0) {
      return contentWrapper(
        <div className="px-4 py-4">
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-3">
              <TurnedInIcon sx={{ fontSize: 20 }} className="text-foreground" />
              <h1 className="text-xl font-semibold text-foreground">Bookmarks</h1>
            </div>
            <BookmarkSearchBar 
            searchQuery={searchQuery}
            onSearchChange={handleSearchChange}
            onClearSearch={handleClearSearch}
            language={language}
            t={t}
          />
          </div>
          
          <div className="flex flex-col items-center justify-center py-24">
            {/* Modern visual representation */}
            <div className="relative mb-8">
              {/* Stack of cards effect */}
              <div className="relative">
                {/* Background cards for depth */}
                <div className="absolute -top-1 -left-1 w-16 h-20 bg-gradient-to-br from-neutral-100 to-neutral-200 dark:from-neutral-800 dark:to-neutral-900 rounded-lg shadow-sm opacity-60 rotate-[-2deg]" />
                <div className="absolute -top-0.5 -right-0.5 w-16 h-20 bg-gradient-to-br from-neutral-50 to-neutral-100 dark:from-neutral-700 dark:to-neutral-800 rounded-lg shadow-sm opacity-80 rotate-[1deg]" />
                
                {/* Main card */}
                <div className="relative w-16 h-20 bg-gradient-to-br from-white to-neutral-50 dark:from-neutral-800 dark:to-neutral-900 rounded-lg border border-neutral-200/60 dark:border-neutral-700/60 shadow-lg backdrop-blur-sm">
                  {/* Subtle bookmark icon */}
                  <div className="absolute top-2 right-2">
                    <div className="w-3 h-4 bg-gradient-to-b from-neutral-300 to-neutral-400 dark:from-neutral-600 dark:to-neutral-700 rounded-sm opacity-40" />
                  </div>
                  
                  {/* Content lines */}
                  <div className="p-2.5 pt-3">
                    <div className="w-full h-1.5 bg-neutral-200 dark:bg-neutral-700 rounded-full mb-2 opacity-50" />
                    <div className="w-4/5 h-1 bg-neutral-200 dark:bg-neutral-700 rounded-full mb-1.5 opacity-40" />
                    <div className="w-3/5 h-1 bg-neutral-200 dark:bg-neutral-700 rounded-full opacity-30" />
                  </div>
                </div>
              </div>
            </div>

            {/* Clean, value-focused messaging with proper typography */}
            <div className="text-center max-w-xs">
              <h2 className={`text-headline font-semibold text-foreground mb-3 ${
                language === 'zh-CN' ? 'chinese-text-sc' : 
                language === 'zh-TW' ? 'chinese-text-tc' : ''
              }`}>
                {t("bookmarks.emptyState.title")}
              </h2>
              <p className={`text-callout text-muted-foreground leading-relaxed ${
                language === 'zh-CN' ? 'chinese-text-sc' : 
                language === 'zh-TW' ? 'chinese-text-tc' : ''
              }`}>
                {t("bookmarks.emptyState.description").split('\n').map((line, index) => (
                  <span key={index}>
                    {line}
                    {index === 0 && <br />}
                  </span>
                ))}
              </p>
            </div>
          </div>
        </div>
      )
    }

    // Show bookmarks
    return contentWrapper(
      <div className="px-4 py-4">
        {/* Page header */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-3">
            <TurnedInIcon sx={{ fontSize: 20 }} className="text-foreground" />
            <h1 className="text-xl font-semibold text-foreground">Bookmarks</h1>
          </div>
          <BookmarkSearchBar 
            searchQuery={searchQuery}
            onSearchChange={handleSearchChange}
            onClearSearch={handleClearSearch}
            language={language}
            t={t}
          />
        </div>

        {/* Show search results or empty search state */}
        {searchQuery && filteredBookmarks.length === 0 ? (
          <div className="text-center py-16">
            <Search className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <h2 className={`text-lg font-medium text-foreground mb-2 ${
              language === 'zh-CN' ? 'chinese-text-sc' : 
              language === 'zh-TW' ? 'chinese-text-tc' : ''
            }`}>
              {t("bookmarks.search.noResults")}
            </h2>
            <p className={`text-sm text-muted-foreground mb-4 max-w-sm mx-auto ${
              language === 'zh-CN' ? 'chinese-text-sc' : 
              language === 'zh-TW' ? 'chinese-text-tc' : ''
            }`}>
              {t("bookmarks.search.noResultsDesc").replace("{query}", searchQuery)}
            </p>
            <button 
              onClick={handleClearSearch}
              className={`text-primary hover:underline text-sm ${
                language === 'zh-CN' ? 'chinese-text-sc' : 
                language === 'zh-TW' ? 'chinese-text-tc' : ''
              }`}
            >
              {t("bookmarks.search.clearSearch")}
            </button>
          </div>
        ) : (
          <>
            {/* Bookmarks grid - optimized two-column layout */}
            <div className="grid grid-cols-2 gap-3">
              {filteredBookmarks.map((bookmark) => (
                <ArticleCard 
                  key={`bookmark-${bookmark.bookmarkId}`}
                  article={bookmark} 
                  onReadMore={handleReadMore}
                  showHkiLogo={true}
                  showTimestamp={false}
                />
              ))}
            </div>

            {/* Infinite scroll trigger - only show when not searching */}
            {!searchQuery && (
              <div ref={ref}>
                {isFetchingNextPage && (
                  <div className="grid grid-cols-2 gap-3 mt-4">
                    <LoadingSkeleton variant="card" count={4} />
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    )
  }

  // Show same empty state UI for non-signed-in users
  const bookmarksFallback = (
    <div className="relative h-full overflow-hidden">
      <div 
        className="h-full"
        style={{ 
          transform: `translateY(0px)`,
          transition: 'transform 0.3s ease-out'
        }}
      >
        <div 
          className="isolate overflow-auto h-full"
          style={{ 
            overscrollBehavior: 'none', 
            touchAction: 'pan-y pinch-zoom',
            WebkitOverflowScrolling: 'touch'
          }}
        >
          <div className="h-[70px] w-full" aria-hidden="true" />
          <div className="px-4 py-4">
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-3">
                <TurnedInIcon sx={{ fontSize: 20 }} className="text-foreground" />
                <h1 className="text-xl font-semibold text-foreground">Bookmarks</h1>
              </div>
              <BookmarkSearchBar 
            searchQuery={searchQuery}
            onSearchChange={handleSearchChange}
            onClearSearch={handleClearSearch}
            language={language}
            t={t}
          />
            </div>
            
            <div className="flex flex-col items-center justify-center py-24">
              {/* Modern visual representation */}
              <div className="relative mb-8">
                {/* Stack of cards effect */}
                <div className="relative">
                  {/* Background cards for depth */}
                  <div className="absolute -top-1 -left-1 w-16 h-20 bg-gradient-to-br from-neutral-100 to-neutral-200 dark:from-neutral-800 dark:to-neutral-900 rounded-lg shadow-sm opacity-60 rotate-[-2deg]" />
                  <div className="absolute -top-0.5 -right-0.5 w-16 h-20 bg-gradient-to-br from-neutral-50 to-neutral-100 dark:from-neutral-700 dark:to-neutral-800 rounded-lg shadow-sm opacity-80 rotate-[1deg]" />
                  
                  {/* Main card */}
                  <div className="relative w-16 h-20 bg-gradient-to-br from-white to-neutral-50 dark:from-neutral-800 dark:to-neutral-900 rounded-lg border border-neutral-200/60 dark:border-neutral-700/60 shadow-lg backdrop-blur-sm">
                    {/* Subtle bookmark icon */}
                    <div className="absolute top-2 right-2">
                      <div className="w-3 h-4 bg-gradient-to-b from-neutral-300 to-neutral-400 dark:from-neutral-600 dark:to-neutral-700 rounded-sm opacity-40" />
                    </div>
                    
                    {/* Content lines */}
                    <div className="p-2.5 pt-3">
                      <div className="w-full h-1.5 bg-neutral-200 dark:bg-neutral-700 rounded-full mb-2 opacity-50" />
                      <div className="w-4/5 h-1 bg-neutral-200 dark:bg-neutral-700 rounded-full mb-1.5 opacity-40" />
                      <div className="w-3/5 h-1 bg-neutral-200 dark:bg-neutral-700 rounded-full opacity-30" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Clean, value-focused messaging with proper typography */}
              <div className="text-center max-w-xs">
                <h2 className={`text-headline font-semibold text-foreground mb-3 ${
                  language === 'zh-CN' ? 'chinese-text-sc' : 
                  language === 'zh-TW' ? 'chinese-text-tc' : ''
                }`}>
                  {t("bookmarks.emptyState.title")}
                </h2>
                <p className={`text-callout text-muted-foreground leading-relaxed ${
                  language === 'zh-CN' ? 'chinese-text-sc' : 
                  language === 'zh-TW' ? 'chinese-text-tc' : ''
                }`}>
                  {t("bookmarks.emptyState.description").split('\n').map((line, index) => (
                    <span key={index}>
                      {line}
                      {index === 0 && <br />}
                    </span>
                  ))}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <AuthProtectedPage
      isMenuOpen={isMenuOpen}
      onMenuOpenChange={setMenuOpen}
      fallback={bookmarksFallback}
    >
      {renderBookmarksContent()}
    </AuthProtectedPage>
  )
}