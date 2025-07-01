"use client"

import { useQuery } from "@tanstack/react-query"
import { TrendingUp, Sparkles, Clock } from "lucide-react"
import ArticleCard from "./article-card"
import LoadingSkeleton from "./loading-skeleton"
import { useLanguage } from "./language-provider"
import type { Article } from "@/lib/types"

interface DiscoveryData {
  trending: Article[]
  recommended: Article[]
  recent: Article[]
}

async function fetchDiscoveryData(): Promise<DiscoveryData> {
  const response = await fetch("/api/discovery")
  if (!response.ok) throw new Error("Failed to fetch discovery data")
  return response.json()
}

export default function TopicsDiscovery() {
  const { t } = useLanguage()
  const { data, isLoading, error } = useQuery({
    queryKey: ["discovery"],
    queryFn: fetchDiscoveryData,
  })

  if (isLoading) return <LoadingSkeleton />
  if (error) return <div className="p-4 text-center text-red-500">{t("error.failedToLoad")} discovery content</div>

  return (
    <div className="p-4 space-y-8">
      <section>
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-[rgb(0,122,255)] dark:text-[rgb(10,132,255)]" />
          <h2 className="text-title-3 text-[rgb(28,28,30)] dark:text-white">{t("discovery.trending")}</h2>
        </div>
        <div className="space-y-4">
          {data?.trending.map((article) => (
            <ArticleCard key={article.id} article={article} />
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-5 h-5 text-[rgb(0,122,255)] dark:text-[rgb(10,132,255)]" />
          <h2 className="text-title-3 text-[rgb(28,28,30)] dark:text-white">{t("discovery.recommended")}</h2>
        </div>
        <div className="space-y-4">
          {data?.recommended.map((article) => (
            <ArticleCard key={article.id} article={article} />
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-5 h-5 text-[rgb(0,122,255)] dark:text-[rgb(10,132,255)]" />
          <h2 className="text-title-3 text-[rgb(28,28,30)] dark:text-white">{t("discovery.recent")}</h2>
        </div>
        <div className="space-y-4">
          {data?.recent.map((article) => (
            <ArticleCard key={article.id} article={article} />
          ))}
        </div>
      </section>
    </div>
  )
}
