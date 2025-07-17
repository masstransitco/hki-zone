"use client"

import * as React from 'react';

export type ContentType = 'headlines' | 'news';

interface ContentTypeSelectorProps {
  value: ContentType;
  onChange: (value: ContentType) => void;
}

export const ContentTypeSelector: React.FC<ContentTypeSelectorProps> = ({ value, onChange }) => {
  return (
    <div className="relative mb-8">
      {/* Background container with glass morphism effect */}
      <div className="relative bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl rounded-2xl p-1 shadow-sm border border-neutral-200/50 dark:border-neutral-700/50">
        {/* Animated background pill */}
        <div 
          className={`absolute top-1 bottom-1 w-1/2 bg-gradient-to-r from-neutral-100 to-neutral-50 dark:from-neutral-800 dark:to-neutral-750 rounded-xl shadow-sm transition-all duration-300 ease-in-out ${
            value === 'headlines' ? 'left-1' : 'left-1/2'
          }`}
          style={{
            transform: value === 'headlines' ? 'translateX(0)' : 'translateX(-1px)',
          }}
        />
        
        {/* Button container */}
        <div className="relative flex">
          <button
            onClick={() => onChange('headlines')}
            className={`flex-1 relative z-10 px-6 py-3 text-sm font-medium rounded-xl transition-all duration-300 ease-in-out ${
              value === 'headlines'
                ? 'text-neutral-900 dark:text-neutral-100 scale-[1.02]'
                : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300 active:scale-[0.98]'
            }`}
            style={{
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          >
            Headlines
          </button>
          
          <button
            onClick={() => onChange('news')}
            className={`flex-1 relative z-10 px-6 py-3 text-sm font-medium rounded-xl transition-all duration-300 ease-in-out ${
              value === 'news'
                ? 'text-neutral-900 dark:text-neutral-100 scale-[1.02]'
                : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300 active:scale-[0.98]'
            }`}
            style={{
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          >
            News
          </button>
        </div>
      </div>
    </div>
  );
};