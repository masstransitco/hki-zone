"use client"

import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ExternalLink, Clock, Newspaper } from "lucide-react"
import { useLanguage } from "./language-provider"
import { analytics } from "@/lib/analytics"
import { useHydrationSafeDate } from "@/hooks/use-hydration-safe-date"
import LoadingSkeleton from "./loading-skeleton"
import type { Headline } from "@/lib/supabase"

interface HeadlinesFeedResponse {
  headlines: Record<string, Headline[]> | Headline[]
  usingMockData: boolean
  debug?: string
}

async function fetchHeadlines(category?: string): Promise<HeadlinesFeedResponse> {
  const url = category ? `/api/headlines?category=${category}` : "/api/headlines"
  const response = await fetch(url)
  if (!response.ok) throw new Error("Failed to fetch headlines")
  return response.json()
}

interface HeadlineCardProps {
  headline: Headline
}

function HeadlineCard({ headline }: HeadlineCardProps) {
  const { t } = useLanguage()
  const timeAgo = useHydrationSafeDate(headline.published_at)

  const handleHeadlineClick = () => {
    analytics.trackArticleView(headline.id || "", headline.source, headline.category)
    // Open link in new tab
    window.open(headline.url, "_blank", "noopener,noreferrer")
  }

  return (
    <Card 
      className="group hover:shadow-md hover:shadow-stone-200/30 dark:hover:shadow-neutral-900/40 transition-all duration-200 border-stone-200/60 dark:border-neutral-700/60 bg-stone-50/95 dark:bg-neutral-900/95 backdrop-blur-sm cursor-pointer"
      onClick={handleHeadlineClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium text-stone-900 dark:text-stone-100 line-clamp-2 group-hover:text-stone-700 dark:group-hover:text-stone-300 transition-colors">
              {headline.title}
            </h3>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="secondary" className="text-xs">
                {headline.source}
              </Badge>
              <div className="flex items-center gap-1 text-xs text-stone-500 dark:text-stone-400">
                <Clock className="w-3 h-3" />
                <span>{timeAgo}</span>
              </div>
            </div>
          </div>
          <ExternalLink className="w-4 h-4 text-stone-400 dark:text-stone-500 group-hover:text-stone-600 dark:group-hover:text-stone-300 transition-colors shrink-0" />
        </div>
      </CardContent>
    </Card>
  )
}

interface CategorySectionProps {
  category: string
  headlines: Headline[]
  isExpanded: boolean
  onToggle: () => void
}

function CategorySection({ category, headlines, isExpanded, onToggle }: CategorySectionProps) {
  const { t } = useLanguage()

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-stone-900 dark:text-stone-100 flex items-center gap-2">
          <Newspaper className="w-5 h-5" />
          {category}
          <Badge variant="outline" className="ml-2 text-xs">
            {headlines.length}
          </Badge>
        </h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggle}
          className="text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100"
        >
          {isExpanded ? t("headlines.showLess") || "Show Less" : t("headlines.showMore") || "Show More"}
        </Button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {headlines.slice(0, isExpanded ? headlines.length : 3).map((headline) => (
          <HeadlineCard key={headline.id || headline.url} headline={headline} />
        ))}
      </div>
    </div>
  )
}

export default function HeadlinesFeed() {
  const { t } = useLanguage()
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({})

  const { data, isLoading, error } = useQuery({
    queryKey: ["headlines"],
    queryFn: () => fetchHeadlines(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 10 * 60 * 1000, // Refetch every 10 minutes
  })

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }))
  }

  if (isLoading) return <LoadingSkeleton />
  if (error) return (
    <div className="p-4 text-center text-destructive" suppressHydrationWarning>
      {t("error.failedToLoad")} headlines
    </div>
  )

  const headlines = data?.headlines || {}
  const isGroupedByCategory = !Array.isArray(headlines)

  if (!isGroupedByCategory) {
    return (
      <div className="px-6 pb-4">
        <div className="text-center text-stone-600 dark:text-stone-400 py-8">
          {t("headlines.noHeadlines") || "No headlines available"}
        </div>
      </div>
    )
  }

  const categories = Object.keys(headlines)

  if (categories.length === 0) {
    return (
      <div className="px-6 pb-4">
        <div className="text-center text-stone-600 dark:text-stone-400 py-8">
          {t("headlines.noHeadlines") || "No headlines available"}
        </div>
      </div>
    )
  }

  return (
    <div className="px-6 pb-4">
      <div className="space-y-8">
        {categories.map((category) => (
          <CategorySection
            key={category}
            category={category}
            headlines={headlines[category] || []}
            isExpanded={expandedCategories[category] || false}
            onToggle={() => toggleCategory(category)}
          />
        ))}
      </div>
      
      {data?.usingMockData && (
        <div className="mt-8 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
          <p className="text-sm text-amber-800 dark:text-amber-200">
            {t("headlines.usingMockData") || "Using sample data. Headlines will be populated when the system is fully configured."}
          </p>
        </div>
      )}
    </div>
  )
}