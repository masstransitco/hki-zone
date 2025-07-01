"use client"

import { useState, useEffect } from "react"
import { Search, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useDebounce } from "@/hooks/use-debounce"
import { useLanguage } from "./language-provider"
import { analytics } from "@/lib/analytics"

interface SearchInterfaceProps {
  onSearch: (query: string) => void
  onClear: () => void
  placeholder?: string
  initialValue?: string
}

export default function SearchInterface({ onSearch, onClear, placeholder, initialValue = "" }: SearchInterfaceProps) {
  const { t } = useLanguage()
  const [query, setQuery] = useState(initialValue)
  const [resultCount, setResultCount] = useState(0)
  const debouncedQuery = useDebounce(query, 300)

  useEffect(() => {
    if (debouncedQuery) {
      onSearch(debouncedQuery)
      // Track search after results are loaded
      setTimeout(() => {
        analytics.trackSearch(debouncedQuery, resultCount)
      }, 1000)
    } else {
      onClear()
    }
  }, [debouncedQuery, onSearch, onClear])

  const handleClear = () => {
    setQuery("")
    onClear()
  }

  return (
    <div className="relative w-full max-w-md">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          type="text"
          placeholder={placeholder || t("search.placeholder")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-10 pr-10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-slate-200/60 dark:border-slate-800/60 focus:border-slate-400 dark:focus:border-slate-600"
        />
        {query && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  )
}
