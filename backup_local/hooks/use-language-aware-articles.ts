import { useEffect, useRef } from 'react'
import { useSelector } from 'react-redux'
import { selectLanguage } from '@/store/languageSlice'
import { selectArticlesByLanguage } from '@/store/articlesSlice'
import type { RootState } from '@/store'

/**
 * Hook to optimize language switching for articles
 * Returns articles for current language, but preserves them during language switch
 * to avoid jarring UI changes
 */
export function useLanguageAwareArticles(currentArticles?: any[]) {
  const currentLanguage = useSelector(selectLanguage)
  const currentArticles = useSelector((state: RootState) => 
    selectArticlesByLanguage(state, currentLanguage)
  )
  
  // Track previous language and articles
  const previousLanguageRef = useRef(currentLanguage)
  const previousArticlesRef = useRef(currentArticles)
  const isLanguageChangingRef = useRef(false)
  
  useEffect(() => {
    // Detect language change
    if (previousLanguageRef.current !== currentLanguage) {
      isLanguageChangingRef.current = true
      previousLanguageRef.current = currentLanguage
      
      // Reset after a short delay to allow new articles to load
      const timer = setTimeout(() => {
        isLanguageChangingRef.current = false
      }, 500)
      
      return () => clearTimeout(timer)
    }
  }, [currentLanguage])
  
  // Update previous articles when we get new ones for the current language
  useEffect(() => {
    if (!isLanguageChangingRef.current && currentArticles.length > 0) {
      previousArticlesRef.current = currentArticles
    }
  }, [currentArticles])
  
  // During language change, show previous articles to avoid empty state
  const articlesToShow = isLanguageChangingRef.current && currentArticles.length === 0
    ? previousArticlesRef.current
    : currentArticles
  
  return {
    articles: articlesToShow,
    currentLanguage,
    isLanguageChanging: isLanguageChangingRef.current
  }
}