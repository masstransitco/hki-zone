"use client"

import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useState, useCallback, useRef } from "react"
import { useInView } from "react-intersection-observer"
import { Search, Grid3X3, List } from "lucide-react"
import { LoadingSpinner } from "./loading-spinner"
import LoadingSkeleton from "./loading-skeleton"
import CarBottomSheet from "./car-bottom-sheet"
import CarSearch from "./car-search"
import PullRefreshIndicator from "./pull-refresh-indicator"
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh"
import { useHeaderVisibility } from "@/contexts/header-visibility"
import { parseCarSpecs, getFormattedSpecString } from "../utils/car-specs-parser"
import { cn } from "@/lib/utils"

// Types remain the same
interface CarListing {
  id: string
  title: string
  make?: string
  model?: string
  year?: string
  price?: string
  content?: string
  summary?: string
  ai_summary?: string
  url: string
  source: string
  imageUrl?: string
  images?: string[]
  category: string
  publishedAt: string
  specs?: Record<string, string>
}

interface CarsResponse {
  articles: CarListing[]
  nextPage: number | null
  hasMore: boolean
  totalCount?: number
}

// Fetch function
async function fetchCars(page: number): Promise<CarsResponse> {
  const response = await fetch(`/api/cars?page=${page}`)
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response.json()
}

// Minimalist car card component
function CarCard({ car, onCarClick }: { car: CarListing, onCarClick: (car: CarListing) => void }) {
  const images = car.images || (car.imageUrl ? [car.imageUrl] : [])
  
  const formatPrice = (price: string) => {
    if (!price) return null
    return price.replace(/HKD\$/, 'HK$').replace(/減價.*$/, '').trim()
  }
  
  const getDisplayTitle = () => {
    if (car.title) return car.title
    const make = car.make || car.specs?.make || ''
    const model = car.model || car.specs?.model || ''
    return `${make} ${model}`.trim() || 'Car Listing'
  }
  
  const displayPrice = formatPrice(car.price || car.specs?.price || '')
  const displayTitle = getDisplayTitle()

  return (
    <article 
      className="group cursor-pointer"
      onClick={() => onCarClick(car)}
    >
      <div className="aspect-[4/3] relative overflow-hidden rounded-lg bg-neutral-100 dark:bg-neutral-800">
        {images.length > 0 ? (
          <img
            src={images[0]}
            alt={displayTitle}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-4xl">🚗</span>
          </div>
        )}
      </div>
      
      <div className="mt-3 space-y-1">
        <h3 className="font-medium text-sm text-neutral-900 dark:text-neutral-100 line-clamp-2">
          {displayTitle}
        </h3>
        {displayPrice && (
          <p className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
            {displayPrice}
          </p>
        )}
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          {car.year || new Date(car.publishedAt).getFullYear()}
        </p>
      </div>
    </article>
  )
}

