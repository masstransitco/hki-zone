"use client"

import React, { createContext, useContext } from 'react'
import { useUnifiedBookmarks } from '@/hooks/use-bookmarks'

interface UnifiedBookmarkContextType {
  bookmarkedArticles: Set<string>
  isBookmarked: (articleId: string) => boolean
  toggleBookmark: (articleId: string, articleTitle?: string) => void
  loading: boolean
  isToggling: boolean
}

const UnifiedBookmarkContext = createContext<UnifiedBookmarkContextType | undefined>(undefined)

export function UnifiedBookmarkProvider({ children }: { children: React.ReactNode }) {
  const bookmarkState = useUnifiedBookmarks()

  return (
    <UnifiedBookmarkContext.Provider value={bookmarkState}>
      {children}
    </UnifiedBookmarkContext.Provider>
  )
}

export function useBookmarksContext() {
  const context = useContext(UnifiedBookmarkContext)
  if (context === undefined) {
    throw new Error('useBookmarksContext must be used within a UnifiedBookmarkProvider')
  }
  return context
}

// Backward compatibility - this can gradually replace the old bookmark context
export { UnifiedBookmarkProvider as BookmarkProvider }