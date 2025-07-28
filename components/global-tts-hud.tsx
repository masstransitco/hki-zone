"use client"

import React from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from "framer-motion"
import HeadphonesIcon from '@mui/icons-material/Headphones'
import PauseIcon from '@mui/icons-material/Pause'
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useTTSContext } from '@/contexts/tts-context'

// Portal container management
const getPortalContainer = () => {
  const existingContainer = document.getElementById('tts-hud-portal')
  if (existingContainer) {
    return existingContainer
  }
  
  // Create portal container
  const container = document.createElement('div')
  container.id = 'tts-hud-portal'
  container.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    pointer-events: none;
    z-index: 9999;
  `
  document.body.appendChild(container)
  return container
}

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
  
  // Portal container state
  const [portalContainer, setPortalContainer] = React.useState<HTMLElement | null>(null)

  // Initialize portal container on client side
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      setPortalContainer(getPortalContainer())
    }
  }, [])

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

  const handleTogglePlayback = () => {
    console.log('🌟 Global TTS HUD - Toggle playback clicked', { isPlaying, isPaused })
    
    if (isPlaying) {
      console.log('🌟 Global TTS HUD - Pausing playback')
      pause()
    } else if (isPaused) {
      console.log('🌟 Global TTS HUD - Resuming playback')
      resume()
    }
  }

  const handleStopClick = () => {
    console.log('🌟 Global TTS HUD - Close button clicked')
    stop()
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

  if (!isVisible || !portalContainer) {
    return null
  }

  const hudContent = (
    <>
      <style jsx global>{`
        :root {
          /* Light mode colors */
          --tts-bar-color-strong: rgba(0, 0, 0, 0.8);
          --tts-bar-color-medium: rgba(0, 0, 0, 0.6);
          --tts-bar-color-weak: rgba(0, 0, 0, 0.2);
          --tts-bar-glow: rgba(0, 0, 0, 0.3);
          --tts-bar-glow-weak: rgba(0, 0, 0, 0.15);
          --tts-bar-highlight: rgba(255, 255, 255, 0.2);
          --tts-progress-bg: rgba(0, 0, 0, 0.1);
          --tts-progress-fill: linear-gradient(90deg, rgba(0, 0, 0, 0.9), rgba(0, 0, 0, 0.7));
          --tts-progress-glow: rgba(0, 0, 0, 0.3);
          --tts-progress-highlight: rgba(255, 255, 255, 0.3);
        }
        
        .dark {
          /* Dark mode colors */
          --tts-bar-color-strong: rgba(255, 255, 255, 0.9);
          --tts-bar-color-medium: rgba(255, 255, 255, 0.7);
          --tts-bar-color-weak: rgba(255, 255, 255, 0.3);
          --tts-bar-glow: rgba(255, 255, 255, 0.5);
          --tts-bar-glow-weak: rgba(255, 255, 255, 0.25);
          --tts-bar-highlight: rgba(255, 255, 255, 0.3);
          --tts-progress-bg: rgba(255, 255, 255, 0.1);
          --tts-progress-fill: linear-gradient(90deg, rgba(255, 255, 255, 0.9), rgba(255, 255, 255, 0.7));
          --tts-progress-glow: rgba(255, 255, 255, 0.5);
          --tts-progress-highlight: rgba(255, 255, 255, 0.3);
        }
      `}</style>
      
      <div 
        className="flex justify-center"
        style={{
          // Position above footer nav (76px) with 0.5rem spacing
          position: 'fixed',
          bottom: 'calc(76px + max(0.5rem, env(safe-area-inset-bottom, 0px)))',
          left: '1rem',
          right: '1rem',
          pointerEvents: 'auto', // Enable pointer events since we're in a portal
        }}
      >
        <AnimatePresence>
          <motion.div
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
              `,
              pointerEvents: 'auto',
              isolation: 'isolate',
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
              className="flex items-center gap-0.5 sm:gap-1 h-6 sm:h-8 flex-shrink-0 px-2"
              style={{
                position: 'relative',
              }}
            >
              {audioData.map((intensity, i) => {
                // Natural height scaling with speech emphasis
                const normalizedHeight = Math.pow(intensity, 0.8) // Logarithmic scaling for natural feel
                const minHeight = 0.2
                const height = Math.max(minHeight, normalizedHeight)
                const maxHeight = 24 // Taller bars for better visual impact
                
                // Dynamic properties based on frequency band
                const isLowFreq = i < 2 // Bass frequencies (voice fundamental)
                const isMidFreq = i >= 2 && i < 4 // Voice formants
                const bandWeight = isLowFreq ? 1.2 : isMidFreq ? 1.0 : 0.8
                
                // Opacity and glow based on activity
                const baseOpacity = isPlaying ? 0.9 : isLoading ? 0.3 : 0.2
                const glowIntensity = isPlaying ? intensity * 20 : 0
                const illumination = isPlaying ? intensity * 0.5 : 0
                
                return (
                  <motion.div
                    key={i}
                    className="rounded-full relative"
                    style={{
                      width: `${isLowFreq ? 1.5 : 1}px`,
                      height: `${height * maxHeight * bandWeight}px`,
                      // Theme-aware gradient
                      background: `linear-gradient(to top, 
                        var(--tts-bar-color-strong),
                        var(--tts-bar-color-medium) 50%,
                        var(--tts-bar-color-weak)
                      )`,
                      // Theme-aware shadows
                      boxShadow: `
                        0 0 ${glowIntensity}px var(--tts-bar-glow),
                        0 0 ${glowIntensity * 0.5}px var(--tts-bar-glow-weak),
                        0 2px 4px rgba(0, 0, 0, 0.2),
                        inset 0 -1px 1px var(--tts-bar-highlight)
                      `,
                      opacity: baseOpacity,
                      transformOrigin: 'bottom center',
                    }}
                    animate={{
                      height: `${height * maxHeight * bandWeight}px`,
                      opacity: isPlaying 
                        ? baseOpacity + (intensity * 0.1) 
                        : isLoading 
                          ? [0.2, 0.5, 0.2] 
                          : 0.2,
                      scaleY: isPlaying ? 1 + (intensity * 0.05) : 1,
                      scaleX: isPlaying ? 1 + (intensity * 0.1) : 1,
                    }}
                    transition={{
                      height: {
                        type: "spring",
                        stiffness: 120,
                        damping: isPlaying ? 8 : 20,
                        mass: 0.1,
                      },
                      opacity: {
                        duration: isPlaying ? 0.05 : 1.5,
                        repeat: isLoading && !isPlaying ? Infinity : 0,
                        delay: isLoading ? i * 0.1 : 0,
                      },
                      scale: {
                        duration: 0.1,
                        ease: "linear",
                      }
                    }}
                  />
                )
              })}
              
              {/* Ambient glow layer */}
              {isPlaying && (
                <motion.div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background: `radial-gradient(ellipse at center bottom, 
                      var(--tts-bar-glow), 
                      transparent 70%
                    )`,
                    filter: 'blur(8px)',
                    opacity: audioData.reduce((a, b) => a + b, 0) / audioData.length * 0.5,
                  }}
                  animate={{
                    opacity: [0.5, 0.8, 0.5],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                />
              )}
            </div>

            {/* Progress Bar */}
            {duration > 0 && (
              <div 
                className="w-12 sm:w-16 h-1 rounded-full overflow-hidden flex-shrink-0"
                style={{ 
                  backgroundColor: 'var(--tts-progress-bg)',
                  boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.2)'
                }}
              >
                <motion.div
                  className="h-full rounded-full relative"
                  style={{ 
                    width: `${progress * 100}%`,
                    background: 'var(--tts-progress-fill)',
                    boxShadow: `
                      0 0 8px var(--tts-progress-glow),
                      inset 0 1px 1px var(--tts-progress-highlight)
                    `
                  }}
                  animate={{ width: `${progress * 100}%` }}
                  transition={{ 
                    duration: 0.3,
                    ease: [0.25, 0.46, 0.45, 0.94]
                  }}
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
                `,
                // Better touch target size for mobile
                minHeight: '44px', // iOS recommended touch target
                minWidth: '44px',
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
              // Mobile touch events for better responsiveness
              onTouchStart={(e) => {
                e.currentTarget.style.backgroundColor = 'rgb(var(--tts-control-bg-active))'
                e.currentTarget.style.transform = 'scale(0.95)'
              }}
              onTouchEnd={(e) => {
                e.currentTarget.style.backgroundColor = 'rgb(var(--tts-control-bg))'
                e.currentTarget.style.transform = 'scale(1)'
              }}
              onClick={handleTogglePlayback}
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
                `,
                // Better touch target size for mobile
                minHeight: '44px', // iOS recommended touch target
                minWidth: '44px',
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
              // Mobile touch events for better responsiveness
              onTouchStart={(e) => {
                e.currentTarget.style.backgroundColor = 'rgb(var(--tts-control-bg-active))'
                e.currentTarget.style.transform = 'scale(0.95)'
              }}
              onTouchEnd={(e) => {
                e.currentTarget.style.backgroundColor = 'rgb(var(--tts-control-bg))'
                e.currentTarget.style.color = 'rgb(var(--tts-control-fg-secondary))'
                e.currentTarget.style.transform = 'scale(1)'
              }}
              onClick={handleStopClick}
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
    </>
  )

  // Render HUD content through portal
  return createPortal(hudContent, portalContainer)
}