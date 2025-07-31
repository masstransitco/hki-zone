import { cn } from "@/lib/utils"

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg"
  className?: string
}

export function LoadingSpinner({ size = "md", className }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: "w-4 h-4 border-2",
    md: "w-6 h-6 border-2",
    lg: "w-8 h-8 border-2"
  }

  return (
    <div
      className={cn(
        "inline-block animate-spin rounded-full",
        "border-neutral-200 dark:border-neutral-800",
        "border-t-neutral-400 dark:border-t-neutral-600",
        sizeClasses[size],
        className
      )}
      style={{
        animationDuration: "750ms",
        animationTimingFunction: "linear"
      }}
      role="status"
      aria-label="Loading"
    >
      <span className="sr-only">Loading...</span>
    </div>
  )
}

// Loading spinner with text
export function LoadingSpinnerWithText({ 
  text = "Loading", 
  size = "md",
  className 
}: LoadingSpinnerProps & { text?: string }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <LoadingSpinner size={size} />
      <span className="text-sm text-neutral-600 dark:text-neutral-400">
        {text}
      </span>
    </div>
  )
}

// Full page loading spinner
export function LoadingSpinnerFullPage() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <LoadingSpinner size="lg" />
    </div>
  )
}

// Inline loading spinner for buttons
export function LoadingSpinnerInline({ className }: { className?: string }) {
  return (
    <LoadingSpinner 
      size="sm" 
      className={cn("inline-block mx-2", className)} 
    />
  )
}