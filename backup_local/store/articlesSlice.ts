import { createSlice, PayloadAction, createSelector } from '@reduxjs/toolkit'
import type { Article } from '@/lib/types'
import type { RootState } from './index'

interface ArticleTranslation {
  title: string
  summary: string
  content?: string
}

interface NormalizedArticle {
  id: string
  url: string
  source: string
  publishedAt: string
  imageUrl?: string
  category: string
  readTime: number
  isAiEnhanced: boolean
  originalArticleId?: string
  enhancementMetadata?: any
  // Store translations by language
  translations: {
    [language: string]: ArticleTranslation
  }
}

interface PageInfo {
  ids: string[]
  hasMore: boolean
  lastFetched: number
  isFetching: boolean
}

interface ArticlesState {
  // Normalized articles by ID
  byId: Record<string, NormalizedArticle>
  // Page tracking by language
  pagesByLanguage: Record<string, {
    pages: PageInfo[]
    currentPage: number
  }>
  // Loading states
  isLoading: boolean
  isRefreshing: boolean
  error: string | null
  // Track which languages have been loaded for each article
  loadedTranslations: Record<string, string[]>
}

const initialState: ArticlesState = {
  byId: {},
  pagesByLanguage: {},
  isLoading: false,
  isRefreshing: false,
  error: null,
  loadedTranslations: {}
}

const articlesSlice = createSlice({
  name: 'articles',
  initialState,
  reducers: {
    // Set loading state
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload
    },
    
    // Set refreshing state
    setRefreshing: (state, action: PayloadAction<boolean>) => {
      state.isRefreshing = action.payload
    },
    
    // Set error
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload
    },
    
    // Add articles from API response
    addArticles: (state, action: PayloadAction<{
      articles: Article[]
      language: string
      page: number
      hasMore: boolean
    }>) => {
      const { articles, language, page, hasMore } = action.payload
      
      // Initialize language pages if needed
      if (!state.pagesByLanguage[language]) {
        state.pagesByLanguage[language] = {
          pages: [],
          currentPage: 0
        }
      }
      
      const articleIds: string[] = []
      
      // Normalize and store articles
      articles.forEach(article => {
        articleIds.push(article.id)
        
        // Check if article already exists
        if (state.byId[article.id]) {
          // Update translation for this language
          state.byId[article.id].translations[language] = {
            title: article.title,
            summary: article.summary,
            content: article.content
          }
        } else {
          // Create new normalized article
          state.byId[article.id] = {
            id: article.id,
            url: article.url,
            source: article.source,
            publishedAt: article.publishedAt,
            imageUrl: article.imageUrl,
            category: article.category,
            readTime: article.readTime,
            isAiEnhanced: article.isAiEnhanced,
            originalArticleId: article.originalArticleId,
            enhancementMetadata: article.enhancementMetadata,
            translations: {
              [language]: {
                title: article.title,
                summary: article.summary,
                content: article.content
              }
            }
          }
        }
        
        // Track loaded translations
        if (!state.loadedTranslations[article.id]) {
          state.loadedTranslations[article.id] = []
        }
        if (!state.loadedTranslations[article.id].includes(language)) {
          state.loadedTranslations[article.id].push(language)
        }
      })
      
      // Update page info
      if (!state.pagesByLanguage[language].pages[page]) {
        state.pagesByLanguage[language].pages[page] = {
          ids: articleIds,
          hasMore,
          lastFetched: Date.now(),
          isFetching: false
        }
      } else {
        // Append to existing page (for real-time updates)
        const existingIds = [...state.pagesByLanguage[language].pages[page].ids]
        articleIds.forEach(id => {
          if (!existingIds.includes(id)) {
            existingIds.push(id)
          }
        })
        state.pagesByLanguage[language].pages[page].ids = existingIds
        state.pagesByLanguage[language].pages[page].hasMore = hasMore
        state.pagesByLanguage[language].pages[page].lastFetched = Date.now()
      }
      
      state.pagesByLanguage[language].currentPage = page
    },
    
    // Set page fetching state
    setPageFetching: (state, action: PayloadAction<{
      language: string
      page: number
      isFetching: boolean
    }>) => {
      const { language, page, isFetching } = action.payload
      
      if (!state.pagesByLanguage[language]) {
        state.pagesByLanguage[language] = {
          pages: [],
          currentPage: 0
        }
      }
      
      if (!state.pagesByLanguage[language].pages[page]) {
        state.pagesByLanguage[language].pages[page] = {
          ids: [],
          hasMore: true,
          lastFetched: 0,
          isFetching
        }
      } else {
        state.pagesByLanguage[language].pages[page].isFetching = isFetching
      }
    },
    
    // Clear articles for a language (for pull-to-refresh)
    clearLanguageArticles: (state, action: PayloadAction<string>) => {
      const language = action.payload
      if (state.pagesByLanguage[language]) {
        state.pagesByLanguage[language] = {
          pages: [],
          currentPage: 0
        }
      }
    },
    
    // Update single article (for real-time updates)
    updateArticle: (state, action: PayloadAction<{
      article: Article
      language: string
    }>) => {
      const { article, language } = action.payload
      
      if (state.byId[article.id]) {
        // Update existing article
        state.byId[article.id].translations[language] = {
          title: article.title,
          summary: article.summary,
          content: article.content
        }
        
        // Update metadata if changed
        if (article.enhancementMetadata) {
          state.byId[article.id].enhancementMetadata = article.enhancementMetadata
        }
      }
    },
    
    // Remove article (for real-time deletions)
    removeArticle: (state, action: PayloadAction<string>) => {
      const articleId = action.payload
      
      // Remove from normalized store
      delete state.byId[articleId]
      delete state.loadedTranslations[articleId]
      
      // Remove from all language pages
      Object.values(state.pagesByLanguage).forEach(langPages => {
        langPages.pages.forEach(page => {
          page.ids = page.ids.filter(id => id !== articleId)
        })
      })
    }
  }
})

