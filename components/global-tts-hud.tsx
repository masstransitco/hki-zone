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
  // HUD state tracking (debug logging removed)

  const handleTogglePlayback = () => {
    if (isPlaying) {
      dispatch(pausePlayback())
    } else if (isPaused) {
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

  // Theme-aware colors using CSS variables
  const ttsColors = {
    // Apple-inspired accent colors for visualization
    barColorStrong: 'rgb(var(--tts-accent))',
    barColorMedium: 'rgb(var(--tts-accent) / 0.8)',
    barColorWeak: 'rgb(var(--tts-accent) / 0.5)',
    barGlow: 'rgb(var(--tts-accent-glow))',
    barGlowStrong: 'rgb(var(--tts-accent) / 0.4)',
    barHighlight: 'rgb(var(--tts-accent) / 0.3)',
    
    // Neutral colors for UI elements
    progressGlow: 'rgb(var(--tts-control-fg) / 0.3)',
    borderActive: 'rgb(var(--tts-control-fg) / 0.4)',
    borderGlow: 'rgb(var(--tts-control-fg) / 0.15)',
    
    // UI surface colors
    surfaceGlass: 'rgb(var(--tts-surface-glass))',
    surfaceElevated: 'rgb(var(--tts-surface-elevated))',
    border: 'rgb(var(--tts-border) / 0.3)',
    shadow: 'rgb(var(--tts-shadow))',
    
    // Control colors
    controlBg: 'rgb(var(--tts-control-bg))',
    controlBgHover: 'rgb(var(--tts-control-bg-hover))',
    controlBgActive: 'rgb(var(--tts-control-bg-active))',
    controlFg: 'rgb(var(--tts-control-fg))',
    controlFgSecondary: 'rgb(var(--tts-control-fg-secondary))',
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
              border: `1px solid ${isPlaying ? ttsColors.borderActive : ttsColors.border}`,
              boxShadow: `
                0 10px 30px ${ttsColors.shadow},
                0 4px 12px ${ttsColors.shadow},
                0 2px 4px ${ttsColors.shadow},
                ${isPlaying ? `0 0 20px ${ttsColors.borderGlow},` : ''}
                inset 0 1px 0 rgba(255, 255, 255, 0.08)
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
                // Enhanced frequency band mapping for better visual distribution
                const frequencyBands = [
                  0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 5, 5, 4, 3
                ] // Map bars to 6 audio data points with emphasis on mid frequencies
                
                const dataIndex = frequencyBands[i]
                const intensity = audioData[dataIndex] || 0
                
                // Enhanced speech frequency modeling with better distribution
                const normalizedIndex = i / 15
                // Create multiple peaks for better visual balance
                const speechWeight1 = Math.exp(-Math.pow((normalizedIndex - 0.25) * 4, 2)) // Low-mid peak
                const speechWeight2 = Math.exp(-Math.pow((normalizedIndex - 0.5) * 3, 2))  // Mid peak
                const speechWeight3 = Math.exp(-Math.pow((normalizedIndex - 0.75) * 4, 2)) // High-mid peak
                const combinedWeight = (speechWeight1 * 0.7 + speechWeight2 + speechWeight3 * 0.8) / 2.5
                
                // Minimum heights for better visibility
                const minHeight = 0.2
                const baseHeight = minHeight + (combinedWeight * 0.4)
                
                // Height calculation with enhanced motion
                let barHeight = baseHeight
                if (isPlaying) {
                  // Complex wave patterns for more interesting motion
                  const time = Date.now() * 0.001
                  const wave1 = Math.sin(time * 1.5 + i * 0.3) * 0.15
                  const wave2 = Math.sin(time * 2.3 + i * 0.7) * 0.1
                  const wave3 = Math.cos(time * 0.8 + i * 0.5) * 0.08
                  
                  // Combine waves with intensity for organic motion
                  const combinedWave = (wave1 + wave2 + wave3) * (0.5 + intensity * 0.5)
                  const speechModulation = intensity * combinedWeight * 0.8
                  
                  barHeight = Math.max(minHeight, Math.min(1, baseHeight + speechModulation + combinedWave))
                } else if (isLoading) {
                  // Enhanced shimmer with traveling wave
                  const shimmerPhase = (Date.now() * 0.004 + i * 0.3) % (Math.PI * 2)
                  const shimmerWave = Math.sin(shimmerPhase) * 0.2 + Math.sin(shimmerPhase * 2) * 0.1
                  barHeight = baseHeight + shimmerWave
                } else if (isPaused) {
                  // Gentle breathing with phase offset
                  const breathPhase = Date.now() * 0.001 + i * 0.15
                  barHeight = baseHeight + Math.sin(breathPhase) * 0.08
                }
                
                const maxHeight = 32 // Slightly taller for better visual impact
                const barPixelHeight = barHeight * maxHeight
                
                // Visual properties with enhanced variation
                const isVoiceRange = i >= 3 && i <= 12 // Wider voice range
                const barWidth = isVoiceRange ? 2.8 : 2.2
                const baseOpacity = isPlaying ? 0.85 : isLoading ? 0.5 : isPaused ? 0.35 : 0.25
                const opacity = baseOpacity + (intensity * 0.15)
                
                // Progress sweep effect
                let progressBoost = 0
                if (isPlaying && (i / 16) <= progress) {
                  progressBoost = 0.25
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
                        0 0 ${(intensity + progressBoost) * 20}px ${isPlaying ? ttsColors.barGlowStrong : ttsColors.barGlow},
                        0 1px 3px rgba(0, 0, 0, 0.1),
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
                      ${isPlaying ? ttsColors.barGlowStrong : ttsColors.barGlow}, 
                      transparent 60%
                    )`,
                    filter: 'blur(16px)',
                    opacity: isPlaying ? 0.6 : 0.3,
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
                  className="absolute bottom-0 left-0 h-full pointer-events-none"
                  style={{
                    width: `${progress * 100}%`,
                    background: `linear-gradient(90deg, transparent, ${ttsColors.progressGlow} 50%, transparent)`,
                    borderRadius: '2px',
                    opacity: 0.5,
                  }}
                  animate={{
                    width: `${progress * 100}%`,
                  }}
                  transition={{
                    duration: 0.3,
                    ease: "easeOut",
                  }}
                />
              )}
            </div>


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
                  0 2px 6px ${ttsColors.shadow},
                  inset 0 1px 0 rgba(255, 255, 255, 0.05)
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
                  0 2px 6px ${ttsColors.shadow},
                  inset 0 1px 0 rgba(255, 255, 255, 0.05)
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