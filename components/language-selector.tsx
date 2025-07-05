"use client"

import { Languages } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useLanguage } from "./language-provider"
import { analytics } from "@/lib/analytics"

const languages = [
  { code: "en" as const, name: "English", flag: "🇺🇸" },
  { code: "zh-CN" as const, name: "简体中文", flag: "🇨🇳" },
  { code: "zh-TW" as const, name: "繁體中文", flag: "🇹🇼" },
]

export default function LanguageSelector() {
  const { language, setLanguage, t } = useLanguage()

  const currentLanguage = languages.find((lang) => lang.code === language)

  const handleLanguageChange = (newLanguage: typeof language) => {
    analytics.trackLanguageChange(language, newLanguage)
    setLanguage(newLanguage)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="w-9 h-9 p-0" aria-label="Language">
          <Languages className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {languages.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => handleLanguageChange(lang.code)}
            className={`flex items-center gap-2 ${language === lang.code ? "bg-accent" : ""}`}
            suppressHydrationWarning
          >
            <span className="text-lg">{lang.flag}</span>
            <span>{lang.name}</span>
            {language === lang.code && <span className="ml-auto text-xs text-muted-foreground">✓</span>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
