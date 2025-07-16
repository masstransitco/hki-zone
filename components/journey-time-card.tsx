"use client"

import React, { useState, useEffect } from 'react'
import { Clock, TrendingUp, TrendingDown } from 'lucide-react'

type RouteType = 'expressway' | 'trunk' | 'local' | 'temp'

interface JourneyTimeCardProps {
  from: string
  to: string
  timeMin: number
  trendMin: number
  colourId: 1 | 2 | 3
  capture: string
  locale?: 'en' | 'zh'
  routeType?: RouteType
  onRouteClick?: (from: string, to: string) => void
}

// Hong Kong road signage color system with fixed heights
const routeTypeColors = {
  expressway: {
    border: 'border-green-700',
    bg: 'bg-green-700 dark:bg-green-800',
    text: 'text-white',
    accent: '#2e7d32', // deep motorway-green
    height: 'h-32' // Largest - most important roads
  },
  trunk: {
    border: 'border-blue-700', 
    bg: 'bg-blue-700 dark:bg-blue-800',
    text: 'text-white',
    accent: '#1565c0', // deep trunk-blue
    height: 'h-28' // Medium-large - major roads
  },
  local: {
    border: 'border-gray-500',
    bg: 'bg-gray-600 dark:bg-gray-700', 
    text: 'text-white',
    accent: '#9e9e9e', // medium grey
    height: 'h-24' // Medium - local roads
  },
  temp: {
    border: 'border-amber-600',
    bg: 'bg-amber-600 dark:bg-amber-700',
    text: 'text-white',
    accent: '#f9a825', // amber for alerts
    height: 'h-20' // Smallest - temporary/alert routes
  }
}

// Journey time-based colors for the animating pill
const getJourneyTimeColor = (timeMin: number) => {
  if (timeMin <= 10) return 'bg-green-500' // Fast - green
  if (timeMin <= 20) return 'bg-orange-500' // Moderate - orange  
  return 'bg-red-500' // Slow - red
}

// Journey time-based text colors for the time display
const getJourneyTimeTextColor = (timeMin: number) => {
  if (timeMin <= 10) return 'text-white' // Fast - white text
  if (timeMin <= 20) return 'text-orange-500' // Moderate - orange text  
  return 'text-red-500' // Slow - red text
}


const routeTypeIcons = {
  expressway: (
    <svg xmlns="http://www.w3.org/2000/svg" height="14px" viewBox="0 -960 960 960" width="14px" fill="currentColor">
      <path d="M80-513v-83q99-24 198.5-34T480-640q102 0 201.5 10T880-596v83q-20-5-40-9l-40-8v130h-80v-144q-60-8-120-12t-120-4q-60 0-120 3.5T240-545v145h-80v-131q-20 4-40 8.5T80-513Zm160 393 58-351q18-2 41-3.5t41-2.5l-60 357h-80Zm120-720h80l-20 119q-18 1-40.5 2.5T339-715l21-125Zm80 720h80v-160h-80v160Zm0-240h80v-119h-80v119Zm80-480h80l21 125q-18-1-40.5-3t-40.5-3l-20-119Zm120 720-60-357q18 1 41 3t41 4l58 350h-80Z"/>
    </svg>
  ),
  trunk: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12.7486 5.75C12.7486 5.33579 12.4128 5 11.9986 5C11.5844 5 11.2486 5.33579 11.2486 5.75V7.3125C11.2486 7.72671 11.5844 8.0625 11.9986 8.0625C12.4128 8.0625 12.7486 7.72671 12.7486 7.3125V5.75Z" fill="currentColor"/>
      <path d="M12.7486 10.4375C12.7486 10.0233 12.4128 9.6875 11.9986 9.6875C11.5844 9.6875 11.2486 10.0233 11.2486 10.4375L11.2486 13.5625C11.2486 13.9767 11.5844 14.3125 11.9986 14.3125C12.4128 14.3125 12.7486 13.9767 12.7486 13.5625V10.4375Z" fill="currentColor"/>
      <path d="M12.7486 16.6875C12.7486 16.2733 12.4128 15.9375 11.9986 15.9375C11.5844 15.9375 11.2486 16.2733 11.2486 16.6875V18.25C11.2486 18.6642 11.5844 19 11.9986 19C12.4128 19 12.7486 18.6642 12.7486 18.25V16.6875Z" fill="currentColor"/>
      <path fillRule="evenodd" clipRule="evenodd" d="M7.3819 2C6.20977 2 5.23399 2.89987 5.13926 4.06816L3.88251 19.5682C3.77629 20.8782 4.81081 22 6.12515 22H17.8721C19.1864 22 20.2209 20.8782 20.1147 19.5682L18.8579 4.06816C18.7632 2.89986 17.7874 2 16.6153 2H7.3819ZM6.63436 4.18939C6.66593 3.79996 6.99119 3.5 7.3819 3.5H16.6153C17.006 3.5 17.3313 3.79995 17.3628 4.18939L18.6196 19.6894C18.655 20.1261 18.3102 20.5 17.8721 20.5H6.12515C5.68703 20.5 5.34219 20.1261 5.3776 19.6894L6.63436 4.18939Z" fill="currentColor"/>
    </svg>
  ),
  local: (
    <svg xmlns="http://www.w3.org/2000/svg" height="14px" viewBox="0 -960 960 960" width="14px" fill="currentColor">
      <path d="M480-240q26 0 43-17t17-43q0-26-17-43t-43-17q-26 0-43 17t-17 43q0 26 17 43t43 17Zm0-180q26 0 43-17t17-43q0-26-17-43t-43-17q-26 0-43 17t-17 43q0 26 17 43t43 17Zm0-180q26 0 43-17t17-43q0-26-17-43t-43-17q-26 0-43 17t-17 43q0 26 17 43t43 17ZM280-360v-46q-51-14-85.5-56T160-560h120v-46q-51-14-85.5-56T160-760h120q0-33 23.5-56.5T360-840h240q33 0 56.5 23.5T680-760h120q0 56-34.5 98T680-606v46h120q0 56-34.5 98T680-406v46h120q0 56-34.5 98T680-206v6q0 33-23.5 56.5T600-120H360q-33 0-56.5-23.5T280-200v-6q-51-14-85.5-56T160-360h120Zm80 160h240v-560H360v560Zm0 0v-560 560Z"/>
    </svg>
  ),
  temp: (
    <svg xmlns="http://www.w3.org/2000/svg" height="14px" viewBox="0 -960 960 960" width="14px" fill="currentColor">
      <path d="M480-240q100 0 170-70t70-170q0-100-70-170t-170-70q-100 0-170 70t-70 170q0 100 70 170t170 70ZM360-440v-80h240v80H360ZM480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z"/>
    </svg>
  )
}

