"use client"

import DarkModeIcon from '@mui/icons-material/DarkMode'
import LightModeIcon from '@mui/icons-material/LightMode'
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { analytics } from "@/lib/analytics"
import { useState, useEffect } from "react"

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light"
    analytics.trackThemeChange(newTheme)
    setTheme(newTheme)
  }

  // Prevent hydration mismatch by showing a placeholder during SSR
  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="w-9 h-9 p-0 text-text-muted hover:text-text-primary hover:bg-surface-hover focus-ring"
        aria-label="Toggle theme"
      >
        <div className="h-4 w-4" />
      </Button>
    )
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggleTheme}
      className="w-9 h-9 p-0 text-text-muted hover:text-text-primary hover:bg-surface-hover focus-ring"
    >
      <LightModeIcon className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <DarkModeIcon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  )
}
