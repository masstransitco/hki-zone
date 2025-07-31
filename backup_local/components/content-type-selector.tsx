"use client"

import * as React from 'react';
import { useLanguage } from './language-provider';

export type ContentType = 'headlines' | 'news' | 'bulletin';

interface ContentTypeSelectorProps {
  value: ContentType;
  onChange: (value: ContentType) => void;
}

const contentTypes: ContentType[] = ['headlines', 'news', 'bulletin'];

export const ContentTypeSelector: React.FC<ContentTypeSelectorProps> = ({ value, onChange }) => {
  const [isPressed, setIsPressed] = React.useState<ContentType | null>(null)
  const { t } = useLanguage()

  const handlePress = (type: ContentType) => {
    setIsPressed(type)
    onChange(type)
    setTimeout(() => setIsPressed(null), 150)
  }

  return (
    <div className="relative flex justify-center" role="tablist" aria-label="Content type selector">
      {/* Minimalist pill container */}
      <div className="inline-flex gap-1 p-1 bg-transparent rounded-full touch-manipulation">
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
          className={`relative px-5 py-2 text-sm font-medium rounded-full transition-all duration-200 ease-out touch-manipulation font-sans ${
            value === 'headlines'
              ? 'bg-neutral-800 dark:bg-neutral-200 text-white dark:text-neutral-900 shadow-sm'
              : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200'
          } ${isPressed === 'headlines' ? 'scale-[0.97]' : ''}`}
          style={{ 
            fontFamily: '"Inter", "SF Pro Display", "Noto Sans CJK SC", "Noto Sans CJK TC", "PingFang SC", "PingFang TC", "Hiragino Sans GB", "Microsoft YaHei", "Helvetica Neue", system-ui, sans-serif',
            letterSpacing: '-0.01em'
          }}
        >
          {t('content.discover')}
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
          className={`relative px-5 py-2 text-sm font-medium rounded-full transition-all duration-200 ease-out touch-manipulation font-sans ${
            value === 'news'
              ? 'bg-neutral-800 dark:bg-neutral-200 text-white dark:text-neutral-900 shadow-sm'
              : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200'
          } ${isPressed === 'news' ? 'scale-[0.97]' : ''}`}
          style={{ 
            fontFamily: '"Inter", "SF Pro Display", "Noto Sans CJK SC", "Noto Sans CJK TC", "PingFang SC", "PingFang TC", "Hiragino Sans GB", "Microsoft YaHei", "Helvetica Neue", system-ui, sans-serif',
            letterSpacing: '-0.01em'
          }}
        >
          {t('content.news')}
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
          className={`relative px-5 py-2 text-sm font-medium rounded-full transition-all duration-200 ease-out touch-manipulation font-sans ${
            value === 'bulletin'
              ? 'bg-neutral-800 dark:bg-neutral-200 text-white dark:text-neutral-900 shadow-sm'
              : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200'
          } ${isPressed === 'bulletin' ? 'scale-[0.97]' : ''}`}
          style={{ 
            fontFamily: '"Inter", "SF Pro Display", "Noto Sans CJK SC", "Noto Sans CJK TC", "PingFang SC", "PingFang TC", "Hiragino Sans GB", "Microsoft YaHei", "Helvetica Neue", system-ui, sans-serif',
            letterSpacing: '-0.01em'
          }}
        >
          {t('content.gov')}
        </button>
      </div>
    </div>
  );
};