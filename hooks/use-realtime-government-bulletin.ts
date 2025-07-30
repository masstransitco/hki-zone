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
      return
    }

    // Create channel name based on filter criteria
    const channelName = `bulletins-${category || 'all'}`
    
    console.log(`📢 [REALTIME] Setting up subscription: ${channelName}`)
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
        setConnectionStatus(
          status === 'SUBSCRIBED' ? 'connected' : 
          status === 'CLOSED' ? 'disconnected' : 'connecting'
        )
      })

    setChannel(bulletinChannel)
    channelRef.current = bulletinChannel

    // Cleanup on unmount or dependency change
    return () => {
      if (channelRef.current) {
        console.log(`📢 [REALTIME] Cleaning up subscription: ${channelName}`)
        supabaseAuth.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [enabled, category, handleBulletinInsert, handleBulletinUpdate, handleBulletinDelete])

  return {
    channel,
    connectionStatus,
    isConnected: connectionStatus === 'connected'
  }
}