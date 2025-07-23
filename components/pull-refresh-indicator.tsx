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
    <div className="fixed top-28 left-0 right-0 flex justify-center pointer-events-none z-40">
      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: -20 }}
            transition={{ 
              duration: 0.2,
              ease: [0.4, 0, 0.2, 1]
            }}
          >
            <motion.div
              className={`
                rounded-full p-3 shadow-minimal backdrop-blur-sm border
                ${willRefresh 
                  ? 'bg-neutral-50/90 dark:bg-neutral-900/90 border-neutral-300 dark:border-neutral-700' 
                  : 'bg-white/90 dark:bg-neutral-800/90 border-neutral-200 dark:border-neutral-700'
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
                      ? 'text-neutral-700 dark:text-neutral-300' 
                      : 'text-neutral-400 dark:text-neutral-500'
                    }
                  `}
                />
              </motion.div>
            </motion.div>
            
            {/* Pull hint text - removed for cleaner UI */}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}