"use client"

import React from 'react'
import { motion, AnimatePresence } from "framer-motion"
import HeadphonesIcon from '@mui/icons-material/Headphones'
import PauseIcon from '@mui/icons-material/Pause'
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useTTSContext } from '@/contexts/tts-context'

export default function GlobalTTSHUD() {
  const { 
    isPlaying, 
    isPaused, 
    isLoading, 
    progress, 
    duration, 
    currentTime, 
    audioData, 
    currentArticle, 
    pause, 
    resume, 
    stop 
  } = useTTSContext()
  
  // Show when there's an active article and it's loading, playing, or paused
  const isVisible = Boolean(currentArticle && (isPlaying || isLoading || isPaused))

  // Debug logging
  React.useEffect(() => {
    console.log('🌟 Global TTS HUD - Render state:', { 
      isVisible, 
      isPlaying, 
      isLoading, 
      isPaused,
      progress: Math.round(progress * 100) + '%',
      duration: Math.round(duration) + 's',
      currentTime: Math.round(currentTime) + 's',
      audioDataAvg: audioData.reduce((a, b) => a + b, 0) / audioData.length,
      hasCurrentArticle: !!currentArticle,
      articleTitle: currentArticle?.title || 'none'
    })
  }, [isVisible, isPlaying, isLoading, isPaused, progress, duration, currentTime, audioData, currentArticle])

  const handleTogglePlayback = (e?: React.MouseEvent) => {
    // Prevent event bubbling that might close bottom sheet
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    
    console.log('🌟 Global TTS HUD - Toggle playback clicked', { isPlaying, isPaused })
    
    if (isPlaying) {
      console.log('🌟 Global TTS HUD - Pausing playback')
      pause()
    } else if (isPaused) {
      console.log('🌟 Global TTS HUD - Resuming playback')
      resume()
    }
  }

  const getControlIcon = () => {
    if (isLoading) {
      return <HeadphonesIcon className="w-5 h-5 animate-pulse" />
    }
    if (isPlaying) {
      return <PauseIcon className="w-5 h-5" />
    }
    return <HeadphonesIcon className="w-5 h-5" />
  }

  const getAriaLabel = () => {
    if (isLoading) return "Loading speech..."
    if (isPlaying) return "Pause speech"
    if (isPaused) return "Resume speech"
    return "Play speech"
  }

  if (!isVisible) {
    return null
  }

  return (
    <div 
      className="fixed pointer-events-none z-[200] flex justify-center"
      style={{
        // Position above footer nav (76px) with 0.5rem spacing
        bottom: 'calc(76px + max(0.5rem, env(safe-area-inset-bottom, 0px)))',
        left: '1rem',
        right: '1rem',
      }}
    >
        <AnimatePresence>
          <motion.div
            className="pointer-events-auto"
            initial={{ y: 100, opacity: 0, scale: 0.9 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 100, opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
          <motion.div
            className="flex items-center backdrop-blur-xl rounded-2xl px-3 py-2 sm:px-4 sm:py-3 gap-2 sm:gap-4 min-w-0"
            style={{
              backgroundColor: 'rgb(var(--tts-surface-glass))',
              border: '1px solid rgb(var(--tts-border) / 0.2)',
              boxShadow: `
                0 8px 32px rgb(var(--tts-shadow) / 0.12),
                0 4px 16px rgb(var(--tts-shadow) / 0.08),
                0 2px 8px rgb(var(--tts-shadow) / 0.04),
                inset 0 1px 0 rgb(255 255 255 / 0.1)
              `
            }}
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.4, ease: [0.25, 1, 0.5, 1] }}
          >
            {/* Article Title */}
            <div 
              className="text-xs sm:text-sm font-semibold truncate max-w-24 sm:max-w-32 md:max-w-48 flex-shrink-0 tracking-tight"
              style={{ color: 'rgb(var(--tts-control-fg))' }}
            >
              {currentArticle?.title || "Article"}
            </div>

            {/* Real-time Audio Visualization */}
            <div 
              className="flex items-center gap-0.5 sm:gap-1 h-6 sm:h-8 flex-shrink-0 px-1"
              style={{
                background: `radial-gradient(ellipse at center, rgb(var(--tts-accent-glow)), transparent 70%)`,
              }}
            >
              {audioData.map((intensity, i) => {
                const height = Math.max(0.15, intensity) // Minimum height
                const maxHeight = 20 // Responsive max height (smaller on mobile)
                const baseOpacity = isPlaying ? 0.8 : isLoading ? 0.4 : 0.25
                const dynamicOpacity = isPlaying ? baseOpacity + (intensity * 0.2) : baseOpacity
                
                return (
                  <motion.div
                    key={i}
                    className="w-0.5 sm:w-1 rounded-full"
                    style={{
                      height: `${height * maxHeight}px`,
                      background: `linear-gradient(to top, rgb(var(--tts-accent)), rgb(var(--tts-accent)) 60%, rgb(var(--tts-accent) / 0.6))`,
                      opacity: dynamicOpacity,
                      boxShadow: isPlaying ? `0 0 ${intensity * 8}px rgb(var(--tts-accent) / 0.4)` : 'none'
                    }}
                    animate={{
                      height: `${height * maxHeight}px`,
                      opacity: isPlaying ? baseOpacity + (intensity * 0.2) : isLoading ? [0.25, 0.6, 0.25] : 0.25,
                      scale: isPlaying ? [1, 1 + (intensity * 0.1), 1] : 1
                    }}
                    transition={{
                      duration: isPlaying ? 0.1 : 1.2,
                      repeat: isLoading && !isPlaying ? Infinity : 0,
                      delay: isLoading ? i * 0.08 : 0,
                      ease: isPlaying ? "linear" : [0.4, 0, 0.2, 1]
                    }}
                  />
                )
              })}
            </div>

            {/* Progress Bar */}
            {duration > 0 && (
              <div 
                className="w-12 sm:w-16 h-1 rounded-full overflow-hidden flex-shrink-0"
                style={{ backgroundColor: 'rgb(var(--tts-control-bg))' }}
              >
                <motion.div
                  className="h-full rounded-full"
                  style={{ 
                    width: `${progress * 100}%`,
                    background: `linear-gradient(90deg, rgb(var(--tts-accent)), rgb(var(--tts-accent)) 80%, rgb(var(--tts-accent) / 0.8))`,
                    boxShadow: '0 0 4px rgb(var(--tts-accent) / 0.3)'
                  }}
                  animate={{ width: `${progress * 100}%` }}
                  transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
                />
              </div>
            )}

            {/* Time Display - Hidden on very small screens */}
            {duration > 0 && (
              <div 
                className="hidden sm:block text-xs font-mono min-w-[40px] flex-shrink-0 tabular-nums tracking-tight"
                style={{ color: 'rgb(var(--tts-control-fg-secondary))' }}
              >
                {Math.floor(currentTime / 60)}:{Math.floor(currentTime % 60).toString().padStart(2, '0')}
              </div>
            )}

            {/* Control Button */}
            <Button
              size="sm"
              variant="ghost"
              className="w-8 h-8 sm:w-10 sm:h-10 rounded-full p-0 min-w-0 shrink-0 transition-all duration-200"
              style={{
                backgroundColor: 'rgb(var(--tts-control-bg))',
                color: 'rgb(var(--tts-control-fg))',
                border: '1px solid rgb(var(--tts-border) / 0.3)',
                boxShadow: `
                  0 2px 8px rgb(var(--tts-shadow) / 0.1),
                  inset 0 1px 0 rgb(255 255 255 / 0.1)
                `
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgb(var(--tts-control-bg-hover))'
                e.currentTarget.style.transform = 'scale(1.05)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgb(var(--tts-control-bg))'
                e.currentTarget.style.transform = 'scale(1)'
              }}
              onMouseDown={(e) => {
                e.currentTarget.style.backgroundColor = 'rgb(var(--tts-control-bg-active))'
                e.currentTarget.style.transform = 'scale(0.95)'
              }}
              onMouseUp={(e) => {
                e.currentTarget.style.backgroundColor = 'rgb(var(--tts-control-bg-hover))'
                e.currentTarget.style.transform = 'scale(1.05)'
              }}
              onClick={(e) => handleTogglePlayback(e)}
              disabled={isLoading}
              aria-label={getAriaLabel()}
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={`${isLoading}-${isPlaying}-${isPaused}`}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  {getControlIcon()}
                </motion.div>
              </AnimatePresence>
            </Button>

            {/* Close Button */}
            <Button
              size="sm"
              variant="ghost"
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full p-0 min-w-0 shrink-0 transition-all duration-200"
              style={{
                backgroundColor: 'rgb(var(--tts-control-bg))',
                color: 'rgb(var(--tts-control-fg-secondary))',
                border: '1px solid rgb(var(--tts-border) / 0.3)',
                boxShadow: `
                  0 2px 8px rgb(var(--tts-shadow) / 0.1),
                  inset 0 1px 0 rgb(255 255 255 / 0.1)
                `
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgb(var(--tts-control-bg-hover))'
                e.currentTarget.style.color = 'rgb(var(--tts-control-fg))'
                e.currentTarget.style.transform = 'scale(1.05)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgb(var(--tts-control-bg))'
                e.currentTarget.style.color = 'rgb(var(--tts-control-fg-secondary))'
                e.currentTarget.style.transform = 'scale(1)'
              }}
              onMouseDown={(e) => {
                e.currentTarget.style.backgroundColor = 'rgb(var(--tts-control-bg-active))'
                e.currentTarget.style.transform = 'scale(0.95)'
              }}
              onMouseUp={(e) => {
                e.currentTarget.style.backgroundColor = 'rgb(var(--tts-control-bg-hover))'
                e.currentTarget.style.transform = 'scale(1.05)'
              }}
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                console.log('🌟 Global TTS HUD - Close button clicked')
                stop()
              }}
              aria-label="Stop and close"
            >
              <X className="w-3 h-3 sm:w-4 sm:h-4" />
            </Button>
          </motion.div>

          {/* Status Text */}
          {isLoading && (
            <motion.div
              className="text-center mt-1 sm:mt-2 text-xs font-medium tracking-tight"
              style={{ color: 'rgb(var(--tts-control-fg-secondary))' }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            >
              Preparing speech...
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}