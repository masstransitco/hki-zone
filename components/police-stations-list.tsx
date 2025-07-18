"use client"

import { useState, useMemo, useCallback } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import PoliceStationCard from "@/components/police-station-card"
import { usePoliceData } from "@/hooks/usePoliceData"
import { useLanguage } from "@/components/language-provider"
import Image from "next/image"
import { 
  RefreshCw, 
  Search, 
  AlertTriangle,
  Filter,
  Shield,
  X,
  Phone,
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

interface PoliceStationsListProps {
  showFilters?: boolean
  autoRefresh?: boolean
  refreshInterval?: number
}

export default function PoliceStationsList({ 
  showFilters = true, 
  autoRefresh = false,
  refreshInterval = 30 * 60 * 1000
}: PoliceStationsListProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [districtFilter, setDistrictFilter] = useState("all")
  const [serviceFilter, setServiceFilter] = useState("all")
  const [filtersExpanded, setFiltersExpanded] = useState(false)
  const [selectedStation, setSelectedStation] = useState<any>(null)
  const { t } = useLanguage()

  // Helper functions to get translated police data
  const getStationName = useCallback((stationName: string) => {
    const translationKey = `station.${stationName}`
    const translated = t(translationKey)
    return translated === translationKey ? stationName : translated
  }, [t])

  const getDistrictName = useCallback((district: string) => {
    const translationKey = `district.${district}`
    const translated = t(translationKey)
    return translated === translationKey ? district : translated
  }, [t])

  const getServiceName = useCallback((service: string) => {
    const translationKey = `service.${service}`
    const translated = t(translationKey)
    return translated === translationKey ? service : translated
  }, [t])

  const {
    data: policeData,
    loading,
    error,
    lastUpdated,
    refresh,
    metadata
  } = usePoliceData({
    district: districtFilter,
    service: serviceFilter,
    search: searchQuery,
    enabled: true,
    autoRefresh,
    refreshInterval
  })

  // District filter options
  const DISTRICT_FILTERS = useMemo(() => [
    { value: "all", label: t("police.allDistricts") },
    ...(metadata?.districts_available || []).map(district => ({
      value: district,
      label: getDistrictName(district)
    }))
  ], [metadata?.districts_available, t, getDistrictName])

  // Service filter options
  const SERVICE_FILTERS = useMemo(() => [
    { value: "all", label: t("police.allServices") },
    ...(metadata?.services_available || []).map(service => ({
      value: service,
      label: getServiceName(service)
    }))
  ], [metadata?.services_available, t, getServiceName])

  // Filter and sort police stations
  const filteredAndSortedStations = useMemo(() => {
    if (!policeData) return []

    return policeData.sort((a, b) => {
      return a.name.localeCompare(b.name)
    })
  }, [policeData])

  // Calculate station status statistics
  const stationStatus = useMemo(() => {
    if (!policeData) return { total: 0, withCoordinates: 0, districts: 0, services: 0 }

    const total = policeData.length
    const withCoordinates = policeData.filter(s => s.hasCoordinates).length
    const districts = new Set(policeData.map(s => s.district)).size
    const services = new Set(policeData.flatMap(s => s.services)).size

    return { total, withCoordinates, districts, services }
  }, [policeData])

  const getPhoneNumber = () => {
    return '2527-7177' // General Hong Kong Police hotline
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 flex items-center justify-center">
            <Image
              src="/menu-icons/police.PNG"
              alt="Police Services"
              width={32}
              height={32}
              className="max-w-8 max-h-8 object-contain"
            />
          </div>
          <div className="w-1 h-8 bg-gray-400 rounded-full"></div>
          <div>
            <h1 className="text-xl font-bold text-foreground">{t("police.policeStations")}</h1>
            <p className="text-sm text-muted-foreground">{t("police.findStations")}</p>
          </div>
        </div>
        
        {/* Station Status Overview */}
        <div className="grid grid-cols-4 gap-3 p-4 bg-muted/30 rounded-lg">
          <div className="text-center">
            <div className="flex items-center justify-center w-8 h-8 bg-blue-100 dark:bg-blue-900/20 rounded-full mx-auto mb-2">
              <Shield className="w-3 h-3 text-blue-600" />
            </div>
            <div className="text-lg font-semibold">{stationStatus.total}</div>
            <div className="text-xs text-muted-foreground">{t("police.totalStations")}</div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center w-8 h-8 bg-green-100 dark:bg-green-900/20 rounded-full mx-auto mb-2">
              <MapPin className="w-3 h-3 text-green-600" />
            </div>
            <div className="text-lg font-semibold">{stationStatus.withCoordinates}</div>
            <div className="text-xs text-muted-foreground">{t("police.withDirections")}</div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center w-8 h-8 bg-purple-100 dark:bg-purple-900/20 rounded-full mx-auto mb-2">
              <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
            </div>
            <div className="text-lg font-semibold">{stationStatus.districts}</div>
            <div className="text-xs text-muted-foreground">{t("police.districts")}</div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center w-8 h-8 bg-orange-100 dark:bg-orange-900/20 rounded-full mx-auto mb-2">
              <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
            </div>
            <div className="text-lg font-semibold">{stationStatus.services}</div>
            <div className="text-xs text-muted-foreground">{t("police.serviceTypes")}</div>
          </div>
        </div>
      </div>

      {/* Error handling */}
      {error && (
        <Card className="border-red-200 bg-red-50 dark:bg-red-900/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-red-800 dark:text-red-400">
              <AlertTriangle className="h-4 w-4" />
              <span className="font-medium">{t("police.errorLoading")}</span>
            </div>
            <p className="text-red-700 dark:text-red-300 mt-1 text-sm">{error}</p>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={refresh}
              className="mt-3"
            >
              {t("police.tryAgain")}
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
                <span className="text-sm">{filtersExpanded ? t("police.hideFilters") : t("police.showFilters")}</span>
              </Button>
              {(searchQuery || districtFilter !== 'all' || serviceFilter !== 'all') && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearchQuery('')
                    setDistrictFilter('all')
                    setServiceFilter('all')
                  }}
                  className="text-xs h-8"
                >
                  {t("police.clear")}
                </Button>
              )}
            </div>
            
            {/* Status Bar */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-xs text-muted-foreground">
                  {lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : t("police.loaded")}
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
                      placeholder={t("police.searchPlaceholder")}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 h-9"
                    />
                  </div>

                  {/* District Filter */}
                  <Select value={districtFilter} onValueChange={setDistrictFilter}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder={t("police.allDistricts")} />
                    </SelectTrigger>
                    <SelectContent>
                      {DISTRICT_FILTERS.map((district) => (
                        <SelectItem key={district.value} value={district.value}>
                          {district.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Service Filter */}
                  <Select value={serviceFilter} onValueChange={setServiceFilter}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder={t("police.allServices")} />
                    </SelectTrigger>
                    <SelectContent>
                      {SERVICE_FILTERS.map((service) => (
                        <SelectItem key={service.value} value={service.value}>
                          {service.label}
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

      {/* Stations Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      ) : (
        <>
          {filteredAndSortedStations.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                {policeData?.length === 0 ? t("police.noStations") : t("police.noMatches")}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredAndSortedStations.map((station) => (
                <div
                  key={station.id}
                  onClick={() => setSelectedStation(station)}
                  className="flex items-center justify-between p-4 bg-background border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <div>
                        <h3 className="font-medium text-sm">{getStationName(station.name)}</h3>
                        <p className="text-xs text-muted-foreground">{getDistrictName(station.district)}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-sm font-medium">{getServiceName(station.primaryService)}</div>
                      <div className="text-xs text-muted-foreground">
                        {station.serviceCount} {station.serviceCount > 1 ? t("police.services") : t("police.service")}
                      </div>
                    </div>
                    <div className="w-3 h-3 rounded-full bg-blue-500" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Station Details Bottom Sheet */}
      <Drawer open={!!selectedStation} onOpenChange={() => setSelectedStation(null)}>
        <DrawerContent className="max-h-[90vh]">
          <DrawerHeader className="px-6 pt-4 pb-2">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <DrawerTitle className="text-left">{selectedStation && getStationName(selectedStation.name)}</DrawerTitle>
                <DrawerDescription className="text-left">{selectedStation && getDistrictName(selectedStation.district)}</DrawerDescription>
              </div>
              <DrawerClose asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 ml-4">
                  <X className="h-4 w-4" />
                </Button>
              </DrawerClose>
            </div>
          </DrawerHeader>
          
          <div className="px-6 pb-6 space-y-4">
            {selectedStation && (
              <>
                {/* Services */}
                <Card>
                  <CardContent className="p-4">
                    <h4 className="font-medium mb-3">{t("police.servicesAvailable")}</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedStation.services.map((service: string, index: number) => (
                        <Badge key={index} variant="secondary" className="text-xs">
                          {getServiceName(service)}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Contact & Location */}
                <Card>
                  <CardContent className="p-4 space-y-3">
                    <div>
                      <h4 className="font-medium text-sm">{t("police.address")}</h4>
                      <p className="text-sm text-muted-foreground">{selectedStation.address}</p>
                    </div>
                    
                    <div>
                      <h4 className="font-medium text-sm">{t("police.phone")}</h4>
                      <p className="text-sm text-muted-foreground">{getPhoneNumber()}</p>
                    </div>

                    {!selectedStation.hasCoordinates && (
                      <div className="text-xs text-amber-600 dark:text-amber-400">
                        ⚠️ {t("police.coordinatesUnavailable")}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Actions */}
                <div className="flex gap-3">
                  <Button 
                    className="flex-1"
                    onClick={() => window.open(`tel:${getPhoneNumber()}`, '_self')}
                  >
                    <Phone className="h-4 w-4 mr-2" />
                    {t("police.callStation")}
                  </Button>
                  
                  <Button 
                    variant="outline"
                    className="flex-1"
                    onClick={() => window.open(
                      selectedStation.hasCoordinates 
                        ? `https://maps.google.com/maps?q=${selectedStation.latitude},${selectedStation.longitude}`
                        : `https://maps.google.com/maps?q=${encodeURIComponent(selectedStation.address)}`,
                      '_blank'
                    )}
                  >
                    <MapPin className="h-4 w-4 mr-2" />
                    {selectedStation.hasCoordinates ? t("police.directions") : t("police.search")}
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