"use client"

import { useState, useEffect, useRef } from "react"
import Header from "@/components/header"
import SignalsList from "@/components/signals-list"
import AeHospitalsList from "@/components/ae-hospitals-list"
import JourneyTimeList from "@/components/journey-time-list"
import WeatherDashboard from "@/components/weather-dashboard"
import { Button } from "@/components/ui/button"
import { RefreshCw, ChevronLeft, ChevronRight } from "lucide-react"
import type { PerplexityArticle } from "@/lib/types"

const CATEGORIES = [
  { value: "road", label: "Road" },
  { value: "weather", label: "Weather" },
  { value: "ae", label: "A&E" },
]

export default function SignalsPage() {
  const [articles, setArticles] = useState<PerplexityArticle[]>([])
  const [loading, setLoading] = useState(true)
  const [categoryFilter, setCategoryFilter] = useState("road")
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)


  useEffect(() => {
    setPage(0)
    setArticles([])
    if (categoryFilter !== "ae") {
      loadArticles(0)
    }
  }, [categoryFilter])

  useEffect(() => {
    if (page > 0) {
      loadArticles(page)
    }
  }, [page])

  useEffect(() => {
    // Auto-refresh every 2 minutes
    const interval = setInterval(() => {
      handleRefresh()
    }, 2 * 60 * 1000)

    return () => clearInterval(interval)
  }, [categoryFilter])

  const loadArticles = async (pageNum: number) => {
    // No articles to load since we removed government feeds from this page
    setLoading(false)
    setArticles([])
    setHasMore(false)
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    // Refresh logic will be handled by individual components
    setRefreshing(false)
  }

  const handleLoadMore = () => {
    setPage(prev => prev + 1)
  }

  const checkScrollButtons = () => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current
      setCanScrollLeft(scrollLeft > 0)
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1)
    }
  }

  useEffect(() => {
    checkScrollButtons()
    window.addEventListener('resize', checkScrollButtons)
    return () => window.removeEventListener('resize', checkScrollButtons)
  }, [])

  const scrollCategories = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = 200
      const currentScroll = scrollContainerRef.current.scrollLeft
      const targetScroll = direction === 'left' 
        ? currentScroll - scrollAmount 
        : currentScroll + scrollAmount
      
      scrollContainerRef.current.scrollTo({
        left: targetScroll,
        behavior: 'smooth'
      })
    }
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header />

      <main className="flex-1 pb-4 pt-16">
        <div className="max-w-7xl mx-auto px-4 py-6">
          {/* Modern header with category filters and refresh button */}
          <div className="flex items-center justify-between mb-8 gap-4">
            {/* Category filters container */}
            <div className="relative flex-1 min-w-0">
              {/* Left scroll button */}
              {canScrollLeft && (
                <div className="absolute left-0 top-0 bottom-0 z-10 flex items-center">
                  <div className="bg-gradient-to-r from-background to-transparent pr-3">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
                      onClick={() => scrollCategories('left')}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
              
              {/* Scrollable category container */}
              <div 
                ref={scrollContainerRef}
                className="flex gap-2 overflow-x-auto scrollbar-none"
                onScroll={checkScrollButtons}
              >
                {CATEGORIES.map((cat) => (
                  <Button
                    key={cat.value}
                    variant="ghost"
                    size="sm"
                    onClick={() => setCategoryFilter(cat.value)}
                    className={`whitespace-nowrap flex-shrink-0 h-9 px-4 rounded-full transition-all duration-200 ${
                      categoryFilter === cat.value
                        ? "bg-neutral-900 text-neutral-50 dark:bg-neutral-100 dark:text-neutral-900 shadow-sm"
                        : "text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:text-neutral-100 dark:hover:bg-neutral-800"
                    }`}
                  >
                    {cat.label}
                  </Button>
                ))}
              </div>
              
              {/* Right scroll button */}
              {canScrollRight && (
                <div className="absolute right-0 top-0 bottom-0 z-10 flex items-center">
                  <div className="bg-gradient-to-l from-background to-transparent pl-3">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
                      onClick={() => scrollCategories('right')}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
            
            {/* Refresh button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRefresh}
              disabled={refreshing}
              className="h-9 w-9 flex-shrink-0 text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all duration-200"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          {categoryFilter === "ae" ? (
            // Render A&E hospitals with enhanced component
            <AeHospitalsList 
              showFilters={true}
              autoRefresh={true}
              refreshInterval={5 * 60 * 1000}
            />
          ) : categoryFilter === "road" ? (
            // Render journey time cards for road category
            <JourneyTimeList
              showFilters={true}
              autoRefresh={true}
              refreshInterval={2 * 60 * 1000}
            />
          ) : categoryFilter === "weather" ? (
            // Render weather dashboard for weather category
            <WeatherDashboard />
          ) : null}
        </div>
      </main>
    </div>
  )
}