"use client"

import ThemeToggle from "./theme-toggle"
import LanguageSelector from "./language-selector"
import Logo from "./logo"
import LiveNewsIndicator from "./live-news-indicator"
import { useHeaderVisibility } from "@/hooks/use-header-visibility"

export default function Header() {
  const { isVisible } = useHeaderVisibility()

  return (
    <header 
      className={`fixed top-0 left-0 right-0 z-50 bg-background/90 backdrop-minimal border-b border-border transition-transform duration-300 ease-in-out ${
        isVisible ? 'translate-y-0' : '-translate-y-full'
      }`}
    >
      <div className="flex items-center justify-between px-4 py-3">
        <Logo />

        <div className="flex items-center gap-2">
          <LiveNewsIndicator />
          <LanguageSelector />
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
