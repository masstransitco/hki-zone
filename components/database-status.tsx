"use client"

import { useQuery } from "@tanstack/react-query"

async function checkDatabaseStatus() {
  const response = await fetch("/api/articles?page=0&_t=" + Date.now())
  const data = await response.json()
  return data.usingMockData !== undefined ? data.usingMockData : false
}

export default function DatabaseStatus() {
  const {
    data: usingMockData,
    isLoading,
  } = useQuery({
    queryKey: ["databaseStatus"],
    queryFn: checkDatabaseStatus,
    staleTime: 30000, // Cache for 30 seconds
    refetchInterval: 60000, // Refetch every minute
  })

  if (isLoading || usingMockData === undefined) return null

  const isConnected = !usingMockData
  const currentTime = new Date().toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })

  return (
    <div className="flex items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
      <div className={`w-2 h-2 rounded-full ${
        isConnected 
          ? 'bg-green-500 shadow-sm shadow-green-500/50' 
          : 'bg-red-500 shadow-sm shadow-red-500/50'
      }`} />
      <span className="font-medium">
        {isConnected ? `Live News ${currentTime}` : 'Disconnected'}
      </span>
    </div>
  )
}
