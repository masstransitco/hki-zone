"use client"

import { useState, useMemo, useCallback } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import ParkCard from "@/components/park-card"
import { useParksData } from "@/hooks/useParksData"
import { useLanguage } from "@/components/language-provider"
import Image from "next/image"
import { 
  RefreshCw, 
  Search, 
  AlertTriangle,
  Filter,
  Trees,
  X,
  MapPin
} from "lucide-react"
import { 
  Drawer, 
  DrawerContent, 
  DrawerHeader, 
  DrawerTitle, 
  DrawerDescription, 
  DrawerClose 
} from "@/components/ui/drawer"

interface ParksListProps {
  showFilters?: boolean
  autoRefresh?: boolean
  refreshInterval?: number
}

export default function ParksList({ 
  showFilters = true, 
  autoRefresh = false,
  refreshInterval = 30 * 60 * 1000
}: ParksListProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [districtFilter, setDistrictFilter] = useState("all")
  const [typeFilter, setTypeFilter] = useState("all")
  const [filtersExpanded, setFiltersExpanded] = useState(false)
  const [selectedPark, setSelectedPark] = useState<any>(null)
  const { t } = useLanguage()

  // Helper functions to get translated park data
  const getParkName = useCallback((parkName: string) => {
    const translationKey = `park.${parkName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}`
    const translated = t(translationKey)
    return translated === translationKey ? parkName : translated
  }, [t])

  const getDistrictName = useCallback((district: string) => {
    const translationKey = `parkDistrict.${district.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}`
    const translated = t(translationKey)
    return translated === translationKey ? district : translated
  }, [t])

  const getParkType = useCallback((type: string) => {
    const translationKey = `parkType.${type.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}`
    const translated = t(translationKey)
    return translated === translationKey ? type : translated
  }, [t])

  const {
    data: parksData,
    loading,
    error,
    lastUpdated,
    refresh,
    metadata
  } = useParksData({
    district: districtFilter,
    type: typeFilter,
    search: searchQuery,
    enabled: true,
    autoRefresh,
    refreshInterval
  })

  // District filter options
  const DISTRICT_FILTERS = useMemo(() => [
    { value: "all", label: t("parks.allDistricts") },
    ...(metadata?.districts_available || []).map(district => ({
      value: district,
      label: getDistrictName(district)
    }))
  ], [metadata?.districts_available, t, getDistrictName])

  // Type filter options
  const TYPE_FILTERS = useMemo(() => [
    { value: "all", label: t("parks.allTypes") },
    ...(metadata?.types_available || []).map(type => ({
      value: type,
      label: getParkType(type)
    }))
  ], [metadata?.types_available, t, getParkType])

  // Filter and sort parks
  const filteredAndSortedParks = useMemo(() => {
    if (!parksData) return []

    return parksData.sort((a, b) => {
      return a.name.localeCompare(b.name)
    })
  }, [parksData])

  // Calculate park status statistics
  const parkStatus = useMemo(() => {
    if (!parksData) return { total: 0, withCoordinates: 0, districts: 0, types: 0 }

    const total = parksData.length
    const withCoordinates = parksData.filter(p => p.hasCoordinates).length
    const districts = new Set(parksData.map(p => p.district)).size
    const types = new Set(parksData.map(p => p.type)).size

    return { total, withCoordinates, districts, types }
  }, [parksData])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 flex items-center justify-center">
            <Image
              src="/menu-icons/park.PNG"
              alt="Parks & Recreation"
              width={32}
              height={32}
              className="max-w-8 max-h-8 object-contain"
            />
          </div>
          <div className="w-1 h-8 bg-gray-400 rounded-full"></div>
          <div>
            <h1 className="text-xl font-bold text-foreground">{t("parks.parksAndRecreation")}</h1>
            <p className="text-sm text-muted-foreground">{t("parks.findParks")}</p>
          </div>
        </div>
        
        {/* Park Status Overview */}
        <div className="grid grid-cols-4 gap-3 p-4 bg-muted/30 rounded-lg">
          <div className="text-center">
            <div className="flex items-center justify-center w-8 h-8 bg-green-100 dark:bg-green-900/20 rounded-full mx-auto mb-2">
              <Trees className="w-3 h-3 text-green-600" />
            </div>
            <div className="text-lg font-semibold">{parkStatus.total}</div>
            <div className="text-xs text-muted-foreground">{t("parks.totalParks")}</div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center w-8 h-8 bg-blue-100 dark:bg-blue-900/20 rounded-full mx-auto mb-2">
              <MapPin className="w-3 h-3 text-blue-600" />
            </div>
            <div className="text-lg font-semibold">{parkStatus.withCoordinates}</div>
            <div className="text-xs text-muted-foreground">{t("parks.withDirections")}</div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center w-8 h-8 bg-purple-100 dark:bg-purple-900/20 rounded-full mx-auto mb-2">
              <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
            </div>
            <div className="text-lg font-semibold">{parkStatus.districts}</div>
            <div className="text-xs text-muted-foreground">{t("parks.districts")}</div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center w-8 h-8 bg-orange-100 dark:bg-orange-900/20 rounded-full mx-auto mb-2">
              <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
            </div>
            <div className="text-lg font-semibold">{parkStatus.types}</div>
            <div className="text-xs text-muted-foreground">{t("parks.parkTypes")}</div>
          </div>
        </div>
      </div>

      {/* Error handling */}
      {error && (
        <Card className="border-red-200 bg-red-50 dark:bg-red-900/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-red-800 dark:text-red-400">
              <AlertTriangle className="h-4 w-4" />
              <span className="font-medium">{t("parks.errorLoading")}</span>
            </div>
            <p className="text-red-700 dark:text-red-300 mt-1 text-sm">{error}</p>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={refresh}
              className="mt-3"
            >
              {t("parks.tryAgain")}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      {showFilters && (
        <div className="space-y-3">
          {/* Filter Toggle and Status Bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFiltersExpanded(!filtersExpanded)}
                className="flex items-center gap-2 h-8"
              >
                <Filter className="h-4 w-4" />
                <span className="text-sm">{filtersExpanded ? t("parks.hideFilters") : t("parks.showFilters")}</span>
              </Button>
              {(searchQuery || districtFilter !== 'all' || typeFilter !== 'all') && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearchQuery('')
                    setDistrictFilter('all')
                    setTypeFilter('all')
                  }}
                  className="text-xs h-8"
                >
                  {t("parks.clear")}
                </Button>
              )}
            </div>
            
            {/* Status Bar */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-xs text-muted-foreground">
                  {lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : t("parks.loaded")}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={refresh}
                disabled={loading}
                className="h-8 w-8 p-0"
              >
                <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>

          {/* Collapsible Filters */}
          {filtersExpanded && (
            <Card>
              <CardContent className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Search */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      type="text"
                      placeholder={t("parks.searchPlaceholder")}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 h-9"
                    />
                  </div>

                  {/* District Filter */}
                  <Select value={districtFilter} onValueChange={setDistrictFilter}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder={t("parks.allDistricts")} />
                    </SelectTrigger>
                    <SelectContent>
                      {DISTRICT_FILTERS.map((district) => (
                        <SelectItem key={district.value} value={district.value}>
                          {district.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Type Filter */}
                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder={t("parks.allTypes")} />
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
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Parks Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      ) : (
        <>
          {filteredAndSortedParks.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                {parksData?.length === 0 ? t("parks.noParks") : t("parks.noMatches")}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredAndSortedParks.map((park) => (
                <div
                  key={park.id}
                  onClick={() => setSelectedPark(park)}
                  className="flex items-center justify-between p-4 bg-background border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <div>
                        <h3 className="font-medium text-sm">{getParkName(park.name)}</h3>
                        <p className="text-xs text-muted-foreground">{getDistrictName(park.district)}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-sm font-medium">{getParkType(park.type)}</div>
                      <div className="text-xs text-muted-foreground">{park.hasCoordinates ? t("parks.withDirections") : t("parks.addressOnly")}</div>
                    </div>
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Park Details Bottom Sheet */}
      <Drawer open={!!selectedPark} onOpenChange={() => setSelectedPark(null)}>
        <DrawerContent className="max-h-[90vh]">
          <DrawerHeader className="px-6 pt-4 pb-2">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <DrawerTitle className="text-left">{selectedPark && getParkName(selectedPark.name)}</DrawerTitle>
                <DrawerDescription className="text-left">{selectedPark && getDistrictName(selectedPark.district)}</DrawerDescription>
              </div>
              <DrawerClose asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 ml-4">
                  <X className="h-4 w-4" />
                </Button>
              </DrawerClose>
            </div>
          </DrawerHeader>
          
          <div className="px-6 pb-6 space-y-4">
            {selectedPark && (
              <>
                {/* Park Type */}
                <Card>
                  <CardContent className="p-4">
                    <h4 className="font-medium mb-3">{t("parks.parkType")}</h4>
                    <Badge variant="secondary" className="text-xs">
                      {getParkType(selectedPark.type)}
                    </Badge>
                  </CardContent>
                </Card>

                {/* Location */}
                <Card>
                  <CardContent className="p-4 space-y-3">
                    <div>
                      <h4 className="font-medium text-sm">{t("parks.address")}</h4>
                      <p className="text-sm text-muted-foreground">{selectedPark.address}</p>
                    </div>

                    {!selectedPark.hasCoordinates && (
                      <div className="text-xs text-amber-600 dark:text-amber-400">
                        ⚠️ {t("parks.coordinatesUnavailable")}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Actions */}
                <div className="flex gap-3">
                  <Button 
                    variant="outline"
                    className="flex-1"
                    onClick={() => window.open(
                      selectedPark.hasCoordinates 
                        ? `https://maps.google.com/maps?q=${selectedPark.latitude},${selectedPark.longitude}`
                        : `https://maps.google.com/maps?q=${encodeURIComponent(selectedPark.address)}`,
                      '_blank'
                    )}
                  >
                    <MapPin className="h-4 w-4 mr-2" />
                    {selectedPark.hasCoordinates ? t("parks.directions") : t("parks.search")}
                  </Button>
                </div>
              </>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  )
}