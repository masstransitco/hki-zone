"use client"

import { useQuery } from "@tanstack/react-query"
import { useState, useEffect, useRef } from "react"
import { cn } from "@/lib/utils"

async function checkDatabaseStatus() {
  const response = await fetch("/api/articles?page=0")
  const data = await response.json()
  return {
    usingMockData: data.usingMockData !== undefined ? data.usingMockData : false,
    debug: data.debug,
    error: data.error
  }
}

export default function LiveNewsIndicator() {
  const [mounted, setMounted] = useState(false)
  const [currentTime, setCurrentTime] = useState<string>("")
  const [isExpanded, setIsExpanded] = useState(false)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

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

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  const handleClick = () => {
    setIsExpanded(true)
    
    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    
    // Auto-collapse after 2.5 seconds
    timeoutRef.current = setTimeout(() => {
      setIsExpanded(false)
    }, 2500)
  }

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
    <button
      onClick={handleClick}
      className={cn(
        "flex items-center gap-2 overflow-hidden transition-all duration-300 ease-out",
        "hover:bg-muted/50 rounded-md px-1 py-1 cursor-pointer",
        "text-xs text-stone-500 dark:text-stone-400",
        isExpanded ? "w-auto" : "w-6"
      )}
      title={status.debug || status.error || 'Click to view live news status'}
    >
      {/* Green/Orange status dot */}
      <div className={cn(
        "w-2 h-2 rounded-full flex-shrink-0",
        isConnected 
          ? 'bg-green-500 shadow-sm shadow-green-500/50' 
          : 'bg-orange-500 shadow-sm shadow-orange-500/50'
      )} />
      
      {/* Status text with slide animation */}
      <span className={cn(
        "font-medium whitespace-nowrap transition-all duration-300 ease-out",
        isExpanded 
          ? "opacity-100 translate-x-0" 
          : "opacity-0 -translate-x-2 w-0"
      )}>
        {statusMessage}
      </span>
    </button>
  )
}