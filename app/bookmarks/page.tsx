"use client"

import { useEffect, useState, useRef } from "react"
import { useInView } from "react-intersection-observer"
import { useHeaderVisibility } from "@/contexts/header-visibility"
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh"
import { useBookmarksPage } from "@/hooks/use-bookmarks"
import AuthProtectedPage from "@/components/auth-protected-page"
import ArticleCard from "@/components/article-card"
import ArticleBottomSheet from "@/components/article-bottom-sheet"
import LoadingSkeleton from "@/components/loading-skeleton"
import PullRefreshIndicator from "@/components/pull-refresh-indicator"
import TurnedInIcon from '@mui/icons-material/TurnedIn'

export default function BookmarksPage() {
  const { ref, inView } = useInView()
  const { setScrollPosition } = useHeaderVisibility()
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null)
  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const ticking = useRef(false)

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

  // Custom sign-in fallback for bookmarks page
  const bookmarksFallback = (
    <div className="flex flex-col items-center justify-center h-screen px-6 text-center">
      <TurnedInIcon sx={{ fontSize: 64 }} className="text-muted-foreground mb-4" />
      <h1 className="text-2xl font-semibold text-foreground mb-2">
        Sign in required
      </h1>
      <p className="text-muted-foreground mb-6 max-w-md">
        Please sign in to view your bookmarked articles. You can access your saved articles anytime after signing in.
      </p>
      <div className="text-sm text-muted-foreground">
        Use the side menu to sign in or create an account.
      </div>
    </div>
  )

  // Render the page content
  const renderBookmarksContent = () => {
    // Show loading skeleton while fetching bookmarks
    if (isLoading) {
      return (
        <div className="relative h-full overflow-hidden">
          <div className="h-full overflow-auto">
            <div className="h-[70px] w-full" aria-hidden="true" />
            <div className="px-4 py-4">
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-1">
                  <TurnedInIcon sx={{ fontSize: 20 }} className="text-foreground" />
                  <h1 className="text-xl font-semibold text-foreground">Bookmarks</h1>
                </div>
                <p className="text-sm text-muted-foreground">Your saved articles</p>
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
          <div className="h-full overflow-auto">
            <div className="h-[70px] w-full" aria-hidden="true" />
            <div className="px-4 py-4">
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-1">
                  <TurnedInIcon sx={{ fontSize: 20 }} className="text-foreground" />
                  <h1 className="text-xl font-semibold text-foreground">Bookmarks</h1>
                </div>
                <p className="text-sm text-muted-foreground">Your saved articles</p>
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
                overscrollBehaviorY: 'contain', 
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
            <div className="flex items-center gap-2 mb-1">
              <TurnedInIcon sx={{ fontSize: 20 }} className="text-foreground" />
              <h1 className="text-xl font-semibold text-foreground">Bookmarks</h1>
            </div>
            <p className="text-sm text-muted-foreground">Your saved articles</p>
          </div>
          
          <div className="text-center py-16">
            <TurnedInIcon sx={{ fontSize: 48 }} className="text-muted-foreground mx-auto mb-3" />
            <h2 className="text-lg font-medium text-foreground mb-2">
              No bookmarks yet
            </h2>
            <p className="text-sm text-muted-foreground mb-4 max-w-sm mx-auto">
              Start bookmarking articles you want to read later. Look for the bookmark icon on article cards.
            </p>
            <div className="text-xs text-muted-foreground">
              Pull down to refresh
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
          <div className="flex items-center gap-2 mb-1">
            <TurnedInIcon sx={{ fontSize: 20 }} className="text-foreground" />
            <h1 className="text-xl font-semibold text-foreground">Bookmarks</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            {bookmarks.length} saved article{bookmarks.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Bookmarks grid - optimized two-column layout */}
        <div className="grid grid-cols-2 gap-3">
          {bookmarks.map((bookmark) => (
            <ArticleCard 
              key={`bookmark-${bookmark.bookmarkId}`}
              article={bookmark} 
              onReadMore={handleReadMore}
              showHkiLogo={true}
            />
          ))}
        </div>

        {/* Infinite scroll trigger */}
        <div ref={ref}>
          {isFetchingNextPage && (
            <div className="grid grid-cols-2 gap-3 mt-4">
              <LoadingSkeleton variant="card" count={4} />
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <AuthProtectedPage
      isMenuOpen={isMenuOpen}
      onMenuOpenChange={setIsMenuOpen}
      fallback={bookmarksFallback}
    >
      {renderBookmarksContent()}
    </AuthProtectedPage>
  )
}