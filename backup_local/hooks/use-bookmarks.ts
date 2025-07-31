import { useCallback, useState, useEffect } from 'react'
import { useInfiniteQuery, useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { useAuth } from '@/hooks/redux-auth'
import { supabaseAuth } from '@/lib/supabase-auth'
import { RealtimeChannel } from "@supabase/supabase-js"
import type { Article } from '@/lib/types'

interface BookmarkedArticle extends Article {
  bookmarkId: string
  bookmarkedAt: string
}

interface BookmarksResponse {
  bookmarks: BookmarkedArticle[]
  nextPage: number | null
  totalCount: number
}

// Helper function to get auth token
const getAuthToken = async () => {
  const session = await supabaseAuth.auth.getSession()
  const token = session.data.session?.access_token
  if (!token) {
    throw new Error('No authentication token available')
  }
  return token
}

// Fetch bookmarks with automatic token handling
async function fetchBookmarks({ pageParam = 0 }): Promise<BookmarksResponse> {
  const token = await getAuthToken()
  
  const response = await fetch(`/api/bookmarks?page=${pageParam}&limit=20`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch bookmarks: ${response.status}`)
  }

  return response.json()
}

// Toggle bookmark status
async function toggleBookmark(articleId: string): Promise<{
  success: boolean
  isBookmarked: boolean
  action: 'added' | 'removed'
}> {
  const token = await getAuthToken()
  
  const response = await fetch('/api/bookmarks', {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ articleId })
  })

  if (!response.ok) {
    throw new Error(`Failed to toggle bookmark: ${response.status}`)
  }

  return response.json()
}

// Check if article is bookmarked
async function checkBookmarkStatus(articleId: string): Promise<{ isBookmarked: boolean }> {
  const token = await getAuthToken()
  
  const response = await fetch(`/api/bookmarks/${articleId}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  })

  if (!response.ok) {
    throw new Error(`Failed to check bookmark status: ${response.status}`)
  }

  return response.json()
}

// Hook specifically for article cards - provides bookmark status and toggle functionality
export function useBookmarkStatus() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [bookmarkedArticles, setBookmarkedArticles] = useState<Set<string>>(new Set())
  const [channel, setChannel] = useState<RealtimeChannel | null>(null)

  // Query for getting all user's bookmarked article IDs (for real-time status checking)
  const bookmarkStatusQuery = useQuery({
    queryKey: ['bookmark-status-all', user?.id],
    queryFn: async () => {
      const token = await getAuthToken()
      const response = await fetch('/api/bookmarks?limit=1000', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      if (!response.ok) throw new Error('Failed to fetch bookmark status')
      const data = await response.json()
      return new Set(data.bookmarks.map((b: any) => b.id || b.article_id))
    },
    enabled: !!user,
    staleTime: 30000,
    retry: 2,
  })

  // Update local state when query data changes
  useEffect(() => {
    if (bookmarkStatusQuery.data) {
      setBookmarkedArticles(bookmarkStatusQuery.data)
    }
  }, [bookmarkStatusQuery.data])

  // Set up real-time subscription
  useEffect(() => {
    if (!user) {
      if (channel) {
        supabaseAuth.removeChannel(channel)
        setChannel(null)
      }
      setBookmarkedArticles(new Set())
      return
    }

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
        (payload: any) => {
          setBookmarkedArticles(prev => {
            const newSet = new Set(prev)
            if (payload.eventType === 'INSERT' && payload.new) {
              newSet.add(payload.new.article_id)
            } else if (payload.eventType === 'DELETE' && payload.old) {
              newSet.delete(payload.old.article_id)
            }
            return newSet
          })
          // Also invalidate React Query cache
          queryClient.invalidateQueries({ queryKey: ['bookmark-status-all', user.id] })
        }
      )
      .subscribe()

    setChannel(bookmarkChannel)

    return () => {
      supabaseAuth.removeChannel(bookmarkChannel)
    }
  }, [user, queryClient])

  // Check if article is bookmarked
  const isBookmarked = useCallback((articleId: string): boolean => {
    return bookmarkedArticles.has(articleId)
  }, [bookmarkedArticles])

  // Toggle bookmark with optimistic updates
  const toggleBookmarkMutation = useMutation({
    mutationFn: async ({ articleId, articleTitle }: { articleId: string, articleTitle?: string }) => {
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
        const result = await toggleBookmark(articleId)
        return { ...result, wasBookmarked }
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
        throw error
      }
    },
    onSuccess: (data, { articleId }) => {
      // Real-time subscription will handle most updates, but ensure consistency
      queryClient.invalidateQueries({ queryKey: ['bookmarks', user?.id] })
      queryClient.invalidateQueries({ queryKey: ['bookmark-status-all', user?.id] })
    }
  })

  return {
    // Status checking (for article cards)
    isBookmarked,
    toggleBookmark: (articleId: string, articleTitle?: string) => 
      toggleBookmarkMutation.mutate({ articleId, articleTitle }),
    isToggling: toggleBookmarkMutation.isPending,
    loading: bookmarkStatusQuery.isLoading,
    
    // For components that need the full set
    bookmarkedArticles,
  }
}

// Create aliases for backward compatibility and clear naming
export const useUnifiedBookmarks = useBookmarkStatus
export const useBookmarks = useBookmarksPage

// Hook for the bookmarks page (infinite scroll)
export function useBookmarksPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  // Infinite query for bookmarks list
  const bookmarksQuery = useInfiniteQuery({
    queryKey: ['bookmarks', user?.id],
    queryFn: ({ pageParam }) => fetchBookmarks({ pageParam }),
    getNextPageParam: (lastPage) => lastPage.nextPage,
    initialPageParam: 0,
    enabled: !!user,
    staleTime: 30000,
    retry: 2,
  })

  // Refresh bookmarks
  const refreshBookmarks = useCallback(async () => {
    console.log('🔄 [BOOKMARKS] Refresh START')
    try {
      await bookmarksQuery.refetch()
      console.log('✅ [BOOKMARKS] Refresh COMPLETED')
    } catch (error) {
      console.error('❌ [BOOKMARKS] Refresh FAILED:', error)
      throw error
    }
  }, [bookmarksQuery.refetch])

  // Get flattened bookmarks array
  const bookmarks = bookmarksQuery.data?.pages.flatMap((page) => page.bookmarks) ?? []

  return {
    // Query state
    bookmarks,
    isLoading: bookmarksQuery.isLoading,
    isError: bookmarksQuery.isError,
    error: bookmarksQuery.error,
    hasNextPage: bookmarksQuery.hasNextPage,
    isFetchingNextPage: bookmarksQuery.isFetchingNextPage,
    
    // Actions
    fetchNextPage: bookmarksQuery.fetchNextPage,
    refreshBookmarks,
  }
}

// Hook for checking individual bookmark status (legacy compatibility)
export function useIndividualBookmarkStatus(articleId: string | null) {
  const { user } = useAuth()
  
  return useQuery({
    queryKey: ['bookmark-status', articleId],
    queryFn: () => checkBookmarkStatus(articleId!),
    enabled: !!user && !!articleId,
    staleTime: 60000, // Cache for 1 minute
    retry: 1,
  })
}