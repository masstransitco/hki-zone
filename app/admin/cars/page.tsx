"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, Filter, RefreshCw, Car, Play, Clock, AlertCircle, CheckCircle, ExternalLink } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useLanguage } from "@/components/language-provider"

interface CarListing {
  id: string
  title: string
  make?: string
  model?: string
  year?: string
  price?: string
  content?: string
  summary?: string
  url: string
  source: string
  imageUrl?: string
  images?: string[]
  category: string
  publishedAt: string
  createdAt: string
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

export default function CarsManagementPage() {
  const { t } = useLanguage()
  const [cars, setCars] = useState<CarListing[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [sortBy, setSortBy] = useState("newest")
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [selectedCar, setSelectedCar] = useState<CarListing | null>(null)
  const [scraperStatus, setScraperStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle')
  const [scraperMessage, setScraperMessage] = useState('')
  const [lastScraperRun, setLastScraperRun] = useState<string | null>(null)
  const [totalCarsCount, setTotalCarsCount] = useState(0)
  const [stats, setStats] = useState({
    total: 0,
    recent24h: 0,
    priceRanges: { 
      under200k: 0,
      range200to300k: 0,
      range300to500k: 0,
      over500k: 0
    }
  })

  useEffect(() => {
    loadCars()
    checkLastScraperRun()
    loadStats()
  }, [page, sortBy])

  useEffect(() => {
    loadStats()
  }, [])

  const loadCars = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "20",
        category: "cars"
      })
      
      if (searchQuery) {
        params.set("search", searchQuery)
      }

      const response = await fetch(`/api/articles?${params}`)
      if (!response.ok) throw new Error("Failed to fetch cars")
      
      const data: CarsResponse = await response.json()
      
      if (page === 0) {
        setCars(data.articles)
      } else {
        setCars(prev => [...prev, ...data.articles])
      }
      
      setHasMore(data.hasMore)
    } catch (error) {
      console.error("Error loading cars:", error)
    } finally {
      setLoading(false)
    }
  }

  const checkLastScraperRun = async () => {
    try {
      const response = await fetch('/api/admin/scraper-status?type=cars')
      if (response.ok) {
        const data = await response.json()
        setLastScraperRun(data.lastRun)
      }
    } catch (error) {
      console.error("Error checking scraper status:", error)
    }
  }

  const loadStats = async () => {
    try {
      const response = await fetch('/api/admin/cars/stats')
      if (response.ok) {
        const data = await response.json()
        setStats(data)
      }
    } catch (error) {
      console.error("Error loading car stats:", error)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(0)
    loadCars()
  }

  const handleRefresh = () => {
    setPage(0)
    setSelectedCar(null)
    loadCars()
    loadStats()
  }

  const handleLoadMore = () => {
    setPage(prev => prev + 1)
  }

  const triggerScraper = async () => {
    setScraperStatus('running')
    setScraperMessage('Starting 28car scraper...')
    
    try {
      const response = await fetch('/api/admin/trigger-scraper', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type: 'cars' })
      })
      
      const data = await response.json()
      
      if (response.ok) {
        setScraperStatus('success')
        setScraperMessage(data.message || 'Car scraper triggered successfully')
        setTimeout(() => {
          handleRefresh()
          checkLastScraperRun()
          loadStats()
        }, 2000)
      } else {
        setScraperStatus('error')
        setScraperMessage(data.error || 'Failed to trigger scraper')
      }
    } catch (error) {
      setScraperStatus('error')
      setScraperMessage('Network error occurred')
    }
    
    // Reset status after 5 seconds
    setTimeout(() => {
      setScraperStatus('idle')
      setScraperMessage('')
    }, 5000)
  }

  const parseCarSpecs = (content: string) => {
    const specs: Record<string, string> = {}
    if (!content) return specs
    
    // Split by ", " but first protect numbers with commas
    let tempContent = content
    
    // Find all instances of numbers with commas (prices, mileage, etc.)
    const numberWithCommasRegex = /(\d+,\d+)/g
    const numbersWithCommas = tempContent.match(numberWithCommasRegex) || []
    
    // Replace each number with commas with a placeholder
    numbersWithCommas.forEach((num, index) => {
      tempContent = tempContent.replace(num, `###NUMBER_${index}###`)
    })
    
    // Now split by comma
    const pairs = tempContent.split(',').map(pair => pair.trim())
    
    for (const pair of pairs) {
      const colonIndex = pair.indexOf(':')
      if (colonIndex === -1) continue
      
      const key = pair.substring(0, colonIndex).trim()
      let value = pair.substring(colonIndex + 1).trim()
      
      // Restore numbers with commas
      numbersWithCommas.forEach((num, index) => {
        value = value.replace(`###NUMBER_${index}###`, num)
      })
      
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
      }
    }
    
    return specs
  }

  const formatPrice = (price: string) => {
    if (!price) return 'N/A'
    // Handle different price formats and preserve commas
    return price
      .replace(/HKD\$/, 'HK$')
      .replace(/減價.*$/, '')
      .trim()
  }

  const totalCars = stats.total
  const recentCars = stats.recent24h

  return (
    <div className="flex flex-1 flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Car Listings Management</h1>
          <p className="text-muted-foreground">Manage car listings and scraper operations</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleRefresh} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Cars</CardTitle>
            <Car className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCars}</div>
            <p className="text-xs text-muted-foreground">
              Currently in database
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recent (24h)</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{recentCars}</div>
            <p className="text-xs text-muted-foreground">
              Added in last 24h
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Under HK$200k</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.priceRanges.under200k}</div>
            <p className="text-xs text-muted-foreground">
              Budget cars
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">HK$200k-300k</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.priceRanges.range200to300k}</div>
            <p className="text-xs text-muted-foreground">
              Mid-range cars
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Additional Price Range Stats */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">HK$300k-500k</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.priceRanges.range300to500k}</div>
            <p className="text-xs text-muted-foreground">
              Premium cars
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">HK$500k+</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.priceRanges.over500k}</div>
            <p className="text-xs text-muted-foreground">
              Luxury cars
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Scraper Control */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Play className="h-5 w-5" />
            28car Scraper Control
          </CardTitle>
          <CardDescription>
            Manually trigger the car scraper to fetch latest listings from 28car.com
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Scraper Status</p>
                <p className="text-sm text-muted-foreground">
                  {lastScraperRun ? `Last run: ${new Date(lastScraperRun).toLocaleString()}` : 'Never run'}
                </p>
              </div>
              <Button 
                onClick={triggerScraper} 
                disabled={scraperStatus === 'running'}
                className="flex items-center gap-2"
              >
                {scraperStatus === 'running' ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Running...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4" />
                    Trigger Scraper
                  </>
                )}
              </Button>
            </div>
            
            {scraperMessage && (
              <Alert className={scraperStatus === 'error' ? 'border-red-200' : scraperStatus === 'success' ? 'border-green-200' : ''}>
                {scraperStatus === 'error' ? (
                  <AlertCircle className="h-4 w-4" />
                ) : scraperStatus === 'success' ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                <AlertDescription>{scraperMessage}</AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Car Listings</CardTitle>
          <CardDescription>
            Browse and manage car listings from 28car.com
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            {/* Search Bar */}
            <form onSubmit={handleSearch} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search cars by make, model, or title..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button type="submit" variant="outline" size="icon">
                <Search className="h-4 w-4" />
              </Button>
            </form>
            
            {/* Filters */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest First</SelectItem>
                  <SelectItem value="oldest">Oldest First</SelectItem>
                  <SelectItem value="price-low">Price: Low to High</SelectItem>
                  <SelectItem value="price-high">Price: High to Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Car Listings Grid */}
      <Card>
        <CardHeader>
          <CardTitle>Current Listings ({totalCars})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="border rounded-lg p-4">
                  <div className="aspect-video bg-muted rounded-lg animate-pulse mb-3" />
                  <div className="space-y-2">
                    <div className="h-4 bg-muted rounded animate-pulse" />
                    <div className="h-3 bg-muted rounded animate-pulse w-2/3" />
                    <div className="h-3 bg-muted rounded animate-pulse w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : cars.length === 0 ? (
            <div className="text-center py-8">
              <Car className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">No cars found</h3>
              <p className="text-muted-foreground mb-4">
                Try running the scraper to fetch some car listings
              </p>
              <Button onClick={triggerScraper} disabled={scraperStatus === 'running'}>
                <Play className="h-4 w-4 mr-2" />
                Run Scraper
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {cars.map((car) => {
                const specs = parseCarSpecs(car.content || '')
                const priceFromContent = specs.price || car.price || ''
                const isOnSale = priceFromContent.includes('減價')
                
                return (
                  <div
                    key={car.id}
                    className={`border rounded-lg p-4 cursor-pointer transition-colors hover:bg-muted/50 ${
                      selectedCar?.id === car.id ? 'ring-2 ring-primary' : ''
                    }`}
                    onClick={() => setSelectedCar(car)}
                  >
                    <div className="aspect-video bg-muted rounded-lg mb-3 relative overflow-hidden">
                      {car.imageUrl ? (
                        <img
                          src={car.imageUrl}
                          alt={car.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Car className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}
                      {isOnSale && (
                        <Badge className="absolute top-2 left-2 bg-stone-600 text-white">
                          Price Reduced
                        </Badge>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <h3 className="font-medium line-clamp-1">{car.title}</h3>
                      <p className="text-sm text-muted-foreground">
                        {formatPrice(priceFromContent)}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{specs.year || 'N/A'}</span>
                        <span>•</span>
                        <span>{new Date(car.createdAt || car.publishedAt).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            window.open(car.url, '_blank')
                          }}
                        >
                          <ExternalLink className="h-3 w-3 mr-1" />
                          View on 28car
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          
          {hasMore && cars.length > 0 && (
            <div className="flex justify-center mt-6">
              <Button onClick={handleLoadMore} variant="outline" disabled={loading}>
                {loading ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : null}
                Load More
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Selected Car Details */}
      {selectedCar && (
        <Card>
          <CardHeader>
            <CardTitle>Car Details</CardTitle>
            <CardDescription>
              Detailed information for selected car listing
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <h3 className="font-medium mb-2">Basic Information</h3>
                <div className="space-y-2 text-sm">
                  <div><span className="font-medium">Title:</span> {selectedCar.title}</div>
                  <div><span className="font-medium">Source:</span> {selectedCar.source}</div>
                  <div><span className="font-medium">Published:</span> {new Date(selectedCar.publishedAt).toLocaleString()}</div>
                  <div><span className="font-medium">Added:</span> {new Date(selectedCar.createdAt || selectedCar.publishedAt).toLocaleString()}</div>
                </div>
              </div>
              
              <div>
                <h3 className="font-medium mb-2">Car Specifications</h3>
                <div className="space-y-2 text-sm">
                  {selectedCar.content && Object.entries(parseCarSpecs(selectedCar.content)).map(([key, value]) => (
                    <div key={key}>
                      <span className="font-medium capitalize">{key}:</span> {value}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            {selectedCar.summary && (
              <div className="mt-4">
                <h3 className="font-medium mb-2">Summary</h3>
                <p className="text-sm text-muted-foreground">{selectedCar.summary}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}