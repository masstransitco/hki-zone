"use client"

import * as React from 'react';
import { ContentType } from './content-type-selector';
import TopicsFeed from './topics-feed';
import NewsFeedMasonry from './news-feed-masonry';
import GovernmentBulletin from './government-bulletin';

interface MainContentProps {
  contentType: ContentType;
}

export default function MainContent({ contentType }: MainContentProps) {
  return (
    <div className="px-6 pt-4 pb-2">
      {contentType === 'headlines' ? (
        <TopicsFeed />
      ) : contentType === 'news' ? (
        <div className="-mx-6">
          <NewsFeedMasonry />
        </div>
      ) : contentType === 'bulletin' ? (
        <GovernmentBulletin autoRefresh={true} refreshInterval={2 * 60 * 1000} />
      ) : null}
    </div>
  );
}