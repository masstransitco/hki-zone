"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { supabaseAuth } from "@/lib/supabase-auth"
import { RealtimeChannel } from "@supabase/supabase-js"

interface BulletinChange {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE'
  new?: any
  old?: any
}

interface UseRealtimeGovernmentBulletinOptions {
  queryKey: string[]
  category?: string
  enabled?: boolean
}

export function useRealtimeGovernmentBulletin({ 
  queryKey, 
  category,
  enabled = true 
}: UseRealtimeGovernmentBulletinOptions) {
  const queryClient = useQueryClient()
  const [channel, setChannel] = useState<RealtimeChannel | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected')
  const channelRef = useRef<RealtimeChannel | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const maxReconnectAttempts = 5
  const isReconnectingRef = useRef(false)

  const queryKeyRef = useRef(queryKey)
  queryKeyRef.current = queryKey

  // Handle new bulletins being inserted
  const handleBulletinInsert = useCallback((payload: BulletinChange) => {
    if (!payload.new) return

    const newBulletin = payload.new
    console.log(`📢 [REALTIME] New bulletin: ${newBulletin.title}`)

    // Check if bulletin matches our filter criteria
    const matchesFilter = 
      !category || category === 'top_signals' || newBulletin.category === category

    if (!matchesFilter) {
      console.log(`📢 [REALTIME] Bulletin filtered out: Category: ${newBulletin.category}`)
      return
    }

    // Transform database bulletin to match the expected format
    const transformedBulletin = {
      id: newBulletin.id,
      title: newBulletin.title,
      body: newBulletin.body,
      category: newBulletin.category,
      severity: newBulletin.severity,
      relevance_score: newBulletin.relevance_score || newBulletin.ai_score || 0,
      source_slug: newBulletin.source_slug,
      source_updated_at: newBulletin.source_updated_at,
      enrichment_status: newBulletin.enrichment_status,
      enriched_title: newBulletin.enriched_title,
      enriched_summary: newBulletin.enriched_summary,
      key_points: newBulletin.key_points,
      why_it_matters: newBulletin.why_it_matters,
      created_at: newBulletin.created_at
    }

    // Update React Query cache by prepending new bulletin
    queryClient.setQueryData(queryKeyRef.current, (oldData: any) => {
      if (!oldData) return oldData

      return [transformedBulletin, ...(oldData || [])]
    })

    // Invalidate query to trigger UI update
    queryClient.invalidateQueries({ queryKey: queryKeyRef.current })
  }, [queryClient, category])

  // Handle bulletin updates
  const handleBulletinUpdate = useCallback((payload: BulletinChange) => {
    if (!payload.new) return

    const updatedBulletin = payload.new
    console.log(`📢 [REALTIME] Bulletin updated: ${updatedBulletin.title}`)

    // Transform database bulletin to match the expected format
    const transformedBulletin = {
      id: updatedBulletin.id,
      title: updatedBulletin.title,
      body: updatedBulletin.body,
      category: updatedBulletin.category,
      severity: updatedBulletin.severity,
      relevance_score: updatedBulletin.relevance_score || updatedBulletin.ai_score || 0,
      source_slug: updatedBulletin.source_slug,
      source_updated_at: updatedBulletin.source_updated_at,
      enrichment_status: updatedBulletin.enrichment_status,
      enriched_title: updatedBulletin.enriched_title,
      enriched_summary: updatedBulletin.enriched_summary,
      key_points: updatedBulletin.key_points,
      why_it_matters: updatedBulletin.why_it_matters,
      created_at: updatedBulletin.created_at
    }

    // Update React Query cache by finding and updating the specific bulletin
    queryClient.setQueryData(queryKeyRef.current, (oldData: any) => {
      if (!oldData || !Array.isArray(oldData)) return oldData

      return oldData.map((bulletin: any) =>
        bulletin.id === transformedBulletin.id ? transformedBulletin : bulletin
      )
    })

    // Invalidate query to trigger UI update
    queryClient.invalidateQueries({ queryKey: queryKeyRef.current })
  }, [queryClient])

  // Handle bulletin deletions
  const handleBulletinDelete = useCallback((payload: BulletinChange) => {
    if (!payload.old) return

    const deletedBulletinId = payload.old.id
    console.log(`📢 [REALTIME] Bulletin deleted: ${deletedBulletinId}`)

    // Update React Query cache by removing the deleted bulletin
    queryClient.setQueryData(queryKeyRef.current, (oldData: any) => {
      if (!oldData || !Array.isArray(oldData)) return oldData

      return oldData.filter((bulletin: any) => bulletin.id !== deletedBulletinId)
    })

    // Invalidate query to trigger UI update
    queryClient.invalidateQueries({ queryKey: queryKeyRef.current })
  }, [queryClient])

  // Calculate exponential backoff delay
  const getReconnectDelay = useCallback((attempt: number) => {
    return Math.min(1000 * Math.pow(2, attempt), 30000) // Max 30 seconds
  }, [])

  // Setup subscription with reconnection logic
  const setupSubscription = useCallback(() => {
    if (!enabled || isReconnectingRef.current) {
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

    // Create channel name based on filter criteria
    const channelName = `bulletins-${category || 'all'}-${Date.now()}`
    
    console.log(`📢 [REALTIME] Setting up subscription: ${channelName} (attempt ${reconnectAttemptsRef.current + 1})`)
    setConnectionStatus('connecting')

    // Note: Using 'incidents' table as that's what the API uses
    const bulletinChannel = supabaseAuth
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'incidents'
        },
        (payload) => handleBulletinInsert(payload as BulletinChange)
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'incidents'
        },
        (payload) => handleBulletinUpdate(payload as BulletinChange)
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'incidents'
        },
        (payload) => handleBulletinDelete(payload as BulletinChange)
      )
      .subscribe((status) => {
        console.log(`📢 [REALTIME] Subscription status for ${channelName}:`, status)
        
        if (status === 'SUBSCRIBED') {
          setConnectionStatus('connected')
          reconnectAttemptsRef.current = 0 // Reset on successful connection
          console.log(`✅ [REALTIME] Successfully connected: ${channelName}`)
        } else if (status === 'CLOSED') {
          setConnectionStatus('disconnected')
          console.log(`❌ [REALTIME] Connection closed: ${channelName}`)
          
          // Attempt reconnection if enabled and under max attempts
          if (enabled && reconnectAttemptsRef.current < maxReconnectAttempts && !isReconnectingRef.current) {
            isReconnectingRef.current = true
            const delay = getReconnectDelay(reconnectAttemptsRef.current)
            console.log(`🔄 [REALTIME] Scheduling reconnection in ${delay}ms (attempt ${reconnectAttemptsRef.current + 1}/${maxReconnectAttempts})`)
            
            reconnectTimeoutRef.current = setTimeout(() => {
              reconnectAttemptsRef.current++
              isReconnectingRef.current = false
              setupSubscription()
            }, delay)
          } else if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
            console.log(`❌ [REALTIME] Max reconnection attempts reached for ${channelName}`)
          }
        } else {
          setConnectionStatus('connecting')
        }
      })

    setChannel(bulletinChannel)
    channelRef.current = bulletinChannel
  }, [enabled, category, handleBulletinInsert, handleBulletinUpdate, handleBulletinDelete, getReconnectDelay])

  // Set up real-time subscription
  useEffect(() => {
    if (!enabled) {
      // Clean up existing subscription if disabled
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
      return
    }

    setupSubscription()

    // Cleanup on unmount or dependency change
    return () => {
      if (channelRef.current) {
        console.log(`📢 [REALTIME] Cleaning up subscription`)
        supabaseAuth.removeChannel(channelRef.current)
        channelRef.current = null
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
        reconnectTimeoutRef.current = null
      }
      isReconnectingRef.current = false
    }
  }, [enabled, setupSubscription])

  // Handle visibility changes for reconnection
  useEffect(() => {
    if (!enabled) return

    const handleVisibilityChange = () => {
      if (!document.hidden && connectionStatus === 'disconnected') {
        console.log('📢 [REALTIME] Page became visible, attempting reconnection')
        reconnectAttemptsRef.current = 0 // Reset attempts when page becomes visible
        isReconnectingRef.current = false
        setupSubscription()
      }
    }

    const handleOnline = () => {
      if (connectionStatus === 'disconnected') {
        console.log('📢 [REALTIME] Network came online, attempting reconnection')
        reconnectAttemptsRef.current = 0 // Reset attempts when network comes back
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
    isConnected: connectionStatus === 'connected'
  }
}