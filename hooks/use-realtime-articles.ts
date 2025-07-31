"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { supabaseAuth } from "@/lib/supabase-auth"
import { RealtimeChannel } from "@supabase/supabase-js"
import type { Article } from "@/lib/types"

interface ArticleChange {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE'
  new?: any
  old?: any
}

interface UseRealtimeArticlesOptions {
  queryKey: string[]
  isAiEnhanced?: boolean
  language?: string
  enabled?: boolean
  onUpdate?: (article: Article) => void
  onDelete?: (articleId: string) => void
}

export function useRealtimeArticles({ 
  queryKey, 
  isAiEnhanced, 
  language,
  enabled = true,
  onUpdate,
  onDelete
}: UseRealtimeArticlesOptions) {
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

  // Handle new articles being inserted
  const handleArticleInsert = useCallback((payload: ArticleChange) => {
    if (!payload.new) return

    const newArticle = payload.new
    console.log(`📰 [REALTIME] New article: ${newArticle.title}`)

    // Check if article matches our filter criteria
    const matchesFilter = 
      (isAiEnhanced === undefined || newArticle.is_ai_enhanced === isAiEnhanced) &&
      (language === undefined || 
       (!newArticle.enhancement_metadata?.language && language === 'en') ||
       newArticle.enhancement_metadata?.language === language)

    if (!matchesFilter) {
      console.log(`📰 [REALTIME] Article filtered out: AI Enhanced: ${newArticle.is_ai_enhanced}, Language: ${newArticle.enhancement_metadata?.language}`)
      return
    }

    // Transform database article to match Article interface
    const transformedArticle: Article = {
      id: newArticle.id,
      title: newArticle.title,
      summary: newArticle.summary,
      content: newArticle.content,
      url: newArticle.url,
      source: newArticle.source,
      publishedAt: newArticle.created_at,
      imageUrl: newArticle.image_url,
      category: newArticle.category,
      isAiEnhanced: newArticle.is_ai_enhanced || false,
      enhancementMetadata: newArticle.enhancement_metadata,
      language: newArticle.enhancement_metadata?.language
    }

    // If Redux callback provided, use it instead of React Query
    if (onUpdate) {
      onUpdate(transformedArticle)
    } else {
      // Update React Query cache by prepending new article to the first page
      queryClient.setQueryData(queryKeyRef.current, (oldData: any) => {
        if (!oldData) return oldData

        const updatedPages = [...oldData.pages]
        if (updatedPages[0]) {
          updatedPages[0] = {
            ...updatedPages[0],
            articles: [transformedArticle, ...updatedPages[0].articles]
          }
        }

        return {
          ...oldData,
          pages: updatedPages
        }
      })

      // Invalidate query to trigger UI update
      queryClient.invalidateQueries({ queryKey: queryKeyRef.current })
    }
  }, [queryClient, isAiEnhanced, language, onUpdate])

  // Handle article updates
  const handleArticleUpdate = useCallback((payload: ArticleChange) => {
    if (!payload.new) return

    const updatedArticle = payload.new
    console.log(`📰 [REALTIME] Article updated: ${updatedArticle.title}`)

    // Transform database article to match Article interface
    const transformedArticle: Article = {
      id: updatedArticle.id,
      title: updatedArticle.title,
      summary: updatedArticle.summary,
      content: updatedArticle.content,
      url: updatedArticle.url,
      source: updatedArticle.source,
      publishedAt: updatedArticle.created_at,
      imageUrl: updatedArticle.image_url,
      category: updatedArticle.category,
      isAiEnhanced: updatedArticle.is_ai_enhanced || false,
      enhancementMetadata: updatedArticle.enhancement_metadata,
      language: updatedArticle.enhancement_metadata?.language
    }

    // If Redux callback provided, use it instead of React Query
    if (onUpdate) {
      onUpdate(transformedArticle)
    } else {
      // Update React Query cache by finding and updating the specific article
      queryClient.setQueryData(queryKeyRef.current, (oldData: any) => {
        if (!oldData) return oldData

        const updatedPages = oldData.pages.map((page: any) => ({
          ...page,
          articles: page.articles.map((article: Article) =>
            article.id === transformedArticle.id ? transformedArticle : article
          )
        }))

        return {
          ...oldData,
          pages: updatedPages
        }
      })

      // Invalidate query to trigger UI update
      queryClient.invalidateQueries({ queryKey: queryKeyRef.current })
    }
  }, [queryClient, onUpdate])

  // Handle article deletions
  const handleArticleDelete = useCallback((payload: ArticleChange) => {
    if (!payload.old) return

    const deletedArticleId = payload.old.id
    console.log(`📰 [REALTIME] Article deleted: ${deletedArticleId}`)

    // If Redux callback provided, use it instead of React Query
    if (onDelete) {
      onDelete(deletedArticleId)
    } else {
      // Update React Query cache by removing the deleted article
      queryClient.setQueryData(queryKeyRef.current, (oldData: any) => {
        if (!oldData) return oldData

        const updatedPages = oldData.pages.map((page: any) => ({
          ...page,
          articles: page.articles.filter((article: Article) => article.id !== deletedArticleId)
        }))

        return {
          ...oldData,
          pages: updatedPages
        }
      })

      // Invalidate query to trigger UI update
      queryClient.invalidateQueries({ queryKey: queryKeyRef.current })
    }
  }, [queryClient, onDelete])

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
    const channelName = `articles-${isAiEnhanced ? 'ai' : 'regular'}-${language || 'all'}-${Date.now()}`
    
    console.log(`📰 [REALTIME] Setting up subscription: ${channelName} (attempt ${reconnectAttemptsRef.current + 1})`)
    setConnectionStatus('connecting')

    // Create subscription with appropriate filters
    let filter = 'is_ai_enhanced=eq.true'
    if (isAiEnhanced === false) {
      filter = 'is_ai_enhanced=eq.false'
    }

    const articleChannel = supabaseAuth
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'articles',
          filter: filter
        },
        (payload) => handleArticleInsert(payload as ArticleChange)
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'articles',
          filter: filter
        },
        (payload) => handleArticleUpdate(payload as ArticleChange)
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'articles',
          filter: filter
        },
        (payload) => handleArticleDelete(payload as ArticleChange)
      )
      .subscribe((status) => {
        console.log(`📰 [REALTIME] Subscription status for ${channelName}:`, status)
        
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

    setChannel(articleChannel)
    channelRef.current = articleChannel
  }, [enabled, isAiEnhanced, language, handleArticleInsert, handleArticleUpdate, handleArticleDelete, getReconnectDelay])

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
        console.log(`📰 [REALTIME] Cleaning up subscription`)
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
        console.log('📰 [REALTIME] Page became visible, attempting reconnection')
        reconnectAttemptsRef.current = 0 // Reset attempts when page becomes visible
        isReconnectingRef.current = false
        setupSubscription()
      }
    }

    const handleOnline = () => {
      if (connectionStatus === 'disconnected') {
        console.log('📰 [REALTIME] Network came online, attempting reconnection')
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