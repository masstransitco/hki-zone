"use client"

import React, { createContext, useContext, useState, useCallback } from 'react'

interface HeaderVisibilityContextType {
  isHeaderVisible: boolean
  setScrollPosition: (scrollTop: number) => void
}

const HeaderVisibilityContext = createContext<HeaderVisibilityContextType | undefined>(undefined)

export function HeaderVisibilityProvider({ children }: { children: React.ReactNode }) {
  const [isHeaderVisible, setIsHeaderVisible] = useState(true)
  const lastScrollTopRef = React.useRef(0)
  const lastUpdateTimeRef = React.useRef(0)

  const setScrollPosition = useCallback((scrollTop: number) => {
    // Debounce rapid updates
    const now = Date.now()
    if (now - lastUpdateTimeRef.current < 16) return // Skip if less than 16ms (60fps)
    lastUpdateTimeRef.current = now

    // Ensure scrollTop is valid
    if (typeof scrollTop !== 'number' || isNaN(scrollTop)) return

    const isNearTop = scrollTop < 50
    const scrollDelta = scrollTop - lastScrollTopRef.current
    const isSignificantScroll = Math.abs(scrollDelta) > 5 // Ignore tiny movements
    const isScrollingDown = scrollDelta > 0 && scrollTop > 100
    const isScrollingUp = scrollDelta < 0

    if (isNearTop) {
      setIsHeaderVisible(true)
    } else if (isSignificantScroll) {
      if (isScrollingDown) {
        setIsHeaderVisible(false)
      } else if (isScrollingUp) {
        setIsHeaderVisible(true)
      }
    }

    lastScrollTopRef.current = scrollTop
  }, [])

  return (
    <HeaderVisibilityContext.Provider value={{ isHeaderVisible, setScrollPosition }}>
      {children}
    </HeaderVisibilityContext.Provider>
  )
}

export function useHeaderVisibility() {
  const context = useContext(HeaderVisibilityContext)
  if (context === undefined) {
    throw new Error('useHeaderVisibility must be used within a HeaderVisibilityProvider')
  }
  return context
}