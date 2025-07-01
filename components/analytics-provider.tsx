"use client"

import type React from "react"

import { useEffect } from "react"
import { usePathname } from "next/navigation"
import { analytics } from "@/lib/analytics"

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  useEffect(() => {
    // Track page views
    analytics.pageView(pathname)
  }, [pathname])

  useEffect(() => {
    // Track session duration
    const startTime = Date.now()

    const handleBeforeUnload = () => {
      const duration = Date.now() - startTime
      analytics.sessionDuration(duration)
    }

    window.addEventListener("beforeunload", handleBeforeUnload)

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload)
      const duration = Date.now() - startTime
      analytics.sessionDuration(duration)
    }
  }, [])

  return <>{children}</>
}
