"use client"

import Image from "next/image"
import { getFaviconUrl, hasFavicon } from "@/lib/source-favicon-mapping"
import { cn } from "@/lib/utils"

interface OutletFaviconProps {
  source: string
  size?: "sm" | "md" | "lg"
  className?: string
  showFallback?: boolean
  fallbackText?: string
}

const sizeMap = {
  sm: { width: 16, height: 16, className: "w-4 h-4" },
  md: { width: 20, height: 20, className: "w-5 h-5" },
  lg: { width: 24, height: 24, className: "w-6 h-6" }
}

export default function OutletFavicon({ 
  source, 
  size = "sm", 
  className = "",
  showFallback = true,
  fallbackText
}: OutletFaviconProps) {
  const faviconUrl = getFaviconUrl(source)
  const hasIcon = hasFavicon(source)
  const { width, height, className: sizeClassName } = sizeMap[size]
  
  // If no favicon is available and fallback is disabled, return null
  if (!hasIcon && !showFallback) {
    return null
  }
  
  // If favicon is available, show it
  if (hasIcon && faviconUrl) {
    return (
      <div className={cn("flex-shrink-0 relative", sizeClassName, className)}>
        <Image
          src={faviconUrl}
          alt={`${source} logo`}
          width={width}
          height={height}
          className={cn(
            "object-contain rounded-sm",
            sizeClassName
          )}
          onError={(e) => {
            // Hide the image if it fails to load
            const target = e.target as HTMLImageElement
            target.style.display = 'none'
          }}
        />
      </div>
    )
  }
  
  // Fallback: show a pill-shaped text badge
  if (showFallback) {
    const cleanSource = source.replace(' (AI Enhanced)', '').replace(/ \+ AI$/, '').trim()
    const displayText = fallbackText || cleanSource
    
    return (
      <div className={cn(
        "flex-shrink-0 flex items-center justify-center rounded-full bg-muted/80 text-muted-foreground text-xs font-medium px-2 py-1",
        "border border-border/40 min-w-fit",
        className
      )}
      style={{ minHeight: size === "sm" ? "20px" : size === "md" ? "24px" : "28px" }}
      >
        {displayText}
      </div>
    )
  }
  
  return null
}