"use client"

import * as React from 'react';
import { useSwipeGesture } from '@/hooks/use-swipe-gesture';
import CircleNotificationsIcon from '@mui/icons-material/CircleNotifications';

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
    <div className="relative" role="tablist" aria-label="Content type selector">
      {/* Minimal background container */}
      <div ref={containerRef} className="relative rounded-xl p-0.5 shadow-sm border border-border/50 bg-muted/30 overflow-hidden touch-manipulation">
        {/* Animated background pill - simplified */}
        <div 
          className={`absolute top-0.5 bottom-0.5 w-1/3 rounded-[10px] bg-background shadow-sm transition-all duration-300 ease-out ${
            value === 'headlines' ? 'left-0.5' : value === 'news' ? 'left-1/3' : 'left-2/3'
          }`}
          style={{
            transform: value === 'headlines' ? 'translateX(0)' : value === 'news' ? 'translateX(-0.5px)' : 'translateX(-1px)',
          }}
        />
        
        {/* Button container */}
        <div className="relative flex">
          <button
            role="tab"
            aria-selected={value === 'headlines'}
            aria-controls="headlines-panel"
            id="headlines-tab"
            onClick={() => handlePress('headlines')}
            onMouseDown={() => setIsPressed('headlines')}
            onMouseUp={() => setIsPressed(null)}
            onTouchStart={() => setIsPressed('headlines')}
            className={`flex-1 relative z-10 px-3 py-2 min-h-[40px] text-sm rounded-[10px] transition-all duration-200 ease-out touch-manipulation ${
              value === 'headlines'
                ? 'text-foreground'
                : 'text-muted-foreground hover:text-foreground/80'
            } ${isPressed === 'headlines' ? 'scale-[0.98]' : ''}`}
          >
            <span className={`relative ${value === 'headlines' ? 'font-medium' : ''}`}>
              Discover
            </span>
          </button>
          
          <button
            role="tab"
            aria-selected={value === 'news'}
            aria-controls="news-panel"
            id="news-tab"
            onClick={() => handlePress('news')}
            onMouseDown={() => setIsPressed('news')}
            onMouseUp={() => setIsPressed(null)}
            onTouchStart={() => setIsPressed('news')}
            className={`flex-1 relative z-10 px-3 py-2 min-h-[40px] text-sm rounded-[10px] transition-all duration-200 ease-out touch-manipulation ${
              value === 'news'
                ? 'text-foreground'
                : 'text-muted-foreground hover:text-foreground/80'
            } ${isPressed === 'news' ? 'scale-[0.98]' : ''}`}
          >
            <span className={`relative ${value === 'news' ? 'font-medium' : ''}`}>
              News
            </span>
          </button>

          <button
            role="tab"
            aria-selected={value === 'bulletin'}
            aria-controls="bulletin-panel"
            id="bulletin-tab"
            onClick={() => handlePress('bulletin')}
            onMouseDown={() => setIsPressed('bulletin')}
            onMouseUp={() => setIsPressed(null)}
            onTouchStart={() => setIsPressed('bulletin')}
            className={`flex-1 relative z-10 px-3 py-2 min-h-[40px] text-sm rounded-[10px] transition-all duration-200 ease-out touch-manipulation ${
              value === 'bulletin'
                ? 'text-foreground'
                : 'text-muted-foreground hover:text-foreground/80'
            } ${isPressed === 'bulletin' ? 'scale-[0.98]' : ''}`}
          >
            <span className={`relative flex items-center justify-center ${value === 'bulletin' ? 'font-medium' : ''}`}>
              <CircleNotificationsIcon className="w-5 h-5" />
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};