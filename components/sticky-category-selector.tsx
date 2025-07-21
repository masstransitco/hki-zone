"use client"

import * as React from 'react';
import { ContentTypeSelector, ContentType } from './content-type-selector';
import { useHeaderVisibility } from '@/hooks/use-header-visibility';

interface StickyCategorySelectorProps {
  value: ContentType;
  onChange: (value: ContentType) => void;
}

export default function StickyCategorySelector({ value, onChange }: StickyCategorySelectorProps) {
  const { isVisible: headerVisible } = useHeaderVisibility();

  return (
    <div className={`sticky z-[90] bg-background/95 backdrop-blur-sm border-b border-border transition-all duration-300 ease-in-out ${
      headerVisible ? 'top-[57px]' : 'top-0'
    }`}>
      <div className="px-4 py-3">
        <ContentTypeSelector value={value} onChange={onChange} />
      </div>
    </div>
  );
}