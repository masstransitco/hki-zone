"use client"

import * as React from 'react';
import { ContentType } from './content-type-selector';
import TopicsFeed from './topics-feed';
import NewsFeedMasonry from './news-feed-masonry';
import GovernmentBulletin from './government-bulletin';
import { cn } from '@/lib/utils';
import { useCacheInvalidation } from '@/hooks/use-cache-invalidation';

interface MainContentProps {
  contentType: ContentType;
}

export default function MainContent({ contentType }: MainContentProps) {
  const [isTransitioning, setIsTransitioning] = React.useState(false);
  const prevContentType = React.useRef(contentType);
  
  // Initialize cache invalidation for language changes
  useCacheInvalidation();

  React.useEffect(() => {
    if (prevContentType.current !== contentType) {
      setIsTransitioning(true);
      
      // Fade transition
      setTimeout(() => {
        setIsTransitioning(false);
      }, 250);
      
      prevContentType.current = contentType;
    }
  }, [contentType]);

  return (
    <div className="relative pb-2 h-full isolate bg-transparent">
      {/* Headlines content */}
      <div
        role="tabpanel"
        id="headlines-panel"
        aria-labelledby="headlines-tab"
        className={cn(
          "transition-all duration-200 ease-out isolate h-full",
          contentType === 'headlines' ? "block" : "hidden pointer-events-none",
          isTransitioning && contentType === 'headlines' ? "opacity-0 scale-[0.98] translate-y-2" : "opacity-100 scale-100 translate-y-0"
        )}
      >
        <div className="relative h-full">
          <TopicsFeed 
            isActive={contentType === 'headlines'}
          />
        </div>
      </div>

      {/* News content */}
      <div
        role="tabpanel"
        id="news-panel"
        aria-labelledby="news-tab"
        className={cn(
          "transition-all duration-200 ease-out isolate h-full",
          contentType === 'news' ? "block" : "hidden",
          isTransitioning && contentType === 'news' ? "opacity-0 scale-[0.98] translate-y-2" : "opacity-100 scale-100 translate-y-0"
        )}
      >
        <div className="relative h-full">
          <NewsFeedMasonry 
            isActive={contentType === 'news'}
          />
        </div>
      </div>

      {/* Bulletin content */}
      <div
        role="tabpanel"
        id="bulletin-panel"
        aria-labelledby="bulletin-tab"
        className={cn(
          "transition-all duration-200 ease-out isolate h-full",
          contentType === 'bulletin' ? "block" : "hidden",
          isTransitioning && contentType === 'bulletin' ? "opacity-0 scale-[0.98] translate-y-2" : "opacity-100 scale-100 translate-y-0"
        )}
      >
        <GovernmentBulletin 
          autoRefresh={true} 
          refreshInterval={2 * 60 * 1000} 
          isActive={contentType === 'bulletin'}
        />
      </div>
      
      {/* Loading shimmer during transition */}
      {isTransitioning && (
        <div className="absolute inset-0 flex items-start justify-center pt-20">
          <div className="flex gap-2">
            <div className="w-2 h-2 bg-stone-300 dark:bg-stone-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 bg-stone-300 dark:bg-stone-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 bg-stone-300 dark:bg-stone-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      )}
    </div>
  );
}