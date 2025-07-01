"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Play, Clock, Database, RefreshCw, CheckCircle, AlertCircle, Globe, Zap, SkipForward } from "lucide-react"

export default function AdminPanel() {
  const [isRunning, setIsRunning] = useState(false)
  const [result, setResult] = useState<any>(null)

  const runManualScrape = async () => {
    setIsRunning(true)
    setResult(null)

    try {
      console.log("🚀 Starting manual scrape...")
      const response = await fetch("/api/manual-scrape", {
        method: "POST",
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      console.log("📊 Scrape result:", data)
      setResult(data)
    } catch (error) {
      console.error("❌ Manual scrape error:", error)
      setResult({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      })
    } finally {
      setIsRunning(false)
    }
  }

  const getResultIcon = () => {
    if (!result) return null
    return result.success ? (
      <CheckCircle className="w-5 h-5 text-green-600" />
    ) : (
      <AlertCircle className="w-5 h-5 text-red-600" />
    )
  }

  const getResultColor = () => {
    if (!result) return ""
    return result.success
      ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
      : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
  }

  const getMethodBadge = (method: string) => {
    switch (method) {
      case "simplified-real":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 text-xs rounded-full">
            <Globe className="w-3 h-3" />
            Real Data
          </span>
        )
      case "enhanced-mock":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 text-xs rounded-full">
            <Zap className="w-3 h-3" />
            Mock Data
          </span>
        )
      default:
        return null
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-title-1 text-[rgb(28,28,30)] dark:text-white mb-2">Panora.hk Admin Panel</h1>
        <p className="text-body text-[rgb(142,142,147)]">Manage news scraping and monitor system status</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="bg-white dark:bg-[rgb(28,28,30)] border-[rgb(229,229,234)] dark:border-[rgb(44,44,46)] rounded-xl apple-shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-headline text-[rgb(28,28,30)] dark:text-white">
              <Play className="w-5 h-5" />
              Manual News Scrape
            </CardTitle>
            <CardDescription className="text-footnote text-[rgb(142,142,147)]">
              Trigger the news scraping process. Duplicate articles are automatically skipped.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={runManualScrape}
              disabled={isRunning}
              className="w-full bg-[rgb(0,122,255)] dark:bg-[rgb(10,132,255)] hover:bg-[rgb(0,122,255)]/90 dark:hover:bg-[rgb(10,132,255)]/90 text-white rounded-lg apple-focus"
            >
              {isRunning ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Scraping News...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Run News Scrape
                </>
              )}
            </Button>

            {result && (
              <div className="mt-4 space-y-3">
                <div className="flex items-center gap-2">
                  {getResultIcon()}
                  <span className="font-medium text-[rgb(28,28,30)] dark:text-white">
                    {result.success ? "Scrape Completed" : "Scrape Failed"}
                  </span>
                  {result.result?.method && getMethodBadge(result.result.method)}
                </div>

                {result.success && result.result && (
                  <div className="text-footnote space-y-1 text-[rgb(142,142,147)]">
                    <p>📝 New articles: {result.result.details?.saved || 0}</p>
                    {result.result.details?.skipped > 0 && (
                      <p className="flex items-center gap-1">
                        <SkipForward className="w-3 h-3" />
                        Duplicates skipped: {result.result.details.skipped}
                      </p>
                    )}
                    {result.result.sources && (
                      <p>
                        📰 Sources: HKFP ({result.result.sources.HKFP}), SingTao ({result.result.sources.SingTao}), HK01
                        ({result.result.sources.HK01})
                      </p>
                    )}
                    {result.result.details?.successRate && <p>✅ Success Rate: {result.result.details.successRate}</p>}
                    {result.result.database?.after && (
                      <p>🗄️ Total in database: {result.result.database.after.total} articles</p>
                    )}
                  </div>
                )}

                {!result.success && (
                  <p className="text-footnote text-red-600 dark:text-red-400">Error: {result.error}</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-[rgb(28,28,30)] border-[rgb(229,229,234)] dark:border-[rgb(44,44,46)] rounded-xl apple-shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-headline text-[rgb(28,28,30)] dark:text-white">
              <Clock className="w-5 h-5" />
              Automatic Cron Jobs
            </CardTitle>
            <CardDescription className="text-footnote text-[rgb(142,142,147)]">
              Information about the automated scraping schedule
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-subhead text-[rgb(28,28,30)] dark:text-white mb-1">Schedule</p>
              <p className="text-footnote text-[rgb(142,142,147)] mb-1">Every 30 minutes</p>
              <code className="text-caption-1 bg-[rgb(242,242,247)] dark:bg-[rgb(44,44,46)] text-[rgb(28,28,30)] dark:text-white p-2 rounded">
                */30 * * * *
              </code>
            </div>
            <div>
              <p className="text-subhead text-[rgb(28,28,30)] dark:text-white mb-2">Status</p>
              <div className="flex items-center gap-2">
                {process.env.VERCEL ? (
                  <>
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-footnote text-green-600 dark:text-green-400">Active (deployed)</span>
                  </>
                ) : (
                  <>
                    <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                    <span className="text-footnote text-yellow-600 dark:text-yellow-400">
                      Inactive (local development)
                    </span>
                  </>
                )}
              </div>
            </div>
            <div>
              <p className="text-subhead text-[rgb(28,28,30)] dark:text-white mb-1">Duplicate Prevention</p>
              <p className="text-footnote text-[rgb(142,142,147)]">
                ✅ Articles are checked by URL - duplicates are automatically skipped
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {result && (
        <Card className="mt-6 bg-white dark:bg-[rgb(28,28,30)] border-[rgb(229,229,234)] dark:border-[rgb(44,44,46)] rounded-xl apple-shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-headline text-[rgb(28,28,30)] dark:text-white">
              <Database className="w-5 h-5" />
              Detailed Results
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`p-4 rounded-lg border ${getResultColor()}`}>
              <pre className="text-caption-1 overflow-x-auto whitespace-pre-wrap max-h-96 overflow-y-auto text-[rgb(28,28,30)] dark:text-white">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="mt-6 bg-white dark:bg-[rgb(28,28,30)] border-[rgb(229,229,234)] dark:border-[rgb(44,44,46)] rounded-xl apple-shadow-sm">
        <CardHeader>
          <CardTitle className="text-headline text-[rgb(28,28,30)] dark:text-white">
            Duplicate Prevention System
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="text-subhead text-[rgb(28,28,30)] dark:text-white mb-2">How It Works</h3>
            <ul className="text-footnote text-[rgb(142,142,147)] space-y-1">
              <li>
                • <strong className="text-[rgb(28,28,30)] dark:text-white">URL-based Detection:</strong> Each article
                URL is checked against the database
              </li>
              <li>
                • <strong className="text-[rgb(28,28,30)] dark:text-white">Automatic Skipping:</strong> Existing
                articles are skipped without processing
              </li>
              <li>
                • <strong className="text-[rgb(28,28,30)] dark:text-white">Efficient Processing:</strong> Only new
                articles go through AI summarization
              </li>
              <li>
                • <strong className="text-[rgb(28,28,30)] dark:text-white">Detailed Reporting:</strong> Shows how many
                new vs duplicate articles found
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-subhead text-[rgb(28,28,30)] dark:text-white mb-2">Benefits</h3>
            <ul className="text-footnote text-[rgb(142,142,147)] space-y-1">
              <li>
                • <strong className="text-[rgb(28,28,30)] dark:text-white">No Duplicates:</strong> Same article won't be
                saved twice
              </li>
              <li>
                • <strong className="text-[rgb(28,28,30)] dark:text-white">Cost Efficient:</strong> Saves AI API calls
                for existing content
              </li>
              <li>
                • <strong className="text-[rgb(28,28,30)] dark:text-white">Fast Processing:</strong> Skips unnecessary
                work
              </li>
              <li>
                • <strong className="text-[rgb(28,28,30)] dark:text-white">Clean Database:</strong> Maintains data
                integrity
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
