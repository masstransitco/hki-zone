"use client"

import Image from "next/image"
import Link from "next/link"
import { useTheme } from "next-themes"

export default function Logo() {
  const { theme } = useTheme()

  // Determine which logo to use based on theme
  const logoSrc = theme === "dark" ? "/hki-logo-white.png" : "/hki-logo-black.png"

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
