"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { 
  Brain, 
  Loader2, 
  Play, 
  RefreshCw, 
  Image as ImageIcon, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  DollarSign,
  Clock,
  Settings
} from "lucide-react"

interface TriggerResult {
  success: boolean
  timestamp: string
  result?: {
    method?: string
    saved?: number
    processed?: number
    imageProcessed?: number
    totalCost?: number
    total?: number
    errors?: number
    errorDetails?: Array<{
      articleId: string
      articleTitle: string
      error: string
      details: string
    }>
    message: string
  }
  error?: string
  fallback?: {
    saved: number
    message: string
  }
}

interface ManualTriggersProps {
  onRefresh?: () => void
}

export default function PerplexityManualTriggers({ onRefresh }: ManualTriggersProps) {
  const [headlinesLoading, setHeadlinesLoading] = useState(false)
  const [enrichmentLoading, setEnrichmentLoading] = useState(false)
  const [headlinesResult, setHeadlinesResult] = useState<TriggerResult | null>(null)
  const [enrichmentResult, setEnrichmentResult] = useState<TriggerResult | null>(null)
  const [enrichmentBatchSize, setEnrichmentBatchSize] = useState(10)
  const [forceAll, setForceAll] = useState(false)

  const triggerHeadlines = async () => {
    setHeadlinesLoading(true)
    setHeadlinesResult(null)
    
    try {
      const response = await fetch('/api/admin/perplexity/trigger-headlines', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      
      const result: TriggerResult = await response.json()
      setHeadlinesResult(result)
      
      if (result.success && onRefresh) {
        // Refresh the parent component after successful trigger
        setTimeout(() => {
          onRefresh()
        }, 1000)
      }
    } catch (error) {
      console.error('Failed to trigger headlines:', error)
      setHeadlinesResult({
        success: false,
        timestamp: new Date().toISOString(),
        error: 'Failed to trigger headlines generation'
      })
    } finally {
      setHeadlinesLoading(false)
    }
  }

  const triggerEnrichment = async () => {
    setEnrichmentLoading(true)
    setEnrichmentResult(null)
    
    try {
      const response = await fetch('/api/admin/perplexity/trigger-enrichment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          batchSize: enrichmentBatchSize,
          forceAll
        })
      })
      
      const result: TriggerResult = await response.json()
      setEnrichmentResult(result)
      
      if (result.success && onRefresh) {
        // Refresh the parent component after successful trigger
        setTimeout(() => {
          onRefresh()
        }, 1000)
      }
    } catch (error) {
      console.error('Failed to trigger enrichment:', error)
      setEnrichmentResult({
        success: false,
        timestamp: new Date().toISOString(),
        error: 'Failed to trigger content enrichment'
      })
    } finally {
      setEnrichmentLoading(false)
    }
  }

  const getResultIcon = (result: TriggerResult | null) => {
    if (!result) return null
    if (result.success) {
      return <CheckCircle className="h-4 w-4 text-green-500" />
    } else {
      return <XCircle className="h-4 w-4 text-red-500" />
    }
  }

  const getResultBadge = (result: TriggerResult | null) => {
    if (!result) return null
    
    const baseClasses = "text-xs"
    if (result.success) {
      return (
        <Badge className={`${baseClasses} bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200`}>
          Success
        </Badge>
      )
    } else {
      return (
        <Badge className={`${baseClasses} bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200`}>
          Error
        </Badge>
      )
    }
  }

  return (
    <div className="space-y-6">
      {/* Headlines Generation */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                Generate New Headlines
              </CardTitle>
              <CardDescription>
                Trigger Perplexity AI to generate fresh Hong Kong news headlines
              </CardDescription>
            </div>
            <Button
              onClick={triggerHeadlines}
              disabled={headlinesLoading}
              className="min-w-[120px]"
            >
              {headlinesLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Generate
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        
        {headlinesResult && (
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getResultIcon(headlinesResult)}
                  <span className="text-sm font-medium">Last Result</span>
                </div>
                <div className="flex items-center gap-2">
                  {getResultBadge(headlinesResult)}
                  <span className="text-xs text-muted-foreground">
                    {new Date(headlinesResult.timestamp).toLocaleString()}
                  </span>
                </div>
              </div>
              
              {headlinesResult.success && headlinesResult.result && (
                <div className="grid grid-cols-2 gap-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <div className="text-sm">
                    <span className="font-medium">Headlines Saved:</span>
                    <span className="ml-2">{headlinesResult.result.saved || 0}</span>
                  </div>
                  <div className="text-sm">
                    <span className="font-medium">Cost:</span>
                    <span className="ml-2">${(headlinesResult.result.totalCost || 0).toFixed(6)}</span>
                  </div>
                  <div className="col-span-2 text-sm">
                    <span className="font-medium">Method:</span>
                    <span className="ml-2">{headlinesResult.result.method || 'unknown'}</span>
                  </div>
                  <div className="col-span-2 text-sm text-muted-foreground">
                    {headlinesResult.result.message}
                  </div>
                </div>
              )}
              
              {headlinesResult.fallback && (
                <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                  <div className="text-sm">
                    <div className="font-medium mb-1">Fallback Used:</div>
                    <div>Saved {headlinesResult.fallback.saved} fallback headlines</div>
                    <div className="text-muted-foreground">{headlinesResult.fallback.message}</div>
                  </div>
                </div>
              )}
              
              {!headlinesResult.success && headlinesResult.error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                  <div className="text-sm">
                    <div className="font-medium mb-1">Error:</div>
                    <div className="text-red-700 dark:text-red-300">{headlinesResult.error}</div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        )}
      </Card>

      {/* Content Enrichment */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5" />
                Enrich Content & Images
              </CardTitle>
              <CardDescription>
                Process pending articles with full content and find relevant images
              </CardDescription>
            </div>
            <Button
              onClick={triggerEnrichment}
              disabled={enrichmentLoading}
              className="min-w-[120px]"
            >
              {enrichmentLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Enrich
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        
        <CardContent>
          <div className="space-y-4">
            {/* Settings */}
            <div className="space-y-3">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Processing Settings
              </Label>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="batchSize" className="text-xs">Batch Size</Label>
                  <Input
                    id="batchSize"
                    type="number"
                    min="1"
                    max="50"
                    value={enrichmentBatchSize}
                    onChange={(e) => setEnrichmentBatchSize(parseInt(e.target.value) || 10)}
                    disabled={enrichmentLoading}
                  />
                </div>
                
                <div className="flex items-center space-x-2">
                  <Switch
                    id="forceAll"
                    checked={forceAll}
                    onCheckedChange={setForceAll}
                    disabled={enrichmentLoading}
                  />
                  <Label htmlFor="forceAll" className="text-xs">Force re-process all</Label>
                </div>
              </div>
            </div>
            
            <Separator />
            
            {/* Results */}
            {enrichmentResult && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getResultIcon(enrichmentResult)}
                    <span className="text-sm font-medium">Last Result</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {getResultBadge(enrichmentResult)}
                    <span className="text-xs text-muted-foreground">
                      {new Date(enrichmentResult.timestamp).toLocaleString()}
                    </span>
                  </div>
                </div>
                
                {enrichmentResult.success && enrichmentResult.result && (
                  <div className="grid grid-cols-2 gap-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <div className="text-sm">
                      <span className="font-medium">Articles Processed:</span>
                      <span className="ml-2">{enrichmentResult.result.processed || 0}/{enrichmentResult.result.total || 0}</span>
                    </div>
                    <div className="text-sm">
                      <span className="font-medium">Images Added:</span>
                      <span className="ml-2">{enrichmentResult.result.imageProcessed || 0}</span>
                    </div>
                    <div className="text-sm">
                      <span className="font-medium">Cost:</span>
                      <span className="ml-2">${(enrichmentResult.result.totalCost || 0).toFixed(6)}</span>
                    </div>
                    <div className="text-sm">
                      <span className="font-medium">Errors:</span>
                      <span className="ml-2">{enrichmentResult.result.errors || 0}</span>
                    </div>
                    <div className="col-span-2 text-sm text-muted-foreground">
                      {enrichmentResult.result.message}
                    </div>
                  </div>
                )}
                
                {enrichmentResult.result?.errorDetails && enrichmentResult.result.errorDetails.length > 0 && (
                  <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                    <div className="text-sm">
                      <div className="font-medium mb-2">Processing Errors:</div>
                      <div className="space-y-1">
                        {enrichmentResult.result.errorDetails.map((error, index) => (
                          <div key={index} className="text-xs">
                            <span className="font-medium">{error.articleTitle}:</span>
                            <span className="ml-1 text-muted-foreground">{error.error}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                
                {!enrichmentResult.success && enrichmentResult.error && (
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                    <div className="text-sm">
                      <div className="font-medium mb-1">Error:</div>
                      <div className="text-red-700 dark:text-red-300">{enrichmentResult.error}</div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Status Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Automated Processing Status
          </CardTitle>
          <CardDescription>
            These operations also run automatically via cron jobs
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span>Headlines Generation:</span>
              <Badge variant="outline" className="text-xs">
                <Clock className="h-3 w-3 mr-1" />
                Every 5 minutes
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>Content Enrichment:</span>
              <Badge variant="outline" className="text-xs">
                <Clock className="h-3 w-3 mr-1" />
                Every 5 minutes (offset)
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground pt-2">
              Manual triggers allow you to run these processes immediately without waiting for the scheduled cron jobs.
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}