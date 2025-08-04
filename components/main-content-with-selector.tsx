"use client"

import * as React from 'react';
import { motion, useMotionValue, animate } from 'framer-motion';
import { ContentType, getContentConfig } from './content-type-selector';
import TopicsFeedRedux from './topics-feed-redux';
import NewsFeedMasonry from './news-feed-masonry';
import GovernmentBulletin from './government-bulletin';
import { cn } from '@/lib/utils';
import { useCacheInvalidation } from '@/hooks/use-cache-invalidation';

interface MainContentProps {
  contentType: ContentType;
  onContentTypeChange?: (type: ContentType) => void;
}

export default function MainContent({ contentType, onContentTypeChange }: MainContentProps) {
  // Initialize cache invalidation for language changes
  useCacheInvalidation();

  const contentTypes: ContentType[] = ['headlines', 'finance', 'techScience', 'entertainment', 'international', 'news', 'bulletin'];
  const currentIndex = contentTypes.indexOf(contentType);
  
  // Framer Motion values for smooth category animations only
  const x = useMotionValue(0);  
  const [screenWidth, setScreenWidth] = React.useState(375);

  // Update screen width on mount and resize
  React.useEffect(() => {
    const updateScreenWidth = () => {
      setScreenWidth(window.innerWidth);
    };
    
    if (typeof window !== 'undefined') {
      updateScreenWidth();
      window.addEventListener('resize', updateScreenWidth);
      return () => window.removeEventListener('resize', updateScreenWidth);
    }
  }, []);

  // Helper function to render content based on type
  const renderContent = (type: ContentType) => {
    const config = getContentConfig(type);
    const isActive = contentType === type;
    
    if (type === 'news') {
      return (
        <NewsFeedMasonry 
          isActive={isActive}
        />
      );
    } else if (type === 'bulletin') {
      return (
        <GovernmentBulletin 
          autoRefresh={true} 
          refreshInterval={2 * 60 * 1000} 
          isActive={isActive}
        />
      );
    } else {
      return (
        <TopicsFeedRedux 
          isActive={isActive}
          category={config.category}
        />
      );
    }
  };

  // Calculate the target position for the current index
  const targetX = -currentIndex * screenWidth;

  // Animate to target position when contentType changes (button press only)
  React.useEffect(() => {
    animate(x, targetX, {
      type: "spring",
      stiffness: 300,
      damping: 30,
      mass: 0.8
    });
  }, [x, targetX]);

  return (
    <div className="relative pb-2 h-full isolate bg-transparent">
      <motion.div
        className="flex h-full will-change-transform"
        style={{ 
          x,
          width: `${contentTypes.length * screenWidth}px`
        }}
      >
        {contentTypes.map((type, index) => (
          <div
            key={type}
            role="tabpanel"
            id={`${type}-panel`}
            aria-labelledby={`${type}-tab`}
            className="flex-shrink-0 h-full isolate overflow-y-auto overflow-x-hidden feed-vertical-scrollbar"
            style={{ width: `${screenWidth}px` }}
          >
            <div className="relative h-full overflow-y-auto feed-vertical-scrollbar">
              {renderContent(type)}
            </div>
          </div>
        ))}
      </motion.div>
    </div>
  );
}