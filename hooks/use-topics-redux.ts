import { useCallback, useEffect, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import type { AppDispatch, RootState } from '@/store'
import {
  setLoading,
  setRefreshing,
  setError,
  addArticles,
  setPageFetching,
  clearArticles,
  updateArticle,
  removeArticle,
  selectArticlesByKey,
  selectHasMorePages,
  selectCurrentPage,
  selectIsPageFetching,
  selectArticlesState
} from '@/store/articlesSlice'
import type { Article } from '@/lib/types'

interface UseTopicsReduxOptions {
  language: string
  enabled?: boolean
  category?: string | null // Category filter for AI-enhanced articles
}

export function useTopicsRedux({ language, enabled = true, category = null }: UseTopicsReduxOptions) {
  const dispatch = useDispatch<AppDispatch>()
  const articles = useSelector((state: RootState) => selectArticlesByKey(state, language, category))
  const hasMore = useSelector((state: RootState) => selectHasMorePages(state, language, category))
  const currentPage = useSelector((state: RootState) => selectCurrentPage(state, language, category))
  const { isLoading, isRefreshing, error } = useSelector(selectArticlesState)
  const isLoadingMore = useSelector((state: RootState) => 
    selectIsPageFetching(state, language, category, currentPage + 1)
  )
  
  // Track if we've done initial load for this language and category combination
  const hasLoadedRef = useRef<string[]>([])
  
  // Fetch articles from API
  const fetchArticles = useCallback(async (page: number, isRefreshAction = false) => {
    if (!enabled) return
    
    // Set appropriate loading state
    if (isRefreshAction) {
      dispatch(setRefreshing(true))
    } else if (page === 0 && articles.length === 0) {
      dispatch(setLoading(true))
    } else {
      dispatch(setPageFetching({ language, page, isFetching: true, category }))
    }
    
    try {
      const url = new URL('/api/topics', window.location.origin)
      url.searchParams.set('page', page.toString())
      url.searchParams.set('language', language)
      if (category) {
        url.searchParams.set('category', category)
      }
      
      const response = await fetch(url.toString())
      if (!response.ok) throw new Error('Failed to fetch topics articles')
      
      const data = await response.json()
      
      // Add articles to Redux store
      dispatch(addArticles({
        articles: data.articles,
        language,
        page,
        hasMore: data.nextPage !== null,
        category
      }))
      
      dispatch(setError(null))
    } catch (error) {
      console.error('Error fetching articles:', error)
      dispatch(setError(error instanceof Error ? error.message : 'Failed to fetch articles'))
    } finally {
      dispatch(setLoading(false))
      dispatch(setRefreshing(false))
      dispatch(setPageFetching({ language, page, isFetching: false, category }))
    }
  }, [dispatch, language, enabled, articles.length, category])
  
  // Load more articles
  const loadMore = useCallback(async () => {
    const nextPage = currentPage + 1
    // Note: we'll check isFetching within the fetchArticles function instead
    
    if (!hasMore) return
    
    await fetchArticles(nextPage)
  }, [currentPage, hasMore, fetchArticles])
  
  // Refresh articles
  const refresh = useCallback(async () => {
    console.log(`🔄 [TOPICS-REDUX] Refresh START - Language: ${language}, Category: ${category || 'all'}`)
    
    // Clear existing articles for this language and category
    dispatch(clearArticles({ language, category }))
    
    // Fetch from page 0
    await fetchArticles(0, true)
    
    console.log(`✅ [TOPICS-REDUX] Refresh COMPLETED - Language: ${language}, Category: ${category || 'all'}`)
  }, [dispatch, language, category, fetchArticles])
  
  // Initial load when language or category changes
  useEffect(() => {
    if (!enabled) return
    
    const cacheKey = `${language}-${category || 'all'}`
    
    // Check if we've already loaded this language/category combination
    if (!hasLoadedRef.current.includes(cacheKey)) {
      hasLoadedRef.current.push(cacheKey)
      
      // Check if we already have articles for this language/category
      if (articles.length === 0) {
        fetchArticles(0)
      }
    }
  }, [language, category, enabled, articles.length, fetchArticles])
  
  // Real-time update handlers
  const handleRealtimeUpdate = useCallback((article: Article) => {
    dispatch(updateArticle({ article, language }))
  }, [dispatch, language])
  
  const handleRealtimeDelete = useCallback((articleId: string) => {
    dispatch(removeArticle(articleId))
  }, [dispatch])
  
  return {
    articles,
    isLoading,
    isRefreshing,
    isLoadingMore,
    error,
    hasMore,
    loadMore,
    refresh,
    handleRealtimeUpdate,
    handleRealtimeDelete
  }
}