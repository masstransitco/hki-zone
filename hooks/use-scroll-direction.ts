"use client"

import { useState, useEffect, useRef } from 'react'

export function useScrollDirection(scrollContainerRef: React.RefObject<HTMLElement>) {
  const [scrollDirection, setScrollDirection] = useState<'up' | 'down' | 'none'>('none')
  const [isNearTop, setIsNearTop] = useState(true)
  const lastScrollTop = useRef(0)
  const ticking = useRef(false)

  useEffect(() => {
    const scrollContainer = scrollContainerRef.current
    if (!scrollContainer) return

    const updateScrollDirection = () => {
      const scrollTop = scrollContainer.scrollTop
      
      // Check if near top
      setIsNearTop(scrollTop < 50)
      
      // Determine scroll direction
      if (scrollTop > lastScrollTop.current && scrollTop > 100) {
        setScrollDirection('down')
      } else if (scrollTop < lastScrollTop.current) {
        setScrollDirection('up')
      }
      
      lastScrollTop.current = scrollTop
    }

    const handleScroll = () => {
      if (!ticking.current) {
        window.requestAnimationFrame(() => {
          updateScrollDirection()
          ticking.current = false
        })
        ticking.current = true
      }
    }

    scrollContainer.addEventListener('scroll', handleScroll, { passive: true })
    
    // Initial check
    updateScrollDirection()

    return () => {
      scrollContainer.removeEventListener('scroll', handleScroll)
    }
  }, [scrollContainerRef])

  return { scrollDirection, isNearTop }
}