"use client"

import { useState, useEffect, useCallback, useRef } from "react"

export interface OutletStatus {
  status: 'idle' | 'running' | 'completed' | 'error'
  progress: number
  articlesFound: number
  message: string
  startTime?: number
  endTime?: number
  error?: string
}

export interface ProgressData {
  isRunning: boolean
  outlets: Record<string, OutletStatus>
  overall: {
    progress: number
    message: string
    startTime?: number
    endTime?: number
  }
}

export function useScrapeProgress() {
  const [progress, setProgress] = useState<ProgressData>({
    isRunning: false,
    outlets: {
      hkfp: { status: 'idle', progress: 0, articlesFound: 0, message: 'Ready' },
      singtao: { status: 'idle', progress: 0, articlesFound: 0, message: 'Ready' },
      hk01: { status: 'idle', progress: 0, articlesFound: 0, message: 'Ready' },
      oncc: { status: 'idle', progress: 0, articlesFound: 0, message: 'Ready' },
      rthk: { status: 'idle', progress: 0, articlesFound: 0, message: 'Ready' },
      '28car': { status: 'idle', progress: 0, articlesFound: 0, message: 'Ready' },
    },
    overall: {
      progress: 0,
      message: 'Ready to scrape'
    }
  })
  
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)

  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }

    try {
      const eventSource = new EventSource('/api/scrape/progress')
      eventSourceRef.current = eventSource

      eventSource.onopen = () => {
        setIsConnected(true)
        setError(null)
        console.log('🔗 Progress connection established')
      }

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          
          if (data.type === 'progress' || data.type === 'initial') {
            setProgress(data.data)
          }
        } catch (err) {
          console.error('Failed to parse progress data:', err)
        }
      }

      eventSource.onerror = (err) => {
        console.error('Progress connection error:', err)
        setIsConnected(false)
        setError('Connection lost. Retrying...')
        
        // Auto-reconnect after 3 seconds
        setTimeout(() => {
          if (eventSourceRef.current?.readyState === EventSource.CLOSED) {
            connect()
          }
        }, 3000)
      }

    } catch (err) {
      console.error('Failed to establish progress connection:', err)
      setError('Failed to connect to progress updates')
    }
  }, [])

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
    setIsConnected(false)
  }, [])

  const resetProgress = useCallback(async () => {
    try {
      await fetch('/api/scrape/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset' })
      })
    } catch (err) {
      console.error('Failed to reset progress:', err)
    }
  }, [])

  const startScraping = useCallback(async (outlets?: string[]) => {
    try {
      await fetch('/api/scrape/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'start',
          data: { outlets }
        })
      })
    } catch (err) {
      console.error('Failed to start scraping progress:', err)
    }
  }, [])

  // Auto-connect on mount
  useEffect(() => {
    connect()
    
    return () => {
      disconnect()
    }
  }, [connect, disconnect])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
      }
    }
  }, [])

  return {
    progress,
    isConnected,
    error,
    connect,
    disconnect,
    resetProgress,
    startScraping,
  }
}