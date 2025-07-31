interface ArticleDetailSkeletonProps {
  isBottomSheet?: boolean
}

export default function ArticleDetailSkeleton({ isBottomSheet = false }: ArticleDetailSkeletonProps) {
  const containerClass = isBottomSheet ? "px-6 pt-4 pb-8" : "max-w-2xl mx-auto p-6"
  const titleHeight = isBottomSheet ? "h-7" : "h-9"
  
  return (
    <div className={`${containerClass} animate-pulse`}>
      {/* Header section with title */}
      <header className="mb-8">
        {/* Large title skeleton - matches article hierarchy */}
        <div className="space-y-3 mb-6">
          <div className={`${titleHeight} bg-muted rounded-lg w-11/12`}></div>
          <div className={`${titleHeight} bg-muted rounded-lg w-4/5`}></div>
        </div>

        {/* Source and time metadata row - matches justify-between layout */}
        <div className="flex items-center justify-between mb-6">
          {/* Source skeleton on left */}
          <div className="h-4 bg-muted rounded w-28"></div>
          {/* Time skeleton on right with clock icon space */}
          <div className="flex items-center gap-1">
            <div className="h-4 w-4 bg-muted rounded"></div>
            <div className="h-4 bg-muted rounded w-16"></div>
          </div>
        </div>
      </header>

      {/* Article image skeleton */}
      <div className="mb-8">
        <div className={`w-full ${isBottomSheet ? 'h-48 sm:h-64' : 'h-48 sm:h-64 md:h-80'} bg-muted rounded-xl`}></div>
      </div>

      {/* Article content skeleton */}
      <div className="space-y-8">
        {/* Content paragraph 1 */}
        <div className="space-y-3">
          <div className="h-4 bg-muted rounded-lg w-full"></div>
          <div className="h-4 bg-muted rounded-lg w-11/12"></div>
          <div className="h-4 bg-muted rounded-lg w-10/12"></div>
          <div className="h-4 bg-muted rounded-lg w-full"></div>
          <div className="h-4 bg-muted rounded-lg w-9/12"></div>
        </div>

        {/* Content paragraph 2 */}
        <div className="space-y-3">
          <div className="h-4 bg-muted rounded-lg w-full"></div>
          <div className="h-4 bg-muted rounded-lg w-10/12"></div>
          <div className="h-4 bg-muted rounded-lg w-8/12"></div>
          <div className="h-4 bg-muted rounded-lg w-11/12"></div>
          <div className="h-4 bg-muted rounded-lg w-7/12"></div>
        </div>

        {/* Content paragraph 3 */}
        <div className="space-y-3">
          <div className="h-4 bg-muted rounded-lg w-full"></div>
          <div className="h-4 bg-muted rounded-lg w-9/12"></div>
          <div className="h-4 bg-muted rounded-lg w-10/12"></div>
        </div>
      </div>

      {/* Footer section skeleton */}
      <footer className={`mt-10 pt-6 border-t border-border ${isBottomSheet ? 'mt-10' : 'mt-12'}`}>
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 bg-muted rounded"></div>
          <div className="h-4 bg-muted rounded w-32"></div>
        </div>
      </footer>
    </div>
  )
}