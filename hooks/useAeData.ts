"use client"

import { useState, useEffect, useCallback, useRef } from 'react'

interface AeHospitalData {
  hospital: {
    hospital_code: string
    hospital_name_en: string
    hospital_name_zh?: string
    address_en?: string
    phone_main?: string
    phone_ae?: string
    latitude?: number
    longitude?: number
    cluster?: string
    type?: string
    website?: string
  }
  waitingData?: {
    id: string
    title: string
    body: string
    relevance_score: number
    source_updated_at: string
    current_wait_time: string
    last_updated_time: string
    ha_hospital_code?: string
  } | null
}

interface AeApiResponse {
  hospitals: AeHospitalData[]
  total: number
  last_updated: string
  error?: string
  metadata: {
    source: string
    api_endpoint?: string
    cache_duration: string
  }
}

interface UseAeDataOptions {
  autoRefresh?: boolean
  refreshInterval?: number // in milliseconds
  enabled?: boolean
}

interface UseAeDataReturn {
  data: AeHospitalData[] | null
  loading: boolean
  error: string | null
  lastUpdated: string | null
  refresh: () => Promise<void>
  isStale: boolean
}

export function useAeData(options: UseAeDataOptions = {}): UseAeDataReturn {
  const {
    autoRefresh = true,
    refreshInterval = 5 * 60 * 1000, // 5 minutes default
    enabled = true
  } = options

  const [data, setData] = useState<AeHospitalData[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const [isStale, setIsStale] = useState(false)

  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const fetchAeData = useCallback(async (signal?: AbortSignal): Promise<AeApiResponse | null> => {
    try {
      const response = await fetch('/api/ae-live', {
        signal,
        headers: {
          'Cache-Control': 'no-cache',
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const responseData: AeApiResponse = await response.json()
      return responseData
    } catch (err) {
      if (signal?.aborted) {
        return null // Request was cancelled
      }
      throw err
    }
  }, [])

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
      const result = await fetchAeData(abortControllerRef.current.signal)
      
      if (result) {
        setData(result.hospitals)
        setLastUpdated(result.last_updated)
        
        if (result.error) {
          setError(result.error)
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch A&E data'
      setError(errorMessage)
      console.error('A&E data fetch error:', err)
    } finally {
      setLoading(false)
      abortControllerRef.current = null
    }
  }, [enabled, fetchAeData])

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
    isStale
  }
}

// Additional utility hook for A&E data filtering
export function useFilteredAeData(
  data: AeHospitalData[] | null,
  filters: {
    cluster?: string
    type?: string
    searchQuery?: string
    severityMin?: number
  } = {}
) {
  return useState(() => {
    if (!data) return []

    return data.filter(hospital => {
      // Cluster filter
      if (filters.cluster && filters.cluster !== 'all') {
        if (hospital.hospital.cluster !== filters.cluster) return false
      }

      // Type filter
      if (filters.type && filters.type !== 'all') {
        if (hospital.hospital.type !== filters.type) return false
      }

      // Search filter
      if (filters.searchQuery) {
        const query = filters.searchQuery.toLowerCase()
        const hospitalName = hospital.hospital.hospital_name_en.toLowerCase()
        if (!hospitalName.includes(query)) return false
      }

      // Severity filter
      if (filters.severityMin && hospital.waitingData) {
        if (hospital.waitingData.severity < filters.severityMin) return false
      }

      return true
    })
  })[0]
}

export default useAeData