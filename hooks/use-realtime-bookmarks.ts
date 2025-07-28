"use client"

import { useState, useEffect, useCallback } from "react"
import { useAuth } from "@/contexts/auth-context"
import { supabaseAuth } from "@/lib/supabase-auth"
import { RealtimeChannel } from "@supabase/supabase-js"

interface BookmarkChange {
  eventType: 'INSERT' | 'DELETE' | 'UPDATE'
  new?: { id: string; article_id: string; user_id: string; created_at: string }
  old?: { id: string; article_id: string; user_id: string }
}

export function useRealtimeBookmarks() {
  const { user } = useAuth()
  const [bookmarkedArticles, setBookmarkedArticles] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [channel, setChannel] = useState<RealtimeChannel | null>(null)

  // Check if an article is bookmarked
  const isBookmarked = useCallback((articleId: string): boolean => {
    return bookmarkedArticles.has(articleId)
  }, [bookmarkedArticles])

  // Toggle bookmark status with optimistic updates
  const toggleBookmark = useCallback(async (articleId: string, articleTitle?: string) => {
    if (!user) return false

    const wasBookmarked = bookmarkedArticles.has(articleId)
    
    // Optimistic update
    setBookmarkedArticles(prev => {
      const newSet = new Set(prev)
      if (wasBookmarked) {
        newSet.delete(articleId)
      } else {
        newSet.add(articleId)
      }
      return newSet
    })

    try {
      const session = await supabaseAuth.auth.getSession()
      const token = session.data.session?.access_token

      if (!token) {
        // Revert optimistic update on auth failure
        setBookmarkedArticles(prev => {
          const newSet = new Set(prev)
          if (wasBookmarked) {
            newSet.add(articleId)
          } else {
            newSet.delete(articleId)
          }
          return newSet
        })
        return false
      }

      const response = await fetch('/api/bookmarks', {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ articleId }),
        cache: 'no-cache'
      })

      if (!response.ok) {
        // Revert optimistic update on API failure
        setBookmarkedArticles(prev => {
          const newSet = new Set(prev)
          if (wasBookmarked) {
            newSet.add(articleId)
          } else {
            newSet.delete(articleId)
          }
          return newSet
        })
        console.error('Failed to toggle bookmark:', response.statusText)
        return false
      }

      const data = await response.json()
      
      // Real-time subscription will handle the actual state update
      // but we can track analytics here
      console.log(`Bookmark ${data.action}: ${articleTitle || articleId}`)
      
      return data.isBookmarked
    } catch (error) {
      // Revert optimistic update on error
      setBookmarkedArticles(prev => {
        const newSet = new Set(prev)
        if (wasBookmarked) {
          newSet.add(articleId)
        } else {
          newSet.delete(articleId)
        }
        return newSet
      })
      console.error('Error toggling bookmark:', error)
      return false
    }
  }, [user, bookmarkedArticles])

  // Load initial bookmarks
  const loadInitialBookmarks = useCallback(async () => {
    if (!user) {
      setBookmarkedArticles(new Set())
      setLoading(false)
      return
    }

    setLoading(true)
    
    try {
      const session = await supabaseAuth.auth.getSession()
      const token = session.data.session?.access_token

      if (!token) {
        setBookmarkedArticles(new Set())
        setLoading(false)
        return
      }

      // Use AbortController to prevent hanging requests
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000) // 5 second timeout

      const response = await fetch('/api/bookmarks?limit=1000', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (response.ok) {
        const data = await response.json()
        const articleIds = new Set(
          data.bookmarks.map((bookmark: any) => bookmark.id || bookmark.article_id)
        )
        setBookmarkedArticles(articleIds)
      } else {
        console.error('Failed to load initial bookmarks:', response.statusText)
        setBookmarkedArticles(new Set())
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        console.warn('Bookmark loading was aborted due to timeout')
      } else {
        console.error('Error loading initial bookmarks:', error)
      }
      setBookmarkedArticles(new Set())
    } finally {
      setLoading(false)
    }
  }, [user])

  // Handle real-time bookmark changes
  const handleBookmarkChange = useCallback((payload: BookmarkChange) => {
    console.log('📚 [REALTIME] Bookmark change:', payload)
    
    setBookmarkedArticles(prev => {
      const newSet = new Set(prev)
      
      if (payload.eventType === 'INSERT' && payload.new) {
        newSet.add(payload.new.article_id)
      } else if (payload.eventType === 'DELETE' && payload.old) {
        newSet.delete(payload.old.article_id)
      }
      
      return newSet
    })
  }, [])

  // Set up real-time subscription
  useEffect(() => {
    if (!user) {
      // Clean up subscription if user logs out
      if (channel) {
        supabaseAuth.removeChannel(channel)
        setChannel(null)
      }
      setBookmarkedArticles(new Set())
      setLoading(false)
      return
    }

    // Load initial bookmarks
    loadInitialBookmarks()

    // Set up real-time subscription for user's bookmarks
    const bookmarkChannel = supabaseAuth
      .channel(`user-bookmarks-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bookmarks',
          filter: `user_id=eq.${user.id}`
        },
        handleBookmarkChange
      )
      .subscribe((status) => {
        console.log('📚 [REALTIME] Bookmark subscription status:', status)
      })

    setChannel(bookmarkChannel)

    // Cleanup on unmount or user change
    return () => {
      supabaseAuth.removeChannel(bookmarkChannel)
    }
  }, [user])

  return {
    bookmarkedArticles,
    isBookmarked,
    toggleBookmark,
    loading
  }
}