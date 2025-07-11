"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Progress } from "@/components/ui/progress"
import { 
  RefreshCw, 
  Database, 
  Play, 
  AlertCircle, 
  CheckCircle, 
  StopCircle,
  Wifi,
  WifiOff,
  RotateCcw
} from "lucide-react"
import { useLanguage } from "./language-provider"
import { analytics } from "@/lib/analytics"
import { useScrapeProgress } from "@/hooks/use-scrape-progress"
import OutletCard from "./outlet-card"

interface AdminPanelProps {
  onManualScrape?: () => Promise<void>
  onDatabaseSetup?: () => Promise<void>
}

const OUTLET_NAMES = {
  hkfp: "HKFP",
  singtao: "SingTao",
  hk01: "HK01",
  oncc: "ONCC",
  rthk: "RTHK",
  '28car': "28car",
}

export default function AdminPanel({ onManualScrape, onDatabaseSetup }: AdminPanelProps) {
  const { t } = useLanguage()
  const [isDatabaseLoading, setIsDatabaseLoading] = useState(false)
  const [dbStatus, setDbStatus] = useState<"idle" | "success" | "error">("idle")
  const { progress, isConnected, error, resetProgress, startScraping } = useScrapeProgress()

  const handleScrapeAll = async () => {
    analytics.trackManualScrape()
    await startScraping()
    
    if (onManualScrape) {
      try {
        await onManualScrape()
      } catch (error) {
        console.error('Legacy scrape handler failed:', error)
      }
    }
  }

  const handleScrapeOutlet = async (outlet: string) => {
    try {
      const response = await fetch(`/api/scrape/${outlet}`, {
        method: 'POST',
      })
      
      if (!response.ok) {
        throw new Error(`Failed to scrape ${outlet}: ${response.statusText}`)
      }
      
      const result = await response.json()
      console.log(`${outlet} scrape result:`, result)
    } catch (error) {
      console.error(`Failed to scrape ${outlet}:`, error)
      throw error
    }
  }

  const handleDatabaseSetup = async () => {
    if (!onDatabaseSetup) return

    setIsDatabaseLoading(true)
    setDbStatus("idle")
    analytics.trackDatabaseSetup()

    try {
      await onDatabaseSetup()
      setDbStatus("success")
    } catch (error) {
      setDbStatus("error")
    } finally {
      setIsDatabaseLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      <Card className="border-slate-200/60 dark:border-slate-800/60 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              <CardTitle className="text-slate-900 dark:text-slate-100">Enhanced Admin Panel</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              {isConnected ? (
                <Badge className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                  <Wifi className="h-3 w-3 mr-1" />
                  Connected
                </Badge>
              ) : (
                <Badge variant="secondary" className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
                  <WifiOff className="h-3 w-3 mr-1" />
                  Disconnected
                </Badge>
              )}
            </div>
          </div>
          <CardDescription className="text-slate-600 dark:text-slate-400">
            Real-time news scraping with individual outlet control
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Overall Progress */}
      {progress.isRunning && (
        <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/20 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Overall Progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>{progress.overall.message}</span>
                <span>{progress.overall.progress}%</span>
              </div>
              <Progress value={progress.overall.progress} className="h-3" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Master Controls */}
      <Card className="border-slate-200/60 dark:border-slate-800/60 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Master Controls</CardTitle>
          <CardDescription>Control all outlets at once</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3">
            <Button
              onClick={handleScrapeAll}
              disabled={progress.isRunning}
              className="flex-1"
            >
              {progress.isRunning ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Scraping All...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Scrape All Outlets
                </>
              )}
            </Button>

            <Button
              onClick={resetProgress}
              variant="outline"
              disabled={progress.isRunning}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Individual Outlet Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Object.entries(progress.outlets).map(([outletKey, status]) => (
          <OutletCard
            key={outletKey}
            outletKey={outletKey}
            outletName={OUTLET_NAMES[outletKey]}
            status={status}
            onScrape={handleScrapeOutlet}
            disabled={progress.isRunning && status.status !== 'running'}
          />
        ))}
      </div>

      <Separator className="bg-slate-200 dark:bg-slate-800" />

      {/* Database Setup Section */}
      <Card className="border-slate-200/60 dark:border-slate-800/60 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Database Management</CardTitle>
          <CardDescription>Initialize or reset the database schema</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {dbStatus === "success" && (
                <Badge className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Success
                </Badge>
              )}
              {dbStatus === "error" && (
                <Badge variant="secondary" className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Error
                </Badge>
              )}
            </div>
            <Button
              onClick={handleDatabaseSetup}
              disabled={isDatabaseLoading}
              variant="outline"
            >
              {isDatabaseLoading ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Setting up...
                </>
              ) : (
                <>
                  <Database className="h-4 w-4 mr-2" />
                  Setup Database
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Connection Error */}
      {error && (
        <Card className="border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">{error}</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