export default function MarketplaceCarsFeed() {
  const queryClient = useQueryClient()
  const [selectedCar, setSelectedCar] = useState<CarListing | null>(null)
  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false)
  const [searchResults, setSearchResults] = useState<CarListing[]>([])
  const [isSearchActive, setIsSearchActive] = useState(false)
  const [isGridView, setIsGridView] = useState(true)
  const [isSearchVisible, setIsSearchVisible] = useState(false)
  const { setScrollPosition } = useHeaderVisibility()
  const ticking = useRef(false)
  
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    error,
    refetch
  } = useInfiniteQuery({
    queryKey: ['marketplace-cars'],
    queryFn: ({ pageParam = 0 }) => fetchCars(pageParam),
    getNextPageParam: (lastPage) => lastPage.nextPage,
    staleTime: 5 * 60 * 1000,
    initialPageParam: 0,
  })
  
  const { ref, inView } = useInView()
  
  // Handle refresh functionality
  const handleRefresh = useCallback(async () => {
    await queryClient.resetQueries({ queryKey: ['marketplace-cars'] })
    await refetch()
  }, [queryClient, refetch])

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
    enabled: !isBottomSheetOpen && !isSearchActive
  })
  
  useEffect(() => {
    if (inView && !isSearchActive && hasNextPage && !isFetchingNextPage) {
      fetchNextPage()
    }
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage, isSearchActive])
  
  const handleCarClick = (car: CarListing) => {
    setSelectedCar(car)
    setIsBottomSheetOpen(true)
  }

  const handleSearchResults = useCallback((results: CarListing[], isSearching: boolean) => {
    setSearchResults(results)
    setIsSearchActive(isSearching)
  }, [])
  
  const displayCars = isSearchActive ? searchResults : (data?.pages.flatMap(page => page.articles) ?? [])
  
  // Track scroll position for header visibility
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
  
  if (isLoading) {
    return (
      <div className="relative h-full">
        <div className="h-full overflow-auto">
          {/* Spacer for fixed header and category selector */}
          <div className="h-[116px] w-full" aria-hidden="true" />
          
          <div className="space-y-6 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto pb-20">
            {/* Search bar placeholder */}
            <div className="h-10" />
            
            {/* Loading skeleton grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="aspect-[4/3] bg-neutral-200 dark:bg-neutral-700 rounded-lg"></div>
                  <div className="mt-3 space-y-2">
                    <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-3/4"></div>
                    <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-1/2"></div>
                    <div className="h-3 bg-neutral-200 dark:bg-neutral-700 rounded w-1/4"></div>
                  </div>
                </div>
              ))}
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
            {/* Clean search bar with toggle */}
            <div className="flex items-center gap-3">
        {isSearchVisible ? (
          <div className="flex-1 animate-in slide-in-from-right duration-200">
            <CarSearch onResults={handleSearchResults} />
          </div>
        ) : (
          <div className="flex-1" />
        )}
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsSearchVisible(!isSearchVisible)}
            className={cn(
              "p-2.5 rounded-full transition-all duration-200",
              isSearchVisible 
                ? "bg-neutral-800 dark:bg-neutral-200 text-white dark:text-neutral-900" 
                : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100"
            )}
            aria-label="Toggle search"
          >
            <Search className="w-4 h-4" />
          </button>
          
          <button
            onClick={() => setIsGridView(!isGridView)}
            className="p-2.5 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors"
            aria-label={isGridView ? 'List view' : 'Grid view'}
          >
            {isGridView ? <List className="w-4 h-4" /> : <Grid3X3 className="w-4 h-4" />}
          </button>
        </div>
      </div>
      
      {/* Cars grid */}
      {displayCars.length > 0 ? (
        <div className={cn(
          isGridView 
            ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4"
            : "space-y-4"
        )}>
          {displayCars.map((car) => (
            <CarCard key={car.id} car={car} onCarClick={handleCarClick} />
          ))}
        </div>
      ) : (
        <div className="text-center py-20">
          <span className="text-6xl mb-4 block">🚗</span>
          <h3 className="text-lg font-medium text-neutral-900 dark:text-neutral-100 mb-2">
            No cars available
          </h3>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Check back soon for new listings
          </p>
        </div>
      )}
      
      {/* Load more */}
      {hasNextPage && !isSearchActive && (
        <div ref={ref} className="py-8">
          {isFetchingNextPage && (
            <div className={cn(
              isGridView 
                ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4"
                : "space-y-4"
            )}>
              {Array.from({ length: isGridView ? 10 : 5 }).map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="aspect-[4/3] bg-neutral-200 dark:bg-neutral-700 rounded-lg"></div>
                  <div className="mt-3 space-y-2">
                    <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-3/4"></div>
                    <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-1/2"></div>
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

      {/* Car detail sheet */}
      <CarBottomSheet
        car={selectedCar}
        open={isBottomSheetOpen}
        onOpenChange={setIsBottomSheetOpen}
      />
    </div>
  )
}