"use client"

import React, { createContext, useContext, useState, useCallback } from 'react'
import { useTextToSpeech } from '@/hooks/use-text-to-speech'
import { useLanguage } from '@/components/language-provider'

interface TTSContextType {
  // States
  isPlaying: boolean
  isPaused: boolean
  isLoading: boolean
  progress: number
  duration: number
  currentTime: number
  audioData: number[]
  currentArticle: {
    id: string
    title: string
    content: string
  } | null
  
  // Actions
  playArticle: (article: { id: string; title: string; content: string }) => Promise<void>
  pause: () => void
  resume: () => void
  stop: () => void
}

const TTSContext = createContext<TTSContextType | undefined>(undefined)

export function TTSProvider({ children }: { children: React.ReactNode }) {
  const { language } = useLanguage()
  const [currentArticle, setCurrentArticle] = useState<TTSContextType['currentArticle']>(null)
  
  const { isPlaying, isPaused, isLoading, progress, duration, currentTime, audioData, speak, pause, resume, stop } = useTextToSpeech({
    apiKey: process.env.NEXT_PUBLIC_GOOGLE_TEXT_TO_SPEECH_API_KEY,
    language
  })

  // Enhanced logging for debugging
  React.useEffect(() => {
    console.log('🌍 Global TTS Context - States:', { 
      isPlaying, 
      isPaused, 
      isLoading,
      currentArticle: currentArticle?.title || 'none',
      language
    })
  }, [isPlaying, isPaused, isLoading, currentArticle, language])

  // Track currentArticle changes specifically
  React.useEffect(() => {
    console.log('🌍 Global TTS Context - currentArticle changed:', { 
      previousArticle: 'tracked in closure',
      newArticle: currentArticle ? {
        id: currentArticle.id,
        title: currentArticle.title,
        contentLength: currentArticle.content?.length || 0
      } : null
    })
  }, [currentArticle])

  const playArticle = useCallback(async (article: { id: string; title: string; content: string }) => {
    console.log('🌍 Global TTS - playArticle called:', { 
      articleId: article.id,
      articleTitle: article.title,
      contentLength: article.content?.length || 0,
      currentlyPlaying: currentArticle?.id || 'none',
      isCurrentlyPlaying: isPlaying,
      isCurrentlyPaused: isPaused
    })
    
    // If there's a different article currently playing or paused, stop it first
    if (currentArticle && currentArticle.id !== article.id && (isPlaying || isPaused)) {
      console.log('🌍 Global TTS - Stopping previous article:', currentArticle.title)
      stop()
      // Small delay to ensure cleanup completes
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    
    console.log('🌍 Global TTS - Setting current article')
    setCurrentArticle(article)
    
    try {
      // Create text to speak: title + content
      let textToSpeak = article.title
      if (article.content) {
        // Remove HTML tags and clean up content
        const cleanContent = article.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
        textToSpeak += '. ' + cleanContent
      }
      
      console.log('🌍 Global TTS - Text prepared, length:', textToSpeak.length)
      console.log('🌍 Global TTS - About to call speak function')
      await speak(textToSpeak)
      console.log('🌍 Global TTS - Speak function completed')
    } catch (error) {
      console.error('🌍 Global TTS - Error during playback:', error)
      console.log('🌍 Global TTS - Clearing current article due to error')
      setCurrentArticle(null)
    }
  }, [speak, currentArticle, isPlaying, isPaused, stop])

  const handleStop = useCallback(() => {
    console.log('🌍 Global TTS - Stopping')
    stop()
    setCurrentArticle(null)
  }, [stop])

  const contextValue: TTSContextType = {
    isPlaying,
    isPaused,
    isLoading,
    progress,
    duration,
    currentTime,
    audioData,
    currentArticle,
    playArticle,
    pause,
    resume,
    stop: handleStop
  }

  return (
    <TTSContext.Provider value={contextValue}>
      {children}
    </TTSContext.Provider>
  )
}

export function useTTSContext() {
  const context = useContext(TTSContext)
  if (context === undefined) {
    throw new Error('useTTSContext must be used within a TTSProvider')
  }
  return context
}