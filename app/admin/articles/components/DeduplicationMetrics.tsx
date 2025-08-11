'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AlertCircle, TrendingDown, DollarSign, Clock, Layers, GitBranch } from 'lucide-react'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Area,
  AreaChart
} from 'recharts'

interface DeduplicationMetricsData {
  summary: {
    totalSessions: number
    totalDuplicatesRemoved: number
    averageReductionRate: number
    totalCost: number
    averageProcessingTime: number
    errorRate: number
  }
  timeSeries: Array<{
    timestamp: string
    duplicates_removed: number
    reduction_rate: number
    total_cost: number
  }>
  sourceEfficiency: Array<{
    source: string
    before_count: number
    after_count: number
    removed_count: number
    efficiency_rate: number
  }>
  clusterAnalysis: {
    averageClusterSize: number
    largestClusterSeen: number
    totalClustersProcessed: number
  }
  costBreakdown: {
    embeddingsCost: number
    nlpCost: number
    totalCost: number
    costPerDuplicate: number
  }
  performanceMetrics: {
    averageEmbeddingsTime: number
    averageClusteringTime: number
    averageNlpTime: number
    averageTotalTime: number
  }
  nlpStats: {
    totalBorderlinePairs: number
    totalVerifications: number
    totalClustersMerged: number
    verificationRate: number
  }
}

