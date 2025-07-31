"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { supabaseAuth } from "@/lib/supabase-auth"
import { RealtimeChannel } from "@supabase/supabase-js"

interface MetricsChange {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE'
  new?: any
  old?: any
}

interface UseRealtimeMetricsOptions {
  timeframe: string
  sources: string[]
  enabled?: boolean
  onMetricsUpdate: () => void
}

export function useRealtimeMetrics({ 
  timeframe,
  sources,
  enabled = true,
  onMetricsUpdate
}: UseRealtimeMetricsOptions) {
  const [channel, setChannel] = useState<RealtimeChannel | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected')
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const channelRef = useRef<RealtimeChannel | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const updateDebounceRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const maxReconnectAttempts = 5
  const isReconnectingRef = useRef(false)

  // Store the callback in a ref to prevent re-renders
  const onMetricsUpdateRef = useRef(onMetricsUpdate)
  onMetricsUpdateRef.current = onMetricsUpdate

  // Debounced metrics update to avoid too frequent refreshes
  const debouncedMetricsUpdate = useCallback(() => {
    if (updateDebounceRef.current) {
      clearTimeout(updateDebounceRef.current)
    }
    
    updateDebounceRef.current = setTimeout(() => {
      console.log(`📊 [REALTIME METRICS] Triggering metrics update`)
      setLastUpdate(new Date())
      onMetricsUpdateRef.current()
    }, 1000) // Debounce by 1 second
  }, [])

  // Store filter values in refs to prevent re-renders
  const timeframeRef = useRef(timeframe)
  const sourcesRef = useRef(sources)
  timeframeRef.current = timeframe
  sourcesRef.current = sources

  // Handle article changes that affect metrics
  const handleArticleChange = useCallback((payload: MetricsChange) => {
    const article = payload.new || payload.old
    
    // Check if this change affects our current view
    if (sourcesRef.current.length > 0 && article?.source && !sourcesRef.current.includes(article.source)) {
      console.log(`📊 [REALTIME METRICS] Change filtered out - source: ${article.source}`)
      return
    }

    // Check if the article falls within our timeframe
    const articleDate = new Date(article?.created_at || article?.inserted_at)
    const now = new Date()
    let isWithinTimeframe = true

    switch (timeframeRef.current) {
      case '7d':
        isWithinTimeframe = articleDate >= new Date(now.setDate(now.getDate() - 7))
        break
      case '30d':
        isWithinTimeframe = articleDate >= new Date(now.setDate(now.getDate() - 30))
        break
      case '90d':
        isWithinTimeframe = articleDate >= new Date(now.setDate(now.getDate() - 90))
        break
      // 'all' means no filtering
    }

    if (!isWithinTimeframe && timeframeRef.current !== 'all') {
      console.log(`📊 [REALTIME METRICS] Change filtered out - outside timeframe`)
      return
    }

    console.log(`📊 [REALTIME METRICS] Article ${payload.eventType}: ${article?.title?.substring(0, 50)}...`)
    debouncedMetricsUpdate()
  }, [debouncedMetricsUpdate])

  // Calculate exponential backoff delay
  const getReconnectDelay = useCallback((attempt: number) => {
    return Math.min(1000 * Math.pow(2, attempt), 30000) // Max 30 seconds
  }, [])

  // Store enabled state in ref to prevent re-renders
  const enabledRef = useRef(enabled)
  enabledRef.current = enabled

  // Setup subscription with reconnection logic
  const setupSubscription = useCallback(() => {
    if (!enabledRef.current || isReconnectingRef.current) {
      return
    }

    // Clean up existing subscription
    if (channelRef.current) {
      supabaseAuth.removeChannel(channelRef.current)
      channelRef.current = null
      setChannel(null)
    }

    // Clear any pending reconnection
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

    // Create channel name
    const channelName = `metrics-${timeframeRef.current}-${sourcesRef.current.join('-') || 'all'}-${Date.now()}`
    
    console.log(`📊 [REALTIME METRICS] Setting up subscription: ${channelName}`)
    setConnectionStatus('connecting')

    // Subscribe to all article changes
    const metricsChannel = supabaseAuth
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'articles'
        },
        (payload) => handleArticleChange(payload as MetricsChange)
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'articles'
        },
        (payload) => handleArticleChange(payload as MetricsChange)
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'articles'
        },
        (payload) => handleArticleChange(payload as MetricsChange)
      )
      .subscribe((status) => {
        console.log(`📊 [REALTIME METRICS] Subscription status:`, status)
        
        if (status === 'SUBSCRIBED') {
          setConnectionStatus('connected')
          reconnectAttemptsRef.current = 0
          console.log(`✅ [REALTIME METRICS] Successfully connected`)
        } else if (status === 'CLOSED') {
          setConnectionStatus('disconnected')
          console.log(`❌ [REALTIME METRICS] Connection closed`)
          
          // Attempt reconnection
          if (enabledRef.current && reconnectAttemptsRef.current < maxReconnectAttempts && !isReconnectingRef.current) {
            isReconnectingRef.current = true
            const delay = getReconnectDelay(reconnectAttemptsRef.current)
            console.log(`🔄 [REALTIME METRICS] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current + 1}/${maxReconnectAttempts})`)
            
            reconnectTimeoutRef.current = setTimeout(() => {
              reconnectAttemptsRef.current++
              isReconnectingRef.current = false
              setupSubscription()
            }, delay)
          }
        } else {
          setConnectionStatus('connecting')
        }
      })

    setChannel(metricsChannel)
    channelRef.current = metricsChannel
  }, [handleArticleChange, getReconnectDelay])

  // Set up real-time subscription
  useEffect(() => {
    if (!enabled) {
      // Clean up if disabled
      if (channelRef.current) {
        supabaseAuth.removeChannel(channelRef.current)
        channelRef.current = null
        setChannel(null)
        setConnectionStatus('disconnected')
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
        reconnectTimeoutRef.current = null
      }
      if (updateDebounceRef.current) {
        clearTimeout(updateDebounceRef.current)
        updateDebounceRef.current = null
      }
      return
    }

    setupSubscription()

    // Cleanup on unmount or dependency change
    return () => {
      if (channelRef.current) {
        console.log(`📊 [REALTIME METRICS] Cleaning up subscription`)
        supabaseAuth.removeChannel(channelRef.current)
        channelRef.current = null
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
        reconnectTimeoutRef.current = null
      }
      if (updateDebounceRef.current) {
        clearTimeout(updateDebounceRef.current)
        updateDebounceRef.current = null
      }
      isReconnectingRef.current = false
    }
  }, [enabled, setupSubscription])

  // Handle visibility changes for reconnection
  useEffect(() => {
    if (!enabled) return

    const handleVisibilityChange = () => {
      if (!document.hidden && connectionStatus === 'disconnected') {
        console.log('📊 [REALTIME METRICS] Page visible, reconnecting')
        reconnectAttemptsRef.current = 0
        isReconnectingRef.current = false
        setupSubscription()
      }
    }

    const handleOnline = () => {
      if (connectionStatus === 'disconnected') {
        console.log('📊 [REALTIME METRICS] Network online, reconnecting')
        reconnectAttemptsRef.current = 0
        isReconnectingRef.current = false
        setupSubscription()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('online', handleOnline)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('online', handleOnline)
    }
  }, [enabled, connectionStatus, setupSubscription])

  return {
    channel,
    connectionStatus,
    isConnected: connectionStatus === 'connected',
    lastUpdate
  }
}