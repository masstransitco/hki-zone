export default function LoadingSkeleton() {
  return (
    <div className="space-y-4 p-6">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="bg-white dark:bg-[rgb(28,28,30)] border border-[rgb(229,229,234)] dark:border-[rgb(44,44,46)] rounded-xl p-4 animate-pulse"
        >
          <div className="flex gap-4">
            <div className="flex-1 space-y-3">
              <div className="h-5 bg-[rgb(242,242,247)] dark:bg-[rgb(44,44,46)] rounded-lg w-3/4"></div>
              <div className="h-4 bg-[rgb(242,242,247)] dark:bg-[rgb(44,44,46)] rounded-lg w-full"></div>
              <div className="h-4 bg-[rgb(242,242,247)] dark:bg-[rgb(44,44,46)] rounded-lg w-2/3"></div>
              <div className="flex gap-3">
                <div className="h-3 bg-[rgb(242,242,247)] dark:bg-[rgb(44,44,46)] rounded w-16"></div>
                <div className="h-3 bg-[rgb(242,242,247)] dark:bg-[rgb(44,44,46)] rounded w-20"></div>
              </div>
            </div>
            <div className="w-20 h-20 bg-[rgb(242,242,247)] dark:bg-[rgb(44,44,46)] rounded-lg"></div>
          </div>
        </div>
      ))}
    </div>
  )
}
