import { useCallback, useEffect, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import type { AppDispatch, RootState } from '@/store'
import {
  setLoading,
  setRefreshing,
  setError,
  addArticles,
  setPageFetching,
  clearLanguageArticles,
  updateArticle,
  removeArticle,
  selectArticlesByLanguage,
  selectHasMorePages,
  selectCurrentPage,
  selectIsPageFetching,
  selectArticlesState
} from '@/store/articlesSlice'
import type { Article } from '@/lib/types'

interface UseTopicsReduxOptions {
  language: string
  enabled?: boolean
}

export function useTopicsRedux({ language, enabled = true }: UseTopicsReduxOptions) {
  const dispatch = useDispatch<AppDispatch>()
  const articles = useSelector((state: RootState) => selectArticlesByLanguage(state, language))
  const hasMore = useSelector((state: RootState) => selectHasMorePages(state, language))
  const currentPage = useSelector((state: RootState) => selectCurrentPage(state, language))
  const { isLoading, isRefreshing, error } = useSelector(selectArticlesState)
  const isLoadingMore = useSelector((state: RootState) => 
    selectIsPageFetching(state, language, currentPage + 1)
  )
  
  // Track if we've done initial load for this language
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
      dispatch(setPageFetching({ language, page, isFetching: true }))
    }
    
    try {
      const response = await fetch(`/api/topics?page=${page}&language=${language}`)
      if (!response.ok) throw new Error('Failed to fetch topics articles')
      
      const data = await response.json()
      
      // Add articles to Redux store
      dispatch(addArticles({
        articles: data.articles,
        language,
        page,
        hasMore: data.nextPage !== null
      }))
      
      dispatch(setError(null))
    } catch (error) {
      console.error('Error fetching articles:', error)
      dispatch(setError(error instanceof Error ? error.message : 'Failed to fetch articles'))
    } finally {
      dispatch(setLoading(false))
      dispatch(setRefreshing(false))
      dispatch(setPageFetching({ language, page, isFetching: false }))
    }
  }, [dispatch, language, enabled, articles.length])
  
  // Load more articles
  const loadMore = useCallback(async () => {
    const nextPage = currentPage + 1
    const isFetching = selectIsPageFetching({ articles: { pagesByLanguage: { [language]: { pages: [{ isFetching: true }] } } } } as RootState, language, nextPage)
    
    if (!hasMore || isFetching) return
    
    await fetchArticles(nextPage)
  }, [currentPage, hasMore, language, fetchArticles])
  
  // Refresh articles
  const refresh = useCallback(async () => {
    console.log(`🔄 [TOPICS-REDUX] Refresh START - Language: ${language}`)
    
    // Clear existing articles for this language
    dispatch(clearLanguageArticles(language))
    
    // Fetch from page 0
    await fetchArticles(0, true)
    
    console.log(`✅ [TOPICS-REDUX] Refresh COMPLETED - Language: ${language}`)
  }, [dispatch, language, fetchArticles])
  
  // Initial load when language changes or component mounts
  useEffect(() => {
    if (!enabled) return
    
    // Check if we've already loaded this language
    if (!hasLoadedRef.current.includes(language)) {
      hasLoadedRef.current.push(language)
      
      // Check if we already have articles for this language
      if (articles.length === 0) {
        fetchArticles(0)
      }
    }
  }, [language, enabled, articles.length, fetchArticles])
  
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