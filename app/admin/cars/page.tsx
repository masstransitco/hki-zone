"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Search, RefreshCw, Car, Play, Clock, AlertCircle, CheckCircle,
  ExternalLink, Brain, Zap, TrendingUp, DollarSign, Eye, Star,
  Flame, User, Wallet, Gauge, BarChart3, ChevronRight, Calendar,
  Timer, History, ToggleLeft, ToggleRight
} from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"

interface CarListing {
  id: string
  title: string
  url: string
  source: string
  image_url?: string
  created_at: string
  price_hkd?: number
  view_count?: number
  is_first_owner?: boolean
  value_score?: number
  description_text?: string
  ai_summary?: string
  content?: string
}

interface FeedInfo {
  id: string
  title: string
  description: string
  count: number
}

interface Stats {
  total: number
  recent24h: number
  recent7d: number
  priceRanges: {
    budget: number
    midLow: number
    mid: number
    premium: number
    luxury: number
  }
  qualityMetrics: {
    firstOwner: number
    highEngagement: number
    enriched: number
  }
  averages: {
    views: number
    price: number
  }
  topMakes: Array<{ make: string; count: number; avg_price: number }>
  feeds: Record<string, number>
  lastListingAt: string | null
  statsRefreshedAt: string | null
}

interface RefreshScheduleItem {
  view_name: string
  display_name: string
  description: string
  refresh_interval_hours: number
  cron_expression: string
  last_refreshed_at: string | null
  next_refresh_at: string | null
  is_enabled: boolean
  avg_refresh_duration_ms: number | null
  refresh_count: number
  last_error: string | null
  is_overdue: boolean
  minutes_until_next: number | null
}

interface RefreshLog {
  view_name: string
  started_at: string
  completed_at: string | null
  duration_ms: number | null
  success: boolean
  error_message: string | null
  triggered_by: string
}

interface RefreshScheduleData {
  schedules: RefreshScheduleItem[]
  recent_logs: RefreshLog[]
  fetched_at: string
}

const FEED_ICONS: Record<string, React.ReactNode> = {
  hot_deals: <Flame className="h-4 w-4" />,
  first_owner: <User className="h-4 w-4" />,
  budget: <Wallet className="h-4 w-4" />,
  enthusiast: <Gauge className="h-4 w-4" />,
  trending: <TrendingUp className="h-4 w-4" />,
  new_today: <Clock className="h-4 w-4" />,
}

