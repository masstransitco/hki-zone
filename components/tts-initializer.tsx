"use client"

import React from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { initializeTTS, selectTTSIsInitialized, selectTTS, updateLanguage } from '@/store/ttsSlice'
import { initializeAudioContext } from '@/store/audioSlice'
import type { AppDispatch, RootState } from '@/store'
import { useLanguage } from './language-provider'

export default function TTSInitializer() {
  const dispatch = useDispatch<AppDispatch>()
  const isInitialized = useSelector(selectTTSIsInitialized)
  const fullTTSState = useSelector(selectTTS)
  const [initAttempted, setInitAttempted] = React.useState(false)
  const [isRehydrated, setIsRehydrated] = React.useState(false)
  const [hasResetStuckState, setHasResetStuckState] = React.useState(false)
  
  // Get current language from language provider
  const { language, onLanguageChange } = useLanguage()
  
  // Check if store is rehydrated by looking for the _persist key
  const persistState = useSelector((state: RootState) => (state as any)._persist)
  
  React.useEffect(() => {
    if (persistState?.rehydrated && !isRehydrated) {
      console.log('🎵 TTS Initializer - Redux store rehydrated')
      setIsRehydrated(true)
    }
  }, [persistState, isRehydrated])

  // Simple mounted state check
  const [isMounted, setIsMounted] = React.useState(false)
  
  React.useEffect(() => {
    setIsMounted(true)
  }, [])
  
  React.useEffect(() => {
    // Use timer-based initialization to ensure we're fully client-side
    const timer = setTimeout(() => {
      if (!isInitialized && !initAttempted) {
        console.log('🎵 TTS Initializer - Starting delayed initialization', {
          isInitialized,
          initAttempted,
          language,
          clientSide: typeof window !== 'undefined'
        })
        setInitAttempted(true)
          
        console.log('🎵 TTS Initializer - Dispatching initialization', {
          language,
          hasApiKey: !!process.env.NEXT_PUBLIC_GOOGLE_TEXT_TO_SPEECH_API_KEY,
          apiKeyValue: process.env.NEXT_PUBLIC_GOOGLE_TEXT_TO_SPEECH_API_KEY?.substring(0, 10) + '...'
        })
        
        // Initialize TTS with current language and API key
        const ttsInitResult = dispatch(initializeTTS({
          language, // Use current language from provider
          apiKey: process.env.NEXT_PUBLIC_GOOGLE_TEXT_TO_SPEECH_API_KEY
        }))
        
        // Initialize audio context (will be handled by services)
        const audioInitResult = dispatch(initializeAudioContext())
        
        // Log results
        ttsInitResult.then((result) => {
          console.log('🎵 TTS Initializer - TTS init result:', result)
        }).catch((error) => {
          console.error('🎵 TTS Initializer - TTS init error:', error)
        })
        
        audioInitResult.then((result) => {
          console.log('🎵 TTS Initializer - Audio init result:', result)
        }).catch((error) => {
          console.error('🎵 TTS Initializer - Audio init error:', error)
        })
      } else {
        console.log('🎵 TTS Initializer - Skipping initialization', {
          isInitialized,
          initAttempted,
          language
        })
      }
    }, 1000) // 1 second delay to ensure everything is ready
    
    return () => clearTimeout(timer)
  }, [dispatch, isInitialized, initAttempted, language])

  // Handle language changes - update TTS language configuration
  const [lastLanguage, setLastLanguage] = React.useState(language)
  
  React.useEffect(() => {
    if (isInitialized && language !== lastLanguage) {
      console.log('🎵 TTS Initializer - Language changed, updating TTS config', {
        from: lastLanguage,
        to: language
      })
      
      setLastLanguage(language)
      
      // Update language in TTS service
      dispatch(updateLanguage(language))
      
      // Reinitialize with new language if needed
      dispatch(initializeTTS({
        language: language,
        apiKey: process.env.NEXT_PUBLIC_GOOGLE_TEXT_TO_SPEECH_API_KEY
      }))
    }
  }, [dispatch, isInitialized, language, lastLanguage])

  // This component doesn't render anything visible
  return null
}