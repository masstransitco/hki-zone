"use client"

import AdminPanel from "@/components/admin-panel"

export default function AdminPage() {
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
    <div className="container mx-auto py-8">
      <AdminPanel 
        onManualScrape={handleManualScrape}
        onDatabaseSetup={handleDatabaseSetup}
      />
    </div>
  )
}
