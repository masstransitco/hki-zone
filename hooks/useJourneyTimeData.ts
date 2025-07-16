"use client"

import { useState, useEffect, useCallback, useRef } from 'react'

type RouteType = 'expressway' | 'trunk' | 'local' | 'temp'

interface JourneyTimeCardProps {
  from: string
  to: string
  timeMin: number
  trendMin: number
  colourId: 1 | 2 | 3
  capture: string
  locale?: 'en' | 'zh'
  routeType: RouteType
}

interface JourneyTimeApiResponse {
  journeyTimes: JourneyTimeCardProps[]
  total: number
  lastUpdated: string
  error?: string
  metadata: {
    source: string
    api_endpoint?: string
    cache_duration: string
    priority_filter?: string
  }
}

interface UseJourneyTimeDataOptions {
  autoRefresh?: boolean
  refreshInterval?: number // in milliseconds
  enabled?: boolean
  startRegion?: 'hk' | 'kln' | 'nt'
  destRegion?: 'hk' | 'kln' | 'nt'
  limit?: number
}

interface UseJourneyTimeDataReturn {
  data: JourneyTimeCardProps[] | null
  loading: boolean
  error: string | null
  lastUpdated: string | null
  refresh: () => Promise<void>
  isStale: boolean
  total: number
}

export function useJourneyTimeData(options: UseJourneyTimeDataOptions = {}): UseJourneyTimeDataReturn {
  const {
    autoRefresh = true,
    refreshInterval = 2 * 60 * 1000, // 2 minutes default (matches TD update frequency)
    enabled = true,
    startRegion,
    destRegion,
    limit = 20
  } = options

  const [data, setData] = useState<JourneyTimeCardProps[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const [isStale, setIsStale] = useState(false)
  const [total, setTotal] = useState(0)

  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const fetchJourneyTimeData = useCallback(async (signal?: AbortSignal): Promise<JourneyTimeApiResponse | null> => {
    try {
      const params = new URLSearchParams({
        limit: limit.toString()
      })
      
      if (startRegion) params.set('start', startRegion)
      if (destRegion) params.set('dest', destRegion)

      const response = await fetch(`/api/journey-time?${params.toString()}`, {
        signal,
        headers: {
          'Cache-Control': 'no-cache',
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const responseData: JourneyTimeApiResponse = await response.json()
      return responseData
    } catch (err) {
      if (signal?.aborted) {
        return null // Request was cancelled
      }
      throw err
    }
  }, [startRegion, destRegion, limit])

  const refresh = useCallback(async () => {
    if (!enabled) return

    // Cancel any ongoing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    // Create new abort controller
    abortControllerRef.current = new AbortController()
    
    setLoading(true)
    setError(null)
    setIsStale(false)

    try {
      const result = await fetchJourneyTimeData(abortControllerRef.current.signal)
      
      if (result) {
        setData(result.journeyTimes)
        setLastUpdated(result.lastUpdated)
        setTotal(result.total)
        
        if (result.error) {
          setError(result.error)
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch journey time data'
      setError(errorMessage)
      console.error('Journey time data fetch error:', err)
    } finally {
      setLoading(false)
      abortControllerRef.current = null
    }
  }, [enabled, fetchJourneyTimeData])

  // Mark data as stale after 3 minutes
  const markStale = useCallback(() => {
    setIsStale(true)
  }, [])

  // Initial fetch
  useEffect(() => {
    if (enabled) {
      refresh()
    }
  }, [enabled, refresh])

  // Auto-refresh setup
  useEffect(() => {
    if (!autoRefresh || !enabled) {
      return
    }

    // Clear existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }

    // Set up new interval
    intervalRef.current = setInterval(() => {
      refresh()
    }, refreshInterval)

    // Set up stale timer (3 minutes)
    const staleTimer = setInterval(markStale, 3 * 60 * 1000)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
      clearInterval(staleTimer)
    }
  }, [autoRefresh, enabled, refreshInterval, refresh, markStale])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  // Reset stale state when new data arrives
  useEffect(() => {
    if (data && lastUpdated) {
      setIsStale(false)
    }
  }, [data, lastUpdated])

  return {
    data,
    loading,
    error,
    lastUpdated,
    refresh,
    isStale,
    total
  }
}

// Hook for fetching specific route data
export function useSpecificJourneyTime(routeId: string, options: { intervalMs?: number } = {}) {
  const { intervalMs = 2 * 60 * 1000 } = options
  const [data, setData] = useState<JourneyTimeCardProps | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!routeId) return

    let cancelled = false
    
    async function fetchSpecificRoute() {
      if (cancelled) return
      
      setLoading(true)
      setError(null)
      
      try {
        const response = await fetch(`/api/journey-time?route=${routeId}`)
        
        if (!response.ok) {
          throw new Error(`Failed to fetch route ${routeId}`)
        }
        
        const json = await response.json()
        
        if (!cancelled) {
          setData(json)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unknown error')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    fetchSpecificRoute()
    const timer = setInterval(fetchSpecificRoute, intervalMs)

    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [routeId, intervalMs])

  return { data, loading, error }
}

export default useJourneyTimeData