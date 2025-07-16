"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function AePage() {
  const router = useRouter()

  useEffect(() => {
    // Redirect to signals page with A&E category filter
    router.replace("/signals?category=ae")
  }, [router])

  return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-muted-foreground">Redirecting to A&E signals...</p>
    </div>
  )
}