"use client"

import { useState, useEffect, useCallback, useRef } from 'react'

interface PoliceStation {
  name: string
  address: string
  district: string
  services: string[]
  latitude: number | null
  longitude: number | null
  id: string
  hasCoordinates: boolean
  primaryService: string
  serviceCount: number
}

interface PoliceApiResponse {
  stations: PoliceStation[]
  total: number
  metadata: {
    source: string
    last_updated: string
    districts_available: string[]
    services_available: string[]
    total_stations: number
    stations_with_coordinates: number
  }
  error?: string
}

interface UsePoliceDataOptions {
  district?: string
  service?: string
  search?: string
  autoRefresh?: boolean
  refreshInterval?: number
  enabled?: boolean
}

interface UsePoliceDataReturn {
  data: PoliceStation[] | null
  loading: boolean
  error: string | null
  lastUpdated: string | null
  refresh: () => Promise<void>
  metadata: PoliceApiResponse['metadata'] | null
}

export function usePoliceData(options: UsePoliceDataOptions = {}): UsePoliceDataReturn {
  const {
    district,
    service,
    search,
    autoRefresh = false, // Police data is static, no need for auto-refresh
    refreshInterval = 30 * 60 * 1000, // 30 minutes if enabled
    enabled = true
  } = options

  const [data, setData] = useState<PoliceStation[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const [metadata, setMetadata] = useState<PoliceApiResponse['metadata'] | null>(null)

  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const fetchPoliceData = useCallback(async (signal?: AbortSignal): Promise<PoliceApiResponse | null> => {
    try {
      // Build query parameters
      const params = new URLSearchParams()
      if (district && district !== 'all') params.append('district', district)
      if (service && service !== 'all') params.append('service', service)
      if (search && search.trim() !== '') params.append('search', search.trim())

      const response = await fetch(`/api/police?${params.toString()}`, {
        signal,
        headers: {
          'Cache-Control': 'no-cache',
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const responseData: PoliceApiResponse = await response.json()
      return responseData
    } catch (err) {
      if (signal?.aborted) {
        return null
      }
      throw err
    }
  }, [district, service, search])

  const refresh = useCallback(async () => {
    if (!enabled) return

    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    abortControllerRef.current = new AbortController()
    
    setLoading(true)
    setError(null)

    try {
      const result = await fetchPoliceData(abortControllerRef.current.signal)
      
      if (result) {
        setData(result.stations)
        setMetadata(result.metadata)
        setLastUpdated(result.metadata.last_updated)
        
        if (result.error) {
          setError(result.error)
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch police data'
      setError(errorMessage)
      console.error('Police data fetch error:', err)
    } finally {
      setLoading(false)
      abortControllerRef.current = null
    }
  }, [enabled, fetchPoliceData])

  // Initial fetch and refetch when filters change
  useEffect(() => {
    if (enabled) {
      refresh()
    }
  }, [enabled, refresh])

  // Auto-refresh setup (optional, disabled by default for static data)
  useEffect(() => {
    if (!autoRefresh || !enabled) {
      return
    }

    if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }

    intervalRef.current = setInterval(() => {
      refresh()
    }, refreshInterval)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [autoRefresh, enabled, refreshInterval, refresh])

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

  return {
    data,
    loading,
    error,
    lastUpdated,
    refresh,
    metadata
  }
}

// Additional utility hook for local filtering (client-side)
export function useFilteredPoliceData(
  data: PoliceStation[] | null,
  filters: {
    district?: string
    service?: string
    searchQuery?: string
    hasCoordinates?: boolean
  } = {}
) {
  return useState(() => {
    if (!data) return []

    return data.filter(station => {
      // District filter
      if (filters.district && filters.district !== 'all') {
        if (station.district !== filters.district) return false
      }

      // Service filter
      if (filters.service && filters.service !== 'all') {
        if (!station.services.includes(filters.service)) return false
      }

      // Search filter
      if (filters.searchQuery) {
        const query = filters.searchQuery.toLowerCase()
        const name = station.name.toLowerCase()
        const address = station.address.toLowerCase()
        const district = station.district.toLowerCase()
        if (!name.includes(query) && !address.includes(query) && !district.includes(query)) {
          return false
        }
      }

      // Coordinates filter
      if (filters.hasCoordinates !== undefined) {
        if (station.hasCoordinates !== filters.hasCoordinates) return false
      }

      return true
    })
  })[0]
}

export default usePoliceData