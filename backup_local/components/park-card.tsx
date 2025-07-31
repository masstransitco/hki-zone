"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/components/language-provider"
import { 
  MapPin, 
  Trees, 
  ExternalLink,
  Clock
} from "lucide-react"

interface ParkCardProps {
  park: {
    id: string
    name: string
    address: string
    district: string
    type: string
    latitude: number
    longitude: number
    hasCoordinates: boolean
  }
  showDetails?: boolean
}

export default function ParkCard({ 
  park, 
  showDetails = false 
}: ParkCardProps) {
  const { t } = useLanguage()

  // Helper functions to get translated park data
  const getParkName = (parkName: string) => {
    const translationKey = `park.${parkName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}`
    const translated = t(translationKey)
    return translated === translationKey ? parkName : translated
  }

  const getDistrictName = (district: string) => {
    const translationKey = `parkDistrict.${district.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}`
    const translated = t(translationKey)
    return translated === translationKey ? district : translated
  }

  const getParkType = (type: string) => {
    const translationKey = `parkType.${type.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}`
    const translated = t(translationKey)
    return translated === translationKey ? type : translated
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'Public Park':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      case 'Country Park':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200'
      case 'Beach Park':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
      case 'Garden':
        return 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200'
      case 'Recreation Ground':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
      case 'Playground':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
      case 'Sports Ground':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
      case 'Swimming Pool':
        return 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200'
      case 'Waterfront Park':
        return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200'
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
      case 'Islands':
        return 'bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
    }
  }

  return (
    <Card className="hover:shadow-md transition-shadow duration-200 border-gray-200 dark:border-gray-700">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
              {getParkName(park.name)}
            </CardTitle>
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <Badge 
                variant="outline" 
                className={`text-xs ${getDistrictColor(park.district)}`}
              >
                {getDistrictName(park.district)}
              </Badge>
              <span>•</span>
              <Badge 
                variant="outline" 
                className={`text-xs ${getTypeColor(park.type)}`}
              >
                {getParkType(park.type)}
              </Badge>
            </div>
          </div>
          <Trees className="h-5 w-5 text-green-600 dark:text-green-400" />
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Address */}
        <div className="flex items-start gap-2">
          <MapPin className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {park.address}
          </p>
        </div>

        {/* Coordinates Status */}
        {!park.hasCoordinates && (
          <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
            <Clock className="h-3 w-3" />
            <span>{t("parks.coordinatesUnavailable")}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-2 border-t border-gray-100 dark:border-gray-800">
          {park.hasCoordinates && (
            <Button 
              variant="outline" 
              size="sm" 
              className="flex-1"
              onClick={() => window.open(
                `https://maps.google.com/maps?q=${park.latitude},${park.longitude}`, 
                '_blank'
              )}
            >
              <MapPin className="h-3 w-3 mr-1" />
              {t("parks.directions")}
            </Button>
          )}
          
          {!park.hasCoordinates && (
            <Button 
              variant="outline" 
              size="sm" 
              className="flex-1"
              onClick={() => window.open(
                `https://maps.google.com/maps?q=${encodeURIComponent(park.address)}`, 
                '_blank'
              )}
            >
              <MapPin className="h-3 w-3 mr-1" />
              {t("parks.search")}
            </Button>
          )}
        </div>

      </CardContent>
    </Card>
  )
}