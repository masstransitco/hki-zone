"use client"

import Link from "next/link"
import { Search } from "lucide-react"
import ThemeToggle from "./theme-toggle"
import LanguageSelector from "./language-selector"
import Logo from "./logo"
import { useLanguage } from "./language-provider"

interface HeaderProps {
  showSearch?: boolean
}

export default function Header({ showSearch = true }: HeaderProps) {
  const { t } = useLanguage()

  return (
    <header className="sticky top-0 z-50 bg-background/90 backdrop-minimal border-b border-border">
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
