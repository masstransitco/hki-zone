"use client"

import { useEffect, useState } from "react"

export function useVisualViewport() {
  const [viewportHeight, setViewportHeight] = useState<number | null>(null)
  
  useEffect(() => {
    function updateViewportHeight() {
      if (typeof window !== "undefined" && window.visualViewport) {
        setViewportHeight(window.visualViewport.height)
      } else if (typeof window !== "undefined") {
        // Fallback for browsers without Visual Viewport API
        setViewportHeight(window.innerHeight)
      }
    }

    // Initial measurement
    updateViewportHeight()

    // Add event listeners
    if (typeof window !== "undefined" && window.visualViewport) {
      window.visualViewport.addEventListener("resize", updateViewportHeight)
      window.visualViewport.addEventListener("scroll", updateViewportHeight)
    }
    
    window.addEventListener("resize", updateViewportHeight)
    window.addEventListener("orientationchange", updateViewportHeight)

    return () => {
      if (typeof window !== "undefined" && window.visualViewport) {
        window.visualViewport.removeEventListener("resize", updateViewportHeight)
        window.visualViewport.removeEventListener("scroll", updateViewportHeight)
      }
      window.removeEventListener("resize", updateViewportHeight)
      window.removeEventListener("orientationchange", updateViewportHeight)
    }
  }, [])

  return viewportHeight
}