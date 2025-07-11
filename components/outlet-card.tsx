"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { 
  RefreshCw, 
  Play, 
  AlertCircle, 
  CheckCircle, 
  Clock,
  FileText,
  Wifi,
  WifiOff
} from "lucide-react"
import { OutletStatus } from "@/hooks/use-scrape-progress"

interface OutletCardProps {
  outletKey: string
  outletName: string
  status: OutletStatus
  onScrape: (outlet: string) => Promise<void>
  disabled?: boolean
}

const OUTLET_LOGOS = {
  hkfp: "🗞️",
  singtao: "⭐",
  hk01: "📰",
  oncc: "🔘",
  '28car': "🚗",
}

const OUTLET_DESCRIPTIONS = {
  hkfp: "Hong Kong Free Press",
  singtao: "星島日報 SingTao",
  hk01: "香港01 HK01",
  oncc: "東網 On.cc",
  '28car': "28car 車網",
}

export default function OutletCard({ 
  outletKey, 
  outletName, 
  status, 
  onScrape, 
  disabled = false 
}: OutletCardProps) {
  const [isLoading, setIsLoading] = useState(false)

  const handleScrape = async () => {
    setIsLoading(true)
    try {
      await onScrape(outletKey)
    } catch (error) {
      console.error(`Failed to scrape ${outletName}:`, error)
    } finally {
      setIsLoading(false)
    }
  }

  const getStatusColor = () => {
    switch (status.status) {
      case 'running':
        return 'border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/20'
      case 'completed':
        return 'border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/20'
      case 'error':
        return 'border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/20'
      default:
        return 'border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80'
    }
  }

  const getStatusBadge = () => {
    switch (status.status) {
      case 'running':
        return (
          <Badge className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
            <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
            Running
          </Badge>
        )
      case 'completed':
        return (
          <Badge className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
            <CheckCircle className="h-3 w-3 mr-1" />
            Completed
          </Badge>
        )
      case 'error':
        return (
          <Badge className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
            <AlertCircle className="h-3 w-3 mr-1" />
            Error
          </Badge>
        )
      default:
        return (
          <Badge variant="secondary">
            <Clock className="h-3 w-3 mr-1" />
            Ready
          </Badge>
        )
    }
  }

  const formatDuration = () => {
    if (!status.startTime) return null
    
    const endTime = status.endTime || Date.now()
    const duration = Math.round((endTime - status.startTime) / 1000)
    
    if (duration < 60) return `${duration}s`
    const minutes = Math.floor(duration / 60)
    const seconds = duration % 60
    return `${minutes}m ${seconds}s`
  }

  return (
    <Card className={`${getStatusColor()} backdrop-blur-sm transition-all duration-200`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{OUTLET_LOGOS[outletKey] || "📰"}</span>
            <div>
              <CardTitle className="text-lg">{outletName}</CardTitle>
              <CardDescription className="text-sm">
                {OUTLET_DESCRIPTIONS[outletKey] || outletName}
              </CardDescription>
            </div>
          </div>
          {getStatusBadge()}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Progress Bar */}
        {status.status === 'running' && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Progress</span>
              <span>{status.progress}%</span>
            </div>
            <Progress value={status.progress} className="h-2" />
          </div>
        )}

        {/* Status Message */}
        <div className="text-sm text-slate-600 dark:text-slate-400">
          {status.message}
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 text-sm">
          {status.articlesFound > 0 && (
            <div className="flex items-center gap-1">
              <FileText className="h-4 w-4" />
              <span>{status.articlesFound} articles</span>
            </div>
          )}
          
          {formatDuration() && (
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              <span>{formatDuration()}</span>
            </div>
          )}
        </div>

        {/* Error Message */}
        {status.status === 'error' && status.error && (
          <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-2 rounded">
            {status.error}
          </div>
        )}

        {/* Action Button */}
        <Button
          onClick={handleScrape}
          disabled={disabled || isLoading || status.status === 'running'}
          size="sm"
          className="w-full"
          variant={status.status === 'error' ? 'destructive' : 'default'}
        >
          {isLoading || status.status === 'running' ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Scraping...
            </>
          ) : (
            <>
              <Play className="h-4 w-4 mr-2" />
              Scrape {outletName}
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  )
}