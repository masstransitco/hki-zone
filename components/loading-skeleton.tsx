import { cn } from "@/lib/utils"

interface LoadingSkeletonProps {
  variant?: "card" | "list" | "text" | "bulletin" | "masonry"
  count?: number
  className?: string
}

// Shimmer effect styles
const shimmerClass = "relative overflow-hidden before:absolute before:inset-0 before:-translate-x-full before:animate-shimmer before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent"

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
      <div className={cn("space-y-4", className)}>
        {skeletons.slice(0, 5).map((_, index) => (
          <div key={index} className="border-l-4 border-l-neutral-300 dark:border-l-neutral-700 pl-4 py-3 space-y-2">
            <div className="flex items-center gap-2">
              <div className={cn(
                "h-6 w-16 bg-neutral-200 dark:bg-neutral-800 rounded",
                shimmerClass
              )} />
              <div className={cn(
                "h-4 w-20 bg-neutral-200 dark:bg-neutral-800 rounded",
                shimmerClass
              )} />
            </div>
            <div className={cn(
              "h-5 bg-neutral-200 dark:bg-neutral-800 rounded w-11/12",
              shimmerClass
            )} />
            <div className={cn(
              "h-4 bg-neutral-200 dark:bg-neutral-800 rounded w-2/3",
              shimmerClass
            )} />
          </div>
        ))}
      </div>
    )
  }

  if (variant === "masonry") {
    // Generate varied heights for masonry layout
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