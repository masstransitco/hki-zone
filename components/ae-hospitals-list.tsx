"use client"

import { useState, useMemo } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import AeHospitalCard from "@/components/ae-hospital-card"
import { useAeData } from "@/hooks/useAeData"
import { 
  RefreshCw, 
  Search, 
  AlertTriangle,
  Filter,
  Clock,
  TrendingUp
} from "lucide-react"

const CLUSTER_FILTERS = [
  { value: "all", label: "All Clusters" },
  { value: "Hong Kong East", label: "Hong Kong East" },
  { value: "Hong Kong West", label: "Hong Kong West" },
  { value: "Kowloon Central", label: "Kowloon Central" },
  { value: "Kowloon East", label: "Kowloon East" },
  { value: "Kowloon West", label: "Kowloon West" },
  { value: "New Territories East", label: "New Territories East" },
  { value: "New Territories West", label: "New Territories West" },
]

const TYPE_FILTERS = [
  { value: "all", label: "All Types" },
  { value: "Public", label: "Public" },
  { value: "Private", label: "Private" },
]

interface AeHospitalsListProps {
  showFilters?: boolean
  autoRefresh?: boolean
  refreshInterval?: number
}

export default function AeHospitalsList({ 
  showFilters = true, 
  autoRefresh = true,
  refreshInterval = 5 * 60 * 1000 
}: AeHospitalsListProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [clusterFilter, setClusterFilter] = useState("all")
  const [typeFilter, setTypeFilter] = useState("all")
  const [sortBy] = useState<"name">("name") // Fixed to name sorting

  const {
    data: aeData,
    loading,
    error,
    lastUpdated,
    refresh,
    isStale
  } = useAeData({
    enabled: true,
    autoRefresh,
    refreshInterval
  })

  // Filter and sort hospitals
  const filteredAndSortedHospitals = useMemo(() => {
    if (!aeData) return []

    let filtered = aeData.filter(hospital => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const hospitalName = hospital.hospital.hospital_name_en.toLowerCase()
        if (!hospitalName.includes(query)) return false
      }

      // Cluster filter
      if (clusterFilter !== "all") {
        if (hospital.hospital.cluster !== clusterFilter) return false
      }

      // Type filter
      if (typeFilter !== "all") {
        if (hospital.hospital.type !== typeFilter) return false
      }

      return true
    })

    // Sort hospitals by name
    filtered.sort((a, b) => {
      return a.hospital.hospital_name_en.localeCompare(b.hospital.hospital_name_en)
    })

    return filtered
  }, [aeData, searchQuery, clusterFilter, typeFilter, sortBy])

  // Calculate statistics
  const stats = useMemo(() => {
    if (!aeData) return { total: 0, withData: 0, longWait: 0 }

    const total = aeData.length
    const withData = aeData.filter(h => h.waitingData).length
    const longWait = aeData.filter(h => 
      h.waitingData && (
        h.waitingData.current_wait_time.includes("> 4") ||
        h.waitingData.current_wait_time.includes("> 6") ||
        h.waitingData.current_wait_time.includes("> 8")
      )
    ).length

    return { total, withData, longWait }
  }, [aeData])

  return (
    <div className="space-y-6">
      {/* Header with statistics */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            A&E Waiting Times
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Real-time emergency department waiting times across Hong Kong hospitals
          </p>
        </div>
        
        {/* Quick stats */}
        <div className="flex gap-4 text-sm">
          <div className="text-center">
            <div className="font-semibold text-lg">{stats.total}</div>
            <div className="text-muted-foreground">Hospitals</div>
          </div>
          <div className="text-center">
            <div className="font-semibold text-lg">{stats.withData}</div>
            <div className="text-muted-foreground">With Data</div>
          </div>
          <div className="text-center">
            <div className="font-semibold text-lg text-red-600">{stats.longWait}</div>
            <div className="text-muted-foreground">Long Wait</div>
          </div>
        </div>
      </div>

      {/* Status and last updated */}
      <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${isStale ? 'bg-orange-500' : 'bg-green-500 animate-pulse'}`} />
          <span className="text-sm text-muted-foreground">
            {lastUpdated ? (
              `Last updated: ${lastUpdated}`
            ) : (
              'Loading...'
            )}
          </span>
          {isStale && (
            <Badge variant="outline" className="text-orange-600 border-orange-600">
              Data may be stale
            </Badge>
          )}
        </div>
        
        <Button
          variant="outline"
          size="sm"
          onClick={refresh}
          disabled={loading}
          className="flex items-center justify-center w-9 h-9"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Error handling */}
      {error && (
        <Card className="border-red-200 bg-red-50 dark:bg-red-900/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-red-800 dark:text-red-400">
              <AlertTriangle className="h-4 w-4" />
              <span className="font-medium">Error loading A&E data</span>
            </div>
            <p className="text-red-700 dark:text-red-300 mt-1 text-sm">{error}</p>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={refresh}
              className="mt-3"
            >
              Try Again
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      {showFilters && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Search */}
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                  Search Hospitals
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    type="text"
                    placeholder="Search by name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Cluster Filter */}
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                  Cluster
                </label>
                <Select value={clusterFilter} onValueChange={setClusterFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CLUSTER_FILTERS.map((cluster) => (
                      <SelectItem key={cluster.value} value={cluster.value}>
                        {cluster.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Type Filter */}
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                  Type
                </label>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TYPE_FILTERS.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

            </div>
          </CardContent>
        </Card>
      )}

      {/* Hospital Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      ) : (
        <>
          {filteredAndSortedHospitals.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                {aeData?.length === 0 ? 'No A&E data available' : 'No hospitals match your filters'}
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredAndSortedHospitals.map((hospital) => (
                <AeHospitalCard
                  key={hospital.hospital.hospital_code}
                  hospital={hospital.hospital}
                  waitingData={hospital.waitingData}
                  showDetails={true}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}