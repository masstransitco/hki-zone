"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { 
  Search, 
  RefreshCw, 
  AlertTriangle, 
  MapPin, 
  Clock, 
  Activity,
  CheckSquare,
  Trash2,
  Sparkles,
  Download,
  Play,
  Settings,
  Rss,
  Radio,
  Zap,
  Award,
  ExternalLink
} from "lucide-react"
import type { Incident, IncidentCategory, EnrichmentStatus } from "@/lib/types"

const INCIDENT_CATEGORIES = [
  { value: "all", label: "All Categories" },
  { value: "road", label: "Road" },
  { value: "rail", label: "Rail" },
  { value: "weather", label: "Weather" },
  { value: "utility", label: "Utility" },
  { value: "ae", label: "A&E" },
  { value: "health", label: "Health" },
  { value: "financial", label: "Financial" },
  { value: "gov", label: "Gov" },
]

const ENRICHMENT_STATUSES = [
  { value: "all", label: "All Statuses" },
  { value: "pending", label: "Pending" },
  { value: "enriched", label: "Enriched" },
  { value: "ready", label: "Ready" },
  { value: "failed", label: "Failed" },
]

const SEVERITY_LEVELS = [
  { value: "all", label: "All Severities" },
  { value: "1", label: "Low (1-3)" },
  { value: "4", label: "Medium (4-6)" },
  { value: "7", label: "High (7-10)" },
]

const SOURCES = [
  { value: "all", label: "All Sources" },
  { value: "td_notices", label: "TD Notices" },
  { value: "td_press", label: "TD Press" },
  { value: "hko_warn", label: "HKO Warnings" },
  { value: "hko_eq", label: "HKO Earthquake" },
  { value: "hko_felt_eq", label: "HKO Felt Earthquake" },
  { value: "ha_ae_waiting", label: "A&E Waiting Times" },
  { value: "chp_press", label: "CHP Press Releases" },
  { value: "chp_disease", label: "CHP Disease Watch" },
  { value: "chp_ncd", label: "CHP NCD Watch" },
  { value: "chp_guidelines", label: "CHP Guidelines" },
  { value: "hkma_press", label: "HKMA Press Releases" },
  { value: "hkma_speeches", label: "HKMA Speeches" },
  { value: "hkma_guidelines", label: "HKMA Guidelines" },
  { value: "hkma_circulars", label: "HKMA Circulars" },
  { value: "news_gov_top", label: "Government News" },
]

