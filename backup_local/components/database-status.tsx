"use client"

import { useQuery } from "@tanstack/react-query"
import { useState, useEffect } from "react"

async function checkDatabaseStatus() {
  const response = await fetch("/api/articles?page=0")
  const data = await response.json()
  return {
    usingMockData: data.usingMockData !== undefined ? data.usingMockData : false,
    debug: data.debug,
    error: data.error
  }
}

export default function DatabaseStatus() {
  const [mounted, setMounted] = useState(false)
  const [currentTime, setCurrentTime] = useState<string>("")

  const {
    data: status,
    isLoading,
  } = useQuery({
    queryKey: ["databaseStatus"],
    queryFn: checkDatabaseStatus,
    staleTime: 30000, // Cache for 30 seconds
    refetchInterval: 60000, // Refetch every minute
  })

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return

    const updateTime = () => {
      setCurrentTime(new Date().toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      }))
    }

    updateTime()
    const interval = setInterval(updateTime, 60000) // Update every minute

    return () => clearInterval(interval)
  }, [mounted])

  if (isLoading || !status || !mounted) return null

  const isConnected = !status.usingMockData
  
  // Determine the status message
  let statusMessage = 'Disconnected'
  if (isConnected) {
    statusMessage = currentTime ? `Live News ${currentTime}` : 'Live News'
  } else if (status.debug) {
    // Provide more specific error messages
    if (status.debug.includes('Database not set up')) {
      statusMessage = 'Database not configured'
    } else if (status.debug.includes('No articles found')) {
      statusMessage = 'No articles in database'
    } else if (status.error) {
      statusMessage = 'Connection error'
    }
  }

  return (
    <div className="flex items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
      <div className={`w-2 h-2 rounded-full ${
        isConnected 
          ? 'bg-green-500 shadow-sm shadow-green-500/50' 
          : 'bg-orange-500 shadow-sm shadow-orange-500/50'
      }`} />
      <span className="font-medium" title={status.debug || status.error || ''}>
        {statusMessage}
      </span>
    </div>
  )
}
