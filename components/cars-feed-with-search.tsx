"use client"

import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useState, useCallback } from "react"
import { useInView } from "react-intersection-observer"
import { RefreshCw, Car, Grid3X3, List, Tag } from "lucide-react"
import LoadingSkeleton from "./loading-skeleton"
import CarBottomSheet from "./car-bottom-sheet"
import CarSearch from "./car-search"
import { useLanguage } from "./language-provider"
import { Button } from "./ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import { Badge } from "./ui/badge"
import { parseCarSpecs, getFormattedSpecString } from "../utils/car-specs-parser"

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
  debug?: {
    source: 'database' | 'mock'
    query?: any
    error?: string
  }
}

// Hydration-safe date formatting utility
const formatPublishedDate = (dateString: string) => {
  try {
    const date = new Date(dateString)
    // Use consistent format that works across all locales
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit', 
      year: 'numeric'
    })
  } catch (error) {
    return 'Date unavailable'
  }
}

// Mobile-optimized car card with compact layout
function CarCard({ car, onCarClick }: { car: CarListing, onCarClick: (car: CarListing) => void }) {
  const [imageIndex, setImageIndex] = useState(0)
  const [imageError, setImageError] = useState(false)
  const [mounted, setMounted] = useState(false)
  const images = car.images || (car.imageUrl ? [car.imageUrl] : [])

  // Handle hydration-safe mounting
  useEffect(() => {
    setMounted(true)
  }, [])
  
  // Optimized price formatting
  const formatPrice = (price: string) => {
    if (!price) return null
    return price.replace(/HKD\$/, 'HK$').replace(/減價.*$/, '').trim()
  }
  
  const isOnSale = (price: string) => price?.includes('減價') || false
  
  // Simplified spec extraction for display
  const getDisplayTitle = () => {
    if (car.title) return car.title
    const make = car.make || car.specs?.make || ''
    const model = car.model || car.specs?.model || ''
    return `${make} ${model}`.trim() || 'Car Listing'
  }
  
  const getDisplayPrice = () => {
    const price = car.price || car.specs?.price || ''
    return formatPrice(price)
  }
  
  const getDisplayYear = () => {
    return car.year || car.specs?.year || new Date(car.publishedAt).getFullYear().toString()
  }
  
  const getSpecs = () => {
    // Use pre-parsed database field if available
    if (car.specFormattedDisplay) {
      return car.specFormattedDisplay
    }
    
    // Fall back to parsing the raw specs
    const rawSpecs = car.specs?.['規格'] || ''
    if (!rawSpecs) return ''
    
    const parsedSpecs = parseCarSpecs(rawSpecs)
    return getFormattedSpecString(parsedSpecs)
  }
  
  // Optimized image navigation
  const nextImage = () => {
    if (images.length > 1) {
      setImageIndex(prev => (prev + 1) % images.length)
    }
  }
  
  const prevImage = () => {
    if (images.length > 1) {
      setImageIndex(prev => prev === 0 ? images.length - 1 : prev - 1)
    }
  }
  
  const displayPrice = getDisplayPrice()
  const displayTitle = getDisplayTitle()
  const specs = getSpecs()
  const year = getDisplayYear()
  const saleStatus = displayPrice ? isOnSale(displayPrice) : false

  return (
    <article 
      className="group relative bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-800 overflow-hidden hover:border-green-200 dark:hover:border-green-800 hover:shadow-md transition-all duration-200 cursor-pointer"
      onClick={() => onCarClick(car)}
    >
      {/* Compact Image Section */}
      <div className="relative aspect-[3/2] overflow-hidden">
        {images.length > 0 && !imageError ? (
          <>
            <img
              src={images[imageIndex]}
              alt={displayTitle}
              className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-500"
              onError={() => setImageError(true)}
              loading="lazy"
            />
            
            
            {/* Mobile-Optimized Navigation */}
            {images.length > 1 && (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); prevImage() }}
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 bg-black/50 hover:bg-black/70 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center"
                  aria-label="Previous image"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); nextImage() }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 bg-black/50 hover:bg-black/70 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center"
                  aria-label="Next image"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
                
                {/* Compact Image Counter */}
                <div className="absolute top-2 right-2 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded">
                  {imageIndex + 1}/{images.length}
                </div>
                
                {/* Bottom indicators */}
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                  {images.map((_, index) => (
                    <div
                      key={index}
                      className={`w-1 h-1 rounded-full transition-all duration-200 ${
                        index === imageIndex ? 'bg-white' : 'bg-white/50'
                      }`}
                    />
                  ))}
                </div>
              </>
            )}
            
            {/* Sale badge */}
            {saleStatus && (
              <div className="absolute top-2 left-2 bg-red-500 text-white text-xs font-medium px-2 py-1 rounded-full">
                Sale
              </div>
            )}
          </>
        ) : (
          <div className="w-full h-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
            <Car className="w-8 h-8 text-neutral-400" />
          </div>
        )}
      </div>
      
      {/* Compact Content Section */}
      <div className="p-3 space-y-2">
        {/* Title and Price Row */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="flex-1 text-sm font-semibold text-neutral-900 dark:text-neutral-100 line-clamp-1 leading-tight">
            {displayTitle}
          </h3>
          {displayPrice && (
            <div className="flex-shrink-0 flex items-center gap-1 text-sm font-bold text-neutral-700 dark:text-neutral-300">
              <Tag className="w-3 h-3 text-green-600 dark:text-green-400" />
              {displayPrice}
            </div>
          )}
        </div>
        
        {/* Compact Metadata */}
        <div className="flex items-center gap-2 text-xs text-neutral-600 dark:text-neutral-400">
          <span>{year}</span>
          <span>•</span>
          <span>{new Date(car.publishedAt).toLocaleDateString()}</span>
        </div>
        
        {/* Compact Specs */}
        {specs && (
          <div className="text-xs text-neutral-600 dark:text-neutral-400 line-clamp-1">
            {specs}
          </div>
        )}
      </div>
    </article>
  )
}

