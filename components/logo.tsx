"use client"

import Link from "next/link"
import { useTheme } from "next-themes"
import { useState, useEffect } from "react"

export default function Logo() {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Colors for light and dark mode
  const isDark = mounted && resolvedTheme === "dark"
  const verticalStroke = isDark ? "#ffffff" : "#1e3a8a"
  const curveStroke = isDark ? "rgba(255,255,255,0.85)" : "#3b82f6"

  return (
    <Link
      href="/"
      className="flex items-center hover:opacity-80 transition-opacity"
      scroll={true}
    >
      <div className="relative w-8 h-8 flex-shrink-0">
        <svg
          width="32"
          height="32"
          viewBox="0 0 100 100"
          className="w-full h-full"
        >
          {/* Left vertical line */}
          <path
            d="M28 22 L28 78"
            stroke={verticalStroke}
            strokeWidth="12"
            fill="none"
            strokeLinecap="round"
          />
          {/* Curved connecting line */}
          <path
            d="M28 52 Q50 68 72 52"
            stroke={curveStroke}
            strokeWidth="12"
            fill="none"
            strokeLinecap="round"
          />
          {/* Right vertical line */}
          <path
            d="M72 22 L72 78"
            stroke={verticalStroke}
            strokeWidth="12"
            fill="none"
            strokeLinecap="round"
          />
        </svg>
      </div>
    </Link>
  )
}
