"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { useLanguage } from "./language-provider"
import { analytics } from "@/lib/analytics"

const languages = [
  { code: "en" as const, name: "EN", fullName: "English" },
  { code: "zh-CN" as const, name: "简", fullName: "简体中文" },
  { code: "zh-TW" as const, name: "繁", fullName: "繁體中文" },
]

export default function LanguageSelector() {
  const { language, setLanguage } = useLanguage()
  const [isOpen, setIsOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const currentLanguage = languages.find((lang) => lang.code === language)

  const handleLanguageChange = (newLanguage: typeof language) => {
    analytics.trackLanguageChange(language, newLanguage)
    setLanguage(newLanguage)
    setIsOpen(false)
  }

  if (!mounted) {
    return (
      <div className="w-8 h-8 rounded-md bg-stone-100 dark:bg-stone-800 animate-pulse" />
    )
  }

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="h-8 px-2 text-xs font-medium text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
        aria-label={`Language: ${currentLanguage?.fullName}`}
      >
        {currentLanguage?.name}
      </Button>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute right-0 top-10 z-50 min-w-[120px] overflow-hidden rounded-md border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 shadow-lg animate-in slide-in-from-top-2 duration-200">
            {languages.map((lang) => (
              <button
                key={lang.code}
                onClick={() => handleLanguageChange(lang.code)}
                className={`w-full px-3 py-2 text-left text-sm transition-colors hover:bg-stone-50 dark:hover:bg-stone-800 ${
                  language === lang.code 
                    ? "bg-stone-100 dark:bg-stone-800 text-stone-900 dark:text-stone-100" 
                    : "text-stone-600 dark:text-stone-400"
                }`}
              >
                {lang.fullName}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
