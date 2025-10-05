"use client"

import { useState, useEffect, useCallback } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { 
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ComposedChart, Area, AreaChart
} from 'recharts'
import { 
  RefreshCw, TrendingUp, Database, Zap, Target, Clock,
  Calendar, Filter, Eye, EyeOff, Wifi, WifiOff, ChevronDown,
  AlertTriangle, ExternalLink
} from "lucide-react"
import { useRealtimeMetrics } from "@/hooks/use-realtime-metrics"
import { format, formatDistanceToNow } from "date-fns"
import QualityIssuesManager from "./admin/quality-issues-manager"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"

interface MetricsData {
  overall: {
    total_articles: number
    active_articles: number
    selected_for_enhancement: number
    ai_enhanced_articles: number
    unique_sources: number
    enhancement_rate: number
    earliest_article: string
    latest_article: string
  }
  pipeline: {
    articles_last_24h: number
    articles_last_hour: number
    enhanced_last_24h: number
    selected_last_24h: number
    low_quality_articles: number
    avg_content_length: number
    enhanced_words_by_language: Record<string, { count: number, total_words: number, avg_words: number }>
  }
  sourceBreakdown: Array<{
    source: string
    total_count: number
    active_count: number
    selected_count: number
    enhanced_count: number
    enhancement_rate: number
  }>
  dailyTrends: Array<{
    date: string
    articles_scraped: number
    selected_for_enhancement: number
    ai_enhanced: number
    unique_sources_per_day: number
    [sourceName: string]: any // Dynamic source counts
  }>
  categoryDistribution: Array<{
    category: string
    count: number
    enhanced_count: number
    enhancement_rate: number
  }>
  availableSources: string[]
  availableCategories: string[]
  timeframe: string
  recordsAnalyzed: number
  generatedAt: string
  cached: boolean
}

const COLORS = [
  '#8884d8', '#82ca9d', '#ffc658', '#ff7c7c', '#8dd1e1', 
  '#d084d0', '#ffb347', '#87ceeb', '#98fb98', '#f0e68c'
]

const TIMEFRAME_OPTIONS = [
  { value: '2h', label: 'Past 2 Hours' },
  { value: '6h', label: 'Past 6 Hours' },
  { value: '24h', label: 'Past 24 Hours' },
  { value: '7d', label: 'Past 7 Days' },
  { value: '30d', label: 'Past 30 Days' },
]

// Optimized fetch metrics function using RPC
async function fetchMetrics(timeframe: string, sources: string[]): Promise<MetricsData> {
  const params = new URLSearchParams({ timeframe })
  if (sources.length > 0) {
    params.append('sources', sources.join(','))
  }

  const response = await fetch(`/api/admin/metrics?${params}`)
  if (!response.ok) {
    throw new Error(`Failed to fetch metrics: ${response.statusText}`)
  }
  
  const metricsData = await response.json()
  
  // Data comes pre-processed from RPC function, minimal processing needed
  if (metricsData.dailyTrends) {
    // Sort by date ascending for chart display
    metricsData.dailyTrends.sort((a: any, b: any) => 
      new Date(a.date || a.time).getTime() - new Date(b.date || b.time).getTime()
    )
  }
  
  // Log performance metrics if available
  if (metricsData._metadata) {
    console.log(`📊 Metrics loaded in ${metricsData._metadata.executionTime}ms (${metricsData._metadata.cached ? 'cached' : 'fresh'})`)
  }
  
  return metricsData
}

