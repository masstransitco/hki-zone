"use client"

import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { useInView } from "react-intersection-observer"
import { RefreshCw, Car } from "lucide-react"
import LoadingSkeleton from "./loading-skeleton"
import CarBottomSheet from "./car-bottom-sheet"
import { useLanguage } from "./language-provider"
import { Button } from "./ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import { Badge } from "./ui/badge"

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

// Modern minimal car card with optimized DOM structure
function CarCard({ car, onCarClick }: { car: CarListing, onCarClick: (car: CarListing) => void }) {
  const [imageIndex, setImageIndex] = useState(0)
  const [imageError, setImageError] = useState(false)
  const images = car.images || (car.imageUrl ? [car.imageUrl] : [])
  
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
    return car.specs?.['規格'] || ''
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
      className="group relative bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200/50 dark:border-neutral-800/50 overflow-hidden hover:shadow-lg dark:hover:shadow-neutral-900/40 transition-all duration-300 cursor-pointer"
      onClick={() => onCarClick(car)}
    >
      {/* Image Section */}
      <div className="relative aspect-[4/3] overflow-hidden">
        {images.length > 0 && !imageError ? (
          <>
            <img
              src={images[imageIndex]}
              alt={displayTitle}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
              onError={() => setImageError(true)}
              loading="lazy"
            />
            
            {/* Image Navigation */}
            {images.length > 1 && (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); prevImage() }}
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/40 hover:bg-black/60 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center"
                  aria-label="Previous image"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); nextImage() }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/40 hover:bg-black/60 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center"
                  aria-label="Next image"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
                
                {/* Image indicators */}
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1">
                  {images.map((_, index) => (
                    <div
                      key={index}
                      className={`w-1.5 h-1.5 rounded-full transition-all duration-200 ${
                        index === imageIndex ? 'bg-white' : 'bg-white/50'
                      }`}
                    />
                  ))}
                </div>
                
                {/* Image counter */}
                <div className="absolute top-3 right-3 bg-black/50 text-white text-xs px-2 py-1 rounded-full">
                  {imageIndex + 1}/{images.length}
                </div>
              </>
            )}
            
            {/* Sale badge */}
            {saleStatus && (
              <div className="absolute top-3 left-3 bg-red-500 text-white text-xs font-medium px-2 py-1 rounded-full">
                Sale
              </div>
            )}
          </>
        ) : (
          <div className="w-full h-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
            <Car className="w-12 h-12 text-neutral-400" />
          </div>
        )}
      </div>
      
      {/* Content Section */}
      <div className="p-4 space-y-3">
        {/* Title and Price */}
        <div className="space-y-1">
          <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 line-clamp-2 leading-snug">
            {displayTitle}
          </h3>
          {displayPrice && (
            <div className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
              {displayPrice}
            </div>
          )}
        </div>
        
        {/* Metadata */}
        <div className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400">
          <span>{year}</span>
          <span>•</span>
          <span>{new Date(car.publishedAt).toLocaleDateString()}</span>
        </div>
        
        {/* Specs */}
        {specs && (
          <div className="text-sm text-neutral-600 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-800 px-3 py-2 rounded-lg">
            <span className="font-medium text-neutral-700 dark:text-neutral-300">規格:</span> {specs}
          </div>
        )}
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
      articles: [
        {
          id: '1',
          title: 'BMW X5 xDrive40i',
          make: 'BMW',
          model: 'X5 xDrive40i',
          year: '2022',
          price: 'HK$850,000',
          content: 'Luxury SUV with excellent condition, full service history, and premium features.',
          summary: 'BMW X5 xDrive40i - HK$850,000',
          url: 'https://28car.com/example',
          source: '28car',
          category: 'cars',
          publishedAt: new Date().toISOString(),
          imageUrl: 'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=800&h=400&fit=crop'
        }
      ],
      nextPage: null,
      hasMore: false,
      debug: {
        source: 'mock',
        error: 'API unavailable'
      }
    }
  }
}

export default function CarsFeed() {
  const queryClient = useQueryClient()
  const { language } = useLanguage()
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [selectedCar, setSelectedCar] = useState<CarListing | null>(null)
  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false)
  
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
    if (inView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage()
    }
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage])
  
  const handleRefresh = async () => {
    setIsRefreshing(true)
    await refetch()
    setIsRefreshing(false)
  }

  const handleCarClick = (car: CarListing) => {
    setSelectedCar(car)
    setIsBottomSheetOpen(true)
  }
  
  const cars = data?.pages.flatMap(page => page.articles) ?? []
  const debugInfo = data?.pages[0]?.debug
  
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Clean Header */}
      <header className="py-4 sm:py-6">
        <div className="flex justify-end">
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
      {debugInfo?.source === 'mock' && (
        <div className="mb-8 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
          <p className="text-sm text-amber-800 dark:text-amber-200 flex items-center gap-2">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Using sample data - car scraping in progress
          </p>
        </div>
      )}
      
      {error && (
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
        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <LoadingSkeleton key={i} />
            ))}
          </div>
        )}
        
        {/* Cars Grid */}
        {!isLoading && cars.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {cars.map((car) => (
              <CarCard key={car.id} car={car} onCarClick={handleCarClick} />
            ))}
          </div>
        )}
        
        {/* Empty State */}
        {!isLoading && cars.length === 0 && !error && (
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
        
        {/* Load More */}
        {hasNextPage && (
          <div ref={ref} className="flex justify-center py-12">
            {isFetchingNextPage && (
              <div className="w-8 h-8 border-2 border-neutral-300 dark:border-neutral-600 border-t-neutral-900 dark:border-t-neutral-100 rounded-full animate-spin" />
            )}
          </div>
        )}
      </main>
      
      {/* Footer Stats */}
      {cars.length > 0 && (
        <footer className="text-center py-8 mt-12 border-t border-neutral-200 dark:border-neutral-800">
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Showing {cars.length} of {data?.pages[0]?.totalCount || cars.length} cars
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