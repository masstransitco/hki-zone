"use client"

import React from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from "framer-motion"
import HeadphonesIcon from '@mui/icons-material/Headphones'
import PauseIcon from '@mui/icons-material/Pause'
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useSelector, useDispatch } from 'react-redux'
import { 
  selectTTSCurrentArticle,
  selectTTSPlaybackState,
  selectTTSProgress,
  selectTTSAudioData,
  selectTTSIsVisible,
  pausePlayback,
  resumePlayback,
  stopPlayback 
} from '@/store/ttsSlice'
import type { AppDispatch } from '@/store'

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
  const dispatch = useDispatch<AppDispatch>()
  
  // Redux selectors
  const currentArticle = useSelector(selectTTSCurrentArticle)
  const { isPlaying, isPaused, isLoading } = useSelector(selectTTSPlaybackState)
  const { progress, duration, currentTime } = useSelector(selectTTSProgress)
  const audioData = useSelector(selectTTSAudioData)
  const isVisible = useSelector(selectTTSIsVisible)
  
  // Portal container state
  const [portalContainer, setPortalContainer] = React.useState<HTMLElement | null>(null)

  // Initialize portal container on client side
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      setPortalContainer(getPortalContainer())
    }
  }, [])

  // isVisible is now handled by the selector

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
      dispatch(pausePlayback())
    } else if (isPaused) {
      console.log('🌟 Global TTS HUD - Resuming playback')
      dispatch(resumePlayback())
    }
  }

  const handleStopClick = () => {
    console.log('🌟 Global TTS HUD - Close button clicked')
    dispatch(stopPlayback())
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

  // Define theme-aware colors inline
  const ttsColors = {
    barColorStrong: 'rgba(255, 255, 255, 0.95)',
    barColorMedium: 'rgba(255, 255, 255, 0.75)',
    barColorWeak: 'rgba(255, 255, 255, 0.4)',
    barGlow: 'rgba(255, 255, 255, 0.6)',
    barGlowWeak: 'rgba(255, 255, 255, 0.3)',
    barHighlight: 'rgba(255, 255, 255, 0.4)',
    progressBg: 'rgba(255, 255, 255, 0.15)',
    progressGlow: 'rgba(255, 255, 255, 0.6)',
    // UI colors
    surfaceGlass: 'rgba(17, 24, 39, 0.8)', // gray-900 with opacity
    border: 'rgba(75, 85, 99, 0.3)', // gray-600 with opacity
    shadow: 'rgba(0, 0, 0, 1)',
    controlBg: 'rgba(55, 65, 81, 1)', // gray-700
    controlBgHover: 'rgba(75, 85, 99, 1)', // gray-600
    controlBgActive: 'rgba(31, 41, 55, 1)', // gray-800
    controlFg: 'rgba(255, 255, 255, 1)',
    controlFgSecondary: 'rgba(156, 163, 175, 1)', // gray-400
  }

  const hudContent = (
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
            className="flex items-center backdrop-blur-xl rounded-2xl px-4 py-3 gap-3 sm:gap-4 min-w-0"
            style={{
              backgroundColor: ttsColors.surfaceGlass,
              border: `1px solid ${ttsColors.border}`,
              boxShadow: `
                0 12px 40px rgba(0, 0, 0, 0.15),
                0 6px 20px rgba(0, 0, 0, 0.1),
                0 3px 10px rgba(0, 0, 0, 0.05),
                inset 0 1px 0 rgba(255, 255, 255, 0.1),
                inset 0 -1px 0 rgba(0, 0, 0, 0.1)
              `,
              pointerEvents: 'auto',
              isolation: 'isolate',
            }}
            initial={{ scale: 0.9, y: 10 }}
            animate={{ scale: 1, y: 0 }}
            transition={{ 
              duration: 0.5, 
              ease: [0.25, 1, 0.5, 1],
              type: "spring",
              stiffness: 300,
              damping: 25
            }}
          >
            {/* Article Title */}
            <div 
              className="text-xs sm:text-sm font-semibold truncate max-w-24 sm:max-w-32 md:max-w-48 flex-shrink-0 tracking-tight"
              style={{ color: ttsColors.controlFg }}
            >
              {currentArticle?.title || "Article"}
            </div>

            {/* Advanced Waveform Visualization */}
            <div 
              className="flex items-end gap-0.5 h-7 sm:h-9 flex-shrink-0 px-3"
              style={{
                position: 'relative',
                minWidth: '80px',
              }}
            >
              {Array.from({ length: 16 }, (_, i) => {
                // Create 16 bars for better waveform representation
                const intensity = audioData[Math.floor(i * audioData.length / 16)] || 0
                
                // Speech-specific frequency modeling
                const normalizedIndex = i / 15
                const speechWeight = Math.exp(-Math.pow((normalizedIndex - 0.4) * 3, 2)) // Peak around human speech freq
                const baseHeight = 0.15 + (speechWeight * 0.3)
                
                // Height calculation with speech characteristics
                let barHeight = baseHeight
                if (isPlaying) {
                  // Simulate speech patterns with consonant/vowel variations
                  const speechPattern = Math.sin(Date.now() * 0.001 + i * 0.5) * 0.1 + intensity
                  barHeight = Math.max(0.1, Math.min(1, baseHeight + speechPattern * speechWeight))
                } else if (isLoading) {
                  // Synthesis shimmer effect
                  const shimmerPhase = (Date.now() * 0.003 + i * 0.2) % (Math.PI * 2)
                  barHeight = baseHeight + Math.sin(shimmerPhase) * 0.15
                } else if (isPaused) {
                  // Breathing animation
                  const breathPhase = Date.now() * 0.0008
                  barHeight = baseHeight + Math.sin(breathPhase) * 0.05
                }
                
                const maxHeight = 28 // Taller for better visual impact
                const barPixelHeight = barHeight * maxHeight
                
                // Visual properties
                const isVoiceRange = i >= 4 && i <= 11 // Primary speech frequencies
                const barWidth = isVoiceRange ? 2.5 : 2
                const opacity = isPlaying ? 0.9 : isLoading ? 0.4 : isPaused ? 0.3 : 0.2
                
                // Progress sweep effect
                let progressBoost = 0
                if (isPlaying && (i / 16) <= progress) {
                  progressBoost = 0.3
                }
                
                return (
                  <motion.div
                    key={i}
                    className="rounded-full relative"
                    style={{
                      width: `${barWidth}px`,
                      height: `${barPixelHeight}px`,
                      background: `linear-gradient(to top, 
                        ${ttsColors.barColorStrong},
                        ${ttsColors.barColorMedium} 60%,
                        ${ttsColors.barColorWeak}
                      )`,
                      boxShadow: `
                        0 0 ${(intensity + progressBoost) * 15}px ${ttsColors.barGlow},
                        0 1px 3px rgba(0, 0, 0, 0.2),
                        inset 0 -1px 1px ${ttsColors.barHighlight}
                      `,
                      opacity: opacity + progressBoost * 0.3,
                      transformOrigin: 'bottom center',
                    }}
                    animate={{
                      height: `${barPixelHeight}px`,
                      opacity: opacity + progressBoost * 0.3,
                      scaleY: isPlaying ? 1 + (intensity * 0.1) : 1,
                    }}
                    transition={{
                      height: {
                        type: "spring",
                        stiffness: 200,
                        damping: isPlaying ? 12 : 25,
                        mass: 0.2,
                      },
                      opacity: {
                        duration: 0.1,
                      },
                      scaleY: {
                        duration: 0.08,
                        ease: "easeOut",
                      }
                    }}
                  />
                )
              })}
              
              {/* Enhanced ambient glow */}
              {(isPlaying || isLoading) && (
                <motion.div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background: `radial-gradient(ellipse 120% 100% at center bottom, 
                      ${ttsColors.barGlow}, 
                      transparent 60%
                    )`,
                    filter: 'blur(12px)',
                    opacity: isPlaying ? 0.4 : 0.2,
                  }}
                  animate={{
                    opacity: isPlaying ? [0.3, 0.6, 0.3] : [0.1, 0.3, 0.1],
                    scale: [1, 1.05, 1],
                  }}
                  transition={{
                    duration: isPlaying ? 1.5 : 2.5,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                />
              )}
              
              {/* Progress overlay */}
              {isPlaying && progress > 0 && (
                <motion.div
                  className="absolute bottom-0 left-3 h-full pointer-events-none"
                  style={{
                    width: `${Math.max(0, (progress * 80) - 6)}px`,
                    background: `linear-gradient(90deg, transparent, ${ttsColors.progressGlow} 80%, transparent)`,
                    borderRadius: '2px',
                    opacity: 0.6,
                  }}
                  animate={{
                    width: `${Math.max(0, (progress * 80) - 6)}px`,
                  }}
                  transition={{
                    duration: 0.3,
                    ease: "easeOut",
                  }}
                />
              )}
            </div>

            {/* Circular Progress Indicator */}
            {duration > 0 && (
              <div 
                className="relative flex-shrink-0 w-6 h-6 sm:w-8 sm:h-8"
                style={{
                  transform: 'rotate(-90deg)', // Start from top
                }}
              >
                {/* Background circle */}
                <svg className="w-full h-full" viewBox="0 0 36 36">
                  <circle
                    cx="18"
                    cy="18"
                    r="16"
                    fill="none"
                    stroke={ttsColors.progressBg}
                    strokeWidth="2"
                    opacity="0.3"
                  />
                  {/* Progress circle */}
                  <motion.circle
                    cx="18"
                    cy="18"
                    r="16"
                    fill="none"
                    stroke={ttsColors.barColorStrong}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 16}`}
                    style={{
                      filter: `drop-shadow(0 0 4px ${ttsColors.barGlow})`,
                    }}
                    animate={{
                      strokeDashoffset: `${2 * Math.PI * 16 * (1 - progress)}`,
                    }}
                    transition={{
                      duration: 0.3,
                      ease: "easeOut",
                    }}
                  />
                </svg>
                
                {/* Center indicator */}
                <motion.div
                  className="absolute inset-0 flex items-center justify-center"
                  style={{
                    transform: 'rotate(90deg)', // Counteract parent rotation
                  }}
                >
                  <div
                    className="w-1.5 h-1.5 rounded-full"
                    style={{
                      backgroundColor: ttsColors.barColorStrong,
                      boxShadow: `0 0 4px ${ttsColors.barGlow}`,
                    }}
                  />
                </motion.div>
              </div>
            )}

            {/* Time Display - Hidden on very small screens */}
            {duration > 0 && (
              <div 
                className="hidden sm:block text-xs font-mono min-w-[40px] flex-shrink-0 tabular-nums tracking-tight"
                style={{ color: ttsColors.controlFgSecondary }}
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
                backgroundColor: ttsColors.controlBg,
                color: ttsColors.controlFg,
                border: `1px solid ${ttsColors.border}`,
                boxShadow: `
                  0 2px 8px rgba(0, 0, 0, 0.1),
                  inset 0 1px 0 rgba(255, 255, 255, 0.1)
                `,
                // Better touch target size for mobile
                minHeight: '44px', // iOS recommended touch target
                minWidth: '44px',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = ttsColors.controlBgHover
                e.currentTarget.style.transform = 'scale(1.05)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = ttsColors.controlBg
                e.currentTarget.style.transform = 'scale(1)'
              }}
              onMouseDown={(e) => {
                e.currentTarget.style.backgroundColor = ttsColors.controlBgActive
                e.currentTarget.style.transform = 'scale(0.95)'
              }}
              onMouseUp={(e) => {
                e.currentTarget.style.backgroundColor = ttsColors.controlBgHover
                e.currentTarget.style.transform = 'scale(1.05)'
              }}
              // Mobile touch events for better responsiveness
              onTouchStart={(e) => {
                e.currentTarget.style.backgroundColor = ttsColors.controlBgActive
                e.currentTarget.style.transform = 'scale(0.95)'
              }}
              onTouchEnd={(e) => {
                e.currentTarget.style.backgroundColor = ttsColors.controlBg
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
                backgroundColor: ttsColors.controlBg,
                color: ttsColors.controlFgSecondary,
                border: `1px solid ${ttsColors.border}`,
                boxShadow: `
                  0 2px 8px rgba(0, 0, 0, 0.1),
                  inset 0 1px 0 rgba(255, 255, 255, 0.1)
                `,
                // Better touch target size for mobile
                minHeight: '44px', // iOS recommended touch target
                minWidth: '44px',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = ttsColors.controlBgHover
                e.currentTarget.style.color = ttsColors.controlFg
                e.currentTarget.style.transform = 'scale(1.05)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = ttsColors.controlBg
                e.currentTarget.style.color = ttsColors.controlFgSecondary
                e.currentTarget.style.transform = 'scale(1)'
              }}
              onMouseDown={(e) => {
                e.currentTarget.style.backgroundColor = ttsColors.controlBgActive
                e.currentTarget.style.transform = 'scale(0.95)'
              }}
              onMouseUp={(e) => {
                e.currentTarget.style.backgroundColor = ttsColors.controlBgHover
                e.currentTarget.style.transform = 'scale(1.05)'
              }}
              // Mobile touch events for better responsiveness
              onTouchStart={(e) => {
                e.currentTarget.style.backgroundColor = ttsColors.controlBgActive
                e.currentTarget.style.transform = 'scale(0.95)'
              }}
              onTouchEnd={(e) => {
                e.currentTarget.style.backgroundColor = ttsColors.controlBg
                e.currentTarget.style.color = ttsColors.controlFgSecondary
                e.currentTarget.style.transform = 'scale(1)'
              }}
              onClick={handleStopClick}
              aria-label="Stop and close"
            >
              <X className="w-3 h-3 sm:w-4 sm:h-4" />
            </Button>
          </motion.div>

          {/* Enhanced Status Text */}
          {(isLoading || (isPlaying && currentArticle)) && (
            <motion.div
              className="text-center mt-2 text-xs font-medium tracking-tight"
              style={{ color: ttsColors.controlFgSecondary }}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ delay: 0.3, duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
            >
              {isLoading && "Synthesizing speech..."}
              {isPlaying && duration > 0 && (
                <span className="inline-flex items-center gap-1">
                  <span className="w-1 h-1 bg-current rounded-full animate-pulse" />
                  {Math.floor(currentTime / 60)}:{Math.floor(currentTime % 60).toString().padStart(2, '0')} / {Math.floor(duration / 60)}:{Math.floor(duration % 60).toString().padStart(2, '0')}
                </span>
              )}
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )

  // Render HUD content through portal
  return createPortal(hudContent, portalContainer)
}