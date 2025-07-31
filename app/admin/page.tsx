"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import AdminPanel from "@/components/admin-panel"
import AdminMetricsDashboard from "@/components/admin-metrics-dashboard"
import { BarChart3, Settings, Database, TrendingUp } from "lucide-react"

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState("metrics")

  const handleManualScrape = async () => {
    const response = await fetch("/api/manual-scrape", {
      method: "POST",
    })
    
    if (!response.ok) {
      throw new Error(`Scraping failed: ${response.statusText}`)
    }
    
    const result = await response.json()
    console.log("Scraping result:", result)
  }

  const handleDatabaseSetup = async () => {
    const response = await fetch("/api/setup-database", {
      method: "POST",
    })
    
    if (!response.ok) {
      throw new Error(`Database setup failed: ${response.statusText}`)
    }
    
    const result = await response.json()
    console.log("Database setup result:", result)
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Article Pipeline Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor outlets, manual extractions, and manage systems settings
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="metrics" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Pipeline Metrics
          </TabsTrigger>
          <TabsTrigger value="controls" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            System Controls
          </TabsTrigger>
        </TabsList>

        <TabsContent value="metrics" className="space-y-4">
          <AdminMetricsDashboard />
        </TabsContent>

        <TabsContent value="controls" className="space-y-4">
          <AdminPanel 
            onManualScrape={handleManualScrape}
            onDatabaseSetup={handleDatabaseSetup}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