export default function AdminSignalsPage() {
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [severityFilter, setSeverityFilter] = useState("all")
  const [sourceFilter, setSourceFilter] = useState("all")
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [selectedIncidentIds, setSelectedIncidentIds] = useState<Set<string>>(new Set())
  const [isProcessing, setIsProcessing] = useState(false)
  const [feedProcessing, setFeedProcessing] = useState<{[key: string]: boolean}>({})
  const [showFeedControls, setShowFeedControls] = useState(false)
  const [enrichmentProcessing, setEnrichmentProcessing] = useState(false)

  useEffect(() => {
    setPage(0)
    setIncidents([])
    loadIncidents(0)
  }, [categoryFilter, statusFilter, severityFilter, sourceFilter])

  const loadIncidents = async (pageNum: number) => {
    try {
      setLoading(pageNum === 0)
      
      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: "20",
      })
      
      if (categoryFilter !== "all") params.set("category", categoryFilter)
      if (statusFilter !== "all") params.set("status", statusFilter)
      if (severityFilter !== "all") params.set("severity", severityFilter)
      if (sourceFilter !== "all") params.set("source", sourceFilter)
      if (searchQuery) params.set("search", searchQuery)

      const response = await fetch(`/api/admin/signals?${params}`)
      if (!response.ok) throw new Error("Failed to fetch incidents")
      
      const data = await response.json()
      
      if (pageNum === 0) {
        setIncidents(data.incidents)
      } else {
        setIncidents(prev => [...prev, ...data.incidents])
      }
      
      setHasMore(data.hasMore)
    } catch (error) {
      console.error("Error loading incidents:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(0)
    loadIncidents(0)
  }

  const handleRefresh = () => {
    setPage(0)
    setSelectedIncidentIds(new Set())
    loadIncidents(0)
  }

  const handleIncidentSelect = (incidentId: string, selected: boolean) => {
    setSelectedIncidentIds(prev => {
      const newSelected = new Set(prev)
      if (selected) {
        newSelected.add(incidentId)
      } else {
        newSelected.delete(incidentId)
      }
      return newSelected
    })
  }

  const handleSelectAll = () => {
    const allIds = new Set(incidents.map(incident => incident.id))
    setSelectedIncidentIds(allIds)
  }

  const handleSelectNone = () => {
    setSelectedIncidentIds(new Set())
  }

  const handleBatchEnrich = async () => {
    if (selectedIncidentIds.size === 0) {
      alert('Please select incidents to enrich')
      return
    }

    if (!confirm(`Mark ${selectedIncidentIds.size} selected incidents for enrichment?`)) {
      return
    }

    setIsProcessing(true)
    try {
      const response = await fetch('/api/admin/signals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'batch_enrich',
          incidentIds: Array.from(selectedIncidentIds)
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to enrich incidents')
      }

      alert(`Successfully marked ${data.enrichedIncidents.length} incidents for enrichment`)
      setSelectedIncidentIds(new Set())
      handleRefresh()
    } catch (error) {
      console.error('Batch enrich error:', error)
      alert('Failed to enrich incidents: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setIsProcessing(false)
    }
  }

  const handleProcessAllFeeds = async () => {
    if (!confirm('Process all government feeds? This will fetch latest incidents from all sources.')) {
      return
    }

    setFeedProcessing(prev => ({ ...prev, 'all': true }))
    try {
      const response = await fetch('/api/cron/fetch-gov-feeds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to process feeds')
      }

      alert(`Successfully processed ${data.result.totalIncidents} incidents from ${data.result.processedFeeds} feeds`)
      handleRefresh()
    } catch (error) {
      console.error('Feed processing error:', error)
      alert('Failed to process feeds: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setFeedProcessing(prev => ({ ...prev, 'all': false }))
    }
  }

  const handleProcessSingleFeed = async (feedSlug: string) => {
    setFeedProcessing(prev => ({ ...prev, [feedSlug]: true }))
    try {
      // We'll need to create an endpoint for single feed processing
      // For now, we'll process all feeds and filter
      const response = await fetch('/api/cron/fetch-gov-feeds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to process feed')
      }

      const feedResult = data.result.feedResults?.find((r: any) => r.feed === feedSlug)
      if (feedResult) {
        alert(`Successfully processed ${feedResult.incidents} incidents from ${feedSlug}`)
      } else {
        alert(`Processed feeds but no specific result for ${feedSlug}`)
      }
      handleRefresh()
    } catch (error) {
      console.error('Feed processing error:', error)
      alert('Failed to process feed: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setFeedProcessing(prev => ({ ...prev, [feedSlug]: false }))
    }
  }

  const handleTriggerEnrichment = async () => {
    if (!confirm('Trigger AI enrichment for selected incidents? This will use the Perplexity API and cost money.')) {
      return
    }

    setEnrichmentProcessing(true)
    try {
      const response = await fetch('/api/admin/signals/enrich-incident', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          incidentIds: Array.from(selectedIncidentIds)
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to trigger enrichment')
      }

      alert(`Successfully triggered enrichment for ${selectedIncidentIds.size} incidents`)
      setSelectedIncidentIds(new Set())
      handleRefresh()
    } catch (error) {
      console.error('Enrichment error:', error)
      alert('Failed to trigger enrichment: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setEnrichmentProcessing(false)
    }
  }

  const handleBatchDelete = async () => {
    if (selectedIncidentIds.size === 0) {
      alert('Please select incidents to delete')
      return
    }

    if (!confirm(`Are you sure you want to delete ${selectedIncidentIds.size} selected incidents?`)) {
      return
    }

    setIsProcessing(true)
    try {
      const response = await fetch('/api/admin/signals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'batch_delete',
          incidentIds: Array.from(selectedIncidentIds)
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete incidents')
      }

      alert(`Successfully deleted ${data.deletedCount} incidents`)
      setSelectedIncidentIds(new Set())
      handleRefresh()
    } catch (error) {
      console.error('Batch delete error:', error)
      alert('Failed to delete incidents: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setIsProcessing(false)
    }
  }

  const getCategoryColor = (category: IncidentCategory) => {
    const colors = {
      road: "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400",
      rail: "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400",
      weather: "bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400",
      utility: "bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400"
    }
    return colors[category] || "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300"
  }

  const getStatusColor = (status: EnrichmentStatus) => {
    const colors = {
      pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400",
      enriched: "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400",
      ready: "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400",
      failed: "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400"
    }
    return colors[status] || "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300"
  }

  const getSeverityColor = (severity: number) => {
    if (severity >= 7) return "text-red-600 dark:text-red-400"
    if (severity >= 4) return "text-orange-600 dark:text-orange-400"
    return "text-green-600 dark:text-green-400"
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  const totalIncidents = incidents.length
  const statusStats = incidents.reduce((acc, incident) => {
    acc[incident.enrichment_status] = (acc[incident.enrichment_status] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  return (
    <div className="flex flex-1 flex-col gap-4">
      {/* Header Controls */}
      <div className="flex items-center gap-4 mb-4">
        <div className="flex items-center gap-2">
          <Radio className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Government Incident Signals</h1>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <Button
            variant="outline"
            onClick={() => setShowFeedControls(!showFeedControls)}
          >
            <Settings className="h-4 w-4 mr-2" />
            {showFeedControls ? 'Hide' : 'Show'} Feed Controls
          </Button>
          <Button
            variant="default"
            onClick={handleProcessAllFeeds}
            disabled={feedProcessing['all']}
          >
            {feedProcessing['all'] ? (
              <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Process All Feeds
          </Button>
        </div>
      </div>

      {/* Feed Controls */}
      {showFeedControls && (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>Manual Feed Processing</CardTitle>
            <CardDescription>
              Process individual government feeds or all feeds at once
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {SOURCES.filter(s => s.value !== 'all').map(source => (
                <div key={source.value} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-2">
                    <Rss className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium text-sm">{source.label}</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleProcessSingleFeed(source.value)}
                    disabled={feedProcessing[source.value]}
                  >
                    {feedProcessing[source.value] ? (
                      <div className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    ) : (
                      <Play className="h-3 w-3" />
                    )}
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Incidents</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalIncidents}</div>
            <p className="text-xs text-muted-foreground">Currently loaded</p>
          </CardContent>
        </Card>
        
        {Object.entries(statusStats).map(([status, count]) => (
          <Card key={status}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium capitalize">{status}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{count}</div>
              <p className="text-xs text-muted-foreground">
                {((count / totalIncidents) * 100).toFixed(1)}% of total
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <CardTitle>Government Incident Management</CardTitle>
          <CardDescription>
            Monitor and manage government incident feeds from Transport Department, MTR, HKO, and EMSD
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            {/* Search Bar */}
            <form onSubmit={handleSearch} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search incidents..."
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
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-full sm:w-[160px]">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  {INCIDENT_CATEGORIES.map(cat => (
                    <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[160px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  {ENRICHMENT_STATUSES.map(status => (
                    <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={severityFilter} onValueChange={setSeverityFilter}>
                <SelectTrigger className="w-full sm:w-[160px]">
                  <SelectValue placeholder="Severity" />
                </SelectTrigger>
                <SelectContent>
                  {SEVERITY_LEVELS.map(level => (
                    <SelectItem key={level.value} value={level.value}>{level.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={sourceFilter} onValueChange={setSourceFilter}>
                <SelectTrigger className="w-full sm:w-[160px]">
                  <SelectValue placeholder="Source" />
                </SelectTrigger>
                <SelectContent>
                  {SOURCES.map(source => (
                    <SelectItem key={source.value} value={source.value}>{source.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button onClick={handleRefresh} variant="outline" size="icon" className="ml-auto">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>

            {/* Selection Controls */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                {selectedIncidentIds.size > 0 ? (
                  <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                      {selectedIncidentIds.size} selected
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleSelectNone}
                      className="h-7 px-2 text-xs"
                    >
                      Clear
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleBatchEnrich}
                      disabled={isProcessing}
                      className="h-7 px-3 text-xs bg-gradient-to-r from-emerald-50 to-blue-50 border-emerald-200 text-emerald-700 hover:from-emerald-100 hover:to-blue-100"
                    >
                      {isProcessing ? (
                        <div className="mr-1 h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      ) : (
                        <Sparkles className="h-3 w-3 mr-1" />
                      )}
                      Mark for Enrichment
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={handleTriggerEnrichment}
                      disabled={enrichmentProcessing}
                      className="h-7 px-3 text-xs bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600"
                    >
                      {enrichmentProcessing ? (
                        <div className="mr-1 h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      ) : (
                        <Zap className="h-3 w-3 mr-1" />
                      )}
                      AI Enrich Now
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleBatchDelete}
                      disabled={isProcessing}
                      className="h-7 px-3 text-xs"
                    >
                      {isProcessing ? (
                        <div className="mr-1 h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      ) : (
                        <Trash2 className="h-3 w-3 mr-1" />
                      )}
                      Delete
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSelectAll}
                    className="h-8 px-3 text-xs"
                  >
                    <CheckSquare className="h-3 w-3 mr-1" />
                    Select All
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Incidents Grid */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4">
                <div className="h-4 bg-gray-200 rounded mb-2"></div>
                <div className="h-3 bg-gray-200 rounded mb-1"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </CardContent>
            </Card>
          ))
        ) : incidents.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="p-8 text-center text-muted-foreground">
              No incidents found
            </CardContent>
          </Card>
        ) : (
          incidents.map((incident) => (
            <Card key={incident.id} className="hover:shadow-lg transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <input
                    type="checkbox"
                    checked={selectedIncidentIds.has(incident.id)}
                    onChange={(e) => handleIncidentSelect(incident.id, e.target.checked)}
                    className="mt-1"
                  />
                  <div className="flex gap-2">
                    <Badge variant="outline" className={getCategoryColor(incident.category)}>
                      {incident.category}
                    </Badge>
                    <Badge variant="outline" className={getStatusColor(incident.enrichment_status)}>
                      {incident.enrichment_status}
                    </Badge>
                  </div>
                </div>

                <h3 className="font-semibold text-sm mb-2 line-clamp-2">
                  {incident.enriched_title || incident.title}
                </h3>

                <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
                  <div className="flex items-center gap-1">
                    <AlertTriangle className={`h-3 w-3 ${getSeverityColor(incident.severity)}`} />
                    <span>Severity: {incident.severity}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Activity className="h-3 w-3" />
                    <span>Relevance: {incident.relevance_score}</span>
                  </div>
                  {incident.reporting_score && incident.reporting_score > 0 && (
                    <div className="flex items-center gap-1">
                      <Award className="h-3 w-3" />
                      <span>Reporting: {incident.reporting_score}/10</span>
                    </div>
                  )}
                </div>

                {(incident.longitude && incident.latitude) && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
                    <MapPin className="h-3 w-3" />
                    <span>{incident.latitude.toFixed(4)}, {incident.longitude.toFixed(4)}</span>
                  </div>
                )}

                <div className="flex items-center gap-1 text-xs text-muted-foreground mb-3">
                  <Clock className="h-3 w-3" />
                  <span>{formatDate(incident.source_updated_at)}</span>
                </div>

                <div className="text-xs text-muted-foreground">
                  <strong>Source:</strong> {incident.source_slug.toUpperCase()}
                </div>

                {incident.body && (
                  <p className="text-sm text-muted-foreground mt-2 line-clamp-3">
                    {incident.body}
                  </p>
                )}

                {/* Enhanced content display */}
                {incident.enrichment_status === 'enriched' && (
                  <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    {incident.key_facts && Array.isArray(incident.key_facts) && incident.key_facts.length > 0 && (
                      <div className="mb-2">
                        <div className="text-xs font-medium text-blue-800 dark:text-blue-300 mb-1">Key Facts:</div>
                        <ul className="text-xs text-blue-700 dark:text-blue-400 space-y-1">
                          {incident.key_facts.map((fact, index) => (
                            <li key={index} className="flex items-start gap-1">
                              <span className="text-blue-600 dark:text-blue-400 mt-1">•</span>
                              <span>{fact}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    {incident.additional_sources && Array.isArray(incident.additional_sources) && incident.additional_sources.length > 0 && (
                      <div className="mb-2">
                        <div className="text-xs font-medium text-blue-800 dark:text-blue-300 mb-1">
                          Additional Sources ({incident.additional_sources.length}):
                        </div>
                        <div className="space-y-1">
                          {incident.additional_sources.slice(0, 2).map((source, index) => (
                            <div key={index} className="flex items-center gap-1 text-xs">
                              <ExternalLink className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                              <a 
                                href={source.url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-blue-600 dark:text-blue-400 hover:underline truncate"
                              >
                                {source.title}
                              </a>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Load More */}
      {hasMore && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={() => {
              const nextPage = page + 1
              setPage(nextPage)
              loadIncidents(nextPage)
            }}
            disabled={loading}
          >
            {loading ? "Loading..." : "Load More"}
          </Button>
        </div>
      )}
    </div>
  )
}