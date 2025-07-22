"use client"

import * as React from 'react';
import { useSwipeGesture } from '@/hooks/use-swipe-gesture';

export type ContentType = 'headlines' | 'news' | 'bulletin';

interface ContentTypeSelectorProps {
  value: ContentType;
  onChange: (value: ContentType) => void;
}

const contentTypes: ContentType[] = ['headlines', 'news', 'bulletin'];

export const ContentTypeSelector: React.FC<ContentTypeSelectorProps> = ({ value, onChange }) => {
  const [isPressed, setIsPressed] = React.useState<ContentType | null>(null)
  const containerRef = React.useRef<HTMLDivElement>(null)

  const handlePress = (type: ContentType) => {
    setIsPressed(type)
    onChange(type)
    setTimeout(() => setIsPressed(null), 150)
  }

  // Handle swipe gestures
  const handleSwipeLeft = () => {
    const currentIndex = contentTypes.indexOf(value)
    const nextIndex = (currentIndex + 1) % contentTypes.length
    onChange(contentTypes[nextIndex])
  }

  const handleSwipeRight = () => {
    const currentIndex = contentTypes.indexOf(value)
    const prevIndex = (currentIndex - 1 + contentTypes.length) % contentTypes.length
    onChange(contentTypes[prevIndex])
  }

  // Enable swipe gestures on the selector
  useSwipeGesture(containerRef, {
    onSwipeLeft: handleSwipeLeft,
    onSwipeRight: handleSwipeRight,
    threshold: 40,
    enabled: true
  })

  return (
    <div className="relative flex justify-center" role="tablist" aria-label="Content type selector">
      {/* Minimalist pill container */}
      <div ref={containerRef} className="inline-flex gap-1 p-1 bg-neutral-100 dark:bg-neutral-800/50 rounded-full touch-manipulation">
        {/* Discover button */}
        <button
          role="tab"
          aria-selected={value === 'headlines'}
          aria-controls="headlines-panel"
          id="headlines-tab"
          onClick={() => handlePress('headlines')}
          onMouseDown={() => setIsPressed('headlines')}
          onMouseUp={() => setIsPressed(null)}
          onTouchStart={() => setIsPressed('headlines')}
          className={`relative px-5 py-2 text-sm font-normal rounded-full transition-all duration-200 ease-out touch-manipulation ${
            value === 'headlines'
              ? 'bg-neutral-800 dark:bg-neutral-200 text-white dark:text-neutral-900 shadow-sm'
              : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200'
          } ${isPressed === 'headlines' ? 'scale-[0.97]' : ''}`}
        >
          Discover
        </button>
        
        {/* News button */}
        <button
          role="tab"
          aria-selected={value === 'news'}
          aria-controls="news-panel"
          id="news-tab"
          onClick={() => handlePress('news')}
          onMouseDown={() => setIsPressed('news')}
          onMouseUp={() => setIsPressed(null)}
          onTouchStart={() => setIsPressed('news')}
          className={`relative px-5 py-2 text-sm font-normal rounded-full transition-all duration-200 ease-out touch-manipulation ${
            value === 'news'
              ? 'bg-neutral-800 dark:bg-neutral-200 text-white dark:text-neutral-900 shadow-sm'
              : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200'
          } ${isPressed === 'news' ? 'scale-[0.97]' : ''}`}
        >
          News
        </button>

        {/* Gov button */}
        <button
          role="tab"
          aria-selected={value === 'bulletin'}
          aria-controls="bulletin-panel"
          id="bulletin-tab"
          onClick={() => handlePress('bulletin')}
          onMouseDown={() => setIsPressed('bulletin')}
          onMouseUp={() => setIsPressed(null)}
          onTouchStart={() => setIsPressed('bulletin')}
          className={`relative px-5 py-2 text-sm font-normal rounded-full transition-all duration-200 ease-out touch-manipulation ${
            value === 'bulletin'
              ? 'bg-neutral-800 dark:bg-neutral-200 text-white dark:text-neutral-900 shadow-sm'
              : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200'
          } ${isPressed === 'bulletin' ? 'scale-[0.97]' : ''}`}
        >
          Gov
        </button>
      </div>
    </div>
  );
};