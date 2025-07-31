"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { analytics } from "@/lib/analytics"

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return
    // Track page views
    analytics.pageView(pathname)
  }, [pathname, mounted])

  useEffect(() => {
    if (!mounted) return
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
  }, [mounted])

  return <>{children}</>
}
