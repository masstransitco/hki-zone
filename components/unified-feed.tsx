"use client"

import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useState, useMemo } from "react"
import { useInView } from "react-intersection-observer"
import { RefreshCw } from "lucide-react"
import ArticleCard from "./article-card"
import ArticleBottomSheet from "./article-bottom-sheet"
import LoadingSkeleton from "./loading-skeleton"
import { useLanguage } from "./language-provider"
import type { 
  UnifiedArticle, 
  UnifiedArticlesResponse,
  FeedConfig,
  FeedHeaderConfig,
  ArticleQueryParams
} from "@/lib/types/unified"
import { DEFAULT_FEED_CONFIG } from "@/lib/types/unified"

interface UnifiedFeedProps {
  config?: FeedConfig;
  headerConfig?: FeedHeaderConfig;
  className?: string;
}

// Transform old Article type to UnifiedArticle for ArticleCard compatibility
function transformToArticleCard(article: UnifiedArticle) {
  return {
    id: article.id,
    title: article.title,
    summary: article.summary || article.lede || '',
    content: article.content,
    url: article.url,
    source: article.source,
    publishedAt: article.published_at,
    imageUrl: article.image_url,
    category: article.category,
    readTime: Math.ceil((article.content?.length || 0) / 200) || 3,
    isAiEnhanced: article.features.has_ai_content,
    aiMetadata: article.article_type === 'ai_generated' ? {
      model: article.generation_metadata?.model,
      enhancedTitle: article.generation_metadata?.enhanced_title || article.title,
      keyPoints: article.key_points,
      whyItMatters: article.why_it_matters,
      sources: article.structured_sources?.sources || []
    } : undefined
  }
}

async function fetchUnifiedArticles(params: ArticleQueryParams): Promise<UnifiedArticlesResponse> {
  const searchParams = new URLSearchParams();
  
  // Build query string
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      if (Array.isArray(value)) {
        value.forEach(v => searchParams.append(key, v));
      } else {
        searchParams.set(key, String(value));
      }
    }
  });

  const response = await fetch(`/api/unified/articles?${searchParams}`);
  if (!response.ok) throw new Error("Failed to fetch articles");
  return response.json();
}

