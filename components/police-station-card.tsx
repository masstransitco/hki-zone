"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/components/language-provider"
import { 
  Phone, 
  MapPin, 
  Shield, 
  Building,
  ExternalLink,
  Clock
} from "lucide-react"

interface PoliceStationCardProps {
  station: {
    name: string
    address: string
    district: string
    services: string[]
    latitude: number | null
    longitude: number | null
    id: string
    hasCoordinates: boolean
    primaryService: string
    serviceCount: number
  }
  showDetails?: boolean
}

export default function PoliceStationCard({ 
  station, 
  showDetails = false 
}: PoliceStationCardProps) {
  const { t } = useLanguage()

  // Helper functions to get translated police data
  const getStationName = (stationName: string) => {
    const translationKey = `station.${stationName}`
    const translated = t(translationKey)
    return translated === translationKey ? stationName : translated
  }

  const getDistrictName = (district: string) => {
    const translationKey = `district.${district}`
    const translated = t(translationKey)
    return translated === translationKey ? district : translated
  }

  const getServiceName = (service: string) => {
    const translationKey = `service.${service}`
    const translated = t(translationKey)
    return translated === translationKey ? service : translated
  }
  const getServiceColor = (service: string) => {
    switch (service) {
      case 'Report Room':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
      case 'Police Reporting Centre':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      case 'Police Services Centre':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
      case 'Police Post':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
      case 'Control Point Police Reporting Centre':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
    }
  }

  const getDistrictColor = (district: string) => {
    switch (district) {
      case 'Hong Kong Island':
        return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200'
      case 'Kowloon East':
        return 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200'
      case 'Kowloon West':
        return 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200'
      case 'New Territories South':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200'
      case 'New Territories North':
        return 'bg-lime-100 text-lime-800 dark:bg-lime-900 dark:text-lime-200'
      case 'Marine Region':
        return 'bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
    }
  }

  const getPhoneNumber = () => {
    // General Hong Kong Police hotline
    return '2527-7177'
  }

  return (
    <Card className="hover:shadow-md transition-shadow duration-200 border-gray-200 dark:border-gray-700">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
              {getStationName(station.name)}
            </CardTitle>
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <Badge 
                variant="outline" 
                className={`text-xs ${getDistrictColor(station.district)}`}
              >
                {getDistrictName(station.district)}
              </Badge>
              <span>•</span>
              <span>{station.serviceCount} {station.serviceCount > 1 ? t("police.services") : t("police.service")}</span>
            </div>
          </div>
          <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Services */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 mb-2">
            <Building className="h-4 w-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t("police.servicesAvailable")}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {station.services.map((service, index) => (
              <Badge 
                key={index}
                variant="secondary"
                className={`text-xs ${getServiceColor(service)}`}
              >
                {getServiceName(service)}
              </Badge>
            ))}
          </div>
        </div>

        {/* Address */}
        <div className="flex items-start gap-2">
          <MapPin className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {station.address}
          </p>
        </div>

        {/* Coordinates Status */}
        {!station.hasCoordinates && (
          <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
            <Clock className="h-3 w-3" />
            <span>{t("police.coordinatesUnavailable")}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-2 border-t border-gray-100 dark:border-gray-800">
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1"
            onClick={() => window.open(`tel:${getPhoneNumber()}`, '_self')}
          >
            <Phone className="h-3 w-3 mr-1" />
            {t("police.call")}
          </Button>
          
          {station.hasCoordinates && (
            <Button 
              variant="outline" 
              size="sm" 
              className="flex-1"
              onClick={() => window.open(
                `https://maps.google.com/maps?q=${station.latitude},${station.longitude}`, 
                '_blank'
              )}
            >
              <MapPin className="h-3 w-3 mr-1" />
              {t("police.directions")}
            </Button>
          )}
          
          {!station.hasCoordinates && (
            <Button 
              variant="outline" 
              size="sm" 
              className="flex-1"
              onClick={() => window.open(
                `https://maps.google.com/maps?q=${encodeURIComponent(station.address)}`, 
                '_blank'
              )}
            >
              <MapPin className="h-3 w-3 mr-1" />
              {t("police.search")}
            </Button>
          )}
        </div>

      </CardContent>
    </Card>
  )
}