"use client"

import { useState, useEffect, useRef } from "react"
import Header from "@/components/header"
import PerplexityPublicList from "@/components/perplexity-public-list"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { RefreshCw, ChevronLeft, ChevronRight } from "lucide-react"
import type { PerplexityArticle } from "@/lib/types"

const CATEGORIES = [
  { value: "all", label: "All" },
  { value: "politics", label: "Politics" },
  { value: "business", label: "Business" },
  { value: "tech", label: "Technology" },
  { value: "health", label: "Health" },
  { value: "lifestyle", label: "Lifestyle" },
  { value: "entertainment", label: "Entertainment" },
]

export default function PerplexityPage() {
  const [articles, setArticles] = useState<PerplexityArticle[]>([])
  const [loading, setLoading] = useState(true)
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  useEffect(() => {
    setPage(0)
    setArticles([])
    loadArticles(0)
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
    try {
      if (pageNum === 0) setLoading(true)
      
      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: "20"
      })
      
      if (categoryFilter !== "all") params.set("category", categoryFilter)
      
      const response = await fetch(`/api/perplexity?${params.toString()}`)
      if (!response.ok) throw new Error('Failed to fetch articles')
      
      const data = await response.json()
      
      if (pageNum === 0) {
        setArticles(data.articles || [])
      } else {
        setArticles(prev => [...prev, ...(data.articles || [])])
      }
      
      setHasMore(data.hasMore || false)
    } catch (error) {
      console.error('Error loading articles:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadArticles(0)
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

      <main className="flex-1 pb-4">
        <div className="container mx-auto px-4 py-8">
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Signals</CardTitle>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleRefresh}
                  disabled={refreshing}
                >
                  <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {/* Horizontal scrollable category pills */}
              <div className="relative">
                {/* Left scroll button */}
                {canScrollLeft && (
                  <div className="absolute left-0 top-0 bottom-0 z-10 flex items-center">
                    <div className="bg-gradient-to-r from-white dark:from-gray-900 to-transparent pr-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => scrollCategories('left')}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
                
                {/* Scrollable container */}
                <div 
                  ref={scrollContainerRef}
                  className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-700"
                  onScroll={checkScrollButtons}
                >
                  {CATEGORIES.map((cat) => (
                    <Button
                      key={cat.value}
                      variant={categoryFilter === cat.value ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCategoryFilter(cat.value)}
                      className="whitespace-nowrap flex-shrink-0"
                    >
                      {cat.label}
                    </Button>
                  ))}
                </div>
                
                {/* Right scroll button */}
                {canScrollRight && (
                  <div className="absolute right-0 top-0 bottom-0 z-10 flex items-center">
                    <div className="bg-gradient-to-l from-white dark:from-gray-900 to-transparent pl-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => scrollCategories('right')}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <PerplexityPublicList
            articles={articles}
            loading={loading}
            onLoadMore={handleLoadMore}
            hasMore={hasMore}
            viewMode="list"
          />
        </div>
      </main>
    </div>
  )
}