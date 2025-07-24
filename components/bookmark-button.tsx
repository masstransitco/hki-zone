"use client"

import { useState, useEffect, useCallback } from "react"
import TurnedInIcon from '@mui/icons-material/TurnedIn'
import TurnedInNotIcon from '@mui/icons-material/TurnedInNot'
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useAuth } from "@/contexts/auth-context"
import { supabaseAuth } from "@/lib/supabase-auth"
import { analytics } from "@/lib/analytics"

interface BookmarkButtonProps {
  articleId: string
  articleTitle?: string
  compact?: boolean
  className?: string
  onAuthRequired?: () => void
}

export default function BookmarkButton({ 
  articleId, 
  articleTitle,
  compact = false, 
  className,
  onAuthRequired
}: BookmarkButtonProps) {
  const { user, loading: authLoading } = useAuth()
  const [isBookmarked, setIsBookmarked] = useState(false)
  const [loading, setLoading] = useState(false)
  const [checkingStatus, setCheckingStatus] = useState(true)

  // Check bookmark status when component mounts or user changes
  const checkBookmarkStatus = useCallback(async () => {
    if (!user || !articleId) {
      setIsBookmarked(false)
      setCheckingStatus(false)
      return
    }

    try {
      const session = await supabaseAuth.auth.getSession()
      const token = session.data.session?.access_token

      if (!token) {
        setIsBookmarked(false)
        setCheckingStatus(false)
        return
      }

      const response = await fetch(`/api/bookmarks/${articleId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        const data = await response.json()
        setIsBookmarked(data.isBookmarked)
      } else {
        setIsBookmarked(false)
      }
    } catch (error) {
      console.error('Error checking bookmark status:', error)
      setIsBookmarked(false)
    } finally {
      setCheckingStatus(false)
    }
  }, [user, articleId])

  useEffect(() => {
    if (!authLoading) {
      checkBookmarkStatus()
    }
  }, [user, articleId, authLoading, checkBookmarkStatus])

  const handleBookmarkToggle = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    // Check if user is authenticated
    if (!user) {
      onAuthRequired?.()
      return
    }

    if (loading) return

    setLoading(true)

    try {
      const session = await supabaseAuth.auth.getSession()
      const token = session.data.session?.access_token

      if (!token) {
        onAuthRequired?.()
        return
      }

      console.log('Making bookmark toggle request for article:', articleId)
      console.log('Using auth token:', token ? 'present' : 'missing')
      
      const response = await fetch('/api/bookmarks', {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ articleId }),
        cache: 'no-cache' // Prevent caching issues
      })

      console.log('Bookmark toggle response:', response.status, response.statusText)
      console.log('Response headers:', Object.fromEntries(response.headers.entries()))

      if (response.ok) {
        const data = await response.json()
        setIsBookmarked(data.isBookmarked)
        
        // Track analytics
        analytics.track('bookmark_toggled', {
          article_id: articleId,
          article_title: articleTitle,
          action: data.action,
          is_bookmarked: data.isBookmarked
        })

        // Show toast notification (optional - can be added later)
        console.log(`Article ${data.action} ${data.isBookmarked ? 'to' : 'from'} bookmarks`)
      } else {
        const errorData = await response.json()
        console.error('Failed to toggle bookmark:', errorData.error)
      }
    } catch (error) {
      console.error('Error toggling bookmark:', error)
    } finally {
      setLoading(false)
    }
  }

  // Show nothing while checking auth status
  if (authLoading || checkingStatus) {
    return null
  }

  const IconComponent = isBookmarked ? TurnedInIcon : TurnedInNotIcon

  if (compact) {
    // Compact version for article cards (small icon next to time)
    return (
      <button
        onClick={handleBookmarkToggle}
        disabled={loading}
        className={cn(
          "flex items-center justify-center transition-colors duration-200",
          "hover:text-stone-700 dark:hover:text-stone-300",
          isBookmarked 
            ? "text-blue-600 dark:text-blue-400" 
            : "text-stone-500 dark:text-neutral-400",
          loading && "opacity-50 cursor-not-allowed",
          className
        )}
        aria-label={isBookmarked ? "Remove bookmark" : "Add bookmark"}
      >
        <IconComponent sx={{ fontSize: 12 }} />
      </button>
    )
  }

  // Full button version for bottom sheet
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleBookmarkToggle}
      disabled={loading}
      className={cn(
        "h-10 w-10 p-0 rounded-full transition-all duration-200",
        isBookmarked
          ? "text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/20"
          : "text-muted-foreground hover:text-foreground hover:bg-muted",
        loading && "opacity-50 cursor-not-allowed",
        className
      )}
      aria-label={isBookmarked ? "Remove bookmark" : "Add bookmark"}
    >
      <IconComponent sx={{ fontSize: 20 }} />
    </Button>
  )
}