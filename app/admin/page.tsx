"use client"

import AdminPanel from "@/components/admin-panel"

export default function AdminDashboard() {
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
    <div className="flex flex-1 flex-col gap-4">
      <div className="grid auto-rows-min gap-4 md:grid-cols-3">
        <div className="aspect-video rounded-xl bg-muted/50" />
        <div className="aspect-video rounded-xl bg-muted/50" />
        <div className="aspect-video rounded-xl bg-muted/50" />
      </div>
      <AdminPanel 
        onManualScrape={handleManualScrape}
        onDatabaseSetup={handleDatabaseSetup}
      />
    </div>
  )
}
