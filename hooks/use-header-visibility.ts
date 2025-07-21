"use client"

import { useState, useEffect, useRef } from 'react'

export function useHeaderVisibility() {
  const [isVisible, setIsVisible] = useState(true)
  const lastScrollY = useRef(0)
  const ticking = useRef(false)

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY || window.pageYOffset || 0
      
      // Always show header when at the very top
      if (currentScrollY < 10) {
        setIsVisible(true)
      } 
      // Hide header when scrolling down (only after passing threshold)
      else if (currentScrollY > lastScrollY.current && currentScrollY > 100) {
        setIsVisible(false)
      }
      // Show header when scrolling up
      else if (currentScrollY < lastScrollY.current) {
        setIsVisible(true)
      }
      
      lastScrollY.current = currentScrollY
    }

    const throttledHandleScroll = () => {
      if (!ticking.current) {
        window.requestAnimationFrame(() => {
          handleScroll()
          ticking.current = false
        })
        ticking.current = true
      }
    }

    // Listen to window scroll
    window.addEventListener('scroll', throttledHandleScroll, { passive: true })
    
    // Force initial check
    handleScroll()

    return () => {
      window.removeEventListener('scroll', throttledHandleScroll)
    }
  }, [])

  return { isVisible }
}