"use client"

import * as React from 'react';
import { ContentTypeSelector, ContentType } from './content-type-selector';
import { useHeaderVisibility } from '@/contexts/header-visibility';
import { cn } from '@/lib/utils';

interface StickyCategorySelectorProps {
  value: ContentType;
  onChange: (value: ContentType) => void;
}

export default function StickyCategorySelector({ value, onChange }: StickyCategorySelectorProps) {
  const { isHeaderVisible } = useHeaderVisibility();

  const shouldHide = !isHeaderVisible;

  return (
    <div className={cn(
      "fixed top-[57px] left-0 right-0 z-30",
      "transition-transform duration-300 ease-out",
      shouldHide && "-translate-y-full"
    )}>
      <div className="px-4 py-3">
        <ContentTypeSelector value={value} onChange={onChange} />
      </div>
    </div>
  );
}