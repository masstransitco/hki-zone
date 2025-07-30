"use client"

import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useLanguageChange } from '@/hooks/use-language-change'
import type { Language } from '@/store/languageSlice'

/**
 * Hook that handles cache invalidation when language changes.
 * This ensures fresh content is loaded when switching between languages.
 */
export function useCacheInvalidation() {
  const queryClient = useQueryClient()

  const handleLanguageChange = useCallback((oldLang: Language, newLang: Language) => {
    console.log(`Cache invalidation: Language changed from ${oldLang} to ${newLang}`)
    
    // CRITICAL FIX: Invalidate topics cache when language changes
    // This ensures users see fresh content instead of stale cached data
    
    // Invalidate all topics-related queries to force fresh data
    queryClient.invalidateQueries({ 
      queryKey: ["topics-articles"] 
    })
    
    // Special handling for English language - force refetch
    // This addresses the specific issue where returning to English shows stale data
    if (newLang === "en") {
      console.log("Returning to English - forcing fresh data fetch")
      queryClient.refetchQueries({ 
        queryKey: ["topics-articles", "en"],
        type: "active"
      })
    }
    
    // Also invalidate unified feed if it exists (for consistency)
    queryClient.invalidateQueries({ 
      queryKey: ["unified-articles"] 
    })
    
    console.log("Cache invalidation completed")
  }, [queryClient])

  // Listen for language changes
  useLanguageChange(handleLanguageChange)
}