export const {
  setLoading,
  setRefreshing,
  setError,
  addArticles,
  setPageFetching,
  clearLanguageArticles,
  updateArticle,
  removeArticle
} = articlesSlice.actions

// Selectors
export const selectArticlesState = (state: RootState) => state.articles

// Get all article IDs for a language
export const selectArticleIdsByLanguage = createSelector(
  [selectArticlesState, (state: RootState, language: string) => language],
  (articlesState, language) => {
    const langPages = articlesState.pagesByLanguage[language]
    if (!langPages) return []
    
    const allIds: string[] = []
    langPages.pages.forEach(page => {
      allIds.push(...page.ids)
    })
    
    return allIds
  }
)

// Get articles for a language with translations
export const selectArticlesByLanguage = createSelector(
  [selectArticlesState, selectArticleIdsByLanguage, (state: RootState, language: string) => language],
  (articlesState, ids, language) => {
    return ids.map(id => {
      const normalizedArticle = articlesState.byId[id]
      if (!normalizedArticle) return null
      
      const translation = normalizedArticle.translations[language] || 
                         normalizedArticle.translations['en'] || 
                         Object.values(normalizedArticle.translations)[0]
      
      if (!translation) return null
      
      // Denormalize for component consumption
      return {
        id: normalizedArticle.id,
        title: translation.title,
        summary: translation.summary,
        content: translation.content,
        url: normalizedArticle.url,
        source: normalizedArticle.source,
        publishedAt: normalizedArticle.publishedAt,
        imageUrl: normalizedArticle.imageUrl,
        category: normalizedArticle.category,
        readTime: normalizedArticle.readTime,
        isAiEnhanced: normalizedArticle.isAiEnhanced,
        language,
        originalArticleId: normalizedArticle.originalArticleId,
        enhancementMetadata: normalizedArticle.enhancementMetadata
      } as Article
    }).filter(Boolean) as Article[]
  }
)

// Get single article by ID and language
export const selectArticleByIdAndLanguage = createSelector(
  [selectArticlesState, (state: RootState, id: string) => id, (state: RootState, id: string, language: string) => language],
  (articlesState, id, language) => {
    const normalizedArticle = articlesState.byId[id]
    if (!normalizedArticle) return null
    
    const translation = normalizedArticle.translations[language] || 
                       normalizedArticle.translations['en'] || 
                       Object.values(normalizedArticle.translations)[0]
    
    if (!translation) return null
    
    return {
      id: normalizedArticle.id,
      title: translation.title,
      summary: translation.summary,
      content: translation.content,
      url: normalizedArticle.url,
      source: normalizedArticle.source,
      publishedAt: normalizedArticle.publishedAt,
      imageUrl: normalizedArticle.imageUrl,
      category: normalizedArticle.category,
      readTime: normalizedArticle.readTime,
      isAiEnhanced: normalizedArticle.isAiEnhanced,
      language,
      originalArticleId: normalizedArticle.originalArticleId,
      enhancementMetadata: normalizedArticle.enhancementMetadata
    } as Article
  }
)

// Check if more pages available
export const selectHasMorePages = createSelector(
  [selectArticlesState, (state: RootState, language: string) => language],
  (articlesState, language) => {
    const langPages = articlesState.pagesByLanguage[language]
    if (!langPages || langPages.pages.length === 0) return true
    
    const lastPage = langPages.pages[langPages.pages.length - 1]
    return lastPage?.hasMore ?? true
  }
)

// Get current page for language
export const selectCurrentPage = createSelector(
  [selectArticlesState, (state: RootState, language: string) => language],
  (articlesState, language) => {
    return articlesState.pagesByLanguage[language]?.currentPage ?? 0
  }
)

// Check if a page is being fetched
export const selectIsPageFetching = createSelector(
  [selectArticlesState, (state: RootState, language: string) => language, (state: RootState, language: string, page: number) => page],
  (articlesState, language, page) => {
    return articlesState.pagesByLanguage[language]?.pages[page]?.isFetching ?? false
  }
)

// Check if article has translation for language
export const selectArticleHasTranslation = createSelector(
  [selectArticlesState, (state: RootState, articleId: string) => articleId, (state: RootState, articleId: string, language: string) => language],
  (articlesState, articleId, language) => {
    return articlesState.loadedTranslations[articleId]?.includes(language) ?? false
  }
)

export default articlesSlice.reducer