"use client"

import { useEffect, useRef } from 'react'

interface SwipeGestureOptions {
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
  threshold?: number
  enabled?: boolean
}

export function useSwipeGesture(
  elementRef: React.RefObject<HTMLElement>,
  { onSwipeLeft, onSwipeRight, threshold = 50, enabled = true }: SwipeGestureOptions
) {
  const touchStartX = useRef(0)
  const touchStartY = useRef(0)
  const touchStartTime = useRef(0)

  useEffect(() => {
    if (!enabled) return

    const element = elementRef.current
    if (!element) return

    const handleTouchStart = (e: TouchEvent) => {
      touchStartX.current = e.touches[0].clientX
      touchStartY.current = e.touches[0].clientY
      touchStartTime.current = Date.now()
    }

    const handleTouchEnd = (e: TouchEvent) => {
      const touchEndX = e.changedTouches[0].clientX
      const touchEndY = e.changedTouches[0].clientY
      const touchEndTime = Date.now()

      const deltaX = touchEndX - touchStartX.current
      const deltaY = touchEndY - touchStartY.current
      const deltaTime = touchEndTime - touchStartTime.current

      // Calculate velocity (pixels per millisecond)
      const velocityX = Math.abs(deltaX) / deltaTime

      // Check if this is a horizontal swipe (not vertical scroll)
      if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > threshold) {
        // Require minimum velocity for swipe recognition
        if (velocityX > 0.3) {
          if (deltaX > 0 && onSwipeRight) {
            onSwipeRight()
          } else if (deltaX < 0 && onSwipeLeft) {
            onSwipeLeft()
          }
        }
      }
    }

    element.addEventListener('touchstart', handleTouchStart, { passive: true })
    element.addEventListener('touchend', handleTouchEnd, { passive: true })

    return () => {
      element.removeEventListener('touchstart', handleTouchStart)
      element.removeEventListener('touchend', handleTouchEnd)
    }
  }, [elementRef, onSwipeLeft, onSwipeRight, threshold, enabled])
}

// Hook for edge swipe detection
export function useEdgeSwipe(
  { onSwipeFromLeft, onSwipeFromRight, edgeWidth = 20, enabled = true }: {
    onSwipeFromLeft?: () => void
    onSwipeFromRight?: () => void
    edgeWidth?: number
    enabled?: boolean
  }
) {
  const touchStartX = useRef(0)

  useEffect(() => {
    if (!enabled) return

    const handleTouchStart = (e: TouchEvent) => {
      touchStartX.current = e.touches[0].clientX
    }

    const handleTouchMove = (e: TouchEvent) => {
      const currentX = e.touches[0].clientX
      const deltaX = currentX - touchStartX.current

      // Check if swipe started from left edge
      if (touchStartX.current < edgeWidth && deltaX > 50 && onSwipeFromLeft) {
        onSwipeFromLeft()
      }
      
      // Check if swipe started from right edge
      const screenWidth = window.innerWidth
      if (touchStartX.current > screenWidth - edgeWidth && deltaX < -50 && onSwipeFromRight) {
        onSwipeFromRight()
      }
    }

    document.addEventListener('touchstart', handleTouchStart, { passive: true })
    document.addEventListener('touchmove', handleTouchMove, { passive: true })

    return () => {
      document.removeEventListener('touchstart', handleTouchStart)
      document.removeEventListener('touchmove', handleTouchMove)
    }
  }, [onSwipeFromLeft, onSwipeFromRight, edgeWidth, enabled])
}