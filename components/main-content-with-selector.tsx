"use client"

import * as React from 'react';
import { ContentTypeSelector, ContentType } from './content-type-selector';
import TopicsFeed from './topics-feed';
import NewsFeedMasonry from './news-feed-masonry';
import DatabaseStatus from './database-status';
import { ClientOnly } from './client-only';

export default function MainContentWithSelector() {
  const [contentType, setContentType] = React.useState<ContentType>('headlines');

  return (
    <div className="px-6 pt-4 pb-2">
      <ClientOnly>
        <DatabaseStatus />
      </ClientOnly>
      
      <ContentTypeSelector value={contentType} onChange={setContentType} />
      
      {contentType === 'headlines' ? (
        <TopicsFeed />
      ) : (
        <div className="-mx-6">
          <NewsFeedMasonry />
        </div>
      )}
    </div>
  );
}