export default function UnifiedFeed({ 
  config = DEFAULT_FEED_CONFIG, 
  headerConfig,
  className = ""
}: UnifiedFeedProps) {
  const { ref, inView } = useInView();
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Build query parameters from config
  const queryParams = useMemo<ArticleQueryParams>(() => {
    const params: ArticleQueryParams = {
      page: 0,
      limit: config.pageSize || 10,
      sort: 'latest',
      status: 'published',
      processingStatus: 'ready'
    };

    // Map feed type to article type
    if (config.feedType === 'ai') {
      params.type = 'ai_generated';
    } else if (config.feedType === 'topics') {
      params.features = ['has_ai_content'];
    } else if (config.feedType === 'news') {
      params.type = 'scraped';
    }

    // Apply filters
    if (config.filters) {
      if (config.filters.type) params.type = config.filters.type;
      if (config.filters.category) params.category = config.filters.category;
      if (config.filters.source) params.source = config.filters.source;
      
      // Convert boolean filters to features array
      const features: string[] = [];
      if (config.filters.hasImage) features.push('has_image');
      if (config.filters.hasAiContent) features.push('has_ai_content');
      if (features.length > 0) params.features = features;
    }

    return params;
  }, [config]);

  const queryKey = useMemo(() => 
    ['unified-articles', config.feedType, queryParams], 
    [config.feedType, queryParams]
  );

  const handleReadMore = (articleId: string) => {
    console.log(`🔍 UnifiedFeed: Opening article with ID: ${articleId}`);
    setSelectedArticleId(articleId);
    setIsBottomSheetOpen(true);
  };

  const handleBottomSheetChange = (open: boolean) => {
    setIsBottomSheetOpen(open);
    if (!open) {
      setSelectedArticleId(null);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await queryClient.resetQueries({ queryKey });
      await refetch();
    } finally {
      setIsRefreshing(false);
    }
  };

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, error, refetch } = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) => {
      const params = { ...queryParams, page: pageParam };
      console.log("🔄 Fetching unified articles:", params);
      return fetchUnifiedArticles(params);
    },
    getNextPageParam: (lastPage) => {
      console.log("📊 GetNextPageParam - hasMore:", lastPage.hasMore, "nextPage:", lastPage.nextPage);
      return lastPage.nextPage;
    },
    initialPageParam: 0,
    staleTime: config.refreshInterval || 5 * 60 * 1000, // 5 minutes default
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchInterval: config.refreshInterval,
    refetchOnWindowFocus: config.refreshInterval ? true : false,
    refetchOnReconnect: true,
    refetchIntervalInBackground: false,
  });

  useEffect(() => {
    if (inView && hasNextPage && config.enableInfiniteScroll !== false) {
      fetchNextPage();
    }
  }, [inView, hasNextPage, fetchNextPage, config.enableInfiniteScroll]);

  if (isLoading) return <LoadingSkeleton />;
  if (error) return <div className="p-4 text-center text-destructive" suppressHydrationWarning>{t("error.failedToLoad")} articles</div>;

  const articles = data?.pages.flatMap((page) => page.articles) ?? [];
  
  console.log(`📊 UnifiedFeed: Loaded ${articles.length} articles for ${config.feedType} feed`);
  if (articles.length > 0) {
    console.log(`   Latest: "${articles[0]?.title}" (published: ${articles[0]?.published_at})`);
  }

  if (articles.length === 0) {
    return (
      <div className="p-6 text-center">
        <h3 className="text-lg font-semibold text-stone-900 dark:text-neutral-50 mb-2">
          {t("feed.noArticles") || "No articles available"}
        </h3>
        <p className="text-stone-600 dark:text-neutral-400">
          {t("feed.checkBackLater") || "Check back later for new content"}
        </p>
      </div>
    );
  }

  return (
    <div className={`px-6 pb-4 ${className}`}>
      {/* Header section */}
      {headerConfig && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xl font-semibold text-stone-900 dark:text-neutral-50">
              {headerConfig.title}
            </h2>
            <div className="flex items-center gap-2">
              {headerConfig.customActions}
              {(config.showRefreshButton || headerConfig.showRefresh) && (
                <button
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-stone-600 dark:text-neutral-400 hover:text-stone-900 dark:hover:text-neutral-50 border border-stone-300 dark:border-neutral-600 rounded-lg hover:bg-stone-50 dark:hover:bg-neutral-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                  {isRefreshing ? 'Refreshing...' : 'Refresh'}
                </button>
              )}
            </div>
          </div>
          {headerConfig.subtitle && (
            <p className="text-sm text-stone-600 dark:text-neutral-400">
              {headerConfig.subtitle}
            </p>
          )}
        </div>
      )}

      {/* Articles grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
        {articles.map((article) => (
          <ArticleCard 
            key={article.id} 
            article={transformToArticleCard(article)} 
            onReadMore={handleReadMore}
          />
        ))}
      </div>

      {/* Infinite scroll trigger or load more button */}
      {config.enableInfiniteScroll !== false ? (
        <div ref={ref} className="h-10">
          {isFetchingNextPage && <LoadingSkeleton />}
        </div>
      ) : (
        config.showLoadMore && hasNextPage && (
          <div className="mt-6 text-center">
            <button
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className="px-6 py-2 text-sm font-medium text-white bg-stone-900 dark:bg-neutral-50 dark:text-stone-900 rounded-lg hover:bg-stone-800 dark:hover:bg-neutral-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isFetchingNextPage ? 'Loading...' : 'Load More'}
            </button>
          </div>
        )
      )}

      {/* Debug info for development */}
      {data?.pages[0]?.debug?.source === 'mock' && (
        <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            {t("feed.usingMockData") || "Using sample content. Live content will appear when the system is fully configured."}
          </p>
        </div>
      )}

      <ArticleBottomSheet
        articleId={selectedArticleId}
        open={isBottomSheetOpen}
        onOpenChange={handleBottomSheetChange}
      />
    </div>
  );
}