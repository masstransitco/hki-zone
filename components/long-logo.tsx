"use client"

import Link from "next/link"
import { useTheme } from "next-themes"
import { useState, useEffect } from "react"

interface LongLogoProps {
  className?: string
  style?: React.CSSProperties
  asLink?: boolean
}

export default function LongLogo({ className, style, asLink = false }: LongLogoProps) {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Colors for light and dark mode
  const isDark = mounted && resolvedTheme === "dark"
  const verticalStroke = isDark ? "#ffffff" : "#1e3a8a"
  const curveStroke = isDark ? "rgba(255,255,255,0.85)" : "#3b82f6"
  const textColor = isDark ? "#ffffff" : "#1e3a8a"

  const logoContent = (
    <div className={`flex items-center gap-2 ${className || ''}`} style={style}>
      {/* Logomark */}
      <svg
        width="28"
        height="28"
        viewBox="0 0 100 100"
        className="flex-shrink-0"
      >
        <path
          d="M28 22 L28 78"
          stroke={verticalStroke}
          strokeWidth="12"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M28 52 Q50 68 72 52"
          stroke={curveStroke}
          strokeWidth="12"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M72 22 L72 78"
          stroke={verticalStroke}
          strokeWidth="12"
          fill="none"
          strokeLinecap="round"
        />
      </svg>
      {/* Text */}
      <span
        className="text-xl font-bold tracking-tight"
        style={{ color: textColor }}
      >
        HKI
      </span>
    </div>
  )

  if (asLink) {
    return (
      <Link
        href="/"
        className="flex items-center hover:opacity-80 transition-opacity"
        scroll={true}
      >
        {logoContent}
      </Link>
    )
  }

  return logoContent
}