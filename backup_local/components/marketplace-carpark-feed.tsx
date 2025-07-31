"use client"

import * as React from 'react';
import { useCarparkListings, DistrictKey } from '../hooks/useCarparkListings';
import { DistrictFilter } from './carparks/DistrictFilter';
import { CarparkCard } from './carparks/CarparkCard';
import PullRefreshIndicator from './pull-refresh-indicator';
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh';
import { useHeaderVisibility } from '@/contexts/header-visibility';
import { LoadingSpinner } from './loading-spinner';
import { useInView } from 'react-intersection-observer';

export default function MarketplaceCarparkFeed() {
  const [district, setDistrict] = React.useState<DistrictKey>('ALL');
  const { items, loading, error, done, loadMore, refresh } = useCarparkListings({ district, pageSize: 20 });
  const { setScrollPosition } = useHeaderVisibility();
  const ticking = React.useRef(false);
  const { ref, inView } = useInView();
  const [isInitialLoad, setIsInitialLoad] = React.useState(true);
  
  // Handle refresh functionality
  const handleRefresh = React.useCallback(async () => {
    if (refresh) {
      await refresh();
    }
  }, [refresh]);

  // Use pull-to-refresh hook
  const {
    scrollRef,
    pullDistance,
    isRefreshing,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd
  } = usePullToRefresh({
    onRefresh: handleRefresh,
    enabled: true
  });

  // Handle infinite scroll
  React.useEffect(() => {
    if (inView && !loading && !done && !isInitialLoad) {
      loadMore();
    }
  }, [inView, loading, done, loadMore, isInitialLoad]);

  // Track initial load completion
  React.useEffect(() => {
    if (!loading && items.length > 0) {
      setIsInitialLoad(false);
    }
  }, [loading, items.length]);

  // Track scroll position for header visibility
  React.useEffect(() => {
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
  }, [setScrollPosition]);

  // Show proper loading skeleton on initial load
  if (isInitialLoad && loading) {
    return (
      <div className="relative h-full">
        <div className="h-full overflow-auto">
          {/* Spacer for fixed header and category selector */}
          <div className="h-[116px] w-full" aria-hidden="true" />
          
          <div className="space-y-6 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto pb-20">
            {/* District filter placeholder */}
            <div className="h-10 w-48 bg-neutral-200 dark:bg-neutral-700 rounded-lg animate-pulse" />
            
            {/* Loading skeleton grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {Array.from({ length: 15 }).map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="aspect-[3/2] bg-neutral-200 dark:bg-neutral-700 rounded-lg"></div>
                  <div className="p-3 space-y-2">
                    <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-3/4"></div>
                    <div className="h-3 bg-neutral-200 dark:bg-neutral-700 rounded w-1/2"></div>
                    <div className="h-3 bg-neutral-200 dark:bg-neutral-700 rounded w-1/4"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
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
          className="h-full overflow-auto"
          style={{ 
            overscrollBehaviorY: 'contain', 
            WebkitOverflowScrolling: 'touch'
          }}
        >
          {/* Spacer for fixed header and category selector */}
          <div className="h-[116px] w-full" aria-hidden="true" />
          
          <div className="space-y-6 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto pb-20">
            <DistrictFilter value={district} onChange={setDistrict} />

            {error && (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg text-sm">
                Error loading listings: {String(error.message || error)}
              </div>
            )}

            {/* Mobile-optimized grid for parking spaces */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {items.map((row) => (
                <CarparkCard key={row.listing_id} row={row} />
              ))}
            </div>

            {/* Empty State */}
            {!loading && items.length === 0 && !error && (
              <div className="text-center py-20">
                <span className="text-6xl mb-4 block">🅿️</span>
                <h3 className="text-lg font-medium text-neutral-900 dark:text-neutral-100 mb-2">
                  No parking spaces found
                </h3>
                <p className="text-sm text-neutral-600 dark:text-neutral-400">
                  Try selecting a different district
                </p>
              </div>
            )}

            {/* Infinite scroll trigger */}
            {!done && items.length > 0 && (
              <div ref={ref} className="py-8">
                {loading && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {Array.from({ length: 10 }).map((_, i) => (
                      <div key={i} className="animate-pulse">
                        <div className="aspect-[3/2] bg-neutral-200 dark:bg-neutral-700 rounded-lg"></div>
                        <div className="p-3 space-y-2">
                          <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-3/4"></div>
                          <div className="h-3 bg-neutral-200 dark:bg-neutral-700 rounded w-1/2"></div>
                          <div className="h-3 bg-neutral-200 dark:bg-neutral-700 rounded w-1/4"></div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}