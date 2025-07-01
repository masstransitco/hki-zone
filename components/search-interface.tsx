"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Search, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import ArticleCard from "./article-card"
import { useLanguage } from "./language-provider"
import type { Article } from "@/lib/types"
import { useDebounce } from "@/hooks/use-debounce"

async function searchArticles(query: string): Promise<Article[]> {
  if (!query.trim()) return []
  const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`)
  if (!response.ok) throw new Error("Failed to search articles")
  return response.json()
}

export default function SearchInterface() {
  const [query, setQuery] = useState("")
  const debouncedQuery = useDebounce(query, 300)
  const { t } = useLanguage()

  const { data: results = [], isLoading } = useQuery({
    queryKey: ["search", debouncedQuery],
    queryFn: () => searchArticles(debouncedQuery),
    enabled: debouncedQuery.length > 0,
  })

  const suggestions = [
    "AI technology",
    "Climate change",
    "Cryptocurrency",
    "Space exploration",
    "Healthcare innovation",
  ]

  return (
    <div className="p-6">
      <div className="relative mb-8">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-[rgb(var(--apple-gray-1))] w-5 h-5" />
          <Input
            type="text"
            placeholder={t("search.placeholder")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-12 pr-12 py-4 text-body bg-[rgb(var(--apple-gray-6))] dark:bg-[rgb(var(--apple-gray-5))] border-[rgb(var(--apple-gray-5))] dark:border-[rgb(var(--apple-gray-4))] rounded-xl apple-focus"
            autoFocus
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-4 top-1/2 transform -translate-y-1/2 text-[rgb(var(--apple-gray-1))] hover:text-foreground p-1 rounded-lg apple-focus"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {!query && (
        <div className="mb-8">
          <h3 className="text-subhead text-[rgb(var(--apple-gray-1))] mb-4">{t("search.suggestions")}</h3>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => setQuery(suggestion)}
                className="px-4 py-2 bg-[rgb(var(--apple-gray-6))] dark:bg-[rgb(var(--apple-gray-5))] text-[rgb(var(--apple-gray-1))] rounded-full text-footnote hover:bg-[rgb(var(--apple-gray-5))] dark:hover:bg-[rgb(var(--apple-gray-4))] hover:text-foreground transition-colors apple-focus"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}

      {isLoading && (
        <div className="text-center text-[rgb(var(--apple-gray-1))] text-body py-8">{t("search.searching")}</div>
      )}

      {results.length > 0 && (
        <div className="space-y-6">
          <h3 className="text-subhead text-[rgb(var(--apple-gray-1))]">
            {results.length} {t("search.results")} "{debouncedQuery}"
          </h3>
          <div className="space-y-4">
            {results.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>
        </div>
      )}

      {debouncedQuery && !isLoading && results.length === 0 && (
        <div className="text-center text-[rgb(var(--apple-gray-1))] text-body py-8">
          {t("search.noResults")} "{debouncedQuery}"
        </div>
      )}
    </div>
  )
}
