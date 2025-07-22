"use client"

import { useState, useRef, useCallback, useEffect } from "react"

interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void>
  threshold?: number
  enabled?: boolean
}

export function usePullToRefresh({
  onRefresh,
  threshold = 80,
  enabled = true
}: UsePullToRefreshOptions) {
  const [pullDistance, setPullDistance] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  
  const scrollRef = useRef<HTMLDivElement>(null)
  const stateRef = useRef({
    touchStartY: 0,
    isPulling: false,
    startedAtTop: false
  })

  useEffect(() => {
    const element = scrollRef.current
    if (!element || !enabled) return

    const handleTouchStart = (e: TouchEvent) => {
      if (isRefreshing) return
      
      const touch = e.touches[0]
      if (!touch) return
      
      const scrollTop = element.scrollTop
      
      // Reset state
      stateRef.current.isPulling = false
      stateRef.current.startedAtTop = false
      
      // Simple check - if at top, allow pull-to-refresh
      if (scrollTop === 0) {
        stateRef.current.touchStartY = touch.clientY
        stateRef.current.startedAtTop = true
        console.log('✅ At top - pull-to-refresh enabled', {
          element: element.className,
          scrollHeight: element.scrollHeight,
          clientHeight: element.clientHeight
        })
      } else {
        setPullDistance(0)
        console.log('❌ Not at top - pull-to-refresh disabled', {
          scrollTop,
          element: element.className
        })
      }
    }

    const handleTouchMove = (e: TouchEvent) => {
      // Must have started at top
      if (isRefreshing || !stateRef.current.startedAtTop) {
        return
      }
      
      const touch = e.touches[0]
      if (!touch) return
      
      const scrollTop = element.scrollTop
      const deltaY = touch.clientY - stateRef.current.touchStartY
      
      // Only process pull if we're still at the top
      if (scrollTop === 0) {
        // User is pulling down (positive deltaY)
        if (deltaY > 5) { // Require 5px minimum movement to start
          stateRef.current.isPulling = true
          
          // Prevent browser pull-to-refresh
          if (e.cancelable) {
            e.preventDefault()
          }
          
          // Apply resistance for natural feel
          const resistance = 0.5
          const distance = Math.min(deltaY * resistance, threshold * 2)
          setPullDistance(distance)
          
          if (distance > 0) {
            console.log('📏 Pulling down at top, distance:', Math.round(distance), 'px')
          }
        } else if (deltaY < 0 && pullDistance > 0) {
          // User is moving finger up while pulling - reduce pull distance
          const resistance = 0.5
          const distance = Math.max(0, (deltaY * resistance) + pullDistance)
          setPullDistance(distance)
        }
      } else {
        // Not at top - immediately cancel any pull
        if (stateRef.current.isPulling || pullDistance > 0) {
          console.log('❌ Not at top - cancelling pull, scrollTop:', scrollTop)
        }
        stateRef.current.isPulling = false
        stateRef.current.startedAtTop = false
        setPullDistance(0)
      }
    }

    const handleTouchEnd = async () => {
      if (!stateRef.current.isPulling || isRefreshing) {
        setPullDistance(0)
        return
      }
      
      const scrollTop = element.scrollTop
      
      stateRef.current.isPulling = false
      stateRef.current.startedAtTop = false
      
      // Simple check - if at top and pulled far enough, refresh
      if (scrollTop === 0 && pullDistance >= threshold) {
        console.log('🔄 Pull-to-refresh triggered!')
        setIsRefreshing(true)
        setPullDistance(threshold)
        
        try {
          await onRefresh()
        } finally {
          console.log('✅ Pull-to-refresh completed')
          setIsRefreshing(false)
          setPullDistance(0)
        }
      } else {
        setPullDistance(0)
      }
    }

    // Handle scroll events - only to cancel pull if user scrolls away
    const handleScroll = () => {
      const scrollTop = element.scrollTop
      
      // If scrolled away from top while pulling, cancel
      if (scrollTop > 0 && (stateRef.current.isPulling || pullDistance > 0)) {
        stateRef.current.isPulling = false
        stateRef.current.startedAtTop = false
        setPullDistance(0)
      }
    }

    // Add listeners
    element.addEventListener('touchstart', handleTouchStart, { passive: true })
    element.addEventListener('touchmove', handleTouchMove, { passive: false })
    element.addEventListener('touchend', handleTouchEnd, { passive: true })
    element.addEventListener('scroll', handleScroll, { passive: true })
    
    return () => {
      element.removeEventListener('touchstart', handleTouchStart)
      element.removeEventListener('touchmove', handleTouchMove)
      element.removeEventListener('touchend', handleTouchEnd)
      element.removeEventListener('scroll', handleScroll)
    }
  }, [enabled, isRefreshing, onRefresh, threshold, pullDistance])


  // Return empty handlers since we're using native listeners
  const handleTouchStart = useCallback(() => {}, [])
  const handleTouchMove = useCallback(() => {}, [])
  const handleTouchEnd = useCallback(() => {}, [])

  return {
    scrollRef,
    pullDistance,
    isRefreshing,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd
  }
}