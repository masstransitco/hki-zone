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
  const [displayContent, setDisplayContent] = React.useState<ContentType>(contentType);
  const prevContentType = React.useRef(contentType);
  
  // Initialize cache invalidation for language changes
  useCacheInvalidation();

  React.useEffect(() => {
    if (prevContentType.current !== contentType) {
      setIsTransitioning(true);
      
      // Fade out current content
      setTimeout(() => {
        setDisplayContent(contentType);
        // Fade in new content
        setTimeout(() => {
          setIsTransitioning(false);
        }, 50);
      }, 200);
      
      prevContentType.current = contentType;
    }
  }, [contentType]);

  const renderContent = () => {
    switch (displayContent) {
      case 'headlines':
        return <TopicsFeed />;
      case 'news':
        return (
          <div className="relative -mx-6 overflow-hidden">
            <NewsFeedMasonry />
          </div>
        );
      case 'bulletin':
        return <GovernmentBulletin autoRefresh={true} refreshInterval={2 * 60 * 1000} />;
      default:
        return null;
    }
  };

  return (
    <div className="relative px-6 pt-4 pb-2 min-h-[500px] isolate">
      <div
        role="tabpanel"
        id={`${displayContent}-panel`}
        aria-labelledby={`${displayContent}-tab`}
        className={cn(
          "transition-all duration-200 ease-out isolate",
          isTransitioning ? "opacity-0 scale-[0.98] translate-y-2" : "opacity-100 scale-100 translate-y-0"
        )}
      >
        {renderContent()}
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