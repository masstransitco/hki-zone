"use client"

import Link from "next/link"
import { Search } from "lucide-react"
import { useState, useEffect } from "react"
import ThemeToggle from "./theme-toggle"
import LanguageSelector from "./language-selector"
import Logo from "./logo"
import { useLanguage } from "./language-provider"

interface HeaderProps {
  showSearch?: boolean
}

export default function Header({ showSearch = true }: HeaderProps) {
  const { t } = useLanguage()
  const [isVisible, setIsVisible] = useState(true)
  const [lastScrollY, setLastScrollY] = useState(0)

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY
      
      // Show header when scrolling up or at the top
      if (currentScrollY < lastScrollY || currentScrollY < 10) {
        setIsVisible(true)
      } 
      // Hide header when scrolling down (only after scrolling past 100px)
      else if (currentScrollY > lastScrollY && currentScrollY > 100) {
        setIsVisible(false)
      }
      
      setLastScrollY(currentScrollY)
    }

    // Add throttling to improve performance
    let ticking = false
    const throttledHandleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          handleScroll()
          ticking = false
        })
        ticking = true
      }
    }

    window.addEventListener('scroll', throttledHandleScroll, { passive: true })
    return () => window.removeEventListener('scroll', throttledHandleScroll)
  }, [lastScrollY])

  return (
    <header 
      className={`fixed top-0 left-0 right-0 z-50 bg-background/90 backdrop-minimal border-b border-border transition-transform duration-300 ease-in-out ${
        isVisible ? 'translate-y-0' : '-translate-y-full'
      }`}
    >
      <div className="flex items-center justify-between px-4 py-3">
        <Logo />

        <div className="flex items-center gap-1">
          {showSearch && (
            <Link
              href="/search"
              className="p-2 hover:bg-surface-hover rounded-lg transition-colors focus-ring"
              aria-label={t("nav.search")}
            >
              <Search className="w-5 h-5 text-muted" />
            </Link>
          )}
          <LanguageSelector />
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
