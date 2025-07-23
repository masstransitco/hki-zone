"use client"

import * as React from 'react';
import { useCarparkListings, DistrictKey } from '../hooks/useCarparkListings';
import { DistrictFilter } from './carparks/DistrictFilter';
import { CarparkCard } from './carparks/CarparkCard';
import PullRefreshIndicator from './pull-refresh-indicator';
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh';
import { useHeaderVisibility } from '@/contexts/header-visibility';
import { LoadingSpinner } from './loading-spinner';

export default function MarketplaceCarparkFeed() {
  const [district, setDistrict] = React.useState<DistrictKey>('ALL');
  const { items, loading, error, done, loadMore, refresh } = useCarparkListings({ district, pageSize: 20 });
  const { setScrollPosition } = useHeaderVisibility();
  const ticking = React.useRef(false);
  
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
          <div className="h-[113px] w-full" aria-hidden="true" />
          
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

            {/* Loading State */}
            {loading && (
              <div className="flex justify-center py-8">
                <LoadingSpinner size="lg" />
              </div>
            )}

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

            {/* Load More */}
            {!done && items.length > 0 && (
              <div className="flex justify-center py-8">
                <button
                  onClick={loadMore}
                  disabled={loading}
                  className="px-6 py-2 text-sm font-medium text-neutral-700 dark:text-neutral-300 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors disabled:opacity-50"
                >
                  {loading ? <LoadingSpinner size="sm" /> : 'Load More'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}