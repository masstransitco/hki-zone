import { cn } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"

interface LoadingSkeletonProps {
  variant?: "card" | "list" | "text" | "bulletin" | "bulletin-full" | "masonry" | "masonry-full" | "topics" | "topics-loading-more"
  count?: number
  className?: string
}

// Enhanced shimmer effect with smoother animation
const shimmerClass = "relative overflow-hidden before:absolute before:inset-0 before:-translate-x-full before:animate-shimmer before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent animate-pulse"

export default function LoadingSkeleton({ 
  variant = "card", 
  count = 8,
  className 
}: LoadingSkeletonProps = {}) {
  const skeletons = Array.from({ length: count })

  if (variant === "list") {
    return (
      <div className={cn("space-y-3", className)}>
        {skeletons.map((_, index) => (
          <div key={index} className="flex gap-3 p-4">
            <div className={cn(
              "w-16 h-16 bg-neutral-200 dark:bg-neutral-800 rounded-lg",
              shimmerClass
            )} />
            <div className="flex-1 space-y-2">
              <div className={cn(
                "h-4 bg-neutral-200 dark:bg-neutral-800 rounded w-3/4",
                shimmerClass
              )} />
              <div className={cn(
                "h-3 bg-neutral-200 dark:bg-neutral-800 rounded w-full",
                shimmerClass
              )} />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (variant === "text") {
    return (
      <div className={cn("space-y-3", className)}>
        {skeletons.slice(0, 3).map((_, index) => (
          <div key={index} className={cn(
            "h-4 bg-neutral-200 dark:bg-neutral-800 rounded",
            shimmerClass,
            index === 1 && "w-5/6",
            index === 2 && "w-4/6"
          )} />
        ))}
      </div>
    )
  }

  if (variant === "bulletin") {
    return (
      <div className={cn("space-y-2", className)}>
        {skeletons.map((_, index) => (
          <Card key={index} className="group article-card cursor-pointer">
            <CardContent className="p-3">
              <div className="space-y-4">
                {/* Main content area with source logo and title */}
                <div className="flex items-start gap-3">
                  {/* Source favicon skeleton */}
                  <div className="flex-shrink-0 mt-0.5">
                    <div className={cn(
                      "w-5 h-5 bg-neutral-200 dark:bg-neutral-800 rounded",
                      shimmerClass
                    )} />
                  </div>
                  
                  {/* Content area */}
                  <div className="flex-1 min-w-0">
                    {/* Title skeleton */}
                    <div className="mb-2 space-y-1">
                      <div className={cn(
                        "h-4 bg-neutral-200 dark:bg-neutral-800 rounded w-full",
                        shimmerClass
                      )} />
                      <div className={cn(
                        "h-4 bg-neutral-200 dark:bg-neutral-800 rounded w-3/4",
                        shimmerClass
                      )} />
                    </div>
                    
                    {/* Metadata row skeleton */}
                    <div className="flex items-center gap-3 text-xs">
                      {/* Category badge skeleton */}
                      <div className={cn(
                        "h-5 w-16 bg-neutral-200 dark:bg-neutral-800 rounded-full",
                        shimmerClass
                      )} />
                      
                      {/* Time skeleton with icon */}
                      <div className="flex items-center gap-1">
                        <div className={cn(
                          "w-3 h-3 bg-neutral-200 dark:bg-neutral-800 rounded",
                          shimmerClass
                        )} />
                        <div className={cn(
                          "h-3 w-16 bg-neutral-200 dark:bg-neutral-800 rounded",
                          shimmerClass
                        )} />
                      </div>
                      
                      {/* Severity skeleton with icon */}
                      <div className="flex items-center gap-1">
                        <div className={cn(
                          "w-3 h-3 bg-neutral-200 dark:bg-neutral-800 rounded",
                          shimmerClass
                        )} />
                        <div className={cn(
                          "h-3 w-6 bg-neutral-200 dark:bg-neutral-800 rounded",
                          shimmerClass
                        )} />
                      </div>
                    </div>
                  </div>
                  
                  {/* Expand button skeleton */}
                  <div className={cn(
                    "h-8 w-8 bg-neutral-200 dark:bg-neutral-800 rounded flex-shrink-0",
                    shimmerClass
                  )} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (variant === "bulletin-full") {
    return (
      <div className="relative h-full overflow-hidden">
        <div className="h-full overflow-auto">
          {/* Header spacer */}
          <div className="h-[113px] w-full" aria-hidden="true" />
          
          <div className="pt-6 space-y-4 px-4 md:px-6 lg:px-8">
            {/* Filter and Real-time status row skeleton */}
            <div className="flex items-center justify-between text-xs">
              {/* Category filter skeleton on the left */}
              <div className={cn("h-7 w-28 bg-neutral-200 dark:bg-neutral-800 rounded border", shimmerClass)} />
              
              {/* Real-time connection status skeleton on the right */}
              <div className="flex items-center gap-2 text-muted-foreground">
                <div className={cn("h-2 w-2 rounded-full bg-neutral-300 dark:bg-neutral-700", shimmerClass)} />
                <div className={cn("h-3 w-20 bg-neutral-200 dark:bg-neutral-800 rounded", shimmerClass)} />
              </div>
            </div>

            {/* Bulletin List skeleton */}
            <div className="space-y-2">
              {Array.from({ length: count }).map((_, index) => (
                <Card key={index} className="group article-card cursor-pointer">
                  <CardContent className="p-3">
                    <div className="space-y-4">
                      {/* Main content area with source logo and title */}
                      <div className="flex items-start gap-3">
                        {/* Source favicon skeleton */}
                        <div className="flex-shrink-0 mt-0.5">
                          <div className={cn(
                            "w-5 h-5 bg-neutral-200 dark:bg-neutral-800 rounded",
                            shimmerClass
                          )} />
                        </div>
                        
                        {/* Content area */}
                        <div className="flex-1 min-w-0">
                          {/* Title skeleton */}
                          <div className="mb-2 space-y-1">
                            <div className={cn(
                              "h-4 bg-neutral-200 dark:bg-neutral-800 rounded w-full",
                              shimmerClass
                            )} />
                            <div className={cn(
                              "h-4 bg-neutral-200 dark:bg-neutral-800 rounded w-3/4",
                              shimmerClass
                            )} />
                          </div>
                          
                          {/* Metadata row skeleton */}
                          <div className="flex items-center gap-3 text-xs">
                            {/* Category badge skeleton */}
                            <div className={cn(
                              "h-5 w-16 bg-neutral-200 dark:bg-neutral-800 rounded-full",
                              shimmerClass
                            )} />
                            
                            {/* Time skeleton with icon */}
                            <div className="flex items-center gap-1">
                              <div className={cn(
                                "w-3 h-3 bg-neutral-200 dark:bg-neutral-800 rounded",
                                shimmerClass
                              )} />
                              <div className={cn(
                                "h-3 w-16 bg-neutral-200 dark:bg-neutral-800 rounded",
                                shimmerClass
                              )} />
                            </div>
                            
                            {/* Severity skeleton with icon */}
                            <div className="flex items-center gap-1">
                              <div className={cn(
                                "w-3 h-3 bg-neutral-200 dark:bg-neutral-800 rounded",
                                shimmerClass
                              )} />
                              <div className={cn(
                                "h-3 w-6 bg-neutral-200 dark:bg-neutral-800 rounded",
                                shimmerClass
                              )} />
                            </div>
                          </div>
                        </div>
                        
                        {/* Expand button skeleton */}
                        <div className={cn(
                          "h-8 w-8 bg-neutral-200 dark:bg-neutral-800 rounded flex-shrink-0",
                          shimmerClass
                        )} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (variant === "masonry") {
    // Generate varied heights for masonry layout - just the cards
    const aspectRatios = ["aspect-[16/9]", "aspect-[1/1]", "aspect-[4/5]"]
    return (
      <>
        {skeletons.map((_, index) => (
          <div key={index} className="news-card">
            <div className="space-y-3">
              <div className={cn(
                "bg-neutral-200 dark:bg-neutral-800 rounded-lg",
                aspectRatios[index % aspectRatios.length],
                shimmerClass
              )} />
              <div className="space-y-2 px-2">
                <div className={cn(
                  "h-4 bg-neutral-200 dark:bg-neutral-800 rounded w-3/4",
                  shimmerClass
                )} />
                <div className={cn(
                  "h-4 bg-neutral-200 dark:bg-neutral-800 rounded",
                  shimmerClass
                )} />
                <div className={cn(
                  "h-4 bg-neutral-200 dark:bg-neutral-800 rounded w-5/6",
                  shimmerClass
                )} />
              </div>
            </div>
          </div>
        ))}
      </>
    )
  }

  if (variant === "masonry-full") {
    // Full masonry layout with header and real-time status
    const aspectRatios = ["aspect-[16/9]", "aspect-[1/1]", "aspect-[4/5]"]
    return (
      <div className="relative h-full overflow-hidden">
        <div className="h-full overflow-auto">
          {/* Header spacer */}
          <div className="h-[113px] w-full" aria-hidden="true" />
          
          {/* Real-time status skeleton */}
          <div className="flex items-center justify-end gap-2 px-4 md:px-6 lg:px-8 pb-3">
            <div className={cn("h-2 w-2 rounded-full bg-neutral-300 dark:bg-neutral-700", shimmerClass)} />
            <div className={cn("h-3 w-20 bg-neutral-200 dark:bg-neutral-800 rounded", shimmerClass)} />
          </div>
          
          {/* Masonry news feed skeleton */}
          <div className="news-feed isolate">
            {skeletons.map((_, index) => (
              <div key={index} className="news-card">
                <div className="space-y-3">
                  <div className={cn(
                    "bg-neutral-200 dark:bg-neutral-800 rounded-lg",
                    aspectRatios[index % aspectRatios.length],
                    shimmerClass
                  )} />
                  <div className="space-y-2 px-2">
                    <div className={cn(
                      "h-4 bg-neutral-200 dark:bg-neutral-800 rounded w-3/4",
                      shimmerClass
                    )} />
                    <div className={cn(
                      "h-4 bg-neutral-200 dark:bg-neutral-800 rounded",
                      shimmerClass
                    )} />
                    <div className={cn(
                      "h-4 bg-neutral-200 dark:bg-neutral-800 rounded w-5/6",
                      shimmerClass
                    )} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (variant === "topics") {
    return (
      <div className="relative h-full overflow-hidden">
        <div className="h-full overflow-auto">
          {/* Header spacer */}
          <div className="h-[113px] w-full" aria-hidden="true" />
          
          {/* Real-time status skeleton */}
          <div className="flex items-center justify-end gap-2 px-4 md:px-6 lg:px-8 pb-3">
            <div className={cn("h-2 w-2 rounded-full bg-neutral-300 dark:bg-neutral-700", shimmerClass)} />
            <div className={cn("h-3 w-20 bg-neutral-200 dark:bg-neutral-800 rounded", shimmerClass)} />
          </div>
          
          {/* Articles grid matching the actual layout */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4 lg:gap-5 isolate px-4 md:px-6 lg:px-8">
            {Array.from({ length: count }).map((_, index) => (
              <Card 
                key={index}
                className="border-stone-200/60 dark:border-neutral-700/60 bg-stone-50/95 dark:bg-neutral-900/95 backdrop-blur-sm"
              >
                <CardContent className="card-content h-full flex flex-col px-3 pt-3 pb-3">
                  {/* Image skeleton */}
                  <div className={cn(
                    "relative w-full aspect-video overflow-hidden rounded-lg bg-neutral-200 dark:bg-neutral-800 mb-4",
                    shimmerClass
                  )} />
                  
                  {/* Title skeleton - 3 lines */}
                  <div className="space-y-2 mb-4">
                    <div className={cn("h-4 bg-neutral-200 dark:bg-neutral-800 rounded", shimmerClass)} />
                    <div className={cn("h-4 bg-neutral-200 dark:bg-neutral-800 rounded", shimmerClass)} />
                    <div className={cn("h-4 bg-neutral-200 dark:bg-neutral-800 rounded w-3/4", shimmerClass)} />
                  </div>
                  
                  {/* Bottom section with source and time */}
                  <div className="flex items-center justify-between text-xs mt-auto">
                    {/* Source skeleton */}
                    <div className="flex items-center gap-2">
                      <div className={cn("w-4 h-4 rounded-sm bg-neutral-200 dark:bg-neutral-800", shimmerClass)} />
                      <div className={cn("h-3 w-16 bg-neutral-200 dark:bg-neutral-800 rounded", shimmerClass)} />
                    </div>
                    
                    {/* Time and bookmark skeleton */}
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <div className={cn("w-3 h-3 rounded bg-neutral-200 dark:bg-neutral-800", shimmerClass)} />
                        <div className={cn("h-3 w-12 bg-neutral-200 dark:bg-neutral-800 rounded", shimmerClass)} />
                      </div>
                      <div className={cn("w-4 h-4 rounded bg-neutral-200 dark:bg-neutral-800", shimmerClass)} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (variant === "topics-loading-more") {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4 lg:gap-5 isolate px-4 md:px-6 lg:px-8 pb-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card 
            key={index}
            className="border-stone-200/60 dark:border-neutral-700/60 bg-stone-50/95 dark:bg-neutral-900/95 backdrop-blur-sm"
          >
            <CardContent className="card-content h-full flex flex-col px-3 pt-3 pb-3">
              {/* Image skeleton */}
              <div className={cn(
                "relative w-full aspect-video overflow-hidden rounded-lg bg-neutral-200 dark:bg-neutral-800 mb-4",
                shimmerClass
              )} />
              
              {/* Title skeleton - 3 lines */}
              <div className="space-y-2 mb-4">
                <div className={cn("h-4 bg-neutral-200 dark:bg-neutral-800 rounded", shimmerClass)} />
                <div className={cn("h-4 bg-neutral-200 dark:bg-neutral-800 rounded", shimmerClass)} />
                <div className={cn("h-4 bg-neutral-200 dark:bg-neutral-800 rounded w-3/4", shimmerClass)} />
              </div>
              
              {/* Bottom section with source and time */}
              <div className="flex items-center justify-between text-xs mt-auto">
                {/* Source skeleton */}
                <div className="flex items-center gap-2">
                  <div className={cn("w-4 h-4 rounded-sm bg-neutral-200 dark:bg-neutral-800", shimmerClass)} />
                  <div className={cn("h-3 w-16 bg-neutral-200 dark:bg-neutral-800 rounded", shimmerClass)} />
                </div>
                
                {/* Time and bookmark skeleton */}
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <div className={cn("w-3 h-3 rounded bg-neutral-200 dark:bg-neutral-800", shimmerClass)} />
                    <div className={cn("h-3 w-12 bg-neutral-200 dark:bg-neutral-800 rounded", shimmerClass)} />
                  </div>
                  <div className={cn("w-4 h-4 rounded bg-neutral-200 dark:bg-neutral-800", shimmerClass)} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  // Default card variant for news articles
  return (
    <>
      {skeletons.map((_, index) => (
        <div key={index} className="space-y-3">
          <div className={cn(
            "bg-neutral-200 dark:bg-neutral-800 aspect-[4/3] rounded-lg",
            shimmerClass
          )} />
          <div className="space-y-2 px-2">
            <div className={cn(
              "h-4 bg-neutral-200 dark:bg-neutral-800 rounded w-3/4",
              shimmerClass
            )} />
            <div className={cn(
              "h-4 bg-neutral-200 dark:bg-neutral-800 rounded",
              shimmerClass
            )} />
            <div className={cn(
              "h-4 bg-neutral-200 dark:bg-neutral-800 rounded w-5/6",
              shimmerClass
            )} />
          </div>
        </div>
      ))}
    </>
  )
}