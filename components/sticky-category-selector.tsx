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
    <div className={`sticky z-40 transition-all duration-300 ease-in-out ${
      headerVisible ? 'top-[57px]' : 'top-0'
    }`}>
      <div className="px-6 py-4">
        <ContentTypeSelector value={value} onChange={onChange} />
      </div>
    </div>
  );
}