export default function CarsManagementPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [feeds, setFeeds] = useState<FeedInfo[]>([])
  const [activeFeed, setActiveFeed] = useState<string>('hot_deals')
  const [feedListings, setFeedListings] = useState<CarListing[]>([])
  const [feedLoading, setFeedLoading] = useState(false)
  const [feedTotal, setFeedTotal] = useState(0)
  const [feedOffset, setFeedOffset] = useState(0)

  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCar, setSelectedCar] = useState<CarListing | null>(null)

  const [scraperStatus, setScraperStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle')
  const [scraperMessage, setScraperMessage] = useState('')
  const [lastScraperRun, setLastScraperRun] = useState<string | null>(null)

  const [enrichmentStatus, setEnrichmentStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle')
  const [enrichmentMessage, setEnrichmentMessage] = useState('')
  const [enrichmentStats, setEnrichmentStats] = useState({
    totalCars: 0,
    enrichedCars: 0,
    unenrichedCars: 0,
    isConfigured: false
  })

  const [refreshingViews, setRefreshingViews] = useState(false)
  const [refreshSchedule, setRefreshSchedule] = useState<RefreshScheduleData | null>(null)
  const [refreshingView, setRefreshingView] = useState<string | null>(null)
  const [showSchedulePanel, setShowSchedulePanel] = useState(false)

  const loadStats = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/cars/stats')
      if (response.ok) {
        const data = await response.json()
        setStats(data)
      }
    } catch (error) {
      console.error("Error loading car stats:", error)
    }
  }, [])

  const loadFeeds = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/cars/feeds')
      if (response.ok) {
        const data = await response.json()
        setFeeds(data.feeds)
      }
    } catch (error) {
      console.error("Error loading feeds:", error)
    }
  }, [])

  const loadFeedListings = useCallback(async (feed: string, offset = 0) => {
    setFeedLoading(true)
    try {
      const response = await fetch(`/api/admin/cars/feeds?feed=${feed}&limit=20&offset=${offset}`)
      if (response.ok) {
        const data = await response.json()
        if (offset === 0) {
          setFeedListings(data.listings)
        } else {
          setFeedListings(prev => [...prev, ...data.listings])
        }
        setFeedTotal(data.total)
        setFeedOffset(offset)
      }
    } catch (error) {
      console.error("Error loading feed listings:", error)
    } finally {
      setFeedLoading(false)
    }
  }, [])

  const loadEnrichmentStats = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/cars/enrich')
      if (response.ok) {
        const data = await response.json()
        setEnrichmentStats(data)
      }
    } catch (error) {
      console.error("Error loading enrichment stats:", error)
    }
  }, [])

  const checkLastScraperRun = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/scraper-status?type=cars')
      if (response.ok) {
        const data = await response.json()
        setLastScraperRun(data.lastRun)
      }
    } catch (error) {
      console.error("Error checking scraper status:", error)
    }
  }, [])

  const loadRefreshSchedule = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/cars/refresh-schedule')
      if (response.ok) {
        const data = await response.json()
        setRefreshSchedule(data)
      }
    } catch (error) {
      console.error("Error loading refresh schedule:", error)
    }
  }, [])

  const refreshSingleView = async (viewName: string) => {
    setRefreshingView(viewName)
    try {
      const response = await fetch('/api/admin/cars/refresh-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ view_name: viewName })
      })
      if (response.ok) {
        await loadRefreshSchedule()
        await handleRefresh()
      }
    } catch (error) {
      console.error("Error refreshing view:", error)
    } finally {
      setRefreshingView(null)
    }
  }

  const toggleScheduleEnabled = async (viewName: string, enabled: boolean) => {
    try {
      const response = await fetch('/api/admin/cars/refresh-schedule', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ view_name: viewName, is_enabled: enabled })
      })
      if (response.ok) {
        await loadRefreshSchedule()
      }
    } catch (error) {
      console.error("Error toggling schedule:", error)
    }
  }

  useEffect(() => {
    const init = async () => {
      setLoading(true)
      await Promise.all([
        loadStats(),
        loadFeeds(),
        loadEnrichmentStats(),
        checkLastScraperRun(),
        loadRefreshSchedule()
      ])
      setLoading(false)
    }
    init()
  }, [loadStats, loadFeeds, loadEnrichmentStats, checkLastScraperRun, loadRefreshSchedule])

  useEffect(() => {
    loadFeedListings(activeFeed, 0)
  }, [activeFeed, loadFeedListings])

  const handleRefresh = async () => {
    setLoading(true)
    await Promise.all([
      loadStats(),
      loadFeeds(),
      loadEnrichmentStats(),
      checkLastScraperRun(),
      loadRefreshSchedule()
    ])
    loadFeedListings(activeFeed, 0)
    setLoading(false)
  }

  const refreshMaterializedViews = async () => {
    setRefreshingViews(true)
    try {
      const response = await fetch('/api/admin/cars/feeds', { method: 'POST' })
      if (response.ok) {
        await handleRefresh()
      }
    } catch (error) {
      console.error("Error refreshing views:", error)
    } finally {
      setRefreshingViews(false)
    }
  }

  const triggerScraper = async () => {
    setScraperStatus('running')
    setScraperMessage('Starting 28car scraper...')

    try {
      const response = await fetch('/api/admin/trigger-scraper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'cars' })
      })

      const data = await response.json()

      if (response.ok) {
        setScraperStatus('success')
        setScraperMessage(data.message || 'Car scraper triggered successfully')
        setTimeout(() => handleRefresh(), 2000)
      } else {
        setScraperStatus('error')
        setScraperMessage(data.error || 'Failed to trigger scraper')
      }
    } catch {
      setScraperStatus('error')
      setScraperMessage('Network error occurred')
    }

    setTimeout(() => {
      setScraperStatus('idle')
      setScraperMessage('')
    }, 5000)
  }

  const triggerEnrichment = async () => {
    if (!enrichmentStats.isConfigured) {
      setEnrichmentStatus('error')
      setEnrichmentMessage('Perplexity API not configured')
      return
    }

    setEnrichmentStatus('running')
    setEnrichmentMessage('Starting car enrichment...')

    try {
      const response = await fetch('/api/admin/cars/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enrichAll: true })
      })

      const data = await response.json()

      if (response.ok) {
        setEnrichmentStatus('success')
        setEnrichmentMessage(data.message || 'Enrichment completed')
        setTimeout(() => handleRefresh(), 2000)
      } else {
        setEnrichmentStatus('error')
        setEnrichmentMessage(data.error || 'Enrichment failed')
      }
    } catch {
      setEnrichmentStatus('error')
      setEnrichmentMessage('Network error occurred')
    }

    setTimeout(() => {
      setEnrichmentStatus('idle')
      setEnrichmentMessage('')
    }, 8000)
  }

  const formatPrice = (price?: number) => {
    if (!price) return 'N/A'
    return `HK$${price.toLocaleString()}`
  }

  const formatNumber = (num?: number) => {
    if (!num) return '0'
    return num.toLocaleString()
  }

  const getValueScoreColor = (score?: number) => {
    if (!score) return 'bg-gray-200'
    if (score >= 70) return 'bg-green-500'
    if (score >= 50) return 'bg-yellow-500'
    if (score >= 30) return 'bg-orange-500'
    return 'bg-red-500'
  }

  if (loading && !stats) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Car Listings Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor and manage 28car listings with smart feeds
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={refreshMaterializedViews}
            variant="outline"
            size="sm"
            disabled={refreshingViews}
          >
            {refreshingViews ? (
              <RefreshCw className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <BarChart3 className="h-4 w-4 mr-1" />
            )}
            Refresh Views
          </Button>
          <Button onClick={handleRefresh} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Key Metrics Row */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Listings</CardTitle>
            <Car className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(stats?.total)}</div>
            <p className="text-xs text-muted-foreground">
              Avg price: {formatPrice(stats?.averages.price)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">New Today</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(stats?.recent24h)}</div>
            <p className="text-xs text-muted-foreground">
              Last 7 days: {formatNumber(stats?.recent7d)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">First Owner</CardTitle>
            <Star className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(stats?.qualityMetrics.firstOwner)}</div>
            <p className="text-xs text-muted-foreground">
              Premium single-owner cars
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">High Engagement</CardTitle>
            <Eye className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(stats?.qualityMetrics.highEngagement)}</div>
            <p className="text-xs text-muted-foreground">
              Avg views: {stats?.averages.views.toFixed(0)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">AI Enriched</CardTitle>
            <Brain className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(stats?.qualityMetrics.enriched)}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.total ? ((stats.qualityMetrics.enriched / stats.total) * 100).toFixed(1) : 0}% coverage
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Price Distribution & Top Makes */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Price Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Price Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { label: 'Budget (<50K)', value: stats?.priceRanges.budget, color: 'bg-green-500' },
                { label: 'Mid-Low (50-100K)', value: stats?.priceRanges.midLow, color: 'bg-blue-500' },
                { label: 'Mid (100-200K)', value: stats?.priceRanges.mid, color: 'bg-yellow-500' },
                { label: 'Premium (200-500K)', value: stats?.priceRanges.premium, color: 'bg-orange-500' },
                { label: 'Luxury (>500K)', value: stats?.priceRanges.luxury, color: 'bg-red-500' },
              ].map((range) => {
                const percentage = stats?.total ? ((range.value || 0) / stats.total) * 100 : 0
                return (
                  <div key={range.label} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>{range.label}</span>
                      <span className="font-medium">{formatNumber(range.value)}</span>
                    </div>
                    <Progress value={percentage} className="h-2" />
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Top Makes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Top Makes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats?.topMakes?.slice(0, 10).map((make, index) => (
                <div key={make.make} className="flex items-center justify-between py-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground w-5">{index + 1}.</span>
                    <span className="font-medium">{make.make}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-muted-foreground">
                      {formatPrice(make.avg_price)} avg
                    </span>
                    <Badge variant="secondary">{make.count}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Feed Tabs */}
      <Card>
        <CardHeader>
          <CardTitle>Smart Feeds</CardTitle>
          <CardDescription>
            Curated listings based on different strategies
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeFeed} onValueChange={(v) => { setActiveFeed(v); setFeedOffset(0); }}>
            <TabsList className="grid w-full grid-cols-3 lg:grid-cols-6">
              {feeds.map((feed) => (
                <TabsTrigger key={feed.id} value={feed.id} className="flex items-center gap-1">
                  {FEED_ICONS[feed.id]}
                  <span className="hidden sm:inline">{feed.title}</span>
                  <Badge variant="secondary" className="ml-1 text-xs">{feed.count}</Badge>
                </TabsTrigger>
              ))}
            </TabsList>

            {feeds.map((feed) => (
              <TabsContent key={feed.id} value={feed.id} className="mt-4">
                <div className="mb-4">
                  <p className="text-sm text-muted-foreground">{feed.description}</p>
                </div>

                {feedLoading && feedListings.length === 0 ? (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    {[...Array(8)].map((_, i) => (
                      <div key={i} className="border rounded-lg p-3">
                        <div className="aspect-video bg-muted rounded animate-pulse mb-2" />
                        <div className="h-4 bg-muted rounded animate-pulse mb-2" />
                        <div className="h-3 bg-muted rounded animate-pulse w-2/3" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                      {feedListings.map((car) => (
                        <div
                          key={car.id}
                          className={`border rounded-lg overflow-hidden cursor-pointer transition-all hover:shadow-md ${
                            selectedCar?.id === car.id ? 'ring-2 ring-primary' : ''
                          }`}
                          onClick={() => setSelectedCar(car)}
                        >
                          <div className="aspect-video bg-muted relative">
                            {car.image_url ? (
                              <img
                                src={car.image_url}
                                alt={car.title}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Car className="h-8 w-8 text-muted-foreground" />
                              </div>
                            )}
                            {car.is_first_owner && (
                              <Badge className="absolute top-2 left-2 bg-yellow-500">
                                First Owner
                              </Badge>
                            )}
                            {car.value_score && car.value_score >= 60 && (
                              <Badge className="absolute top-2 right-2 bg-green-600">
                                Score: {car.value_score}
                              </Badge>
                            )}
                          </div>

                          <div className="p-3 space-y-2">
                            <h3 className="font-medium text-sm line-clamp-1">{car.title}</h3>
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-primary">
                                {formatPrice(car.price_hkd)}
                              </span>
                              {car.view_count && (
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Eye className="h-3 w-3" />
                                  {car.view_count}
                                </span>
                              )}
                            </div>
                            {car.value_score && (
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full ${getValueScoreColor(car.value_score)}`}
                                    style={{ width: `${car.value_score}%` }}
                                  />
                                </div>
                                <span className="text-xs text-muted-foreground">{car.value_score}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {feedListings.length < feedTotal && (
                      <div className="flex justify-center mt-6">
                        <Button
                          onClick={() => loadFeedListings(activeFeed, feedOffset + 20)}
                          variant="outline"
                          disabled={feedLoading}
                        >
                          {feedLoading && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
                          Load More ({feedListings.length} of {feedTotal})
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      {/* Selected Car Details */}
      {selectedCar && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Listing Details</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(selectedCar.url, '_blank')}
              >
                <ExternalLink className="h-4 w-4 mr-1" />
                View on 28car
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                {selectedCar.image_url && (
                  <img
                    src={selectedCar.image_url}
                    alt={selectedCar.title}
                    className="w-full rounded-lg mb-4"
                  />
                )}
                <h3 className="font-bold text-lg mb-2">{selectedCar.title}</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Price:</span>
                    <span className="font-bold">{formatPrice(selectedCar.price_hkd)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Views:</span>
                    <span>{formatNumber(selectedCar.view_count)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">First Owner:</span>
                    <span>{selectedCar.is_first_owner ? 'Yes' : 'No'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Value Score:</span>
                    <span>{selectedCar.value_score || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Listed:</span>
                    <span>{new Date(selectedCar.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                {selectedCar.description_text && (
                  <div>
                    <h4 className="font-medium mb-2">Description</h4>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {selectedCar.description_text}
                    </p>
                  </div>
                )}

                {selectedCar.ai_summary && (
                  <div>
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <Brain className="h-4 w-4 text-purple-500" />
                      AI Insights
                    </h4>
                    <div className="text-sm bg-purple-50 dark:bg-purple-900/20 p-3 rounded-lg whitespace-pre-wrap">
                      {selectedCar.ai_summary}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Operations Panel */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Scraper Control */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Play className="h-5 w-5" />
              Scraper Control
            </CardTitle>
            <CardDescription>
              Trigger 28car.com scraper to fetch new listings
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Last Run</p>
                  <p className="text-sm text-muted-foreground">
                    {lastScraperRun ? new Date(lastScraperRun).toLocaleString() : 'Never'}
                  </p>
                </div>
                <Button
                  onClick={triggerScraper}
                  disabled={scraperStatus === 'running'}
                >
                  {scraperStatus === 'running' ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin mr-1" />
                      Running...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-1" />
                      Run Scraper
                    </>
                  )}
                </Button>
              </div>

              {scraperMessage && (
                <Alert className={scraperStatus === 'error' ? 'border-red-200' : scraperStatus === 'success' ? 'border-green-200' : ''}>
                  {scraperStatus === 'error' ? <AlertCircle className="h-4 w-4" /> :
                   scraperStatus === 'success' ? <CheckCircle className="h-4 w-4" /> :
                   <RefreshCw className="h-4 w-4" />}
                  <AlertDescription>{scraperMessage}</AlertDescription>
                </Alert>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Enrichment Control */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5" />
              AI Enrichment
            </CardTitle>
            <CardDescription>
              Enrich listings with AI-generated insights
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-muted/50 p-2 rounded">
                  <div className="text-lg font-bold">{enrichmentStats.totalCars}</div>
                  <div className="text-xs text-muted-foreground">Total</div>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 p-2 rounded">
                  <div className="text-lg font-bold text-green-600">{enrichmentStats.enrichedCars}</div>
                  <div className="text-xs text-muted-foreground">Enriched</div>
                </div>
                <div className="bg-amber-50 dark:bg-amber-900/20 p-2 rounded">
                  <div className="text-lg font-bold text-amber-600">{enrichmentStats.unenrichedCars}</div>
                  <div className="text-xs text-muted-foreground">Pending</div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Status</p>
                  <p className="text-sm text-muted-foreground">
                    {enrichmentStats.isConfigured ?
                      `${enrichmentStats.unenrichedCars} pending` :
                      'API not configured'}
                  </p>
                </div>
                <Button
                  onClick={triggerEnrichment}
                  disabled={enrichmentStatus === 'running' || !enrichmentStats.isConfigured || enrichmentStats.unenrichedCars === 0}
                >
                  {enrichmentStatus === 'running' ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin mr-1" />
                      Enriching...
                    </>
                  ) : (
                    <>
                      <Zap className="h-4 w-4 mr-1" />
                      Enrich
                    </>
                  )}
                </Button>
              </div>

              {enrichmentMessage && (
                <Alert className={enrichmentStatus === 'error' ? 'border-red-200' : enrichmentStatus === 'success' ? 'border-green-200' : ''}>
                  {enrichmentStatus === 'error' ? <AlertCircle className="h-4 w-4" /> :
                   enrichmentStatus === 'success' ? <CheckCircle className="h-4 w-4" /> :
                   <RefreshCw className="h-4 w-4" />}
                  <AlertDescription>{enrichmentMessage}</AlertDescription>
                </Alert>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Refresh Schedule Panel */}
      <Card>
        <CardHeader
          className="cursor-pointer"
          onClick={() => setShowSchedulePanel(!showSchedulePanel)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              <CardTitle>Refresh Schedule</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              {refreshSchedule && (
                <Badge variant="outline">
                  {refreshSchedule.schedules.filter(s => s.is_overdue).length} overdue
                </Badge>
              )}
              <ChevronRight className={`h-4 w-4 transition-transform ${showSchedulePanel ? 'rotate-90' : ''}`} />
            </div>
          </div>
          <CardDescription>
            Automated materialized view refresh jobs (pg_cron)
          </CardDescription>
        </CardHeader>

        {showSchedulePanel && (
          <CardContent>
            <div className="space-y-4">
              {/* Quick Actions */}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => loadRefreshSchedule()}
                >
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Refresh Status
                </Button>
                <Button
                  size="sm"
                  variant="default"
                  disabled={refreshingView !== null}
                  onClick={async () => {
                    setRefreshingView('all')
                    try {
                      const response = await fetch('/api/admin/cars/refresh-schedule', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ refresh_all: true })
                      })
                      if (response.ok) {
                        await loadRefreshSchedule()
                        await handleRefresh()
                      }
                    } finally {
                      setRefreshingView(null)
                    }
                  }}
                >
                  {refreshingView === 'all' ? (
                    <><RefreshCw className="h-4 w-4 mr-1 animate-spin" />Refreshing All...</>
                  ) : (
                    <><Zap className="h-4 w-4 mr-1" />Refresh All Views</>
                  )}
                </Button>
              </div>

              {/* Schedule Table */}
              {refreshSchedule?.schedules && (
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left p-2 font-medium">View</th>
                        <th className="text-left p-2 font-medium">Interval</th>
                        <th className="text-left p-2 font-medium">Last Refresh</th>
                        <th className="text-left p-2 font-medium">Next Refresh</th>
                        <th className="text-center p-2 font-medium">Status</th>
                        <th className="text-center p-2 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {refreshSchedule.schedules.map((schedule) => (
                        <tr key={schedule.view_name} className="border-t">
                          <td className="p-2">
                            <div className="flex items-center gap-2">
                              {FEED_ICONS[schedule.view_name.replace('mv_cars_', '')] || <BarChart3 className="h-4 w-4" />}
                              <div>
                                <div className="font-medium">{schedule.display_name}</div>
                                <div className="text-xs text-muted-foreground">{schedule.description}</div>
                              </div>
                            </div>
                          </td>
                          <td className="p-2">
                            <div className="flex items-center gap-1">
                              <Timer className="h-3 w-3 text-muted-foreground" />
                              <span>{schedule.refresh_interval_hours}h</span>
                            </div>
                            <div className="text-xs text-muted-foreground font-mono">{schedule.cron_expression}</div>
                          </td>
                          <td className="p-2">
                            {schedule.last_refreshed_at ? (
                              <div>
                                <div>{new Date(schedule.last_refreshed_at).toLocaleTimeString()}</div>
                                <div className="text-xs text-muted-foreground">
                                  {new Date(schedule.last_refreshed_at).toLocaleDateString()}
                                </div>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">Never</span>
                            )}
                          </td>
                          <td className="p-2">
                            {schedule.next_refresh_at ? (
                              <div>
                                <div className={schedule.is_overdue ? 'text-red-500 font-medium' : ''}>
                                  {schedule.is_overdue ? 'Overdue' : new Date(schedule.next_refresh_at).toLocaleTimeString()}
                                </div>
                                {schedule.minutes_until_next !== null && !schedule.is_overdue && (
                                  <div className="text-xs text-muted-foreground">
                                    in {schedule.minutes_until_next}m
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="p-2 text-center">
                            <button
                              onClick={() => toggleScheduleEnabled(schedule.view_name, !schedule.is_enabled)}
                              className="inline-flex items-center"
                            >
                              {schedule.is_enabled ? (
                                <ToggleRight className="h-6 w-6 text-green-500" />
                              ) : (
                                <ToggleLeft className="h-6 w-6 text-muted-foreground" />
                              )}
                            </button>
                          </td>
                          <td className="p-2 text-center">
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={refreshingView !== null}
                              onClick={() => refreshSingleView(schedule.view_name)}
                            >
                              {refreshingView === schedule.view_name ? (
                                <RefreshCw className="h-4 w-4 animate-spin" />
                              ) : (
                                <RefreshCw className="h-4 w-4" />
                              )}
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Recent Logs */}
              {refreshSchedule?.recent_logs && refreshSchedule.recent_logs.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                    <History className="h-4 w-4" />
                    Recent Refresh Logs
                  </h4>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {refreshSchedule.recent_logs.slice(0, 10).map((log, idx) => (
                      <div
                        key={idx}
                        className={`text-xs p-2 rounded flex items-center justify-between ${
                          log.success ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {log.success ? (
                            <CheckCircle className="h-3 w-3 text-green-500" />
                          ) : (
                            <AlertCircle className="h-3 w-3 text-red-500" />
                          )}
                          <span className="font-medium">{log.view_name.replace('mv_cars_', '')}</span>
                          <span className="text-muted-foreground">
                            {log.duration_ms ? `${log.duration_ms}ms` : ''}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Badge variant="outline" className="text-xs">{log.triggered_by}</Badge>
                          <span>{new Date(log.started_at).toLocaleTimeString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Schedule Summary */}
              {refreshSchedule && (
                <div className="text-xs text-muted-foreground text-center pt-2 border-t">
                  {refreshSchedule.schedules.filter(s => s.is_enabled).length} of {refreshSchedule.schedules.length} schedules enabled
                  {' | '}
                  Total refreshes: {refreshSchedule.schedules.reduce((sum, s) => sum + s.refresh_count, 0)}
                  {' | '}
                  Last updated: {new Date(refreshSchedule.fetched_at).toLocaleTimeString()}
                </div>
              )}
            </div>
          </CardContent>
        )}
      </Card>

      {/* Stats Footer */}
      {stats?.statsRefreshedAt && (
        <p className="text-xs text-muted-foreground text-center">
          Stats last refreshed: {new Date(stats.statsRefreshedAt).toLocaleString()}
          {stats.lastListingAt && (
            <> | Latest listing: {new Date(stats.lastListingAt).toLocaleString()}</>
          )}
        </p>
      )}
    </div>
  )
}
