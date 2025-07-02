"use client"

import { useInfiniteQuery } from "@tanstack/react-query"
import { useEffect } from "react"
import { useInView } from "react-intersection-observer"
import ArticleCard from "./article-card"
import LoadingSkeleton from "./loading-skeleton"
import { useLanguage } from "./language-provider"
import type { Article } from "@/lib/types"

async function fetchArticles({ pageParam = 0 }): Promise<{ articles: Article[]; nextPage: number | null }> {
  const response = await fetch(`/api/articles?page=${pageParam}`)
  if (!response.ok) throw new Error("Failed to fetch articles")
  return response.json()
}

export default function NewsFeed() {
  const { ref, inView } = useInView()
  const { t } = useLanguage()

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, error } = useInfiniteQuery({
    queryKey: ["articles"],
    queryFn: fetchArticles,
    getNextPageParam: (lastPage) => lastPage.nextPage,
    initialPageParam: 0,
  })

  useEffect(() => {
    if (inView && hasNextPage) {
      fetchNextPage()
    }
  }, [inView, hasNextPage, fetchNextPage])

  if (isLoading) return <LoadingSkeleton />
  if (error) return <div className="p-4 text-center text-destructive">{t("error.failedToLoad")} articles</div>

  const articles = data?.pages.flatMap((page) => page.articles) ?? []

  return (
    <div className="space-y-2 md:space-y-4 px-3 md:px-4">
      {/* Grid layout on larger screens, single column on mobile */}
      <div className="space-y-2 md:space-y-3 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0">
        {articles.map((article) => (
          <ArticleCard key={article.id} article={article} />
        ))}
      </div>

      <div ref={ref} className="h-10">
        {isFetchingNextPage && <LoadingSkeleton />}
      </div>
    </div>
  )
}
