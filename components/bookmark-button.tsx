"use client"

import { useState } from "react"
import TurnedInIcon from '@mui/icons-material/TurnedIn'
import TurnedInNotIcon from '@mui/icons-material/TurnedInNot'
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useAuth } from "@/contexts/auth-context"
import { useAuthModal } from "@/contexts/auth-modal-context"
import { useBookmarks } from "@/contexts/bookmark-context"
import { analytics } from "@/lib/analytics"

interface BookmarkButtonProps {
  articleId: string
  articleTitle?: string
  compact?: boolean
  className?: string
}

export default function BookmarkButton({ 
  articleId, 
  articleTitle,
  compact = false, 
  className
}: BookmarkButtonProps) {
  const { user } = useAuth()
  const { showAuthModal } = useAuthModal()
  const { isBookmarked, toggleBookmark, loading: bookmarksLoading } = useBookmarks()
  
  const isArticleBookmarked = isBookmarked(articleId)
  const [loading, setLoading] = useState(false)

  const handleBookmarkToggle = async (e: React.MouseEvent) => {
    // Prevent both default action and event bubbling to parent Card
    e.preventDefault()
    e.stopPropagation()
    
    // Check if user is authenticated
    if (!user) {
      showAuthModal({
        title: "Sign in to bookmark",
        description: "Create an account or sign in to save articles for later"
      })
      return
    }

    if (loading) return

    setLoading(true)

    try {
      const newBookmarkStatus = await toggleBookmark(articleId, articleTitle)
      
      // Track analytics
      analytics.track('bookmark_toggled', {
        article_id: articleId,
        article_title: articleTitle,
        action: newBookmarkStatus ? 'added' : 'removed',
        is_bookmarked: newBookmarkStatus
      })

      console.log(`Article ${newBookmarkStatus ? 'added to' : 'removed from'} bookmarks: ${articleTitle || articleId}`)
    } catch (error) {
      console.error('Error toggling bookmark:', error)
    } finally {
      setLoading(false)
    }
  }

  // Show nothing while loading initial bookmarks
  if (bookmarksLoading) {
    return null
  }

  const IconComponent = isArticleBookmarked ? TurnedInIcon : TurnedInNotIcon

  if (compact) {
    // Compact version for article cards (small icon next to time)
    return (
      <button
        onClick={handleBookmarkToggle}
        disabled={loading}
        className={cn(
          "flex items-center justify-center p-1 transition-colors duration-200",
          "hover:text-stone-700 dark:hover:text-stone-300",
          isArticleBookmarked 
            ? "text-blue-600 dark:text-blue-400" 
            : "text-stone-500 dark:text-neutral-400",
          loading && "opacity-50 cursor-not-allowed",
          className
        )}
        aria-label={isArticleBookmarked ? "Remove bookmark" : "Add bookmark"}
      >
        <IconComponent sx={{ fontSize: 16 }} />
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
        isArticleBookmarked
          ? "text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/20"
          : "text-muted-foreground hover:text-foreground hover:bg-muted",
        loading && "opacity-50 cursor-not-allowed",
        className
      )}
      aria-label={isArticleBookmarked ? "Remove bookmark" : "Add bookmark"}
    >
      <IconComponent sx={{ fontSize: 20 }} />
    </Button>
  )
}