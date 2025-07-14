"use client"

import Image from "next/image"
import Link from "next/link"
import { useTheme } from "next-themes"
import { useState, useEffect } from "react"

export default function Logo() {
  const { theme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Use SVG logos for better quality and smaller file size
  const logoSrc = mounted && theme === "dark" ? "/hki-logo-white.svg" : "/hki-logo-black.svg"

  return (
    <Link href="/" className="flex items-center hover:opacity-80 transition-opacity">
      <div className="relative w-8 h-8 flex-shrink-0">
        <Image
          src={logoSrc || "/placeholder.svg"}
          alt="HKI Logo"
          width={32}
          height={32}
          className="w-full h-full object-contain"
          priority
        />
      </div>
    </Link>
  )
}
