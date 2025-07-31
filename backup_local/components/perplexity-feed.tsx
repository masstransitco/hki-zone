"use client"

import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { useInView } from "react-intersection-observer"
import { RefreshCw } from "lucide-react"
import ArticleCard from "./article-card"
import ArticleBottomSheet from "./article-bottom-sheet"
import LoadingSkeleton from "./loading-skeleton"
import { useLanguage } from "./language-provider"
import { transformPerplexityToArticle } from "@/lib/perplexity-utils"
import type { Article, PerplexityArticle } from "@/lib/types"

interface PerplexityFeedResponse {
  articles: PerplexityArticle[]
  nextPage: number | null
  usingMockData: boolean
  debug?: string
}

async function fetchPerplexityArticles({ pageParam = 0 }): Promise<PerplexityFeedResponse> {
  const response = await fetch(`/api/perplexity?page=${pageParam}`)
  if (!response.ok) throw new Error("Failed to fetch Perplexity articles")
  return response.json()
}

export default function PerplexityFeed() {
  const { ref, inView } = useInView()
  const { t } = useLanguage()
  const queryClient = useQueryClient()
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null)
  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const handleReadMore = (articleId: string) => {
    console.log(`🔍 PerplexityFeed: Opening article with ID: ${articleId}`)
    setSelectedArticleId(articleId)
    setIsBottomSheetOpen(true)
  }

  const handleBottomSheetChange = (open: boolean) => {
    setIsBottomSheetOpen(open)
    if (!open) {
      setSelectedArticleId(null)
    }
  }

  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      // Reset the query to clear cache and start fresh
      await queryClient.resetQueries({ queryKey: ["perplexity-articles"] })
      await refetch()
    } finally {
      setIsRefreshing(false)
    }
  }

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, error, refetch } = useInfiniteQuery({
    queryKey: ["perplexity-articles"],
    queryFn: ({ pageParam }) => {
      console.log("🔄 Fetching perplexity articles, page:", pageParam)
      return fetchPerplexityArticles({ pageParam })
    },
    getNextPageParam: (lastPage) => {
      console.log("📊 GetNextPageParam - lastPage.nextPage:", lastPage.nextPage)
      return lastPage.nextPage
    },
    initialPageParam: 0,
    staleTime: 30 * 1000, // 30 seconds - very short stale time to ensure fresh data
    gcTime: 60 * 1000, // 1 minute garbage collection time (formerly cacheTime)
    refetchInterval: 2 * 60 * 1000, // Auto-refetch every 2 minutes to get newly created articles
    refetchOnWindowFocus: true, // Refetch when user returns to tab
    refetchOnReconnect: true, // Refetch when network reconnects
    refetchIntervalInBackground: false, // Don't refetch in background to save resources
  })

  useEffect(() => {
    if (inView && hasNextPage) {
      fetchNextPage()
    }
  }, [inView, hasNextPage, fetchNextPage])

  if (isLoading) return <LoadingSkeleton />
  if (error) return <div className="p-4 text-center text-destructive" suppressHydrationWarning>{t("error.failedToLoad")} AI news</div>

  const perplexityArticles = data?.pages.flatMap((page) => page.articles) ?? []
  
  // Deduplicate articles by ID to prevent duplicates from pagination issues
  const uniquePerplexityArticles = perplexityArticles.filter((article, index, self) => 
    index === self.findIndex(a => a.id === article.id)
  )
  
  const articles: Article[] = uniquePerplexityArticles.map(transformPerplexityToArticle)
  
  console.log(`📊 PerplexityFeed: Loaded ${articles.length} unique articles (${perplexityArticles.length - uniquePerplexityArticles.length} duplicates removed)`)
  if (articles.length > 0) {
    console.log(`   Latest article: "${articles[0]?.title}" (ID: ${articles[0]?.id}, published: ${articles[0]?.publishedAt})`)
    if (articles.length > 1) {
      console.log(`   Second article: "${articles[1]?.title}" (ID: ${articles[1]?.id}, published: ${articles[1]?.publishedAt})`)
    }
    // Check for ordering issues
    const dates = articles.slice(0, 10).map(a => new Date(a.publishedAt))
    const isProperlyOrdered = dates.every((date, i) => i === 0 || date <= dates[i - 1])
    if (!isProperlyOrdered) {
      console.warn(`⚠️  Articles are not properly ordered by date!`)
    }
  }

  if (articles.length === 0) {
    return (
      <div className="p-6 text-center">
        <h3 className="text-lg font-semibold text-stone-900 dark:text-neutral-50 mb-2">
          {t("perplexity.noNews") || "No AI news available"}
        </h3>
        <p className="text-stone-600 dark:text-neutral-400">
          {t("perplexity.waitingForContent") || "Fresh AI-generated content is being created..."}
        </p>
      </div>
    )
  }

  return (
    <div className="px-6 pb-4">
      {/* Header for AI news */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xl font-semibold text-stone-900 dark:text-neutral-50">
            {t("perplexity.aiNewsFeed") || "AI News Feed"}
          </h2>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-stone-600 dark:text-neutral-400 hover:text-stone-900 dark:hover:text-neutral-50 border border-stone-300 dark:border-neutral-600 rounded-lg hover:bg-stone-50 dark:hover:bg-neutral-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
        <p className="text-sm text-stone-600 dark:text-neutral-400">
          {t("perplexity.aiNewsDescription") || "Fresh Hong Kong news generated by AI, sorted by latest updates"}
        </p>
      </div>

      {/* Responsive grid layout: mobile 1col, tablet 2col, desktop 3col, large 4col */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
        {articles.map((article) => (
          <ArticleCard 
            key={article.id} 
            article={article} 
            onReadMore={handleReadMore}
          />
        ))}
      </div>

      <div ref={ref} className="h-10">
        {isFetchingNextPage && <LoadingSkeleton />}
      </div>

      {/* Show mock data indicator if applicable */}
      {data?.pages[0]?.usingMockData && (
        <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            {t("perplexity.usingMockData") || "Using sample AI-generated content. Live content will appear when the system is fully configured."}
          </p>
        </div>
      )}

      <ArticleBottomSheet
        articleId={selectedArticleId}
        open={isBottomSheetOpen}
        onOpenChange={handleBottomSheetChange}
      />
    </div>
  )
}