"use client"

import React, { createContext, useContext, useState, useCallback } from 'react'

interface GenerationState {
  getimg: Set<string>  // Article IDs currently generating with GetImg
  openai: Set<string>  // Article IDs currently generating with OpenAI
}

interface ImageGenerationContextValue {
  isGenerating: (articleId: string, type: 'getimg' | 'openai') => boolean
  setGenerating: (articleId: string, type: 'getimg' | 'openai', isGenerating: boolean) => void
  getGeneratingCount: (type?: 'getimg' | 'openai') => number
}

const ImageGenerationContext = createContext<ImageGenerationContextValue | undefined>(undefined)

export function ImageGenerationProvider({ children }: { children: React.ReactNode }) {
  const [generationState, setGenerationState] = useState<GenerationState>({
    getimg: new Set(),
    openai: new Set()
  })

  const isGenerating = useCallback((articleId: string, type: 'getimg' | 'openai') => {
    return generationState[type].has(articleId)
  }, [generationState])

  const setGenerating = useCallback((articleId: string, type: 'getimg' | 'openai', isGenerating: boolean) => {
    setGenerationState(prev => {
      const newState = {
        ...prev,
        [type]: new Set(prev[type])
      }
      
      if (isGenerating) {
        newState[type].add(articleId)
      } else {
        newState[type].delete(articleId)
      }
      
      return newState
    })
  }, [])

  const getGeneratingCount = useCallback((type?: 'getimg' | 'openai') => {
    if (type) {
      return generationState[type].size
    }
    return generationState.getimg.size + generationState.openai.size
  }, [generationState])

  return (
    <ImageGenerationContext.Provider value={{ isGenerating, setGenerating, getGeneratingCount }}>
      {children}
    </ImageGenerationContext.Provider>
  )
}

export function useImageGeneration() {
  const context = useContext(ImageGenerationContext)
  if (!context) {
    throw new Error('useImageGeneration must be used within ImageGenerationProvider')
  }
  return context
}