export default function LoadingSkeleton() {
  return (
    <div className="px-6 py-4">
      {/* Match the responsive grid layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="bg-card border border-border rounded-lg p-6 animate-pulse h-full"
          >
            {/* Vertical layout matching the new card design */}
            <div className="flex flex-col gap-4 h-full">
              {/* Image skeleton */}
              <div className="w-full aspect-video bg-muted rounded-lg"></div>
              
              {/* Content area */}
              <div className="flex-1 space-y-3">
                {/* Header with source and time */}
                <div className="flex items-center justify-between">
                  <div className="h-4 bg-muted rounded w-20"></div>
                  <div className="h-4 bg-muted rounded w-16"></div>
                </div>
                
                {/* Title */}
                <div className="space-y-2">
                  <div className="h-5 bg-muted rounded-lg w-full"></div>
                  <div className="h-5 bg-muted rounded-lg w-4/5"></div>
                </div>
                
                {/* Summary */}
                <div className="space-y-2">
                  <div className="h-4 bg-muted rounded-lg w-full"></div>
                  <div className="h-4 bg-muted rounded-lg w-3/4"></div>
                </div>
                
                {/* Footer */}
                <div className="flex items-center justify-between mt-auto">
                  <div className="h-4 bg-muted rounded w-16"></div>
                  <div className="h-4 bg-muted rounded w-20"></div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
