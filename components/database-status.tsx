"use client"

import { useQuery } from "@tanstack/react-query"
import { useState, useEffect } from "react"

async function checkDatabaseStatus() {
  const response = await fetch("/api/articles?page=0")
  const data = await response.json()
  return data.usingMockData !== undefined ? data.usingMockData : false
}

export default function DatabaseStatus() {
  const [mounted, setMounted] = useState(false)
  const [currentTime, setCurrentTime] = useState<string>("")

  const {
    data: usingMockData,
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

  if (isLoading || usingMockData === undefined || !mounted) return null

  const isConnected = !usingMockData

  return (
    <div className="flex items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
      <div className={`w-2 h-2 rounded-full ${
        isConnected 
          ? 'bg-green-500 shadow-sm shadow-green-500/50' 
          : 'bg-red-500 shadow-sm shadow-red-500/50'
      }`} />
      <span className="font-medium">
        {isConnected ? (currentTime ? `Live News ${currentTime}` : 'Live News') : 'Disconnected'}
      </span>
    </div>
  )
}
