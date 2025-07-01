"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { RefreshCw, Database, Play, AlertCircle, CheckCircle } from "lucide-react"
import { useLanguage } from "./language-provider"
import { analytics } from "@/lib/analytics"

interface AdminPanelProps {
  onManualScrape?: () => Promise<void>
  onDatabaseSetup?: () => Promise<void>
}

export default function AdminPanel({ onManualScrape, onDatabaseSetup }: AdminPanelProps) {
  const { t } = useLanguage()
  const [isScrapingLoading, setIsScrapingLoading] = useState(false)
  const [isDatabaseLoading, setIsDatabaseLoading] = useState(false)
  const [scrapeStatus, setScrapeStatus] = useState<"idle" | "success" | "error">("idle")
  const [dbStatus, setDbStatus] = useState<"idle" | "success" | "error">("idle")

  const handleManualScrape = async () => {
    if (!onManualScrape) return

    setIsScrapingLoading(true)
    setScrapeStatus("idle")
    analytics.trackManualScrape()

    try {
      await onManualScrape()
      setScrapeStatus("success")
    } catch (error) {
      setScrapeStatus("error")
    } finally {
      setIsScrapingLoading(false)
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
      <Card className="border-slate-200/60 dark:border-slate-800/60 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
            <Database className="h-5 w-5" />
            Admin Panel
          </CardTitle>
          <CardDescription className="text-slate-600 dark:text-slate-400">
            Manage news scraping and database operations
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Manual Scrape Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-slate-900 dark:text-slate-100">Manual News Scrape</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Trigger immediate news collection from all sources
                </p>
              </div>
              <div className="flex items-center gap-2">
                {scrapeStatus === "success" && (
                  <Badge
                    variant="secondary"
                    className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                  >
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Success
                  </Badge>
                )}
                {scrapeStatus === "error" && (
                  <Badge variant="secondary" className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Error
                  </Badge>
                )}
                <Button
                  onClick={handleManualScrape}
                  disabled={isScrapingLoading}
                  size="sm"
                  className="bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200"
                >
                  {isScrapingLoading ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Scraping...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Run Scrape
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>

          <Separator className="bg-slate-200 dark:bg-slate-800" />

          {/* Database Setup Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-slate-900 dark:text-slate-100">Database Setup</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">Initialize or reset the database schema</p>
              </div>
              <div className="flex items-center gap-2">
                {dbStatus === "success" && (
                  <Badge
                    variant="secondary"
                    className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                  >
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
                <Button
                  onClick={handleDatabaseSetup}
                  disabled={isDatabaseLoading}
                  size="sm"
                  variant="outline"
                  className="border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 bg-transparent"
                >
                  {isDatabaseLoading ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Setting up...
                    </>
                  ) : (
                    <>
                      <Database className="h-4 w-4 mr-2" />
                      Setup DB
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
