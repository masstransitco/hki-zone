"use client"

import { useState, useEffect, useCallback, useRef } from 'react'

interface Park {
  id: string
  name: string
  address: string
  district: string
  type: string
  latitude: number
  longitude: number
  hasCoordinates: boolean
}

interface ParksApiResponse {
  parks: Park[]
  total: number
  metadata: {
    source: string
    last_updated: string
    districts_available: string[]
    types_available: string[]
    total_parks: number
    parks_with_coordinates: number
  }
  error?: string
}

interface UseParksDataOptions {
  district?: string
  type?: string
  search?: string
  autoRefresh?: boolean
  refreshInterval?: number
  enabled?: boolean
}

interface UseParksDataReturn {
  data: Park[] | null
  loading: boolean
  error: string | null
  lastUpdated: string | null
  refresh: () => Promise<void>
  metadata: ParksApiResponse['metadata'] | null
}

export function useParksData(options: UseParksDataOptions = {}): UseParksDataReturn {
  const {
    district,
    type,
    search,
    autoRefresh = false, // Parks data is static, no need for auto-refresh
    refreshInterval = 30 * 60 * 1000, // 30 minutes if enabled
    enabled = true
  } = options

  const [data, setData] = useState<Park[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const [metadata, setMetadata] = useState<ParksApiResponse['metadata'] | null>(null)

  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const fetchParksData = useCallback(async (signal?: AbortSignal): Promise<ParksApiResponse | null> => {
    try {
      // Build query parameters
      const params = new URLSearchParams()
      if (district && district !== 'all') params.append('district', district)
      if (type && type !== 'all') params.append('type', type)
      if (search && search.trim() !== '') params.append('search', search.trim())

      const response = await fetch(`/api/parks?${params.toString()}`, {
        signal,
        headers: {
          'Cache-Control': 'no-cache',
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const responseData: ParksApiResponse = await response.json()
      return responseData
    } catch (err) {
      if (signal?.aborted) {
        return null
      }
      throw err
    }
  }, [district, type, search])

  const refresh = useCallback(async () => {
    if (!enabled) return

    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    abortControllerRef.current = new AbortController()
    
    setLoading(true)
    setError(null)

    try {
      const result = await fetchParksData(abortControllerRef.current.signal)
      
      if (result) {
        setData(result.parks)
        setMetadata(result.metadata)
        setLastUpdated(result.metadata.last_updated)
        
        if (result.error) {
          setError(result.error)
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch parks data'
      setError(errorMessage)
      console.error('Parks data fetch error:', err)
    } finally {
      setLoading(false)
      abortControllerRef.current = null
    }
  }, [enabled, fetchParksData])

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
export function useFilteredParksData(
  data: Park[] | null,
  filters: {
    district?: string
    type?: string
    searchQuery?: string
    hasCoordinates?: boolean
  } = {}
) {
  return useState(() => {
    if (!data) return []

    return data.filter(park => {
      // District filter
      if (filters.district && filters.district !== 'all') {
        if (park.district !== filters.district) return false
      }

      // Type filter
      if (filters.type && filters.type !== 'all') {
        if (park.type !== filters.type) return false
      }

      // Search filter
      if (filters.searchQuery) {
        const query = filters.searchQuery.toLowerCase()
        const name = park.name.toLowerCase()
        const address = park.address.toLowerCase()
        const district = park.district.toLowerCase()
        if (!name.includes(query) && !address.includes(query) && !district.includes(query)) {
          return false
        }
      }

      // Coordinates filter
      if (filters.hasCoordinates !== undefined) {
        if (park.hasCoordinates !== filters.hasCoordinates) return false
      }

      return true
    })
  })[0]
}

export default useParksData