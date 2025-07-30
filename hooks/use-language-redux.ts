import { useEffect, useCallback, useMemo } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { selectLanguage, selectIsHydrated, selectTranslation, setLanguage as setLanguageAction, hydrate, Language } from '@/store/languageSlice'
import type { RootState } from '@/store'

interface UseLanguageReturn {
  language: Language
  setLanguage: (language: Language) => void
  t: (key: string) => string
}

export function useLanguage(): UseLanguageReturn {
  const dispatch = useDispatch()
  const language = useSelector((state: RootState) => selectLanguage(state))
  const isHydrated = useSelector((state: RootState) => selectIsHydrated(state))

  // Hydrate language from localStorage on mount
  useEffect(() => {
    if (!isHydrated) {
      dispatch(hydrate())
    }
  }, [dispatch, isHydrated])

  const setLanguage = useCallback(
    (newLanguage: Language) => {
      dispatch(setLanguageAction(newLanguage))
    },
    [dispatch]
  )

  const t = useCallback(
    (key: string) => {
      // Create a mock state object for the selector
      const mockState = { language: { language: isHydrated ? language : 'en', isHydrated } }
      return selectTranslation(key)(mockState)
    },
    [language, isHydrated]
  )

  return {
    language: isHydrated ? language : 'en', // Always return 'en' until hydrated
    setLanguage,
    t,
  }
}

// Helper hook to get translation function without other language features
export function useTranslation() {
  const { t } = useLanguage()
  return t
}