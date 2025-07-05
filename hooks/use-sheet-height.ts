"use client"

import { useEffect, useState } from "react"

function getChromeHeight() {
  // layout viewport (innerHeight) – visual viewport = UI bars
  return Math.max(0, window.innerHeight - (window.visualViewport?.height ?? window.innerHeight))
}

export function useSheetHeight() {
  const [height, setHeight] = useState<string>("100dvh") // sane fallback

  useEffect(() => {
    const update = () => {
      const vv = window.visualViewport?.height ?? window.innerHeight
      const bars = getChromeHeight() // URL + status bar + notch
      const gap = bars + 8 // keep the grab-handle visible
      setHeight(`${vv - gap}px`)
    }

    update()
    window.visualViewport?.addEventListener("resize", update)
    window.visualViewport?.addEventListener("scroll", update)
    
    return () => {
      window.visualViewport?.removeEventListener("resize", update)
      window.visualViewport?.removeEventListener("scroll", update)
    }
  }, [])

  return height
}