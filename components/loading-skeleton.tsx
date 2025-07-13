export default function LoadingSkeleton() {
  return (
    <div className="group relative bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200/50 dark:border-neutral-800/50 overflow-hidden animate-pulse">
      {/* Image skeleton - matches 4:3 aspect ratio of car cards */}
      <div className="relative aspect-[4/3] bg-neutral-200 dark:bg-neutral-800"></div>
      
      {/* Content skeleton - matches car card structure */}
      <div className="p-4 space-y-3">
        {/* Title and Price */}
        <div className="space-y-1">
          <div className="h-5 bg-neutral-200 dark:bg-neutral-800 rounded w-full"></div>
          <div className="h-6 bg-neutral-200 dark:bg-neutral-800 rounded w-24"></div>
        </div>
        
        {/* Metadata */}
        <div className="flex items-center gap-2">
          <div className="h-4 bg-neutral-200 dark:bg-neutral-800 rounded w-12"></div>
          <div className="w-1 h-1 bg-neutral-200 dark:bg-neutral-800 rounded-full"></div>
          <div className="h-4 bg-neutral-200 dark:bg-neutral-800 rounded w-16"></div>
        </div>
        
        {/* Specs */}
        <div className="h-8 bg-neutral-200 dark:bg-neutral-800 rounded-lg w-full"></div>
      </div>
    </div>
  )
}
