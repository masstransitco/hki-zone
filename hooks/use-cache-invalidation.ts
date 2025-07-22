"use client"

import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useLanguage } from '@/components/language-provider'

/**
 * Hook that handles cache invalidation when language changes.
 * This ensures fresh content is loaded when switching between languages.
 */
export function useCacheInvalidation() {
  const queryClient = useQueryClient()
  const { onLanguageChange } = useLanguage()

  useEffect(() => {
    // Define the language change handler
    const handleLanguageChange = (oldLang: string, newLang: string) => {
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
    }

    // Register the language change handler
    if (onLanguageChange) {
      onLanguageChange(handleLanguageChange)
    }
  }, [queryClient, onLanguageChange])
}