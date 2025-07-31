"use client"

import { useState, useMemo, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import JourneyTimeCard from "@/components/journey-time-card"
import { useJourneyTimeData } from "@/hooks/useJourneyTimeData"
import { useLanguage } from "@/components/language-provider"
import { 
  RefreshCw, 
  AlertTriangle,
  Clock,
  MapPin,
  TrendingUp,
  ArrowRight
} from "lucide-react"

// Region filters will be generated dynamically based on language

// Valid region combinations based on actual journey time data
const VALID_REGION_COMBINATIONS: Record<string, string[]> = {
  "hk": ["kln"], // Hong Kong Island -> Kowloon only
  "kln": ["hk", "nt"], // Kowloon -> Hong Kong Island or New Territories
  "nt": ["hk", "kln", "nt"] // New Territories -> Hong Kong Island, Kowloon, or New Territories
}

// Helper function to get random region pair (follows valid combinations)
const getRandomRegionPair = () => {
  const regions = ["hk", "kln", "nt"] as const
  const start = regions[Math.floor(Math.random() * regions.length)]
  const validDestinations = VALID_REGION_COMBINATIONS[start]
  const dest = validDestinations[Math.floor(Math.random() * validDestinations.length)]
  
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
  const { language, t } = useLanguage()
  const randomPair = getRandomRegionPair()
  
  // Generate region filters based on current language
  const REGION_FILTERS = useMemo(() => [
    { value: "hk", label: `🏝️ ${t('regions.hk')}` },
    { value: "kln", label: `🏙️ ${t('regions.kln')}` },
    { value: "nt", label: `🏔️ ${t('regions.nt')}` },
  ], [t])
  
  // Helper function to get valid destination regions for a given start region
  const getValidDestinations = useMemo(() => (startRegion: string): typeof REGION_FILTERS => {
    const validDestinations = VALID_REGION_COMBINATIONS[startRegion] || []
    return REGION_FILTERS.filter(region => validDestinations.includes(region.value))
  }, [REGION_FILTERS])

  // Helper function to get valid start regions for a given destination region
  const getValidStartRegions = useMemo(() => (destRegion: string): typeof REGION_FILTERS => {
    const validStartRegions = Object.keys(VALID_REGION_COMBINATIONS).filter(startRegion => 
      VALID_REGION_COMBINATIONS[startRegion].includes(destRegion)
    )
    return REGION_FILTERS.filter(region => validStartRegions.includes(region.value))
  }, [REGION_FILTERS])
  
  const [startRegionFilter, setStartRegionFilter] = useState<"hk" | "kln" | "nt">(randomPair.start)
  const [destRegionFilter, setDestRegionFilter] = useState<"hk" | "kln" | "nt">(randomPair.dest)
  const [routeTypeFilters, setRouteTypeFilters] = useState<{
    expressway: boolean
    trunk: boolean
    local: boolean
  }>({
    expressway: false,
    trunk: false,
    local: false
  })

  // Get valid destinations for current start region
  const validDestinations = useMemo(() => {
    return getValidDestinations(startRegionFilter)
  }, [startRegionFilter, getValidDestinations])

  // Get valid start regions for current destination region
  const validStartRegions = useMemo(() => {
    return getValidStartRegions(destRegionFilter)
  }, [destRegionFilter, getValidStartRegions])

  // Auto-update destination if current selection becomes invalid
  useEffect(() => {
    const isCurrentDestValid = validDestinations.some(dest => dest.value === destRegionFilter)
    if (!isCurrentDestValid && validDestinations.length > 0) {
      setDestRegionFilter(validDestinations[0].value as "hk" | "kln" | "nt")
    }
  }, [startRegionFilter, destRegionFilter, validDestinations])

  // Auto-update start region if current selection becomes invalid
  useEffect(() => {
    const isCurrentStartValid = validStartRegions.some(start => start.value === startRegionFilter)
    if (!isCurrentStartValid && validStartRegions.length > 0) {
      setStartRegionFilter(validStartRegions[0].value as "hk" | "kln" | "nt")
    }
  }, [destRegionFilter, startRegionFilter, validStartRegions])

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
    limit: 50,
    language: language
  })

  // Determine available road types for current region combination
  const availableRouteTypes = useMemo(() => {
    if (!journeyTimeData) return { expressway: false, trunk: false, local: false }
    
    const available = {
      expressway: false,
      trunk: false,
      local: false
    }
    
    journeyTimeData.forEach(journey => {
      if (journey.routeType === 'expressway') available.expressway = true
      if (journey.routeType === 'trunk') available.trunk = true
      if (journey.routeType === 'local') available.local = true
    })
    
    return available
  }, [journeyTimeData])

  // Auto-enable available route types when data loads or regions change
  useEffect(() => {
    const hasAvailableTypes = Object.values(availableRouteTypes).some(available => available)
    
    if (hasAvailableTypes) {
      // Reset and enable all available route types when regions change
      const newFilters = {
        expressway: availableRouteTypes.expressway,
        trunk: availableRouteTypes.trunk,
        local: availableRouteTypes.local
      }
      
      setRouteTypeFilters(newFilters)
    } else {
      // If no types are available, reset all to false
      setRouteTypeFilters({
        expressway: false,
        trunk: false,
        local: false
      })
    }
  }, [availableRouteTypes, startRegionFilter, destRegionFilter])

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
    // Don't allow toggling if this route type is not available
    if (!availableRouteTypes[routeType]) return
    
    // Don't allow turning off if this is the only enabled route type
    const currentlyEnabled = Object.entries(routeTypeFilters).filter(([_, enabled]) => enabled)
    if (currentlyEnabled.length === 1 && currentlyEnabled[0][0] === routeType && routeTypeFilters[routeType]) {
      return // Prevent turning off the last enabled route type
    }
    
    setRouteTypeFilters(prev => ({
      ...prev,
      [routeType]: !prev[routeType]
    }))
  }

  // Helper function to get the visual state of a route type button
  const getRouteTypeState = (routeType: keyof typeof routeTypeFilters): 'disabled' | 'enabled' | 'available' => {
    if (!availableRouteTypes[routeType]) return 'disabled'
    if (routeTypeFilters[routeType]) return 'enabled'
    return 'available'
  }

  // Helper function to get route type label
  const getRouteTypeLabel = (routeType: string): string => {
    const labels = {
      expressway: t('journey.expressway'),
      trunk: t('journey.trunk'),
      local: t('journey.local'),
      temp: t('journey.temp')
    }
    return labels[routeType as keyof typeof labels] || routeType
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
                    {validStartRegions.map((filter) => (
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
                    {validDestinations.map((filter) => (
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
                {t('journey.roadType')}
              </label>
              <div className="flex gap-2">
                {Object.entries(ROUTE_TYPE_ICONS).map(([routeType, icon]) => {
                  const state = getRouteTypeState(routeType as keyof typeof routeTypeFilters)
                  const isDisabled = state === 'disabled'
                  const isEnabled = state === 'enabled'
                  const isLastEnabled = Object.entries(routeTypeFilters).filter(([_, enabled]) => enabled).length === 1 && isEnabled
                  
                  return (
                    <button
                      key={routeType}
                      onClick={() => toggleRouteType(routeType as keyof typeof routeTypeFilters)}
                      disabled={isDisabled}
                      className={`
                        w-12 h-12 rounded-full border-2 flex items-center justify-center
                        transition-all duration-200 relative
                        ${isDisabled 
                          ? 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-300 dark:text-gray-700 cursor-not-allowed opacity-50'
                          : isEnabled
                          ? 'bg-gray-800 dark:bg-gray-200 border-gray-800 dark:border-gray-200 text-white dark:text-gray-800 hover:bg-gray-900 dark:hover:bg-gray-100 hover:shadow-md'
                          : 'bg-white dark:bg-gray-800 border-gray-500 dark:border-gray-400 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-600 dark:hover:border-gray-300 hover:shadow-md'
                        }
                        ${isLastEnabled ? 'ring-2 ring-gray-400 dark:ring-gray-500' : ''}
                      `}
                      title={`${getRouteTypeLabel(routeType)} - ${isDisabled ? t('journey.notAvailableForRoute') : isEnabled ? t('journey.enabled') : t('journey.available')}`}
                    >
                      {icon}
                      {isLastEnabled && (
                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-gray-600 dark:bg-gray-400 rounded-full border-2 border-white dark:border-gray-900" />
                      )}
                    </button>
                  )
                })}
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
                <div className="space-y-2">
                  <p>
                    {journeyTimeData && journeyTimeData.length > 0 
                      ? t('journey.noRoutes')
                      : t('journey.noData')
                    }
                  </p>
                  {journeyTimeData && journeyTimeData.length > 0 && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {t('journey.tryDifferent')}
                    </p>
                  )}
                </div>
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
                  language={language}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}