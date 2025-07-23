"use client"

import { useState, useEffect, useRef } from 'react'

export function useScrollDirection(scrollContainerRef: React.RefObject<HTMLElement>) {
  const [scrollDirection, setScrollDirection] = useState<'up' | 'down' | 'none'>('none')
  const [isNearTop, setIsNearTop] = useState(true)
  const lastScrollTop = useRef(0)
  const ticking = useRef(false)

  useEffect(() => {
    const updateScrollDirection = (scrollTop: number) => {
      // Check if near top
      const nearTop = scrollTop < 50
      setIsNearTop(nearTop)
      
      // Determine scroll direction
      if (scrollTop > lastScrollTop.current && scrollTop > 100) {
        console.log('[useScrollDirection] Direction: DOWN', { scrollTop, lastScrollTop: lastScrollTop.current })
        setScrollDirection('down')
      } else if (scrollTop < lastScrollTop.current) {
        console.log('[useScrollDirection] Direction: UP', { scrollTop, lastScrollTop: lastScrollTop.current })
        setScrollDirection('up')
      }
      
      lastScrollTop.current = scrollTop
    }

    const handleScroll = () => {
      const element = scrollContainerRef.current
      if (!element) return

      if (!ticking.current) {
        window.requestAnimationFrame(() => {
          updateScrollDirection(element.scrollTop)
          ticking.current = false
        })
        ticking.current = true
      }
    }

    // Check for scroll container every 100ms until found
    const checkInterval = setInterval(() => {
      const element = scrollContainerRef.current
      if (element) {
        clearInterval(checkInterval)
        
        console.log('[useScrollDirection] Found scroll container:', element.className)
        
        // Attach scroll listener
        element.addEventListener('scroll', handleScroll, { passive: true })
        
        // Initial check
        updateScrollDirection(element.scrollTop)
        
      }
    }, 100)

    // Cleanup
    return () => {
      clearInterval(checkInterval)
      const element = scrollContainerRef.current
      if (element) {
        element.removeEventListener('scroll', handleScroll)
      }
      ticking.current = false
    }
  }, []) // Remove dependency on scrollContainerRef to avoid re-running

  return { scrollDirection, isNearTop }
}