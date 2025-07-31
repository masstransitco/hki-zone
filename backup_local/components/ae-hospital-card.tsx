"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { 
  Phone, 
  MapPin, 
  Clock, 
  AlertTriangle, 
  ExternalLink, 
  Hospital,
  Timer,
  TrendingUp
} from "lucide-react"

interface HospitalInfo {
  hospital_code: string
  hospital_name_en: string
  hospital_name_zh?: string
  address_en?: string
  phone_main?: string
  phone_ae?: string
  cluster?: string
  type?: string
  website?: string
  latitude?: number
  longitude?: number
}

interface AeWaitingData {
  id: string
  title: string
  body: string
  relevance_score: number
  source_updated_at: string
  current_wait_time: string
  last_updated_time: string
}

interface AeHospitalCardProps {
  hospital: HospitalInfo
  waitingData?: AeWaitingData
  showDetails?: boolean
}

export default function AeHospitalCard({ 
  hospital, 
  waitingData, 
  showDetails = false 
}: AeHospitalCardProps) {
  const getWaitTimeColor = (waitTime: string) => {
    // Color based on wait time ranges from HA API
    if (waitTime.includes("> 8")) return "text-red-600"
    if (waitTime.includes("> 6")) return "text-orange-600" 
    if (waitTime.includes("> 4")) return "text-yellow-600"
    if (waitTime.includes("> 2")) return "text-blue-600"
    if (waitTime.includes("> 1")) return "text-green-600"
    if (waitTime.includes("< 1")) return "text-green-500"
    return "text-gray-600"
  }

  const getWaitTimeBadgeColor = (waitTime: string) => {
    // Badge background color based on wait time
    if (waitTime.includes("> 8")) return "bg-red-500"
    if (waitTime.includes("> 6")) return "bg-orange-500"
    if (waitTime.includes("> 4")) return "bg-yellow-500" 
    if (waitTime.includes("> 2")) return "bg-blue-500"
    if (waitTime.includes("> 1")) return "bg-green-500"
    if (waitTime.includes("< 1")) return "bg-green-400"
    return "bg-gray-500"
  }

  const formatLastUpdated = (timestamp: string) => {
    try {
      const date = new Date(timestamp)
      return date.toLocaleString('en-HK', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return timestamp
    }
  }

  return (
    <Card className="hover:shadow-md transition-shadow duration-200 border-gray-200 dark:border-gray-700">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
              {hospital.hospital_name_en}
            </CardTitle>
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <span>{hospital.type || 'Public'}</span>
              {hospital.cluster && (
                <>
                  <span>•</span>
                  <span>{hospital.cluster}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Waiting Time Information */}
        {waitingData && (
          <div className="border-l-4 border-blue-500 pl-4 py-2">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Timer className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">A&E Wait Time</span>
              </div>
              <Badge 
                variant="outline"
                className={`${getWaitTimeBadgeColor(waitingData.current_wait_time)} text-white border-0`}
              >
                {waitingData.current_wait_time} hrs
              </Badge>
            </div>
            
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <Clock className="h-3 w-3" />
              {formatLastUpdated(waitingData.source_updated_at)}
            </div>
          </div>
        )}

        {/* Contact Information */}
        <div className="space-y-2">
          {hospital.phone_main && (
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-gray-400" />
              <a 
                href={`tel:${hospital.phone_main}`}
                className="text-sm font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400"
              >
                {hospital.phone_main}
              </a>
            </div>
          )}
          
          {hospital.phone_ae && hospital.phone_ae !== hospital.phone_main && (
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-gray-400" />
              <a 
                href={`tel:${hospital.phone_ae}`}
                className="text-sm font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400"
              >
                {hospital.phone_ae} <span className="text-xs text-gray-500">(A&E Direct)</span>
              </a>
            </div>
          )}
        </div>

        {/* Address */}
        {hospital.address_en && (
          <div className="flex items-start gap-2">
            <MapPin className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {hospital.address_en}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-2 border-t border-gray-100 dark:border-gray-800">
          {hospital.phone_main && (
            <Button 
              variant="outline" 
              size="sm" 
              className="flex-1"
              onClick={() => window.open(`tel:${hospital.phone_main}`, '_self')}
            >
              <Phone className="h-3 w-3 mr-1" />
              Call
            </Button>
          )}
          
          {hospital.latitude && hospital.longitude && (
            <Button 
              variant="outline" 
              size="sm" 
              className="flex-1"
              onClick={() => window.open(
                `https://maps.google.com/maps?q=${hospital.latitude},${hospital.longitude}`, 
                '_blank'
              )}
            >
              <MapPin className="h-3 w-3 mr-1" />
              Directions
            </Button>
          )}
        </div>

      </CardContent>
    </Card>
  )
}

// Export types for use in other components
export type { HospitalInfo, AeWaitingData }