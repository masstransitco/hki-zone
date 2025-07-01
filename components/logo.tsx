"use client"

import Image from "next/image"
import Link from "next/link"
import { useTheme } from "next-themes"
import { useLanguage } from "./language-provider"

export default function Logo() {
  const { theme } = useTheme()
  const { language } = useLanguage()

  // Determine which logo to use based on theme
  const logoSrc = theme === "dark" ? "/panora-logo-white.png" : "/panora-logo-black.png"

  // Determine wordmark text and styling based on language
  const isChineseLanguage = language === "zh-CN" || language === "zh-TW"
  const wordmark = isChineseLanguage ? "秒知" : "Panora"

  return (
    <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
      <div className="relative w-8 h-8 flex-shrink-0">
        <Image
          src={logoSrc || "/placeholder.svg"}
          alt="Panora Logo"
          width={32}
          height={32}
          className="w-full h-full object-contain"
          priority
        />
      </div>
      <span
        className={`text-xl text-foreground ${
          isChineseLanguage ? "font-chinese logo-wordmark-chinese" : "logo-wordmark"
        }`}
      >
        {wordmark}
      </span>
    </Link>
  )
}
