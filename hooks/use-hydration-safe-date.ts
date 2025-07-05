import { useState, useEffect } from "react"
import { formatDistanceToNow } from "date-fns"

export function useHydrationSafeDate(date: string | Date | null | undefined) {
  const [formattedDate, setFormattedDate] = useState<string>("")
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted || !date) return

    const dateObj = typeof date === "string" ? new Date(date) : date
    
    // Check if date is valid
    if (isNaN(dateObj.getTime())) {
      console.warn("Invalid date provided to useHydrationSafeDate:", date)
      return
    }

    setFormattedDate(formatDistanceToNow(dateObj))

    // Update every minute to keep time fresh
    const interval = setInterval(() => {
      setFormattedDate(formatDistanceToNow(dateObj))
    }, 60000)

    return () => clearInterval(interval)
  }, [date, mounted])

  // Return empty string during SSR/hydration to prevent mismatch
  return mounted ? formattedDate : ""
}