"use client"

import { useState, useMemo } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import JourneyTimeCard from "@/components/journey-time-card"
import { useJourneyTimeData } from "@/hooks/useJourneyTimeData"
import { 
  RefreshCw, 
  AlertTriangle,
  Clock,
  MapPin,
  TrendingUp,
  ArrowRight
} from "lucide-react"

const REGION_FILTERS = [
  { value: "hk", label: "🏝️ Hong Kong Island" },
  { value: "kln", label: "🏙️ Kowloon" },
  { value: "nt", label: "🏔️ New Territories" },
]

// Helper function to get random region pair (not Kowloon to Kowloon)
const getRandomRegionPair = () => {
  const regions = ["hk", "kln", "nt"] as const
  let start = regions[Math.floor(Math.random() * regions.length)]
  let dest = regions[Math.floor(Math.random() * regions.length)]
  
  // Ensure not Kowloon to Kowloon
  while (start === "kln" && dest === "kln") {
    dest = regions[Math.floor(Math.random() * regions.length)]
  }
  
  return { start, dest }
}

const ROUTE_TYPE_ICONS = {
  expressway: (
    <svg xmlns="http://www.w3.org/2000/svg" height="18px" viewBox="0 -960 960 960" width="18px" fill="currentColor">
      <path d="M80-513v-83q99-24 198.5-34T480-640q102 0 201.5 10T880-596v83q-20-5-40-9l-40-8v130h-80v-144q-60-8-120-12t-120-4q-60 0-120 3.5T240-545v145h-80v-131q-20 4-40 8.5T80-513Zm160 393 58-351q18-2 41-3.5t41-2.5l-60 357h-80Zm120-720h80l-20 119q-18 1-40.5 2.5T339-715l21-125Zm80 720h80v-160h-80v160Zm0-240h80v-119h-80v119Zm80-480h80l21 125q-18-1-40.5-3t-40.5-3l-20-119Zm120 720-60-357q18 1 41 3t41 4l58 350h-80Z"/>
    </svg>
  ),
  trunk: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12.7486 5.75C12.7486 5.33579 12.4128 5 11.9986 5C11.5844 5 11.2486 5.33579 11.2486 5.75V7.3125C11.2486 7.72671 11.5844 8.0625 11.9986 8.0625C12.4128 8.0625 12.7486 7.72671 12.7486 7.3125V5.75Z" fill="currentColor"/>
      <path d="M12.7486 10.4375C12.7486 10.0233 12.4128 9.6875 11.9986 9.6875C11.5844 9.6875 11.2486 10.0233 11.2486 10.4375L11.2486 13.5625C11.2486 13.9767 11.5844 14.3125 11.9986 14.3125C12.4128 14.3125 12.7486 13.9767 12.7486 13.5625V10.4375Z" fill="currentColor"/>
      <path d="M12.7486 16.6875C12.7486 16.2733 12.4128 15.9375 11.9986 15.9375C11.5844 15.9375 11.2486 16.2733 11.2486 16.6875V18.25C11.2486 18.6642 11.5844 19 11.9986 19C12.4128 19 12.7486 18.6642 12.7486 18.25V16.6875Z" fill="currentColor"/>
      <path fillRule="evenodd" clipRule="evenodd" d="M7.3819 2C6.20977 2 5.23399 2.89987 5.13926 4.06816L3.88251 19.5682C3.77629 20.8782 4.81081 22 6.12515 22H17.8721C19.1864 22 20.2209 20.8782 20.1147 19.5682L18.8579 4.06816C18.7632 2.89986 17.7874 2 16.6153 2H7.3819ZM6.63436 4.18939C6.66593 3.79996 6.99119 3.5 7.3819 3.5H16.6153C17.006 3.5 17.3313 3.79995 17.3628 4.18939L18.6196 19.6894C18.655 20.1261 18.3102 20.5 17.8721 20.5H6.12515C5.68703 20.5 5.34219 20.1261 5.3776 19.6894L6.63436 4.18939Z" fill="currentColor"/>
    </svg>
  ),
  local: (
    <svg xmlns="http://www.w3.org/2000/svg" height="18px" viewBox="0 -960 960 960" width="18px" fill="currentColor">
      <path d="M480-240q26 0 43-17t17-43q0-26-17-43t-43-17q-26 0-43 17t-17 43q0 26 17 43t43 17Zm0-180q26 0 43-17t17-43q0-26-17-43t-43-17q-26 0-43 17t-17 43q0 26 17 43t43 17Zm0-180q26 0 43-17t17-43q0-26-17-43t-43-17q-26 0-43 17t-17 43q0 26 17 43t43 17ZM280-360v-46q-51-14-85.5-56T160-560h120v-46q-51-14-85.5-56T160-760h120q0-33 23.5-56.5T360-840h240q33 0 56.5 23.5T680-760h120q0 56-34.5 98T680-606v46h120q0 56-34.5 98T680-406v46h120q0 56-34.5 98T680-206v6q0 33-23.5 56.5T600-120H360q-33 0-56.5-23.5T280-200v-6q-51-14-85.5-56T160-360h120Zm80 160h240v-560H360v560Zm0 0v-560 560Z"/>
    </svg>
  )
}

