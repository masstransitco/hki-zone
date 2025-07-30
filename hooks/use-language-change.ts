import { useEffect } from 'react'
import type { Language } from '@/store/languageSlice'

export function useLanguageChange(
  callback: (from: Language, to: Language) => void
) {
  useEffect(() => {
    const handleLanguageChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ from: Language; to: Language }>
      callback(customEvent.detail.from, customEvent.detail.to)
    }

    window.addEventListener('language-changed', handleLanguageChange)
    
    return () => {
      window.removeEventListener('language-changed', handleLanguageChange)
    }
  }, [callback])
}