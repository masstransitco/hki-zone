"use client"

import * as React from 'react';
import { useLanguage } from './language-provider';

export type ContentType = 'headlines' | 'finance' | 'techScience' | 'entertainment' | 'international' | 'news' | 'bulletin';

interface ContentTypeSelectorProps {
  value: ContentType;
  onChange: (value: ContentType) => void;
}

const contentTypes: ContentType[] = ['headlines', 'finance', 'techScience', 'entertainment', 'international', 'news', 'bulletin'];

// Map content types to their translation keys and category filters
export const getContentConfig = (type: ContentType) => {
  const configs = {
    headlines: { translationKey: 'content.discover', category: null }, // All AI-enhanced (Top Stories)
    finance: { translationKey: 'content.finance', category: 'Finance' },
    techScience: { translationKey: 'content.techScience', category: 'Tech & Science' },
    entertainment: { translationKey: 'content.entertainment', category: 'Entertainment' },
    international: { translationKey: 'content.international', category: 'International' },
    news: { translationKey: 'content.news', category: null }, // News feed masonry
    bulletin: { translationKey: 'content.gov', category: null } // Government bulletin
  }
  return configs[type]
}

export const ContentTypeSelector: React.FC<ContentTypeSelectorProps> = ({ value, onChange }) => {
  const [isPressed, setIsPressed] = React.useState<ContentType | null>(null)
  const { t } = useLanguage()
  const containerRef = React.useRef<HTMLDivElement>(null)

  const handlePress = (type: ContentType) => {
    setIsPressed(type)
    onChange(type)
    setTimeout(() => setIsPressed(null), 150)
  }

  // Enable horizontal scroll with mouse wheel on desktop
  React.useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleWheel = (e: WheelEvent) => {
      if (e.deltaY !== 0) {
        e.preventDefault()
        container.scrollLeft += e.deltaY
      }
    }

    container.addEventListener('wheel', handleWheel, { passive: false })
    return () => container.removeEventListener('wheel', handleWheel)
  }, [])

  // Auto-scroll to keep selected category in view
  React.useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // Find the selected button element
    const selectedButton = container.querySelector(`button[aria-selected="true"]`) as HTMLElement
    if (!selectedButton) return

    // Get container and button dimensions
    const containerRect = container.getBoundingClientRect()
    const buttonRect = selectedButton.getBoundingClientRect()
    
    // Calculate if button is out of view
    const buttonLeft = selectedButton.offsetLeft
    const buttonWidth = selectedButton.offsetWidth
    const containerScrollLeft = container.scrollLeft
    const containerWidth = container.clientWidth

    // Check if button is partially or fully out of view
    const isOutOfViewLeft = buttonLeft < containerScrollLeft
    const isOutOfViewRight = buttonLeft + buttonWidth > containerScrollLeft + containerWidth

    if (isOutOfViewLeft || isOutOfViewRight) {
      // Calculate scroll position to center the button
      const targetScrollLeft = buttonLeft - (containerWidth / 2) + (buttonWidth / 2)
      
      // Smooth scroll to center the selected category
      container.scrollTo({
        left: Math.max(0, targetScrollLeft),
        behavior: 'smooth'
      })
    }
  }, [value]) // Trigger when selected category changes

  return (
    <div className="relative w-full" role="tablist" aria-label="Content type selector">
      {/* Horizontal scrolling container with custom scrollbar styling */}
      <div 
        ref={containerRef}
        className="overflow-x-auto category-selector-scrollbar"
      >
        {/* Pills container */}
        <div className="flex gap-2 p-1 min-w-max lg:min-w-full lg:justify-between">
          {contentTypes.map((type) => {
            const config = getContentConfig(type)
            const isSelected = value === type
            const isPressedState = isPressed === type
            
            return (
              <div key={type} className="relative">
                {/* Blur emission layer behind pill */}
                <div 
                  className={`absolute inset-0 rounded-full transition-all duration-200 pointer-events-none ${
                    isSelected 
                      ? 'bg-accent-1/20 dark:bg-accent-1/15' 
                      : 'bg-surface-3/20 dark:bg-surface-4/15'
                  }`}
                  style={{
                    filter: isSelected ? 'blur(24px)' : 'blur(20px)',
                    transform: isSelected ? 'scale(1.15)' : 'scale(1.1)'
                  }}
                />
                {/* Actual pill button */}
                <button
                  role="tab"
                  aria-selected={isSelected}
                  aria-controls={`${type}-panel`}
                  id={`${type}-tab`}
                  onClick={() => handlePress(type)}
                  onMouseDown={() => setIsPressed(type)}
                  onMouseUp={() => setIsPressed(null)}
                  onTouchStart={() => setIsPressed(type)}
                  className={`relative px-4 py-2 text-sm font-medium rounded-full transition-all duration-200 ease-out touch-manipulation font-sans whitespace-nowrap ${
                    isSelected
                      ? 'bg-accent-1/95 text-white dark:bg-accent-1/95 dark:text-white backdrop-blur-sm'
                      : 'bg-surface-1/70 dark:bg-surface-2/60 text-text-3 dark:text-text-3 hover:bg-surface-2/80 dark:hover:bg-surface-3/70 hover:text-text-2 dark:hover:text-text-2 backdrop-blur-sm'
                  } ${isPressedState ? 'scale-[0.97]' : ''}`}
                  style={{ 
                    fontFamily: '"Inter", "SF Pro Display", "Noto Sans CJK SC", "Noto Sans CJK TC", "PingFang SC", "PingFang TC", "Hiragino Sans GB", "Microsoft YaHei", "Helvetica Neue", system-ui, sans-serif',
                    letterSpacing: '-0.01em'
                  }}
                >
                  {t(config.translationKey)}
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  );
};