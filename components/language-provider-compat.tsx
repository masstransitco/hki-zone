"use client"

import type React from "react"
import { createContext, useContext } from "react"
import { useLanguage as useLanguageRedux } from "@/hooks/use-language-redux"
import type { Language } from "@/store/languageSlice"

interface LanguageContextType {
  language: Language
  setLanguage: (language: Language) => void
  t: (key: string) => string
  onLanguageChange?: (oldLang: Language, newLang: Language) => void
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

// Compatibility wrapper that provides the old context API using Redux under the hood
export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const { language, setLanguage, t } = useLanguageRedux()

  // For now, we don't support onLanguageChange in the Redux version
  // Components that need this will need to be updated
  const contextValue: LanguageContextType = {
    language,
    setLanguage,
    t,
    onLanguageChange: undefined,
  }

  return (
    <LanguageContext.Provider value={contextValue}>
      {children}
    </LanguageContext.Provider>
  )
}

// This allows existing components to keep using the same import
export function useLanguage() {
  const context = useContext(LanguageContext)
  if (context === undefined) {
    // Fall back to direct Redux usage if not in provider
    return useLanguageRedux()
  }
  return context
}