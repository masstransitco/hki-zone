"use client"

import * as React from 'react';
import { MarketplaceCategoryType } from './marketplace-category-selector';
import MarketplaceCarsFeed from './marketplace-cars-feed';
import MarketplaceCarparkFeed from './marketplace-carpark-feed';
import { cn } from '@/lib/utils';

interface MarketplaceContentProps {
  category: MarketplaceCategoryType;
}

export default function MarketplaceContent({ category }: MarketplaceContentProps) {
  return (
    <div className="relative h-full">
      {/* Cars content */}
      <div
        role="tabpanel"
        id="cars-panel"
        aria-labelledby="cars-tab"
        className={cn(
          "absolute inset-0 transition-opacity duration-200 ease-out",
          category === 'cars' ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
      >
        <MarketplaceCarsFeed />
      </div>

      {/* Car Parks content */}
      <div
        role="tabpanel"
        id="carparks-panel"
        aria-labelledby="carparks-tab"
        className={cn(
          "absolute inset-0 transition-opacity duration-200 ease-out",
          category === 'carparks' ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
      >
        <MarketplaceCarparkFeed />
      </div>
    </div>
  );
}