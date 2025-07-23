"use client"

import * as React from 'react';
import { MarketplaceCategorySelector, MarketplaceCategoryType } from './marketplace-category-selector';
import { cn } from '@/lib/utils';

interface StickyMarketplaceSelectorProps {
  value: MarketplaceCategoryType;
  onChange: (value: MarketplaceCategoryType) => void;
}

export default function StickyMarketplaceSelector({ value, onChange }: StickyMarketplaceSelectorProps) {
  return (
    <div className={cn(
      "fixed top-[57px] left-0 right-0 z-30"
    )}>
      <div className="px-4 py-3">
        <MarketplaceCategorySelector value={value} onChange={onChange} />
      </div>
    </div>
  );
}