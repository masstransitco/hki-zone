"use client"

import { useState, useMemo } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import AeHospitalCard from "@/components/ae-hospital-card"
import { useAeData } from "@/hooks/useAeData"
import { useLanguage } from "@/components/language-provider"
import { useEffect } from 'react'
import Image from "next/image"
import { 
  RefreshCw, 
  Search, 
  AlertTriangle,
  Filter,
  Clock,
  TrendingUp,
  X
} from "lucide-react"
import { 
  Drawer, 
  DrawerContent, 
  DrawerHeader, 
  DrawerTitle, 
  DrawerDescription, 
  DrawerClose 
} from "@/components/ui/drawer"


interface AeHospitalsListProps {
  showFilters?: boolean
  autoRefresh?: boolean
  refreshInterval?: number
  language?: string
}

export default function AeHospitalsList({ 
  showFilters = true, 
  autoRefresh = true,
  refreshInterval = 5 * 60 * 1000,
  language 
}: AeHospitalsListProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [clusterFilter, setClusterFilter] = useState("all")
  const [typeFilter, setTypeFilter] = useState("all")
  const [sortBy] = useState<"name">("name") // Fixed to name sorting
  const [filtersExpanded, setFiltersExpanded] = useState(false)
  const [selectedHospital, setSelectedHospital] = useState<any>(null)
  const [hospitalFeeData, setHospitalFeeData] = useState<any[]>([])
  const { t } = useLanguage()

  // Load hospital fee data
  useEffect(() => {
    const loadHospitalData = async () => {
      try {
        const response = await fetch('/hospitals.json')
        const data = await response.json()
        setHospitalFeeData(data)
      } catch (error) {
        console.error('Error loading hospital data:', error)
      }
    }
    loadHospitalData()
  }, [])

  // Get hospital fee information
  const getHospitalFeeInfo = (hospitalCode: string) => {
    return hospitalFeeData.find(h => h.code === hospitalCode)
  }

  // Format fee information
  const formatFeeInfo = (feeInfo: any) => {
    if (!feeInfo) return null
    
    if (typeof feeInfo.ae_fee_hkd === 'number') {
      return {
        type: 'standard',
        fee: feeInfo.ae_fee_hkd,
        ownership: feeInfo.ownership
      }
    } else if (typeof feeInfo.ae_fee_hkd === 'object') {
      return {
        type: 'time-based',
        fees: feeInfo.ae_fee_hkd,
        ownership: feeInfo.ownership
      }
    }
    return null
  }

  // Helper functions to get translated hospital data
  const getHospitalName = (hospital: any) => {
    const translationKey = `hospital.${hospital.hospital_code}`
    const translated = t(translationKey)
    return translated === translationKey ? hospital.hospital_name_en : translated
  }

  const getHospitalAddress = (hospital: any) => {
    const translationKey = `address.${hospital.hospital_code}`
    const translated = t(translationKey)
    return translated === translationKey ? hospital.address_en : translated
  }

  const getClusterName = (cluster: string) => {
    if (!cluster) return cluster
    
    const clusterMap: { [key: string]: string } = {
      "Hong Kong East": "hongKongEast",
      "Hong Kong West": "hongKongWest", 
      "Kowloon Central": "kowloonCentral",
      "Kowloon East": "kowloonEast",
      "Kowloon West": "kowloonWest",
      "New Territories East": "newTerritoriesEast",
      "New Territories West": "newTerritoriesWest"
    }
    
    const key = clusterMap[cluster]
    if (!key) return cluster
    
    const translationKey = `cluster.${key}`
    const translated = t(translationKey)
    return translated === translationKey ? cluster : translated
  }

  const formatWaitTime = (waitTime: string) => {
    if (!waitTime || waitTime === 'N/A') return waitTime
    
    // Add hr/小時 suffix to wait time values
    const timeRegex = /(<|>)\s*(\d+)/g
    const formatted = waitTime.replace(timeRegex, (match, operator, number) => {
      return `${operator}${number} ${t("ae.hour")}`
    })
    
    // Handle range formats like "2-4 hours" -> "2-4 hrs"
    const rangeRegex = /(\d+)\s*-\s*(\d+)\s*(hours?)?/g
    const finalFormatted = formatted.replace(rangeRegex, (match, start, end, hourText) => {
      return `${start}-${end} ${t("ae.hours")}`
    })
    
    return finalFormatted
  }

  const CLUSTER_FILTERS = [
    { value: "all", label: t("ae.allClusters") },
    { value: "Hong Kong East", label: getClusterName("Hong Kong East") },
    { value: "Hong Kong West", label: getClusterName("Hong Kong West") },
    { value: "Kowloon Central", label: getClusterName("Kowloon Central") },
    { value: "Kowloon East", label: getClusterName("Kowloon East") },
    { value: "Kowloon West", label: getClusterName("Kowloon West") },
    { value: "New Territories East", label: getClusterName("New Territories East") },
    { value: "New Territories West", label: getClusterName("New Territories West") },
  ]

  const TYPE_FILTERS = [
    { value: "all", label: t("ae.allTypes") },
    { value: "Public", label: t("ae.public") },
    { value: "Private", label: t("ae.private") },
  ]

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

  // Calculate hospital status statistics
  const hospitalStatus = useMemo(() => {
    if (!aeData) return { available: 0, shortWait: 0, moderateWait: 0, longWait: 0, unavailable: 0 }

    const available = aeData.filter(h => h.waitingData).length
    const shortWait = aeData.filter(h => 
      h.waitingData && (
        h.waitingData.current_wait_time.includes("< 1") ||
        h.waitingData.current_wait_time.includes("< 2") ||
        h.waitingData.current_wait_time === "< 1 hour" ||
        h.waitingData.current_wait_time === "< 2 hours"
      )
    ).length
    const moderateWait = aeData.filter(h => 
      h.waitingData && (
        h.waitingData.current_wait_time.includes("2-4") ||
        h.waitingData.current_wait_time.includes("2 - 4") ||
        h.waitingData.current_wait_time.includes("< 4")
      )
    ).length
    const longWait = aeData.filter(h => 
      h.waitingData && (
        h.waitingData.current_wait_time.includes("> 4") ||
        h.waitingData.current_wait_time.includes("> 6") ||
        h.waitingData.current_wait_time.includes("> 8")
      )
    ).length
    const unavailable = aeData.length - available

    return { available, shortWait, moderateWait, longWait, unavailable }
  }, [aeData])

  return (
    <div className="space-y-6">
      {/* Authoritative Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 flex items-center justify-center">
            <Image
              src="/menu-icons/ae.PNG"
              alt="Emergency Services"
              width={32}
              height={32}
              className="max-w-8 max-h-8 object-contain"
            />
          </div>
          <div className="w-1 h-8 bg-gray-400 rounded-full"></div>
          <div>
            <h1 className="text-xl font-bold text-foreground">{t("ae.emergencyServices")}</h1>
            <p className="text-sm text-muted-foreground">{t("ae.realTimeStatus")}</p>
          </div>
        </div>
        
        {/* Hospital Status Overview */}
        <div className="grid grid-cols-4 gap-3 p-4 bg-muted/30 rounded-lg">
          <div className="text-center">
            <div className="flex items-center justify-center w-8 h-8 bg-green-100 dark:bg-green-900/20 rounded-full mx-auto mb-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            </div>
            <div className="text-lg font-semibold">{hospitalStatus.shortWait}</div>
            <div className="text-xs text-muted-foreground">{t("ae.shortWait")}</div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center w-8 h-8 bg-orange-100 dark:bg-orange-900/20 rounded-full mx-auto mb-2">
              <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
            </div>
            <div className="text-lg font-semibold">{hospitalStatus.moderateWait}</div>
            <div className="text-xs text-muted-foreground">{t("ae.moderateWait")}</div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center w-8 h-8 bg-red-100 dark:bg-red-900/20 rounded-full mx-auto mb-2">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
            </div>
            <div className="text-lg font-semibold">{hospitalStatus.longWait}</div>
            <div className="text-xs text-muted-foreground">{t("ae.longWait")}</div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center w-8 h-8 bg-gray-100 dark:bg-gray-900/20 rounded-full mx-auto mb-2">
              <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
            </div>
            <div className="text-lg font-semibold">{hospitalStatus.unavailable}</div>
            <div className="text-xs text-muted-foreground">{t("ae.unavailable")}</div>
          </div>
        </div>
      </div>


      {/* Error handling */}
      {error && (
        <Card className="border-red-200 bg-red-50 dark:bg-red-900/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-red-800 dark:text-red-400">
              <AlertTriangle className="h-4 w-4" />
              <span className="font-medium">{t("ae.errorLoading")}</span>
            </div>
            <p className="text-red-700 dark:text-red-300 mt-1 text-sm">{error}</p>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={refresh}
              className="mt-3"
            >
              {t("ae.tryAgain")}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Compact Filters */}
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
                <span className="text-sm">{filtersExpanded ? t("ae.hideFilters") : t("ae.showFilters")}</span>
              </Button>
              {(searchQuery || clusterFilter !== 'all' || typeFilter !== 'all') && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearchQuery('')
                    setClusterFilter('all')
                    setTypeFilter('all')
                  }}
                  className="text-xs h-8"
                >
                  {t("ae.clear")}
                </Button>
              )}
            </div>
            
            {/* Compact Status Bar */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isStale ? 'bg-orange-500' : 'bg-green-500 animate-pulse'}`} />
                <span className="text-xs text-muted-foreground">
                  {lastUpdated ? lastUpdated.split(' ')[1] : t("ae.loading")}
                </span>
                {isStale && (
                  <Badge variant="outline" className="text-xs px-1 py-0 h-5 text-orange-600 border-orange-600">
                    {t("ae.stale")}
                  </Badge>
                )}
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
                      placeholder={t("ae.searchPlaceholder")}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 h-9"
                    />
                  </div>

                  {/* Cluster Filter */}
                  <Select value={clusterFilter} onValueChange={setClusterFilter}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder={t("ae.allClusters")} />
                    </SelectTrigger>
                    <SelectContent>
                      {CLUSTER_FILTERS.map((cluster) => (
                        <SelectItem key={cluster.value} value={cluster.value}>
                          {cluster.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Type Filter */}
                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder={t("ae.allTypes")} />
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
                {aeData?.length === 0 ? t("ae.noData") : t("ae.noMatches")}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredAndSortedHospitals.map((hospital) => (
                <div
                  key={hospital.hospital.hospital_code}
                  onClick={() => setSelectedHospital(hospital)}
                  className="flex items-center justify-between p-4 bg-background border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <div>
                        <h3 className="font-medium text-sm">{getHospitalName(hospital.hospital)}</h3>
                        <p className="text-xs text-muted-foreground">{getClusterName(hospital.hospital.cluster)}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-sm font-medium">
                        {hospital.waitingData ? formatWaitTime(hospital.waitingData.current_wait_time) : 'N/A'}
                      </div>
                      <div className="text-xs text-muted-foreground">{t("ae.waitTime")}</div>
                    </div>
                    <div className={`w-3 h-3 rounded-full ${
                      hospital.waitingData
                        ? hospital.waitingData.current_wait_time.includes('> 4') ||
                          hospital.waitingData.current_wait_time.includes('> 6') ||
                          hospital.waitingData.current_wait_time.includes('> 8')
                          ? 'bg-red-500'
                          : hospital.waitingData.current_wait_time.includes('> 2')
                          ? 'bg-orange-500'
                          : 'bg-green-500'
                        : 'bg-gray-400'
                    }`} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Hospital Details Bottom Sheet */}
      <Drawer open={!!selectedHospital} onOpenChange={() => setSelectedHospital(null)}>
        <DrawerContent className="max-h-[90vh]">
          <DrawerHeader className="px-6 pt-4 pb-2">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <DrawerTitle className="text-left">{selectedHospital && getHospitalName(selectedHospital.hospital)}</DrawerTitle>
                <DrawerDescription className="text-left">{selectedHospital && getClusterName(selectedHospital.hospital.cluster)}</DrawerDescription>
              </div>
              <DrawerClose asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 ml-4">
                  <X className="h-4 w-4" />
                </Button>
              </DrawerClose>
            </div>
          </DrawerHeader>
          
          <div className="px-6 pb-6 space-y-4">
            {selectedHospital && (
              <>
                {/* Wait Time Status */}
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">{t("ae.currentWaitTime")}</h4>
                        <p className="text-2xl font-bold text-primary">
                          {selectedHospital.waitingData ? formatWaitTime(selectedHospital.waitingData.current_wait_time) : 'N/A'}
                        </p>
                      </div>
                      <div className={`w-4 h-4 rounded-full ${
                        selectedHospital.waitingData
                          ? selectedHospital.waitingData.current_wait_time.includes('> 4') ||
                            selectedHospital.waitingData.current_wait_time.includes('> 6') ||
                            selectedHospital.waitingData.current_wait_time.includes('> 8')
                            ? 'bg-red-500'
                            : selectedHospital.waitingData.current_wait_time.includes('> 2')
                            ? 'bg-orange-500'
                            : 'bg-green-500'
                          : 'bg-gray-400'
                      }`} />
                    </div>
                  </CardContent>
                </Card>

                {/* Hospital Details */}
                <Card>
                  <CardContent className="p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <h4 className="font-medium text-sm">{t("ae.type")}</h4>
                        <p className="text-sm text-muted-foreground">{selectedHospital.hospital.type}</p>
                      </div>
                      <div>
                        <h4 className="font-medium text-sm">{t("ae.cluster")}</h4>
                        <p className="text-sm text-muted-foreground">{getClusterName(selectedHospital.hospital.cluster)}</p>
                      </div>
                    </div>
                    
                    {(selectedHospital.hospital.address_en || getHospitalAddress(selectedHospital.hospital)) && (
                      <div>
                        <h4 className="font-medium text-sm">{t("ae.address")}</h4>
                        <p className="text-sm text-muted-foreground">{getHospitalAddress(selectedHospital.hospital)}</p>
                      </div>
                    )}
                    
                    {selectedHospital.hospital.phone && (
                      <div>
                        <h4 className="font-medium text-sm">{t("ae.phone")}</h4>
                        <p className="text-sm text-muted-foreground">{selectedHospital.hospital.phone}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* A&E Fee Information */}
                {(() => {
                  const feeInfo = getHospitalFeeInfo(selectedHospital.hospital.hospital_code)
                  const formattedFee = formatFeeInfo(feeInfo)
                  if (!formattedFee) return null
                  
                  return (
                    <Card>
                      <CardContent className="p-4">
                        <h4 className="font-medium text-sm mb-3">{t("ae.feeInformation")}</h4>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">
                              {formattedFee.ownership === 'public-HA' ? t("ae.publicHospital") : t("ae.privateHospital")}
                            </span>
                            <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                          </div>
                          
                          {formattedFee.type === 'standard' ? (
                            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                              <span className="text-sm font-medium">{t("ae.standardFee")}</span>
                              <span className="text-lg font-bold text-primary">{t("ae.hkd")}{formattedFee.fee}</span>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <div className="text-sm font-medium mb-2">{t("ae.timeBasedFee")}</div>
                              {Object.entries(formattedFee.fees).map(([time, fee]) => (
                                <div key={time} className="flex items-center justify-between p-2 bg-muted/30 rounded">
                                  <span className="text-xs text-muted-foreground">{time}</span>
                                  <span className="text-sm font-medium">{t("ae.hkd")}{fee}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )
                })()}
              </>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  )
}