const routeTypeLabels = {
  expressway: 'Expressway',
  trunk: 'Major Road',
  local: 'Local Road', 
  temp: 'Temporary'
}

export const JourneyTimeCard: React.FC<JourneyTimeCardProps> = React.memo(({
  from,
  to,
  timeMin,
  trendMin,
  colourId,
  capture,
  locale = 'en',
  routeType = 'trunk',
  onRouteClick
}) => {
  const [flash, setFlash] = useState(false)

  useEffect(() => {
    setFlash(true)
    const timer = setTimeout(() => setFlash(false), 400)
    return () => clearTimeout(timer)
  }, [timeMin, trendMin])

  const displayTime = locale === 'en' ? `${timeMin} min` : `${timeMin} 分`
  const displayTrend = trendMin === 0 ? '' : `${Math.abs(trendMin)} min`
  const trendDirection = trendMin > 0 ? 'slower' : 'faster'

  const formatCaptureTime = (isoString: string) => {
    try {
      const date = new Date(isoString)
      return date.toLocaleTimeString('en-HK', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
      })
    } catch {
      return 'N/A'
    }
  }

  const colors = routeTypeColors[routeType] || routeTypeColors.trunk
  const pillColor = getJourneyTimeColor(timeMin)
  const timeTextColor = getJourneyTimeTextColor(timeMin)
  
  return (
    <div
      className={`
        relative p-4 border-2 rounded-2xl cursor-pointer 
        transition-all duration-300 hover:shadow-md
        ${colors.border} ${colors.bg} ${colors.height}
        ${flash ? 'scale-[1.02]' : 'scale-100'}
        flex flex-col justify-between
      `}
      onClick={() => onRouteClick?.(from, to)}
      role="button"
      aria-label={`Route ${from} to ${to}: ${displayTime}, ${routeTypeLabels[routeType]}`}
    >
      {/* Main Content */}
      <div className="flex items-start gap-3">
        {/* Journey Time Indicator */}
        <div className={`w-3 h-3 rounded-full ${pillColor} animate-pulse flex-shrink-0 mt-1`} />
        
        {/* Route Details - Multi-line layout */}
        <div className="flex-1 min-w-0">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm">
              <span className={`font-medium ${colors.text}`}>{from}</span>
              <span className="text-white/70 flex-shrink-0">→</span>
            </div>
            <div className="text-sm">
              <span className={`font-medium ${colors.text}`}>{to}</span>
            </div>
          </div>
        </div>

        {/* Time Display - Always visible */}
        <div className="text-right flex-shrink-0">
          <div className={`text-xl font-bold ${timeTextColor}`}>
            {displayTime}
          </div>
          <div className="text-xs text-white/60 flex items-center gap-1 justify-end">
            <Clock className="h-3 w-3" />
            {formatCaptureTime(capture)}
          </div>
        </div>
      </div>

      {/* Bottom Row: Road type icon (left) and trend indicator (right) */}
      <div className="flex items-center justify-between">
        {/* Road Type Icon - Bottom Left */}
        <div className="w-7 h-7 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
          <div className="text-neutral-700 dark:text-neutral-300">
            {routeTypeIcons[routeType]}
          </div>
        </div>
        
        {/* Trend Indicator - Bottom Right */}
        {trendMin !== 0 && (
          <div className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full ${
            trendMin > 0 
              ? 'text-red-600 bg-red-100/20 dark:bg-red-900/20' 
              : 'text-green-600 bg-green-100/20 dark:bg-green-900/20'
          }`}>
            {trendMin > 0 ? (
              <TrendingUp className="h-3 w-3" />
            ) : (
              <TrendingDown className="h-3 w-3" />
            )}
            <span>{displayTrend}</span>
          </div>
        )}
      </div>

      {/* Tooltip */}
      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-black text-white text-xs rounded-lg opacity-0 pointer-events-none transition-opacity duration-200 group-hover:opacity-100 whitespace-nowrap">
        <div className="font-medium">{routeTypeLabels[routeType]} Route</div>
        <div>Updated at {formatCaptureTime(capture)}</div>
        {trendMin !== 0 && (
          <div className={trendMin > 0 ? 'text-red-300' : 'text-green-300'}>
            {Math.abs(trendMin)} min {trendDirection} than usual
          </div>
        )}
        {/* Tooltip Arrow */}
        <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-black"></div>
      </div>
    </div>
  )
})

JourneyTimeCard.displayName = 'JourneyTimeCard'

export default JourneyTimeCard