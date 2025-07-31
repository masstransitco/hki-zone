"use client"

import React, { createContext, useContext } from 'react'
import { useRealtimeBookmarks } from '@/hooks/use-realtime-bookmarks'

interface BookmarkContextType {
  bookmarkedArticles: Set<string>
  isBookmarked: (articleId: string) => boolean
  toggleBookmark: (articleId: string, articleTitle?: string) => Promise<boolean>
  loading: boolean
}

const BookmarkContext = createContext<BookmarkContextType | undefined>(undefined)

export function BookmarkProvider({ children }: { children: React.ReactNode }) {
  const bookmarkState = useRealtimeBookmarks()

  // Don't block rendering while bookmarks are loading
  return (
    <BookmarkContext.Provider value={bookmarkState}>
      {children}
    </BookmarkContext.Provider>
  )
}

export function useBookmarks() {
  const context = useContext(BookmarkContext)
  if (context === undefined) {
    throw new Error('useBookmarks must be used within a BookmarkProvider')
  }
  return context
}