interface JourneyTimeListProps {
  showFilters?: boolean
  autoRefresh?: boolean
  refreshInterval?: number
}

export default function JourneyTimeList({ 
  showFilters = true, 
  autoRefresh = true,
  refreshInterval = 2 * 60 * 1000 
}: JourneyTimeListProps) {
  const randomPair = getRandomRegionPair()
  const [startRegionFilter, setStartRegionFilter] = useState<"hk" | "kln" | "nt">(randomPair.start)
  const [destRegionFilter, setDestRegionFilter] = useState<"hk" | "kln" | "nt">(randomPair.dest)
  const [routeTypeFilters, setRouteTypeFilters] = useState<{
    expressway: boolean
    trunk: boolean
    local: boolean
  }>({
    expressway: true,
    trunk: true,
    local: true
  })

  const {
    data: journeyTimeData,
    loading,
    error,
    lastUpdated,
    refresh,
    isStale,
    total
  } = useJourneyTimeData({
    enabled: true,
    autoRefresh,
    refreshInterval,
    startRegion: startRegionFilter,
    destRegion: destRegionFilter,
    limit: 50
  })

  // Filter data by route type
  const filteredData = useMemo(() => {
    if (!journeyTimeData) return []
    
    // Filter by selected route types
    return journeyTimeData.filter(jt => {
      // Skip temp routes (not included in toggle buttons)
      if (jt.routeType === 'temp') return false
      return routeTypeFilters[jt.routeType as keyof typeof routeTypeFilters]
    })
  }, [journeyTimeData, routeTypeFilters])


  const handleRouteClick = (from: string, to: string) => {
    console.log(`Route clicked: ${from} → ${to}`)
    // Could open detailed route view or navigation
  }

  const toggleRouteType = (routeType: keyof typeof routeTypeFilters) => {
    setRouteTypeFilters(prev => ({
      ...prev,
      [routeType]: !prev[routeType]
    }))
  }

  const formatLastUpdated = (isoString: string) => {
    try {
      const date = new Date(isoString)
      return date.toLocaleString('en-HK', {
        year: 'numeric',
        month: 'short',
        day: 'numeric', 
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return isoString
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Journey Times
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Real-time traffic conditions and journey times across Hong Kong
        </p>
      </div>

      {/* Status and last updated */}
      <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${isStale ? 'bg-orange-500' : 'bg-green-500 animate-pulse'}`} />
          <span className="text-sm text-muted-foreground">
            {lastUpdated ? (
              `Last updated: ${formatLastUpdated(lastUpdated)}`
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
              <span className="font-medium">Error loading journey time data</span>
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
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 shadow-sm">
          <div className="space-y-4">
            {/* Region Filters Row */}
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <Select value={startRegionFilter} onValueChange={(value: any) => setStartRegionFilter(value)}>
                  <SelectTrigger className="h-11 border-gray-300 dark:border-gray-600 focus:border-blue-500 focus:ring-blue-500">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REGION_FILTERS.map((filter) => (
                      <SelectItem key={filter.value} value={filter.value}>
                        {filter.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex-shrink-0">
                <ArrowRight className="h-5 w-5 text-gray-400" />
              </div>
              
              <div className="flex-1">
                <Select value={destRegionFilter} onValueChange={(value: any) => setDestRegionFilter(value)}>
                  <SelectTrigger className="h-11 border-gray-300 dark:border-gray-600 focus:border-blue-500 focus:ring-blue-500">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REGION_FILTERS.map((filter) => (
                      <SelectItem key={filter.value} value={filter.value}>
                        {filter.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {/* Road Type Filter Row */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-900 dark:text-gray-100">
                Road Type
              </label>
              <div className="flex gap-2">
                {Object.entries(ROUTE_TYPE_ICONS).map(([routeType, icon]) => (
                  <button
                    key={routeType}
                    onClick={() => toggleRouteType(routeType as keyof typeof routeTypeFilters)}
                    className={`
                      w-12 h-12 rounded-full border-2 flex items-center justify-center
                      transition-all duration-200 hover:shadow-md
                      ${routeTypeFilters[routeType as keyof typeof routeTypeFilters]
                        ? 'bg-gray-800 dark:bg-gray-200 border-gray-800 dark:border-gray-200 text-white dark:text-gray-800'
                        : 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400'
                      }
                    `}
                    title={routeType === 'expressway' ? 'Expressway' : routeType === 'trunk' ? 'Major Road' : 'Local Road'}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Journey Time Cards Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      ) : (
        <>
          {!filteredData || filteredData.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                {journeyTimeData && journeyTimeData.length > 0 
                  ? `No routes available for selected filters`
                  : 'No journey time data available'
                }
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredData.map((journey, index) => (
                <JourneyTimeCard
                  key={`${journey.from}-${journey.to}-${index}`}
                  from={journey.from}
                  to={journey.to}
                  timeMin={journey.timeMin}
                  trendMin={journey.trendMin}
                  colourId={journey.colourId}
                  capture={journey.capture}
                  locale={journey.locale}
                  routeType={journey.routeType}
                  onRouteClick={handleRouteClick}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}