"use client"

import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { useInView } from "react-intersection-observer"
import { RefreshCw, Car, ExternalLink, Clock } from "lucide-react"
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

// Enhanced Car-specific card component with improved visual hierarchy
function CarCard({ car, onCarClick }: { car: CarListing, onCarClick: (car: CarListing) => void }) {
  const [selectedImage, setSelectedImage] = useState(0)
  const [imageError, setImageError] = useState(false)
  const [touchStart, setTouchStart] = useState(0)
  const [touchEnd, setTouchEnd] = useState(0)
  const images = car.images || (car.imageUrl ? [car.imageUrl] : [])
  
  const formatPrice = (price: string) => {
    if (!price) return 'Price not available'
    // Handle different price formats and preserve commas
    // Convert HKD$ to HK$ for consistency
    return price
      .replace(/HKD\$/, 'HK$')
      .replace(/減價.*$/, '')
      .trim()
  }
  
  const extractOriginalPrice = (price: string) => {
    const match = price.match(/原價\$([^\]]+)/)
    return match ? `HK$${match[1]}` : null
  }
  
  // Parse car specifications from content first
  const parseCarSpecs = (content: string) => {
    const specs: Record<string, string> = {}
    if (!content) return specs
    
    // Debug: log the content to see what we're working with
    console.log('Original content:', content)
    
    // Check if content already contains placeholder artifacts
    if (content.includes('###NUMBER_') || content.includes('###') || content.includes('PLACEHOLDER')) {
      console.log('Content contains placeholders, skipping parsing')
      return specs
    }
    
    // Simple parsing without complex placeholder replacement
    const pairs = content.split(',').map(pair => pair.trim())
    
    for (const pair of pairs) {
      const colonIndex = pair.indexOf(':')
      if (colonIndex === -1) continue
      
      const key = pair.substring(0, colonIndex).trim()
      const value = pair.substring(colonIndex + 1).trim()
      
      if (key && value) {
        const lowerKey = key.toLowerCase()
        
        if (lowerKey === 'engine') specs.engine = value
        else if (lowerKey === 'transmission') specs.transmission = value
        else if (lowerKey === 'fuel') specs.fuel = value
        else if (lowerKey === 'mileage') specs.mileage = value
        else if (lowerKey === 'year') specs.year = value
        else if (lowerKey === 'make') specs.make = value
        else if (lowerKey === 'model') specs.model = value
        else if (lowerKey === 'price') specs.price = value
        else if (lowerKey === 'doors') specs.doors = value
        else if (lowerKey === 'color') specs.color = value
        else if (key === '規格') specs['規格'] = value
      }
    }
    
    console.log('Parsed specs:', specs)
    return specs
  }
  
  const carSpecs = parseCarSpecs(car.content || '')
  
  // Debug car object to see what's available
  console.log('Car object:', { title: car.title, price: car.price, make: car.make, model: car.model })
  console.log('Car specs from API:', car.specs)
  console.log('Parsed carSpecs:', carSpecs)
  
  // Use direct price from API only - avoid parsing content for price to prevent placeholder issues
  const directPrice = car.price || car.specs?.price || ''
  
  // Don't use parsed price from content as it may contain placeholder artifacts
  const priceFromContent = directPrice || 'Price not available'
  const isOnSale = priceFromContent.includes('減價')
  const originalPrice = isOnSale && priceFromContent ? extractOriginalPrice(priceFromContent) : null
  
  // Debug pricing
  console.log('Car title:', car.title)
  console.log('Direct price from API:', directPrice)
  console.log('Final price used:', priceFromContent)
  console.log('Formatted price:', formatPrice(priceFromContent))
  
  const handleImageError = () => {
    setImageError(true)
  }
  
  const handleImageNavigation = (direction: 'prev' | 'next') => {
    if (images.length <= 1) return
    
    if (direction === 'prev') {
      setSelectedImage(prev => prev === 0 ? images.length - 1 : prev - 1)
    } else {
      setSelectedImage(prev => prev === images.length - 1 ? 0 : prev + 1)
    }
  }
  
  // Touch handlers for swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientX)
  }
  
  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX)
  }
  
  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return
    
    const distance = touchStart - touchEnd
    const isLeftSwipe = distance > 50
    const isRightSwipe = distance < -50
    
    if (isLeftSwipe && images.length > 1) {
      handleImageNavigation('next')
    }
    if (isRightSwipe && images.length > 1) {
      handleImageNavigation('prev')
    }
  }
  
  return (
    <Card 
      className="group overflow-hidden hover:shadow-elevated dark:hover:shadow-neutral-900/40 transition-all duration-300 border-stone-200/60 dark:border-neutral-700/60 bg-white dark:bg-neutral-900 backdrop-blur-sm cursor-pointer"
      onClick={() => onCarClick(car)}
    >
      {/* Modernized Image Section */}
      <div className="relative">
        {images.length > 0 && !imageError ? (
          <div 
            className="aspect-[16/10] bg-surface relative overflow-hidden"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <img
              src={images[selectedImage]}
              alt={car.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              onError={handleImageError}
              loading="lazy"
            />
            
            {/* Image Navigation Arrows */}
            {images.length > 1 && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleImageNavigation('prev')
                  }}
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 active:bg-black/80 text-white p-1.5 sm:p-2 rounded-full opacity-0 group-hover:opacity-100 touch:opacity-100 transition-opacity duration-200 z-10"
                  aria-label="Previous image"
                >
                  <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleImageNavigation('next')
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 active:bg-black/80 text-white p-1.5 sm:p-2 rounded-full opacity-0 group-hover:opacity-100 touch:opacity-100 transition-opacity duration-200 z-10"
                  aria-label="Next image"
                >
                  <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </>
            )}
            
            {/* Image Counter */}
            {images.length > 1 && (
              <div className="absolute top-2 right-2 bg-black/60 text-white px-2 py-1 rounded-full text-xs font-medium">
                {selectedImage + 1} / {images.length}
              </div>
            )}
            
            {/* Sale Badge */}
            {isOnSale && (
              <Badge className="absolute top-2 left-2 bg-stone-600 hover:bg-stone-700 dark:bg-neutral-600 dark:hover:bg-neutral-700 text-white font-semibold px-2 py-1 text-xs">
                Price Reduced
              </Badge>
            )}
            
            {/* Source overlay on hover */}
            <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <div className="bg-black/60 text-white px-2 py-1 rounded text-xs font-medium">
                {car.source}
              </div>
            </div>
          </div>
        ) : (
          // Fallback image with car icon
          <div className="aspect-[16/10] bg-surface flex items-center justify-center">
            <Car className="w-8 h-8 text-stone-400 dark:text-neutral-500" />
          </div>
        )}
        
        {/* Simplified Image Navigation Dots */}
        {images.length > 1 && (
          <div className="flex justify-center gap-1 py-2 bg-gradient-to-t from-stone-50 to-transparent dark:from-neutral-800">
            {images.map((_, index) => (
              <button
                key={index}
                onClick={(e) => {
                  e.stopPropagation()
                  setSelectedImage(index)
                }}
                className={`w-1.5 h-1.5 rounded-full transition-all duration-200 z-10 ${
                  index === selectedImage 
                    ? 'bg-stone-600 scale-125' 
                    : 'bg-stone-300 dark:bg-neutral-600 hover:bg-stone-400 dark:hover:bg-neutral-500'
                }`}
                aria-label={`View image ${index + 1}`}
              />
            ))}
          </div>
        )}
      </div>
      
      {/* Compact Content Section */}
      <div className="p-3 space-y-3">
        {/* Title and Price Section */}
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-stone-900 dark:text-neutral-50 line-clamp-2 leading-tight group-hover:text-stone-700 dark:group-hover:text-neutral-100 transition-colors">
            {car.title || `${carSpecs.make || ''} ${carSpecs.model || ''}`.trim() || 'Car Listing'}
          </h3>
          
          {/* Price Display */}
          <div className="flex items-center gap-2">
            <div className="text-lg font-bold text-stone-700 dark:text-neutral-300">
              {formatPrice(priceFromContent)}
            </div>
            {isOnSale && originalPrice && (
              <div className="text-sm text-stone-500 dark:text-neutral-400 line-through">
                {originalPrice}
              </div>
            )}
          </div>
        </div>
        
        {/* Condensed Car Specifications */}
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-stone-600 dark:text-neutral-400">
            {(carSpecs.year || car.year) && <span className="font-medium">{carSpecs.year || car.year}</span>}
            {(carSpecs.year || car.year) && <span>•</span>}
            <span>{new Date(car.publishedAt).toLocaleDateString()}</span>
          </div>
          
          {/* 規格 (Specifications) - compact display */}
          {(car.specs?.['規格'] || carSpecs['規格']) && (
            <div className="text-xs text-stone-600 dark:text-neutral-400 bg-stone-50 dark:bg-neutral-800 px-2 py-1 rounded">
              <span className="font-medium">規格:</span> {car.specs?.['規格'] || carSpecs['規格']}
            </div>
          )}
          
          {/* Summary if no detailed specs */}
          {Object.keys(carSpecs).length === 0 && car.summary && (
            <p className="text-xs text-stone-600 dark:text-neutral-400 line-clamp-2">
              {car.summary}
            </p>
          )}
          
          {/* Key Specifications - Condensed */}
          {Object.keys(carSpecs).length > 0 && (
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
              {carSpecs.engine && (
                <div className="flex items-center gap-1 text-stone-600 dark:text-neutral-400">
                  <span className="font-medium">Engine:</span>
                  <span className="truncate">{carSpecs.engine}</span>
                </div>
              )}
              {carSpecs.fuel && (
                <div className="flex items-center gap-1 text-stone-600 dark:text-neutral-400">
                  <span className="font-medium">Fuel:</span>
                  <span className="truncate">{carSpecs.fuel}</span>
                </div>
              )}
              {carSpecs.mileage && (
                <div className="flex items-center gap-1 text-stone-600 dark:text-neutral-400">
                  <span className="font-medium">Mileage:</span>
                  <span className="truncate">{carSpecs.mileage}</span>
                </div>
              )}
              {carSpecs.transmission && (
                <div className="flex items-center gap-1 text-stone-600 dark:text-neutral-400">
                  <span className="font-medium">Trans:</span>
                  <span className="truncate">{carSpecs.transmission}</span>
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Simplified Footer */}
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation()
              window.open(car.url, '_blank')
            }}
            className="flex items-center gap-1 text-xs hover:bg-stone-50 hover:text-stone-700 hover:border-stone-300 dark:hover:bg-neutral-800 dark:hover:text-neutral-300 transition-colors"
          >
            <ExternalLink className="w-3 h-3" />
            View on 28car
          </Button>
        </div>
      </div>
    </Card>
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
    <div className="max-w-7xl mx-auto px-4 lg:px-6">
      {/* Enhanced Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between py-6 sm:py-8 gap-4 sm:gap-0">
        <div className="space-y-2">
          {cars.length > 0 && (
            <p className="text-sm text-stone-500 dark:text-neutral-500">
              {cars.length} cars available
            </p>
          )}
        </div>
        
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="flex items-center gap-2 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 dark:hover:bg-blue-900/20 dark:hover:text-blue-400 transition-colors self-start sm:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>
      
      {/* Debug info */}
      {debugInfo?.source === 'mock' && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4 rounded-lg mb-8">
          <p className="text-sm text-amber-700 dark:text-amber-300 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Using mock data - car scraping may be in progress
          </p>
        </div>
      )}
      
      {/* Error state */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 rounded-lg mb-8">
          <p className="text-red-700 dark:text-red-300 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Error loading cars: {error.message}
          </p>
        </div>
      )}
      
      {/* Loading state */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6 lg:gap-8">
          {[...Array(8)].map((_, i) => (
            <LoadingSkeleton key={i} />
          ))}
        </div>
      )}
      
      {/* Enhanced Cars grid */}
      {!isLoading && cars.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6 lg:gap-8">
          {cars.map((car) => (
            <CarCard key={car.id} car={car} onCarClick={handleCarClick} />
          ))}
        </div>
      )}
      
      {/* Enhanced No cars message */}
      {!isLoading && cars.length === 0 && !error && (
        <div className="text-center py-16">
          <div className="max-w-md mx-auto">
            <Car className="w-20 h-20 text-stone-400 dark:text-neutral-500 mx-auto mb-6" />
            <h3 className="text-xl font-semibold text-stone-700 dark:text-neutral-300 mb-3">
              No cars found
            </h3>
            <p className="text-stone-500 dark:text-neutral-400 mb-6">
              We're currently updating our car listings. Check back soon for the latest vehicles.
            </p>
            <Button
              variant="outline"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-2 mx-auto"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              Check Again
            </Button>
          </div>
        </div>
      )}
      
      {/* Load more trigger */}
      {hasNextPage && (
        <div ref={ref} className="py-12">
          {isFetchingNextPage && (
            <div className="flex justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-400"></div>
            </div>
          )}
        </div>
      )}
      
      {/* Enhanced Stats */}
      {cars.length > 0 && (
        <div className="text-center py-8 border-t border-stone-200 dark:border-neutral-700 mt-8">
          <p className="text-sm text-stone-500 dark:text-neutral-400">
            Showing {cars.length} cars
            {debugInfo?.source === 'database' && ' from database'}
          </p>
        </div>
      )}

      {/* Car Bottom Sheet */}
      <CarBottomSheet
        car={selectedCar}
        open={isBottomSheetOpen}
        onOpenChange={setIsBottomSheetOpen}
      />
    </div>
  )
}