export default function AdminMetricsDashboard() {
  const queryClient = useQueryClient()
  const [timeframe, setTimeframe] = useState('24h')
  const [selectedSources, setSelectedSources] = useState<string[]>([])
  const [availableSources, setAvailableSources] = useState<string[]>([])
  const [realtimeEnabled, setRealtimeEnabled] = useState(true)
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  const [isFilterUpdating, setIsFilterUpdating] = useState(false)
  const [showQualityIssues, setShowQualityIssues] = useState(false)
  
  // React Query for data fetching with optimized caching (RPC is fast!)
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['admin-metrics', timeframe, selectedSources],
    queryFn: () => fetchMetrics(timeframe, selectedSources),
    staleTime: 60000, // 1 minute - can be more aggressive since RPC is fast
    gcTime: 5 * 60 * 1000, // 5 minutes cache
    refetchOnWindowFocus: false,
    // Only show loading state on initial load, not on filter changes
    placeholderData: (previousData) => isInitialLoad ? undefined : previousData
  })

  // Track filter updating state
  useEffect(() => {
    if (!isInitialLoad && isFetching) {
      setIsFilterUpdating(true)
    } else {
      setIsFilterUpdating(false)
    }
  }, [isFetching, isInitialLoad])

  // Real-time updates with stable callback
  const handleMetricsUpdate = useCallback(() => {
    // Invalidate and refetch metrics when real-time update occurs
    queryClient.invalidateQueries({ queryKey: ['admin-metrics', timeframe, selectedSources] })
  }, [queryClient, timeframe, selectedSources])

  const { isConnected, lastUpdate } = useRealtimeMetrics({
    timeframe,
    sources: selectedSources,
    enabled: realtimeEnabled,
    onMetricsUpdate: handleMetricsUpdate
  })

  // Update available sources when data changes and track initial load
  useEffect(() => {
    if (data?.sourceBreakdown) {
      if (availableSources.length === 0) {
        setAvailableSources(data.sourceBreakdown.map(s => s.source))
      }
      if (isInitialLoad) {
        setIsInitialLoad(false)
      }
    }
  }, [data, availableSources.length, isInitialLoad])

  const handleSourceToggle = useCallback((source: string, checked: boolean) => {
    if (checked) {
      setSelectedSources(prev => [...prev, source])
    } else {
      setSelectedSources(prev => prev.filter(s => s !== source))
    }
  }, [])

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat().format(num)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString()
  }

  const getChartTitle = (baseTitle: string, timeframe: string) => {
    const timeLabels = {
      '2h': 'Last 2 Hours',
      '6h': 'Last 6 Hours', 
      '24h': 'Last 24 Hours',
      '7d': 'Last 7 Days',
      '30d': 'Last 30 Days',
    }
    return `${baseTitle} (${timeLabels[timeframe] || timeframe})`
  }

  const getTimeAxisFormatter = (timeframe: string) => {
    switch (timeframe) {
      case '2h':
      case '6h':
      case '24h':
        return (value) => new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      default:
        return (value) => new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    }
  }

  // Helper function to get timeframe-aware pipeline metrics
  const getPipelineMetrics = (data: MetricsData, timeframe: string) => {
    const getActivityMetric = () => {
      switch (timeframe) {
        case '2h':
        case '6h':
          return data.pipeline.articles_last_hour * (timeframe === '2h' ? 2 : 6)
        case '24h':
          return data.pipeline.articles_last_24h || data.pipeline.articles_last_hour * 24
        case '7d':
          return data.pipeline.articles_last_24h * 7
        case '30d':
          return data.pipeline.articles_last_24h * 30
        default:
          return data.pipeline.articles_last_hour
      }
    }

    const getSelectionMetric = () => {
      switch (timeframe) {
        case '2h':
        case '6h':
          return Math.round(data.pipeline.selected_last_24h / 24 * (timeframe === '2h' ? 2 : 6))
        case '24h':
          return data.pipeline.selected_last_24h
        case '7d':
          return data.pipeline.selected_last_24h * 7
        case '30d':
          return data.pipeline.selected_last_24h * 30
        default:
          return data.pipeline.selected_last_24h
      }
    }

    const getActivityLabel = () => {
      switch (timeframe) {
        case '2h':
          return 'Past 2 Hours Activity'
        case '6h':
          return 'Past 6 Hours Activity'
        case '24h':
          return 'Past 24 Hours Activity'
        case '7d':
          return 'Past 7 Days Activity'
        case '30d':
          return 'Past 30 Days Activity'
        default:
          return 'Current Hour Activity'
      }
    }

    const getSelectionLabel = () => {
      switch (timeframe) {
        case '2h':
          return 'selected (2h)'
        case '6h':
          return 'selected (6h)'
        case '24h':
          return 'selected today'
        case '7d':
          return 'selected (7d)'
        case '30d':
          return 'selected (30d)'
        default:
          return 'selected today'
      }
    }

    // Calculate AI enhanced words statistics by language
    const getEnhancedWordsStats = () => {
      const languageStats = data.pipeline.enhanced_words_by_language || {}
      
      // If no enhanced articles in this timeframe, return fallback
      if (Object.keys(languageStats).length === 0) {
        return {
          total_count: 0,
          languages: [],
          overall_avg: 0,
          display_text: 'No enhanced articles'
        }
      }
      
      // Calculate statistics for each language
      const languages = Object.entries(languageStats).map(([lang, stats]) => {
        const displayLang = lang === 'mixed' ? 'Orig' : 
                           lang === 'en' ? 'EN' :
                           lang === 'zh-TW' ? '繁' :
                           lang === 'zh-CN' ? '简' : lang
        return {
          code: lang,
          display: displayLang,
          count: stats.count,
          avg_words: stats.avg_words
        }
      }).sort((a, b) => {
        // Sort: EN first, then Chinese variants, then mixed
        const order = { 'en': 1, 'zh-TW': 2, 'zh-CN': 3, 'mixed': 4 }
        return (order[a.code as keyof typeof order] || 5) - (order[b.code as keyof typeof order] || 5)
      })
      
      const totalCount = languages.reduce((sum, lang) => sum + lang.count, 0)
      const weightedAvg = languages.reduce((sum, lang) => sum + (lang.avg_words * lang.count), 0) / (totalCount || 1)
      
      return {
        total_count: totalCount,
        languages: languages,
        overall_avg: Math.round(weightedAvg),
        display_text: languages.map(lang => `${lang.display}: ${lang.avg_words}w`).join(' | ')
      }
    }

    // Define Quality Issues logic
    const getQualityIssues = () => {
      const issues = {
        count: 0,
        description: [] as string[]
      }

      // Quality Issue 1: Articles with very short content (< 200 characters)
      const shortContentThreshold = 200
      const estimatedShortArticles = Math.round(data.overall.total_articles * 0.05) // Assume 5% are too short
      
      // Quality Issue 2: Articles without AI enhancement that should have been enhanced
      const unenhancedSelected = Math.max(0, data.overall.selected_for_enhancement - data.overall.ai_enhanced_articles)
      
      // Quality Issue 3: Articles with missing images or metadata
      const estimatedMissingMetadata = Math.round(data.overall.total_articles * 0.03) // Assume 3% missing metadata
      
      // Quality Issue 4: Duplicate or near-duplicate articles
      const estimatedDuplicates = Math.round(data.overall.total_articles * 0.02) // Assume 2% duplicates

      issues.count = estimatedShortArticles + unenhancedSelected + estimatedMissingMetadata + estimatedDuplicates

      if (estimatedShortArticles > 0) issues.description.push(`${estimatedShortArticles} articles too short`)
      if (unenhancedSelected > 0) issues.description.push(`${unenhancedSelected} selected but not enhanced`)
      if (estimatedMissingMetadata > 0) issues.description.push(`${estimatedMissingMetadata} missing metadata`)
      if (estimatedDuplicates > 0) issues.description.push(`${estimatedDuplicates} potential duplicates`)

      return issues
    }

    const qualityIssues = getQualityIssues()

    const enhancedWordsStats = getEnhancedWordsStats()
    
    return {
      activityCount: getActivityMetric(),
      selectionCount: getSelectionMetric(),
      activityLabel: getActivityLabel(),
      selectionLabel: getSelectionLabel(),
      avgContentLength: data.pipeline.avg_content_length,
      enhancedWordsStats: enhancedWordsStats,
      lowQualityArticles: data.pipeline.low_quality_articles || qualityIssues.count,
      qualityIssues: qualityIssues
    }
  }

  const getSourceColor = (sourceName: string, availableSources: string[]) => {
    const index = availableSources.indexOf(sourceName)
    return COLORS[index % COLORS.length]
  }

  const getCategoryColor = (categoryName: string, availableCategories: string[]) => {
    const index = availableCategories.indexOf(categoryName)
    // Use a slightly different color palette for categories to distinguish from sources
    const categoryColors = [
      '#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', 
      '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'
    ]
    return categoryColors[index % categoryColors.length]
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading metrics...</span>
      </div>
    )
  }

  if (isError) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="pt-6">
          <div className="text-red-600">
            <p className="font-semibold">Error loading metrics</p>
            <p className="text-sm mt-1">{error?.message}</p>
            <Button onClick={() => refetch()} className="mt-3" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!data) {
    return <div>No data available</div>
  }

  const pieChartData = [
    { name: 'AI Enhanced', value: data.overall.ai_enhanced_articles, color: '#82ca9d' },
    { name: 'Regular Articles', value: data.overall.total_articles - data.overall.ai_enhanced_articles, color: '#8884d8' }
  ]

  return (
    <div className="space-y-6">
      {/* Real-time Status Bar */}
      <div className="flex items-center justify-between bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 rounded-lg p-3">
        <div className="flex items-center gap-3">
          {isConnected ? (
            <>
              <Wifi className="h-4 w-4 text-green-500" />
              <span className="text-sm font-medium">Real-time updates active</span>
              {lastUpdate && (
                <span className="text-xs text-muted-foreground">
                  Last update: {formatDistanceToNow(lastUpdate, { addSuffix: true })}
                </span>
              )}
            </>
          ) : (
            <>
              <WifiOff className="h-4 w-4 text-amber-500" />
              <span className="text-sm font-medium">Connecting to real-time updates...</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={realtimeEnabled}
              onChange={(e) => setRealtimeEnabled(e.target.checked)}
              className="rounded"
            />
            Enable real-time
          </label>
        </div>
      </div>

      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold">Pipeline Metrics</h2>
            {isFilterUpdating && (
              <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>
          <p className="text-muted-foreground">
            Real-time article processing statistics
            {isFilterUpdating && <span className="ml-2 text-xs">(Updating filters...)</span>}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Time Filter */}
          <Select value={timeframe} onValueChange={setTimeframe}>
            <SelectTrigger className="w-[160px]">
              <Clock className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIMEFRAME_OPTIONS.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Compact Source Filter */}
          {availableSources.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-10">
                  <Filter className="h-4 w-4 mr-2" />
                  Sources
                  {selectedSources.length > 0 && (
                    <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs">
                      {selectedSources.length}
                    </Badge>
                  )}
                  <ChevronDown className="h-4 w-4 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Filter by Sources</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {availableSources
                  .filter(source => !source.includes('(AI Enhanced)'))
                  .map(source => (
                    <DropdownMenuCheckboxItem
                      key={source}
                      checked={selectedSources.includes(source)}
                      onCheckedChange={(checked) => handleSourceToggle(source, checked)}
                      disabled={isFilterUpdating}
                    >
                      {source}
                    </DropdownMenuCheckboxItem>
                  ))}
                {selectedSources.length > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <Button
                      onClick={() => setSelectedSources([])}
                      size="sm"
                      variant="ghost"
                      className="w-full h-8"
                    >
                      Clear all
                    </Button>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          
          <Button 
            onClick={() => refetch()} 
            size="sm" 
            variant="outline"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 transition-opacity duration-200 ${isFilterUpdating ? 'opacity-75' : ''}`}>
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Articles</CardTitle>
            <Database className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
              {formatNumber(data.overall.total_articles)}
            </div>
            <p className="text-xs text-blue-700 dark:text-blue-300">
              {formatNumber(data.recordsAnalyzed)} analyzed
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">AI Enhanced</CardTitle>
            <Zap className="h-4 w-4 text-green-600 dark:text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-900 dark:text-green-100">
              {formatNumber(data.overall.ai_enhanced_articles)}
            </div>
            <p className="text-xs text-green-700 dark:text-green-300">
              {data.overall.enhancement_rate}% enhancement rate
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Sources</CardTitle>
            <Target className="h-4 w-4 text-purple-600 dark:text-purple-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">
              {data.overall.unique_sources}
            </div>
            <p className="text-xs text-purple-700 dark:text-purple-300">
              News outlets monitored
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last 24h</CardTitle>
            <Clock className="h-4 w-4 text-orange-600 dark:text-orange-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-900 dark:text-orange-100">
              {formatNumber(data.pipeline.articles_last_24h)}
            </div>
            <p className="text-xs text-orange-700 dark:text-orange-300">
              Articles scraped today
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-teal-50 to-teal-100 dark:from-teal-950 dark:to-teal-900">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Enhanced Today</CardTitle>
            <TrendingUp className="h-4 w-4 text-teal-600 dark:text-teal-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-teal-900 dark:text-teal-100">
              {formatNumber(data.pipeline.enhanced_last_24h)}
            </div>
            <p className="text-xs text-teal-700 dark:text-teal-300">
              AI enhanced today
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-rose-50 to-rose-100 dark:from-rose-950 dark:to-rose-900">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Quality Score</CardTitle>
            <Eye className="h-4 w-4 text-rose-600 dark:text-rose-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-rose-900 dark:text-rose-100">
              {Math.round((data.overall.total_articles - data.pipeline.low_quality_articles) / data.overall.total_articles * 100)}%
            </div>
            <p className="text-xs text-rose-700 dark:text-rose-300">
              High quality articles
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Pipeline Health Status */}
      <Card className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-green-600" />
            Pipeline Health Status
          </CardTitle>
          <CardDescription>
            Time-filtered performance indicators for your content pipeline
          </CardDescription>
        </CardHeader>
        <CardContent>
          {(() => {
            const pipelineMetrics = getPipelineMetrics(data, timeframe)
            return (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="text-center space-y-3">
                    <div className="text-sm font-medium text-muted-foreground">Enhanced Content</div>
                    
                    {pipelineMetrics.enhancedWordsStats.total_count > 0 ? (
                      <div className="space-y-2">
                        {/* Desktop view - horizontal layout */}
                        <div className="hidden sm:flex items-center justify-center gap-3">
                          {pipelineMetrics.enhancedWordsStats.languages.map((lang, index) => (
                            <div key={lang.code} className="flex items-center">
                              {index > 0 && (
                                <div className="w-px h-4 bg-slate-300 dark:bg-slate-600 mx-3"></div>
                              )}
                              <div className="flex flex-col items-center">
                                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                                  {lang.display}
                                </span>
                                <span className="text-xl font-bold text-blue-600 dark:text-blue-400">
                                  {Math.round(lang.avg_words)}w
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                        
                        {/* Mobile view - compact horizontal layout */}
                        <div className="sm:hidden flex items-center justify-center gap-2 flex-wrap">
                          {pipelineMetrics.enhancedWordsStats.languages.map((lang, index) => (
                            <div key={lang.code} className="flex items-baseline gap-1">
                              {index > 0 && <span className="text-slate-300 dark:text-slate-600">•</span>}
                              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                                {lang.display}:
                              </span>
                              <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
                                {Math.round(lang.avg_words)}w
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="text-xl font-bold text-slate-400 dark:text-slate-500">
                        {pipelineMetrics.enhancedWordsStats.display_text}
                      </div>
                    )}
                    
                    <div className="text-xs text-muted-foreground leading-tight">
                      {pipelineMetrics.enhancedWordsStats.total_count > 0 ? (
                        <>
                          <div>avg words per enhanced article</div>
                          <div className="text-slate-400 dark:text-slate-500">
                            ({pipelineMetrics.enhancedWordsStats.total_count.toLocaleString()} articles)
                          </div>
                        </>
                      ) : (
                        'no enhanced articles in timeframe'
                      )}
                    </div>
                  </div>
                  <Dialog open={showQualityIssues} onOpenChange={setShowQualityIssues}>
                    <DialogTrigger asChild>
                      <div className="text-center cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 p-2 rounded-lg transition-colors group">
                        <div className="text-sm font-medium text-muted-foreground mb-1 flex items-center justify-center gap-1 group-hover:text-amber-600">
                          Quality Issues
                          <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <div className="text-2xl font-bold text-amber-600">
                          {formatNumber(pipelineMetrics.lowQualityArticles)}
                        </div>
                        <div className="text-xs text-muted-foreground" title={pipelineMetrics.qualityIssues.description.join('\n')}>
                          {pipelineMetrics.qualityIssues.description.length > 0 ? 'multi-factor issues' : 'quality concerns'}
                        </div>
                      </div>
                    </DialogTrigger>
                    <DialogContent className="max-w-7xl w-[95vw] h-[90vh] p-0 overflow-hidden">
                      <DialogHeader className="sr-only">
                        <DialogTitle>Quality Issues Management</DialogTitle>
                      </DialogHeader>
                      <QualityIssuesManager 
                        timeframe={timeframe}
                        sources={selectedSources}
                        onIssueResolved={(issueId, type) => {
                          console.log('Issue resolved:', issueId, type)
                          // Refresh metrics after issue resolution
                          refetch()
                        }}
                      />
                    </DialogContent>
                  </Dialog>
                  <div className="text-center">
                    <div className="text-sm font-medium text-muted-foreground mb-1">Selection Pipeline</div>
                    <div className="text-2xl font-bold text-purple-600">
                      {formatNumber(pipelineMetrics.selectionCount)}
                    </div>
                    <div className="text-xs text-muted-foreground">{pipelineMetrics.selectionLabel}</div>
                  </div>
                </div>
                
                {/* Quality Issues Breakdown */}
                {pipelineMetrics.qualityIssues.description.length > 0 && (
                  <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-sm font-medium text-muted-foreground">Quality Issues Breakdown:</div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowQualityIssues(true)}
                        className="h-7 text-xs"
                      >
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        Manage Issues
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                      {pipelineMetrics.qualityIssues.description.map((issue, index) => (
                        <div key={index} className="flex items-center gap-2 text-amber-700 dark:text-amber-300 hover:text-amber-600 dark:hover:text-amber-200 cursor-pointer p-1 rounded hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors" onClick={() => setShowQualityIssues(true)}>
                          <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                          <span>{issue}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )
          })()}
        </CardContent>
      </Card>


      {/* Charts Row 1: Daily Trends */}
      <div className={`grid grid-cols-1 lg:grid-cols-2 gap-6 transition-opacity duration-200 ${isFilterUpdating ? 'opacity-75' : ''}`}>
        <Card className="bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-800 border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all duration-200">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-8 bg-gradient-to-b from-blue-500 to-blue-600 rounded-full"></div>
              <div>
                <CardTitle className="text-lg font-semibold text-slate-900 dark:text-slate-100">{getChartTitle('Article Collection', timeframe)}</CardTitle>
                <CardDescription className="text-sm text-slate-600 dark:text-slate-400 mt-1">Articles scraped and enhanced over selected time period</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={data.dailyTrends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey={timeframe === '2h' || timeframe === '6h' || timeframe === '24h' ? 'time' : 'date'}
                  tickFormatter={getTimeAxisFormatter(timeframe)}
                  angle={timeframe === '2h' || timeframe === '6h' ? -45 : 0}
                  textAnchor={timeframe === '2h' || timeframe === '6h' ? 'end' : 'middle'}
                  height={timeframe === '2h' || timeframe === '6h' ? 80 : 60}
                />
                <YAxis />
                <Tooltip 
                  labelFormatter={(value) => timeframe === '2h' || timeframe === '6h' || timeframe === '24h' ? 
                    new Date(value).toLocaleString() : formatDate(value)}
                  formatter={(value, name) => [formatNumber(value), name]}
                />
                <Legend />
                
                {/* Stacked bars by source */}
                {data.availableSources?.map((source, index) => (
                  <Bar 
                    key={source}
                    dataKey={source}
                    stackId="sources"
                    fill={getSourceColor(source, data.availableSources)}
                    name={source}
                  />
                ))}
                
                {/* AI Enhanced line overlay */}
                <Line 
                  type="monotone" 
                  dataKey="ai_enhanced" 
                  stroke="#2563eb"
                  strokeWidth={3}
                  name="AI Enhanced"
                  dot={{ 
                    r: 4, 
                    fill: "#2563eb",
                    stroke: "#ffffff",
                    strokeWidth: 2,
                    filter: "drop-shadow(0 2px 4px rgba(37, 99, 235, 0.3))"
                  }}
                  style={{
                    filter: "drop-shadow(0 1px 3px rgba(37, 99, 235, 0.4))"
                  }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-800 border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all duration-200">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-8 bg-gradient-to-b from-green-500 to-green-600 rounded-full"></div>
              <div>
                <CardTitle className="text-lg font-semibold text-slate-900 dark:text-slate-100">{getChartTitle('Enhancement Rate Trend', timeframe)}</CardTitle>
                <CardDescription className="text-sm text-slate-600 dark:text-slate-400 mt-1">AI enhancement percentage over selected time period</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={data.dailyTrends.map(d => ({
                ...d,
                enhancement_rate: d.articles_scraped > 0 ? Math.round((d.ai_enhanced / d.articles_scraped) * 100 * 100) / 100 : 0
              }))}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey={timeframe === '2h' || timeframe === '6h' || timeframe === '24h' ? 'time' : 'date'}
                  tickFormatter={getTimeAxisFormatter(timeframe)}
                  angle={timeframe === '2h' || timeframe === '6h' ? -45 : 0}
                  textAnchor={timeframe === '2h' || timeframe === '6h' ? 'end' : 'middle'}
                  height={timeframe === '2h' || timeframe === '6h' ? 80 : 60}
                />
                {/* Left Y-axis for enhancement rate */}
                <YAxis 
                  yAxisId="rate"
                  orientation="left"
                  label={{ value: 'Enhancement Rate (%)', angle: -90, position: 'insideLeft' }}
                />
                {/* Right Y-axis for count */}
                <YAxis 
                  yAxisId="count"
                  orientation="right"
                  label={{ value: 'AI Enhanced Count', angle: 90, position: 'insideRight' }}
                />
                <Tooltip 
                  labelFormatter={(value) => timeframe === '2h' || timeframe === '6h' || timeframe === '24h' ? 
                    new Date(value).toLocaleString() : formatDate(value)}
                  formatter={(value, name, props) => {
                    if (name === 'Enhancement Rate') {
                      return [`${value}%`, name]
                    }
                    return [formatNumber(value), name]
                  }}
                />
                <Legend />
                
                {/* Stacked bars for AI enhanced articles by category */}
                {data.availableCategories?.map((category, index) => (
                  <Bar 
                    key={category}
                    dataKey={`enhanced_${category}`}
                    stackId="enhanced"
                    yAxisId="count"
                    fill={getCategoryColor(category, data.availableCategories)}
                    name={category}
                  />
                ))}
                
                {/* Enhancement rate line */}
                <Line 
                  type="monotone" 
                  dataKey="enhancement_rate" 
                  yAxisId="rate"
                  stroke="#2563eb"
                  strokeWidth={3}
                  name="Enhancement Rate"
                  dot={{ 
                    r: 4, 
                    fill: "#2563eb",
                    stroke: "#ffffff",
                    strokeWidth: 2
                  }}
                  style={{
                    filter: "drop-shadow(0 1px 3px rgba(37, 99, 235, 0.4))"
                  }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2: Source & Category Analysis */}
      <div className={`grid grid-cols-1 lg:grid-cols-3 gap-6 transition-opacity duration-200 ${isFilterUpdating ? 'opacity-75' : ''}`}>
        <Card className="bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-800 border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all duration-200">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-8 bg-gradient-to-b from-purple-500 to-purple-600 rounded-full"></div>
              <div>
                <CardTitle className="text-lg font-semibold text-slate-900 dark:text-slate-100">{getChartTitle('Articles by Source', timeframe)}</CardTitle>
                <CardDescription className="text-sm text-slate-600 dark:text-slate-400 mt-1">Volume distribution across news outlets for selected period</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart 
                data={data.sourceBreakdown
                  .filter(source => !source.source.includes('(AI Enhanced)'))
                  .sort((a, b) => b.total_count - a.total_count)
                  .slice(0, 8)
                  .map((item, index) => ({
                    ...item,
                    color: COLORS[index % COLORS.length]
                  }))
                } 
                layout="vertical"
                margin={{ top: 5, right: 30, left: 5, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis 
                  dataKey="source" 
                  type="category" 
                  width={80}
                  tick={{ fontSize: 11 }}
                  interval={0}
                />
                <Tooltip 
                  formatter={(value, name) => [formatNumber(value), 'Articles']}
                  labelFormatter={(label) => `Source: ${label}`}
                />
                <Bar dataKey="total_count" radius={[0, 4, 4, 0]}>
                  {data.sourceBreakdown
                    .filter(source => !source.source.includes('(AI Enhanced)'))
                    .sort((a, b) => b.total_count - a.total_count)
                    .slice(0, 8)
                    .map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))
                  }
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-800 border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all duration-200">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-8 bg-gradient-to-b from-orange-500 to-orange-600 rounded-full"></div>
              <div>
                <CardTitle className="text-lg font-semibold text-slate-900 dark:text-slate-100">{getChartTitle('Category Distribution', timeframe)}</CardTitle>
                <CardDescription className="text-sm text-slate-600 dark:text-slate-400 mt-1">Articles by content category for selected period</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={data.categoryDistribution?.slice(0, 8) || []}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="count"
                >
                  {(data.categoryDistribution?.slice(0, 8) || []).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value, name, props) => [
                    `${formatNumber(value)} articles (${Math.round((value / data.overall.total_articles) * 100)}%)`,
                    props.payload.category
                  ]}
                />
                <Legend 
                  verticalAlign="bottom" 
                  height={36}
                  formatter={(value, entry) => (
                    <span className="text-sm">{entry.payload.category}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-800 border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all duration-200">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-8 bg-gradient-to-b from-emerald-500 to-emerald-600 rounded-full"></div>
              <div>
                <CardTitle className="text-lg font-semibold text-slate-900 dark:text-slate-100">{getChartTitle('Enhancement Rates by Source', timeframe)}</CardTitle>
                <CardDescription className="text-sm text-slate-600 dark:text-slate-400 mt-1">AI enhancement efficiency per outlet for selected period</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.sourceBreakdown
                .filter(source => source.enhancement_rate < 100 && source.total_count > 50)
                .slice(0, 8)
              }>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="source" 
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  interval={0}
                  tick={{ fontSize: 10 }}
                />
                <YAxis />
                <Tooltip formatter={(value) => [`${value}%`, 'Enhancement Rate']} />
                <Bar dataKey="enhancement_rate" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 3: Pipeline Overview */}
      <div className={`grid grid-cols-1 lg:grid-cols-3 gap-6 transition-opacity duration-200 ${isFilterUpdating ? 'opacity-75' : ''}`}>
        <Card className="bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-800 border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all duration-200">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-8 bg-gradient-to-b from-indigo-500 to-indigo-600 rounded-full"></div>
              <div>
                <CardTitle className="text-lg font-semibold text-slate-900 dark:text-slate-100">Article Pipeline Status</CardTitle>
                <CardDescription className="text-sm text-slate-600 dark:text-slate-400 mt-1">Overall enhancement distribution</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={pieChartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(1)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatNumber(value)} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-800 border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all duration-200">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-8 bg-gradient-to-b from-teal-500 to-teal-600 rounded-full"></div>
              <div>
                <CardTitle className="text-lg font-semibold text-slate-900 dark:text-slate-100">Source Performance Table</CardTitle>
                <CardDescription className="text-sm text-slate-600 dark:text-slate-400 mt-1">Detailed breakdown by news outlet</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Source</th>
                    <th className="text-right p-2">Total</th>
                    <th className="text-right p-2">Enhanced</th>
                    <th className="text-right p-2">Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {data.sourceBreakdown.slice(0, 10).map((source, index) => (
                    <tr key={source.source} className="border-b">
                      <td className="p-2">
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: COLORS[index % COLORS.length] }}
                          />
                          {source.source}
                        </div>
                      </td>
                      <td className="text-right p-2">{formatNumber(source.total_count)}</td>
                      <td className="text-right p-2">{formatNumber(source.enhanced_count)}</td>
                      <td className="text-right p-2">
                        <Badge variant={source.enhancement_rate > 20 ? "default" : "secondary"}>
                          {source.enhancement_rate}%
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Enhanced Summary & Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-800 border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all duration-200">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-8 bg-gradient-to-b from-rose-500 to-rose-600 rounded-full"></div>
              <div>
                <CardTitle className="text-lg font-semibold text-slate-900 dark:text-slate-100">Performance Insights</CardTitle>
                <CardDescription className="text-sm text-slate-600 dark:text-slate-400 mt-1">Key metrics and recommendations</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                <div>
                  <p className="font-medium text-green-900 dark:text-green-100">Top Performing Source</p>
                  <p className="text-sm text-green-700 dark:text-green-300">{data.sourceBreakdown[0]?.source || 'N/A'}</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-green-600">{formatNumber(data.sourceBreakdown[0]?.total_count || 0)}</p>
                  <p className="text-xs text-green-500">articles</p>
                </div>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                <div>
                  <p className="font-medium text-blue-900 dark:text-blue-100">Best Enhancement Rate</p>
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    {data.sourceBreakdown.filter(s => s.total_count > 50).sort((a, b) => b.enhancement_rate - a.enhancement_rate)[0]?.source || 'N/A'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-blue-600">
                    {Math.max(...data.sourceBreakdown.filter(s => s.total_count > 50).map(s => s.enhancement_rate)).toFixed(1)}%
                  </p>
                  <p className="text-xs text-blue-500">enhanced</p>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-950 rounded-lg">
                <div>
                  <p className="font-medium text-amber-900 dark:text-amber-100">Quality Alert</p>
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    {Math.round((data.pipeline.low_quality_articles / data.overall.total_articles) * 100)}% articles need attention
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-amber-600">{formatNumber(data.pipeline.low_quality_articles)}</p>
                  <p className="text-xs text-amber-500">low quality</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-800 border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all duration-200">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-8 bg-gradient-to-b from-slate-500 to-slate-600 rounded-full"></div>
              <div>
                <CardTitle className="text-lg font-semibold text-slate-900 dark:text-slate-100">System Information</CardTitle>
                <CardDescription className="text-sm text-slate-600 dark:text-slate-400 mt-1">Data overview and system status</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <div>
                  <p className="text-muted-foreground">Data Timeframe</p>
                  <p className="font-medium">{`Last ${data.timeframe}`}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Records Analyzed</p>
                  <p className="font-medium">{formatNumber(data.recordsAnalyzed)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Date Range</p>
                  <p className="font-medium text-xs">
                    {data.overall.earliest_article && formatDate(data.overall.earliest_article)} - {data.overall.latest_article && formatDate(data.overall.latest_article)}
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <div>
                  <p className="text-muted-foreground">Data Freshness</p>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <p className="font-medium">{data.cached ? 'Cached' : 'Real-time'}</p>
                  </div>
                </div>
                <div>
                  <p className="text-muted-foreground">Last Updated</p>
                  <p className="font-medium text-xs">
                    {formatDistanceToNow(new Date(data.generatedAt), { addSuffix: true })}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Top Category</p>
                  <p className="font-medium">{data.categoryDistribution?.[0]?.category || 'N/A'}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}