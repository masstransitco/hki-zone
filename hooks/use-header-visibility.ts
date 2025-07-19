"use client"

import { useState, useEffect } from 'react'

export function useHeaderVisibility() {
  const [isVisible, setIsVisible] = useState(true)
  const [lastScrollY, setLastScrollY] = useState(0)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return

    const handleScroll = () => {
      const currentScrollY = window.scrollY
      
      // Show header only when very close to the top
      if (currentScrollY < 10) {
        setIsVisible(true)
      } 
      // Hide header when scrolling down (only after scrolling past 100px)
      else if (currentScrollY > lastScrollY && currentScrollY > 100) {
        setIsVisible(false)
      }
      // Keep header hidden when scrolling up but not at top
      else if (currentScrollY >= 10) {
        setIsVisible(false)
      }
      
      setLastScrollY(currentScrollY)
    }

    // Add throttling to improve performance
    let ticking = false
    const throttledHandleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          handleScroll()
          ticking = false
        })
        ticking = true
      }
    }

    window.addEventListener('scroll', throttledHandleScroll, { passive: true })
    return () => window.removeEventListener('scroll', throttledHandleScroll)
  }, [lastScrollY, mounted])

  return { isVisible, mounted }
}