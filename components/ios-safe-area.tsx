'use client'

import { useEffect, useState } from 'react'

export function IOSSafeArea() {
  const [safeAreaTop, setSafeAreaTop] = useState(0)

  useEffect(() => {
    // Detect iOS device
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)

    if (isIOS) {
      // Get safe area inset from CSS env variable
      const computedStyle = getComputedStyle(document.documentElement)
      const safeAreaInsetTop = computedStyle.getPropertyValue('--sat') ||
                               getComputedStyle(document.body).getPropertyValue('env(safe-area-inset-top)') ||
                               '0px'

      // Parse the value
      const topValue = parseInt(safeAreaInsetTop) || 0
      setSafeAreaTop(topValue || 44) // Default to 44px if not detected (standard iOS status bar)
    }
  }, [])

  if (safeAreaTop === 0) return null

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[9999] pointer-events-none bg-transparent"
      style={{
        height: `${safeAreaTop}px`,
        backgroundColor: 'transparent'
      }}
    />
  )
}
