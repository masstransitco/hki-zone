"use client"

import { useState, useEffect, useCallback } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { 
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ComposedChart, Area, AreaChart
} from 'recharts'
import { 
  RefreshCw, TrendingUp, Database, Zap, Target, Clock,
  Calendar, Filter, Eye, EyeOff, Wifi, WifiOff
} from "lucide-react"
import { useRealtimeMetrics } from "@/hooks/use-realtime-metrics"
import { format, formatDistanceToNow } from "date-fns"

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
  }>
  timeframe: string
  recordsAnalyzed: number
}

const COLORS = [
  '#8884d8', '#82ca9d', '#ffc658', '#ff7c7c', '#8dd1e1', 
  '#d084d0', '#ffb347', '#87ceeb', '#98fb98', '#f0e68c'
]

const TIMEFRAME_OPTIONS = [
  { value: '7d', label: 'Last 7 Days' },
  { value: '30d', label: 'Last 30 Days' },
  { value: '90d', label: 'Last 90 Days' },
  { value: 'all', label: 'All Time' }
]

// Fetch metrics function
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
  
  // Sort daily trends by date
  if (metricsData.dailyTrends) {
    metricsData.dailyTrends.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }
  
  return metricsData
}

export default function AdminMetricsDashboard() {
  const queryClient = useQueryClient()
  const [timeframe, setTimeframe] = useState('30d')
  const [selectedSources, setSelectedSources] = useState<string[]>([])
  const [availableSources, setAvailableSources] = useState<string[]>([])
  const [realtimeEnabled, setRealtimeEnabled] = useState(true)
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  const [isFilterUpdating, setIsFilterUpdating] = useState(false)
  
  // React Query for data fetching with smart invalidation
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['admin-metrics', timeframe, selectedSources],
    queryFn: () => fetchMetrics(timeframe, selectedSources),
    staleTime: 30000, // 30 seconds
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
          <Select value={timeframe} onValueChange={setTimeframe}>
            <SelectTrigger className="w-[180px]">
              <Calendar className="h-4 w-4 mr-2" />
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
      <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 transition-opacity duration-200 ${isFilterUpdating ? 'opacity-75' : ''}`}>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Articles</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatNumber(data.overall.total_articles)}
            </div>
            <p className="text-xs text-muted-foreground">
              {formatNumber(data.recordsAnalyzed)} analyzed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">AI Enhanced</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatNumber(data.overall.ai_enhanced_articles)}
            </div>
            <p className="text-xs text-muted-foreground">
              {data.overall.enhancement_rate}% enhancement rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Sources</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data.overall.unique_sources}
            </div>
            <p className="text-xs text-muted-foreground">
              News outlets monitored
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Daily Average</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatNumber(Math.round(data.overall.total_articles / Math.max(data.dailyTrends.length, 1)))}
            </div>
            <p className="text-xs text-muted-foreground">
              Articles per day
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Source Filter */}
      {availableSources.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Source Filters
            </CardTitle>
            <CardDescription>
              Filter metrics by specific news sources
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {availableSources.map(source => (
                <div key={source} className={`flex items-center space-x-2 transition-opacity duration-200 ${isFilterUpdating ? 'opacity-60' : ''}`}>
                  <Checkbox
                    id={source}
                    checked={selectedSources.includes(source)}
                    onCheckedChange={(checked) => handleSourceToggle(source, checked as boolean)}
                    disabled={isFilterUpdating}
                  />
                  <label htmlFor={source} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    {source}
                  </label>
                </div>
              ))}
            </div>
            {selectedSources.length > 0 && (
              <div className="mt-3 pt-3 border-t">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Active filters:</span>
                  {selectedSources.map(source => (
                    <Badge key={source} variant="secondary">
                      {source}
                    </Badge>
                  ))}
                  <Button 
                    onClick={() => setSelectedSources([])} 
                    size="sm" 
                    variant="ghost"
                    className="h-6 px-2"
                  >
                    Clear all
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Charts Row 1: Daily Trends */}
      <div className={`grid grid-cols-1 lg:grid-cols-2 gap-6 transition-opacity duration-200 ${isFilterUpdating ? 'opacity-75' : ''}`}>
        <Card>
          <CardHeader>
            <CardTitle>Daily Article Collection</CardTitle>
            <CardDescription>Articles scraped and enhanced over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={data.dailyTrends.slice(0, 30).reverse()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(value) => new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                />
                <YAxis />
                <Tooltip 
                  labelFormatter={(value) => formatDate(value)}
                  formatter={(value, name) => [formatNumber(value), name]}
                />
                <Legend />
                <Bar dataKey="articles_scraped" fill="#8884d8" name="Articles Scraped" />
                <Line 
                  type="monotone" 
                  dataKey="ai_enhanced" 
                  stroke="#82ca9d" 
                  strokeWidth={2}
                  name="AI Enhanced"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Enhancement Rate Trend</CardTitle>
            <CardDescription>AI enhancement percentage over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data.dailyTrends.slice(0, 30).reverse().map(d => ({
                ...d,
                enhancement_rate: d.articles_scraped > 0 ? Math.round((d.ai_enhanced / d.articles_scraped) * 100 * 100) / 100 : 0
              }))}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(value) => new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                />
                <YAxis />
                <Tooltip 
                  labelFormatter={(value) => formatDate(value)}
                  formatter={(value) => [`${value}%`, 'Enhancement Rate']}
                />
                <Line 
                  type="monotone" 
                  dataKey="enhancement_rate" 
                  stroke="#ff7c7c" 
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2: Source Analysis */}
      <div className={`grid grid-cols-1 lg:grid-cols-2 gap-6 transition-opacity duration-200 ${isFilterUpdating ? 'opacity-75' : ''}`}>
        <Card>
          <CardHeader>
            <CardTitle>Articles by Source</CardTitle>
            <CardDescription>Volume distribution across news outlets</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.sourceBreakdown.slice(0, 10)} layout="horizontal">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="source" type="category" width={80} />
                <Tooltip formatter={(value) => formatNumber(value)} />
                <Bar dataKey="total_count" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Enhancement Rates by Source</CardTitle>
            <CardDescription>AI enhancement efficiency per outlet</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.sourceBreakdown.slice(0, 10)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="source" 
                  angle={-45}
                  textAnchor="end"
                  height={100}
                />
                <YAxis />
                <Tooltip formatter={(value) => [`${value}%`, 'Enhancement Rate']} />
                <Bar dataKey="enhancement_rate" fill="#82ca9d" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 3: Pipeline Overview */}
      <div className={`grid grid-cols-1 lg:grid-cols-3 gap-6 transition-opacity duration-200 ${isFilterUpdating ? 'opacity-75' : ''}`}>
        <Card>
          <CardHeader>
            <CardTitle>Article Pipeline Status</CardTitle>
            <CardDescription>Overall enhancement distribution</CardDescription>
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

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Source Performance Table</CardTitle>
            <CardDescription>Detailed breakdown by news outlet</CardDescription>
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

      {/* Summary Stats */}
      <Card>
        <CardHeader>
          <CardTitle>Summary Statistics</CardTitle>
          <CardDescription>Key insights from your article pipeline</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Data Range</p>
              <p className="font-medium">
                {data.overall.earliest_article && formatDate(data.overall.earliest_article)} - {data.overall.latest_article && formatDate(data.overall.latest_article)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Top Source</p>
              <p className="font-medium">{data.sourceBreakdown[0]?.source || 'N/A'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Best Enhancement Rate</p>
              <p className="font-medium">
                {Math.max(...data.sourceBreakdown.map(s => s.enhancement_rate)).toFixed(1)}%
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Records Analyzed</p>
              <p className="font-medium">{formatNumber(data.recordsAnalyzed)}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}