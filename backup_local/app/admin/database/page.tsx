"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { 
  Database, 
  CheckCircle, 
  AlertCircle, 
  RefreshCw,
  Activity,
  HardDrive,
  Users,
  FileText,
  Trash2
} from "lucide-react"

interface DatabaseStats {
  total: number
  bySource: Record<string, number>
  latest?: string
  oldest?: string
}

export default function DatabasePage() {
  const [isSetupLoading, setIsSetupLoading] = useState(false)
  const [setupStatus, setSetupStatus] = useState<"idle" | "success" | "error">("idle")
  const [setupMessage, setSetupMessage] = useState("")
  const [stats, setStats] = useState<DatabaseStats | null>(null)
  const [isConnected, setIsConnected] = useState<boolean | null>(null)

  useEffect(() => {
    checkDatabaseStatus()
    loadStats()
  }, [])

  const checkDatabaseStatus = async () => {
    try {
      const response = await fetch("/api/debug/database")
      const data = await response.json()
      setIsConnected(data.connected)
    } catch (error) {
      console.error("Error checking database status:", error)
      setIsConnected(false)
    }
  }

  const loadStats = async () => {
    try {
      const response = await fetch("/api/admin/database/stats")
      if (response.ok) {
        const data = await response.json()
        setStats(data)
      }
    } catch (error) {
      console.error("Error loading stats:", error)
    }
  }

  const handleDatabaseSetup = async () => {
    setIsSetupLoading(true)
    setSetupStatus("idle")
    setSetupMessage("")

    try {
      const response = await fetch("/api/setup-database", {
        method: "POST",
      })
      
      const result = await response.json()
      
      if (response.ok) {
        setSetupStatus("success")
        setSetupMessage("Database setup completed successfully")
        await checkDatabaseStatus()
        await loadStats()
      } else {
        setSetupStatus("error")
        setSetupMessage(result.error || "Database setup failed")
      }
    } catch (error) {
      setSetupStatus("error")
      setSetupMessage("Failed to connect to database setup endpoint")
    } finally {
      setIsSetupLoading(false)
    }
  }

  const handleRefreshStats = () => {
    checkDatabaseStatus()
    loadStats()
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      {/* Database Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Database Status
              </CardTitle>
              <CardDescription>
                Current connection and setup status
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={handleRefreshStats}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              {isConnected === true && (
                <>
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <Badge variant="secondary" className="bg-green-100 text-green-700">
                    Connected
                  </Badge>
                </>
              )}
              {isConnected === false && (
                <>
                  <AlertCircle className="h-5 w-5 text-red-500" />
                  <Badge variant="secondary" className="bg-red-100 text-red-700">
                    Disconnected
                  </Badge>
                </>
              )}
              {isConnected === null && (
                <>
                  <Activity className="h-5 w-5 text-yellow-500 animate-pulse" />
                  <Badge variant="secondary" className="bg-yellow-100 text-yellow-700">
                    Checking...
                  </Badge>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Database Setup */}
      <Card>
        <CardHeader>
          <CardTitle>Database Setup</CardTitle>
          <CardDescription>
            Initialize or reset the database schema and tables
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {setupMessage && (
            <Alert className={setupStatus === "error" ? "border-red-200" : "border-green-200"}>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{setupMessage}</AlertDescription>
            </Alert>
          )}
          
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                This will create the necessary tables and indexes for the application
              </p>
            </div>
            <Button
              onClick={handleDatabaseSetup}
              disabled={isSetupLoading}
              variant={setupStatus === "success" ? "outline" : "default"}
            >
              {isSetupLoading ? (
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

      {/* Database Statistics */}
      {stats && (
        <Card>
          <CardHeader>
            <CardTitle>Database Statistics</CardTitle>
            <CardDescription>
              Current data in the system
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                  <FileText className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-sm text-muted-foreground">Total Articles</p>
                </div>
              </div>
              
              {Object.entries(stats.bySource).map(([source, count]) => (
                <div key={source} className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
                    <Users className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-lg font-semibold">{count}</p>
                    <p className="text-sm text-muted-foreground">{source}</p>
                  </div>
                </div>
              ))}
            </div>
            
            {(stats.latest || stats.oldest) && (
              <>
                <Separator className="my-4" />
                <div className="grid gap-4 md:grid-cols-2">
                  {stats.latest && (
                    <div>
                      <p className="text-sm font-medium">Latest Article</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(stats.latest).toLocaleString()}
                      </p>
                    </div>
                  )}
                  {stats.oldest && (
                    <div>
                      <p className="text-sm font-medium">Oldest Article</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(stats.oldest).toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Database Maintenance */}
      <Card>
        <CardHeader>
          <CardTitle className="text-red-700">Danger Zone</CardTitle>
          <CardDescription>
            Irreversible database operations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Alert className="border-red-200">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                These actions cannot be undone. Make sure you have backups before proceeding.
              </AlertDescription>
            </Alert>
            
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Clear All Articles</p>
                <p className="text-sm text-muted-foreground">
                  Remove all scraped articles from the database
                </p>
              </div>
              <Button variant="destructive" disabled>
                <Trash2 className="h-4 w-4 mr-2" />
                Clear Data
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}