// List view component with horizontal layout
function CarListItem({ car, onCarClick }: { car: CarListing, onCarClick: (car: CarListing) => void }) {
  const [imageError, setImageError] = useState(false)
  const images = car.images || (car.imageUrl ? [car.imageUrl] : [])
  
  // Reuse the same helper functions from CarCard
  const formatPrice = (price: string) => {
    if (!price) return null
    return price.replace(/HKD\$/, 'HK$').replace(/減價.*$/, '').trim()
  }
  
  const isOnSale = (price: string) => price?.includes('減價') || false
  
  const getDisplayTitle = () => {
    if (car.title) return car.title
    const make = car.make || car.specs?.make || ''
    const model = car.model || car.specs?.model || ''
    return `${make} ${model}`.trim() || 'Car Listing'
  }
  
  const getDisplayPrice = () => {
    const price = car.price || car.specs?.price || ''
    return formatPrice(price)
  }
  
  const getDisplayYear = () => {
    return car.year || car.specs?.year || new Date(car.publishedAt).getFullYear().toString()
  }
  
  const getSpecs = () => {
    // Use pre-parsed database field if available
    if (car.specFormattedDisplay) {
      return car.specFormattedDisplay
    }
    
    // Fall back to parsing the raw specs
    const rawSpecs = car.specs?.['規格'] || ''
    if (!rawSpecs) return ''
    
    const parsedSpecs = parseCarSpecs(rawSpecs)
    return getFormattedSpecString(parsedSpecs)
  }
  
  const displayPrice = getDisplayPrice()
  const displayTitle = getDisplayTitle()
  const specs = getSpecs()
  const year = getDisplayYear()
  const saleStatus = displayPrice ? isOnSale(displayPrice) : false

  return (
    <article 
      className="group relative bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200/50 dark:border-neutral-800/50 overflow-hidden hover:shadow-md dark:hover:shadow-neutral-900/40 transition-all duration-300 cursor-pointer"
      onClick={() => onCarClick(car)}
    >
      <div className="flex gap-4 p-4">
        {/* 1:1 Thumbnail */}
        <div className="relative w-24 h-24 sm:w-28 sm:h-28 flex-shrink-0 overflow-hidden rounded-lg">
          {images.length > 0 && !imageError ? (
            <>
              <img
                src={images[0]}
                alt={displayTitle}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                onError={() => setImageError(true)}
                loading="lazy"
              />
              
              {/* Sale badge */}
              {saleStatus && (
                <div className="absolute top-1 left-1 bg-red-500 text-white text-xs font-medium px-1.5 py-0.5 rounded">
                  Sale
                </div>
              )}
              
              {/* Image count indicator */}
              {images.length > 1 && (
                <div className="absolute bottom-1 right-1 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded">
                  {images.length}
                </div>
              )}
            </>
          ) : (
            <div className="w-full h-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center rounded-lg">
              <Car className="w-8 h-8 text-neutral-400" />
            </div>
          )}
        </div>
        
        {/* Content */}
        <div className="flex-1 min-w-0 flex flex-col justify-between">
          {/* Top section: Title and Price */}
          <div className="flex justify-between items-start gap-4">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 text-base leading-tight line-clamp-2">
                {displayTitle}
              </h3>
              <div className="flex items-center gap-2 mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                <span>{year}</span>
                <span>•</span>
                <span>{new Date(car.publishedAt).toLocaleDateString()}</span>
              </div>
            </div>
            
            {/* Price section */}
            <div className="flex-shrink-0 text-right">
              {displayPrice && (
                <div className="flex items-center gap-1.5 text-lg font-bold text-neutral-700 dark:text-neutral-300">
                  <Tag className="w-4 h-4 text-green-600 dark:text-green-400" />
                  {displayPrice}
                </div>
              )}
            </div>
          </div>
          
          {/* Bottom section: Specs */}
          {specs && (
            <div className="mt-2 text-sm text-neutral-600 dark:text-neutral-400 line-clamp-1">
              {specs}
            </div>
          )}
        </div>
      </div>
    </article>
  )
}

