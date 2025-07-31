"use client"

import React, { useState, useEffect, useRef, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Play, Pause, X } from "lucide-react"
import HeadphonesIcon from '@mui/icons-material/Headphones'
import PauseIcon from '@mui/icons-material/Pause'
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type TTSState = "idle" | "loading" | "playing" | "paused" | "finished"

interface TTSHUDProps {
  isVisible: boolean
  isLoading: boolean
  isPlaying: boolean
  isPaused: boolean
  articleTitle?: string
  onPlay: () => void
  onPause: () => void
  onResume: () => void
  onStop: () => void
}

export default function TTSHUD({
  isVisible,
  isLoading,
  isPlaying,
  isPaused,
  articleTitle = "Article",
  onPlay,
  onPause,
  onResume,
  onStop
}: TTSHUDProps) {
  // Debug logging
  React.useEffect(() => {
    console.log('🎯 TTS HUD Debug - Props:', { 
      isVisible, 
      isLoading, 
      isPlaying, 
      isPaused, 
      articleTitle 
    })
  }, [isVisible, isLoading, isPlaying, isPaused, articleTitle])
  const [audioData, setAudioData] = useState<number[]>(Array(6).fill(0))
  const [progress, setProgress] = useState(0)
  const animationRef = useRef<number>()

  const ROWS = 6
  const COLS = 28

  // Generate mock audio data for visualization
  const generateMockAudioData = useCallback((intensity = 0.5) => {
    return Array.from({ length: ROWS }, (_, i) => {
      const baseEnergy = Math.random() * intensity
      const frequencyBand = i / ROWS
      // Higher frequencies (top rows) typically have less energy in speech
      const frequencyWeight = 1 - frequencyBand * 0.6
      return Math.min(1, baseEnergy * frequencyWeight)
    })
  }, [])

  // Animation loop for real-time visualization
  const animate = useCallback(() => {
    if (isPlaying) {
      const newAudioData = generateMockAudioData(0.7 + Math.random() * 0.3)
      setAudioData(newAudioData)

      // Simulate progress (in a real implementation, this would be actual progress)
      setProgress((prev) => {
        const newProgress = prev + 0.005
        if (newProgress >= 1) {
          return 1
        }
        return newProgress
      })
    } else if (isLoading) {
      // Shimmer effect during loading
      const shimmerData = Array.from({ length: ROWS }, () => Math.random() * 0.4 + 0.1)
      setAudioData(shimmerData)
    } else if (isPaused) {
      // Gentle breathing animation when paused
      const time = Date.now() * 0.001
      const breathingData = Array.from({ length: ROWS }, () => 0.05 + Math.sin(time * 0.5) * 0.03)
      setAudioData(breathingData)
    } else {
      // Idle state - minimal activity
      const idleData = Array.from({ length: ROWS }, () => 0.02)
      setAudioData(idleData)
    }

    if (isVisible) {
      animationRef.current = requestAnimationFrame(animate)
    }
  }, [isVisible, isPlaying, isLoading, isPaused, generateMockAudioData])

  // Start animation loop when visible
  useEffect(() => {
    if (isVisible) {
      animationRef.current = requestAnimationFrame(animate)
    }
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [isVisible, animate])

  // Reset progress when not playing
  useEffect(() => {
    if (!isPlaying && !isPaused) {
      setProgress(0)
    }
  }, [isPlaying, isPaused])

  const handleTogglePlayback = () => {
    if (isPlaying) {
      onPause()
    } else if (isPaused) {
      onResume()
    } else {
      onPlay()
    }
  }

  // Generate dots with proper brightness and sweep effect
  const renderDots = () => {
    const dots = []
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const colProgress = col / COLS
        const energy = audioData[row] || 0

        // Progress sweep effect
        let sweepBoost = 0
        if (isPlaying && colProgress < progress) {
          sweepBoost = 0.25
        } else if (isLoading) {
          // Shimmer effect
          const shimmerPhase = (Date.now() * 0.01 + col * 0.1) % (Math.PI * 2)
          sweepBoost = Math.sin(shimmerPhase) * 0.2 + 0.2
        }

        const brightness = Math.min(1, energy + sweepBoost)
        const opacity = 0.1 + brightness * 0.9

        dots.push(
          <motion.div
            key={`${row}-${col}`}
            className="w-1.5 h-1.5 rounded-full bg-white"
            style={{ opacity }}
            animate={{ opacity }}
            transition={{ duration: 0.12, ease: "linear" }}
          />,
        )
      }
    }
    return dots
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

  console.log('🎯 TTS HUD - Render decision:', { isVisible, willRender: isVisible })

  if (!isVisible) {
    console.log('🎯 TTS HUD - Not rendering (not visible)')
    return null
  }

  console.log('🎯 TTS HUD - Rendering component')

  return (
    <AnimatePresence>
      <motion.div
        className="fixed bottom-16 left-1/2 transform -translate-x-1/2 z-[100]"
        initial={{ y: 100, opacity: 0, scale: 0.9 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 100, opacity: 0, scale: 0.9 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      >
        <motion.div
          className="flex items-center bg-gray-900/95 backdrop-blur-sm rounded-full px-4 py-3 gap-4 shadow-2xl border border-gray-700/50"
          initial={{ scale: 0.9 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          {/* Article Title */}
          <div className="text-white text-sm font-medium truncate max-w-32 md:max-w-48">
            {articleTitle}
          </div>

          {/* Dots Grid Visualizer */}
          <div
            className="grid gap-0.5"
            style={{
              gridTemplateColumns: `repeat(${COLS}, 6px)`,
              gridTemplateRows: `repeat(${ROWS}, 6px)`,
            }}
          >
            {renderDots()}
          </div>

          {/* Control Button */}
          <Button
            size="sm"
            variant="ghost"
            className="w-10 h-10 rounded-full bg-gray-800 hover:bg-gray-700 text-white p-0 min-w-0 shrink-0"
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
            className="w-8 h-8 rounded-full bg-gray-800 hover:bg-gray-700 text-white p-0 min-w-0 shrink-0"
            onClick={onStop}
            aria-label="Stop and close"
          >
            <X className="w-4 h-4" />
          </Button>
        </motion.div>

        {/* Optional Status Text */}
        {isLoading && (
          <motion.div
            className="text-center mt-2 text-xs text-gray-400"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            Preparing speech...
          </motion.div>
        )}
      </motion.div>
    </AnimatePresence>
  )
}