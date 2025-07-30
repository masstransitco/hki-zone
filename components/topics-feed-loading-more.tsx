import { Card, CardContent } from "@/components/ui/card"

interface TopicsFeedLoadingMoreProps {
  columns?: {
    default: number
    md: number
    lg: number
    xl: number
  }
}

export default function TopicsFeedLoadingMore({ 
  columns = { default: 1, md: 2, lg: 3, xl: 4 } 
}: TopicsFeedLoadingMoreProps) {
  // Calculate how many skeleton cards to show based on viewport
  // We'll show one row of skeletons
  const skeletonCount = columns.xl // Default to max columns, CSS will handle responsive display
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-1 md:gap-[18px] lg:gap-[22px] isolate px-[1px] pb-4">
      {Array.from({ length: skeletonCount }).map((_, index) => (
        <Card 
          key={index}
          className="border-stone-200/60 dark:border-neutral-700/60 bg-stone-50/95 dark:bg-neutral-900/95 backdrop-blur-sm"
        >
          <CardContent className="card-content h-full flex flex-col px-3 pt-3 pb-3">
            {/* Image skeleton */}
            <div className="relative w-full aspect-video overflow-hidden rounded-lg bg-neutral-200 dark:bg-neutral-800 mb-4 animate-pulse" />
            
            {/* Title skeleton - 3 lines */}
            <div className="space-y-2 mb-4">
              <div className="h-4 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
              <div className="h-4 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
              <div className="h-4 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse w-3/4" />
            </div>
            
            {/* Bottom section with source and time */}
            <div className="flex items-center justify-between text-xs mt-auto">
              {/* Source skeleton */}
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-sm bg-neutral-200 dark:bg-neutral-800 animate-pulse" />
                <div className="h-3 w-16 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
              </div>
              
              {/* Time and bookmark skeleton */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-neutral-200 dark:bg-neutral-800 animate-pulse" />
                  <div className="h-3 w-12 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
                </div>
                <div className="w-4 h-4 rounded bg-neutral-200 dark:bg-neutral-800 animate-pulse" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}