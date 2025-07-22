"use client"

import { motion, AnimatePresence } from "framer-motion"
import { RefreshCw } from "lucide-react"

interface PullRefreshIndicatorProps {
  pullDistance: number
  isRefreshing: boolean
  threshold?: number
}

export default function PullRefreshIndicator({ 
  pullDistance, 
  isRefreshing,
  threshold = 80 
}: PullRefreshIndicatorProps) {
  const progress = Math.min(pullDistance / threshold, 1)
  const isVisible = pullDistance > 20 || isRefreshing // Show after 20px pull
  const willRefresh = pullDistance >= threshold

  return (
    <div className="absolute top-0 left-0 right-0 flex justify-center pointer-events-none z-40 -translate-y-16">
      <AnimatePresence>
        {isVisible && (
          <motion.div
            className="mt-4"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.2 }}
          >
            <motion.div
              className={`
                rounded-full p-3 shadow-lg border
                ${willRefresh 
                  ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' 
                  : 'bg-white dark:bg-neutral-800 border-stone-200 dark:border-neutral-700'
                }
              `}
              animate={{
                scale: isRefreshing ? 1 : 0.8 + (progress * 0.2),
              }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
            >
              <motion.div
                animate={{
                  rotate: isRefreshing ? 360 : progress * 180,
                }}
                transition={{
                  rotate: isRefreshing 
                    ? { repeat: Infinity, duration: 1, ease: "linear" }
                    : { type: "spring", stiffness: 400, damping: 30 }
                }}
              >
                <RefreshCw 
                  className={`
                    w-5 h-5 transition-colors duration-200
                    ${willRefresh 
                      ? 'text-blue-600 dark:text-blue-400' 
                      : 'text-stone-400 dark:text-neutral-500'
                    }
                  `}
                />
              </motion.div>
            </motion.div>
            
            {/* Pull hint text */}
            <motion.p
              className="text-xs text-stone-500 dark:text-neutral-400 text-center mt-2"
              initial={{ opacity: 0 }}
              animate={{ 
                opacity: progress > 0.2 ? progress : 0,
              }}
            >
              {isRefreshing 
                ? "Refreshing..." 
                : willRefresh 
                  ? "Release to refresh" 
                  : "Pull to refresh"
              }
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}