async function fetchCars(page: number): Promise<CarsResponse> {
  try {
    // Using the new cars API that handles both tables
    const response = await fetch(`/api/cars?page=${page}`)
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    
    const data = await response.json()
    
    return {
      articles: data.articles || [],
      nextPage: data.nextPage,
      hasMore: data.hasMore || false,
      totalCount: data.totalCount,
      debug: data.debug
    }
  } catch (error) {
    console.error('Error fetching cars:', error)
    
    // Return mock data if API fails
    return {
      articles: [],
      nextPage: null,
      hasMore: false,
      debug: {
        source: 'mock',
        error: 'API unavailable'
      }
    }
  }
}

export default function CarsFeedWithSearch() {
  const queryClient = useQueryClient()
  const { language } = useLanguage()
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [selectedCar, setSelectedCar] = useState<CarListing | null>(null)
  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false)
  const [searchResults, setSearchResults] = useState<CarListing[]>([])
  const [isSearchActive, setIsSearchActive] = useState(false)
  const [searchHasMore, setSearchHasMore] = useState(false)
  const [searchLoadMore, setSearchLoadMore] = useState<(() => void) | null>(null)
  const [searchIsFetchingNextPage, setSearchIsFetchingNextPage] = useState(false)
  const [isGridView, setIsGridView] = useState(false)
  
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    error,
    refetch
  } = useInfiniteQuery({
    queryKey: ['cars', language],
    queryFn: ({ pageParam = 0 }) => fetchCars(pageParam),
    getNextPageParam: (lastPage) => lastPage.nextPage,
    staleTime: 5 * 60 * 1000, // 5 minutes
    initialPageParam: 0,
  })
  
  const { ref, inView } = useInView({
    threshold: 0,
    triggerOnce: false,
  })
  
  useEffect(() => {
    if (inView && !isSearchActive && hasNextPage && !isFetchingNextPage) {
      fetchNextPage()
    } else if (inView && isSearchActive && searchHasMore && !searchIsFetchingNextPage && searchLoadMore) {
      searchLoadMore()
    }
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage, isSearchActive, searchHasMore, searchIsFetchingNextPage, searchLoadMore])
  
  const handleRefresh = async () => {
    setIsRefreshing(true)
    await refetch()
    setIsRefreshing(false)
  }

  const handleCarClick = (car: CarListing) => {
    setSelectedCar(car)
    setIsBottomSheetOpen(true)
  }

  const handleSearchResults = useCallback((results: CarListing[], isSearching: boolean, hasMore?: boolean, loadMore?: () => void, isFetchingNextPage?: boolean) => {
    setSearchResults(results)
    setIsSearchActive(isSearching) // Active when user is searching, regardless of results
    setSearchHasMore(hasMore || false)
    setSearchLoadMore(() => loadMore || null)
    setSearchIsFetchingNextPage(isFetchingNextPage || false)
  }, [])
  
  // Use search results if active, otherwise use regular feed
  const displayCars = isSearchActive ? searchResults : (data?.pages.flatMap(page => page.articles) ?? [])
  const debugInfo = data?.pages[0]?.debug
  
  return (
    <div className="space-y-6">
      {/* Clean Header with Search */}
      <header className="pb-4 sm:pb-6">
        {/* Search Component with View Toggle and Refresh Button */}
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <CarSearch onResults={handleSearchResults} />
          </div>
          <button
            onClick={() => setIsGridView(!isGridView)}
            className="w-10 h-10 inline-flex items-center justify-center text-neutral-700 dark:text-neutral-300 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors"
            aria-label={isGridView ? 'Switch to list view' : 'Switch to grid view'}
          >
            {isGridView ? <List className="w-4 h-4" /> : <Grid3X3 className="w-4 h-4" />}
          </button>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="w-10 h-10 inline-flex items-center justify-center text-neutral-700 dark:text-neutral-300 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors disabled:opacity-50"
            aria-label="Refresh car listings"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>
      
      {/* Status Messages */}
      {debugInfo?.source === 'mock' && !isSearchActive && (
        <div className="mb-8 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
          <p className="text-sm text-amber-800 dark:text-amber-200 flex items-center gap-2">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Using sample data - car scraping in progress
          </p>
        </div>
      )}
      
      {error && !isSearchActive && (
        <div className="mb-8 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-800 dark:text-red-200 flex items-center gap-2">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Failed to load cars: {error.message}
          </p>
        </div>
      )}
      
      {/* Content */}
      <main>
        {/* Loading State */}
        {isLoading && !isSearchActive && (
          <div className={isGridView 
            ? "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4"
            : "space-y-4"
          }>
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="aspect-[3/2] bg-neutral-200 dark:bg-neutral-700 rounded-lg"></div>
                <div className="p-3 space-y-2">
                  <div className="flex justify-between items-start gap-2">
                    <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-2/3"></div>
                    <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-1/4"></div>
                  </div>
                  <div className="h-3 bg-neutral-200 dark:bg-neutral-700 rounded w-1/2"></div>
                  <div className="h-3 bg-neutral-200 dark:bg-neutral-700 rounded w-3/4"></div>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {/* Cars Grid or List */}
        {displayCars.length > 0 && (
          <div className={isGridView 
            ? "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4"
            : "space-y-4"
          }>
            {displayCars.map((car) => (
              isGridView ? (
                <CarCard key={car.id} car={car} onCarClick={handleCarClick} />
              ) : (
                <CarListItem key={car.id} car={car} onCarClick={handleCarClick} />
              )
            ))}
          </div>
        )}
        
        {/* Empty State - only show when not searching */}
        {!isLoading && displayCars.length === 0 && !error && !isSearchActive && (
          <div className="text-center py-16">
            <Car className="w-16 h-16 text-neutral-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
              No cars available
            </h3>
            <p className="text-neutral-600 dark:text-neutral-400 mb-6 max-w-sm mx-auto">
              We're updating our listings. Please check back soon for new vehicles.
            </p>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-neutral-900 dark:bg-neutral-100 dark:text-neutral-900 rounded-lg hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              Try Again
            </button>
          </div>
        )}
        
        {/* Load More - show for both regular feed and search results */}
        {((hasNextPage && !isSearchActive) || (searchHasMore && isSearchActive)) && (
          <div ref={ref} className="flex justify-center py-12">
            {(isFetchingNextPage || searchIsFetchingNextPage) && (
              <div className="w-8 h-8 border-2 border-neutral-300 dark:border-neutral-600 border-t-neutral-900 dark:border-t-neutral-100 rounded-full animate-spin" />
            )}
          </div>
        )}
      </main>
      
      {/* Footer Stats */}
      {displayCars.length > 0 && (
        <footer className="text-center py-8 mt-12 border-t border-neutral-200 dark:border-neutral-800">
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            {isSearchActive 
              ? `Found ${displayCars.length} cars`
              : `Showing ${displayCars.length} of ${data?.pages[0]?.totalCount || displayCars.length} cars`
            }
          </p>
        </footer>
      )}

      {/* Car Detail Modal */}
      <CarBottomSheet
        car={selectedCar}
        open={isBottomSheetOpen}
        onOpenChange={setIsBottomSheetOpen}
      />
    </div>
  )
}