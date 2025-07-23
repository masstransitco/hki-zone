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

  const setScrollPosition = useCallback((scrollTop: number) => {
    const isNearTop = scrollTop < 50
    const isScrollingDown = scrollTop > lastScrollTopRef.current && scrollTop > 100
    const isScrollingUp = scrollTop < lastScrollTopRef.current

    if (isNearTop) {
      setIsHeaderVisible(true)
    } else if (isScrollingDown) {
      setIsHeaderVisible(false)
    } else if (isScrollingUp) {
      setIsHeaderVisible(true)
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