export function DeduplicationMetrics() {
  const [timeframe, setTimeframe] = useState('24h')
  const [metrics, setMetrics] = useState<DeduplicationMetricsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchMetrics = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch(`/api/admin/articles/deduplication-metrics?timeframe=${timeframe}`)
      if (!response.ok) {
        throw new Error('Failed to fetch metrics')
      }
      const data = await response.json()
      setMetrics(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load metrics')
      console.error('Error fetching deduplication metrics:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMetrics()
    const interval = setInterval(fetchMetrics, 60000) // Refresh every minute
    return () => clearInterval(interval)
  }, [timeframe])

  if (loading && !metrics) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Story Deduplication Metrics</CardTitle>
          <CardDescription>Loading metrics...</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (error && !metrics) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Story Deduplication Metrics</CardTitle>
          <CardDescription className="text-red-500 flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {error}
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (!metrics) {
    return null
  }

  // Format time series data for charts
  const formattedTimeSeries = metrics.timeSeries.map(item => ({
    ...item,
    time: new Date(item.timestamp).toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    }),
    date: new Date(item.timestamp).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    })
  }))

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Story Deduplication Metrics</CardTitle>
            <CardDescription>
              Cross-source duplicate detection and removal performance
            </CardDescription>
          </div>
          <Select value={timeframe} onValueChange={setTimeframe}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1h">Last Hour</SelectItem>
              <SelectItem value="6h">Last 6 Hours</SelectItem>
              <SelectItem value="24h">Last 24 Hours</SelectItem>
              <SelectItem value="7d">Last 7 Days</SelectItem>
              <SelectItem value="30d">Last 30 Days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Sessions</p>
            <p className="text-2xl font-bold">{metrics.summary.totalSessions}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Duplicates Removed</p>
            <p className="text-2xl font-bold text-green-600">
              {metrics.summary.totalDuplicatesRemoved}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Reduction Rate</p>
            <p className="text-2xl font-bold">
              {metrics.summary.averageReductionRate}%
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Total Cost</p>
            <p className="text-2xl font-bold">
              ${metrics.summary.totalCost.toFixed(4)}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Avg Time</p>
            <p className="text-2xl font-bold">
              {metrics.summary.averageProcessingTime}ms
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Error Rate</p>
            <p className={`text-2xl font-bold ${metrics.summary.errorRate > 5 ? 'text-red-600' : 'text-green-600'}`}>
              {metrics.summary.errorRate}%
            </p>
          </div>
        </div>

        <Tabs defaultValue="trends" className="space-y-4">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="trends">Trends</TabsTrigger>
            <TabsTrigger value="sources">Sources</TabsTrigger>
            <TabsTrigger value="clusters">Clusters</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="costs">Costs</TabsTrigger>
          </TabsList>

          {/* Trends Tab */}
          <TabsContent value="trends" className="space-y-4">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={formattedTimeSeries}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey={timeframe === '24h' || timeframe === '6h' || timeframe === '1h' ? 'time' : 'date'} />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip />
                  <Legend />
                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="duplicates_removed"
                    stroke="#10b981"
                    fill="#10b98150"
                    name="Duplicates Removed"
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="reduction_rate"
                    stroke="#3b82f6"
                    name="Reduction Rate (%)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>

          {/* Sources Tab */}
          <TabsContent value="sources" className="space-y-4">
            <div className="space-y-2">
              {metrics.sourceEfficiency.map((source, index) => (
                <div key={source.source} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Badge variant={index < 3 ? "destructive" : "secondary"}>
                      #{index + 1}
                    </Badge>
                    <span className="font-medium">{source.source}</span>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-muted-foreground">
                      {source.before_count} → {source.after_count}
                    </span>
                    <Badge variant="outline" className="text-green-600">
                      -{source.removed_count} ({source.efficiency_rate.toFixed(1)}%)
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* Clusters Tab */}
          <TabsContent value="clusters" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Average Cluster Size</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {metrics.clusterAnalysis.averageClusterSize.toFixed(2)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    articles per story cluster
                  </p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Largest Cluster</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {metrics.clusterAnalysis.largestClusterSeen}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    max articles in single story
                  </p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Total Clusters</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {metrics.clusterAnalysis.totalClustersProcessed}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    unique stories identified
                  </p>
                </CardContent>
              </Card>
            </div>

            {metrics.nlpStats && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">NLP Verification Stats</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Borderline Pairs Found</span>
                    <span className="font-medium">{metrics.nlpStats.totalBorderlinePairs}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">NLP Verifications Run</span>
                    <span className="font-medium">{metrics.nlpStats.totalVerifications}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Clusters Merged</span>
                    <span className="font-medium">{metrics.nlpStats.totalClustersMerged}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Sessions with NLP</span>
                    <span className="font-medium">{metrics.nlpStats.verificationRate.toFixed(1)}%</span>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Performance Tab */}
          <TabsContent value="performance" className="space-y-4">
            <div className="space-y-3">
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-sm font-medium">Embeddings Generation</span>
                  <span className="text-sm text-muted-foreground">
                    {metrics.performanceMetrics.averageEmbeddingsTime}ms
                  </span>
                </div>
                <Progress 
                  value={(metrics.performanceMetrics.averageEmbeddingsTime / metrics.performanceMetrics.averageTotalTime) * 100} 
                  className="h-2"
                />
              </div>
              
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-sm font-medium">Clustering</span>
                  <span className="text-sm text-muted-foreground">
                    {metrics.performanceMetrics.averageClusteringTime}ms
                  </span>
                </div>
                <Progress 
                  value={(metrics.performanceMetrics.averageClusteringTime / metrics.performanceMetrics.averageTotalTime) * 100} 
                  className="h-2"
                />
              </div>
              
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-sm font-medium">NLP Verification</span>
                  <span className="text-sm text-muted-foreground">
                    {metrics.performanceMetrics.averageNlpTime}ms
                  </span>
                </div>
                <Progress 
                  value={(metrics.performanceMetrics.averageNlpTime / metrics.performanceMetrics.averageTotalTime) * 100} 
                  className="h-2"
                />
              </div>
            </div>
            
            <div className="pt-4 border-t">
              <div className="flex justify-between">
                <span className="text-sm font-medium">Total Average Processing Time</span>
                <span className="text-lg font-bold">{metrics.performanceMetrics.averageTotalTime}ms</span>
              </div>
            </div>
          </TabsContent>

          {/* Costs Tab */}
          <TabsContent value="costs" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Cost Breakdown</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Embeddings</span>
                    <span className="font-medium">${metrics.costBreakdown.embeddingsCost.toFixed(6)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">NLP Verification</span>
                    <span className="font-medium">${metrics.costBreakdown.nlpCost.toFixed(6)}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t">
                    <span className="text-sm font-medium">Total</span>
                    <span className="font-bold">${metrics.costBreakdown.totalCost.toFixed(6)}</span>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Cost Efficiency</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-green-600">
                      ${metrics.costBreakdown.costPerDuplicate.toFixed(6)}
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">
                      per duplicate removed
                    </p>
                  </div>
                  <div className="mt-4 p-3 bg-muted rounded-lg">
                    <p className="text-xs text-muted-foreground">
                      Estimated monthly cost at current rate:
                    </p>
                    <p className="text-lg font-bold">
                      ${(metrics.costBreakdown.totalCost * 30 / (timeframe === '24h' ? 1 : timeframe === '7d' ? 7 : 30)).toFixed(2)}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}