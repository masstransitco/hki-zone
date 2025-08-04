"use client"

import * as React from 'react';
import { motion, PanInfo, useMotionValue, useTransform, animate } from 'framer-motion';
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
  
  // Framer Motion values for drag and animation
  const x = useMotionValue(0);  
  const containerRef = React.useRef<HTMLDivElement>(null);
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

  // Animate to target position when contentType changes
  React.useEffect(() => {
    animate(x, targetX, {
      type: "spring",
      stiffness: 300,
      damping: 30,
      mass: 0.8
    });
  }, [x, targetX]);

  // Handle drag end to determine if we should change content type
  const handleDragEnd = React.useCallback((event: any, info: PanInfo) => {
    console.log('Drag ended:', { offset: info.offset, velocity: info.velocity, currentIndex });
    
    if (!onContentTypeChange) {
      console.log('No onContentTypeChange handler');
      return;
    }

    const { offset, velocity } = info;
    const swipeThreshold = 10; // Very sensitive - just 10px drag
    const velocityThreshold = 5; // Very low velocity threshold - 5px/s

    // Determine if we should swipe based on distance or velocity
    const shouldSwipeLeft = offset.x < -swipeThreshold || velocity.x < -velocityThreshold;
    const shouldSwipeRight = offset.x > swipeThreshold || velocity.x > velocityThreshold;

    console.log('Swipe detection:', { 
      shouldSwipeLeft, 
      shouldSwipeRight, 
      offsetX: offset.x, 
      velocityX: velocity.x,
      swipeThreshold,
      velocityThreshold
    });

    if (shouldSwipeLeft) {
      // Swipe to next content type (with wrapping)
      const nextIndex = (currentIndex + 1) % contentTypes.length;
      console.log('Swiping to next:', contentTypes[nextIndex]);
      onContentTypeChange(contentTypes[nextIndex]);
    } else if (shouldSwipeRight) {
      // Swipe to previous content type (with wrapping)
      const prevIndex = (currentIndex - 1 + contentTypes.length) % contentTypes.length;
      console.log('Swiping to previous:', contentTypes[prevIndex]);
      onContentTypeChange(contentTypes[prevIndex]);
    } else {
      console.log('Snapping back to current position');
      // Snap back to current position
      animate(x, targetX, {
        type: "spring",
        stiffness: 400,
        damping: 40
      });
    }
  }, [currentIndex, contentTypes, onContentTypeChange, screenWidth, x, targetX]);

  // Simplified drag constraints - allow full drag range
  const dragConstraints = React.useMemo(() => {
    // Allow dragging the full screen width in both directions
    // Framer Motion will handle the boundaries naturally
    return {
      left: -screenWidth,
      right: screenWidth
    };
  }, [screenWidth]);

  return (
    <div className="relative pb-2 h-full isolate bg-transparent overflow-hidden">
      <motion.div
        ref={containerRef}
        className="flex h-full will-change-transform cursor-grab active:cursor-grabbing"
        style={{ 
          x,
          width: `${contentTypes.length * screenWidth}px`,
          touchAction: 'pan-y' // Allow vertical scrolling within content
        }}
        drag="x"
        dragConstraints={dragConstraints}
        dragElastic={0.1}
        dragMomentum={false}
        onDragEnd={handleDragEnd}
        whileDrag={{ cursor: 'grabbing' }}
      >
        {contentTypes.map((type, index) => (
          <div
            key={type}
            role="tabpanel"
            id={`${type}-panel`}
            aria-labelledby={`${type}-tab`}
            className="flex-shrink-0 h-full isolate"
            style={{ width: `${screenWidth}px` }}
          >
            <div className="relative h-full">
              {renderContent(type)}
            </div>
          </div>
        ))}
      </motion.div>
    </div>
  );
}