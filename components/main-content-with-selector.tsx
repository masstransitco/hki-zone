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
  // Initialize cache invalidation for language changes
  useCacheInvalidation();

  return (
    <div className="relative pb-2 h-full isolate bg-transparent">
      {/* Headlines content */}
      <div
        role="tabpanel"
        id="headlines-panel"
        aria-labelledby="headlines-tab"
        className={cn(
          "absolute inset-0 transition-opacity duration-200 ease-out isolate",
          contentType === 'headlines' ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
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
          "absolute inset-0 transition-opacity duration-200 ease-out isolate",
          contentType === 'news' ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
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
          "absolute inset-0 transition-opacity duration-200 ease-out isolate",
          contentType === 'bulletin' ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
      >
        <GovernmentBulletin 
          autoRefresh={true} 
          refreshInterval={2 * 60 * 1000} 
          isActive={contentType === 'bulletin'}
        />
      </div>
    </div>
  );
}