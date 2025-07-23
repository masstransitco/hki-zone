"use client"

import * as React from 'react';
import { Car, ParkingCircle } from 'lucide-react';

export type MarketplaceCategoryType = 'cars' | 'carparks';

interface MarketplaceCategorySelectorProps {
  value: MarketplaceCategoryType;
  onChange: (value: MarketplaceCategoryType) => void;
}

export const MarketplaceCategorySelector: React.FC<MarketplaceCategorySelectorProps> = ({ value, onChange }) => {
  const [isPressed, setIsPressed] = React.useState<MarketplaceCategoryType | null>(null)

  const handlePress = (type: MarketplaceCategoryType) => {
    setIsPressed(type)
    onChange(type)
    setTimeout(() => setIsPressed(null), 150)
  }

  return (
    <div className="relative flex justify-center" role="tablist" aria-label="Marketplace category selector">
      {/* Minimalist pill container - matches main app */}
      <div className="inline-flex gap-1 p-1 bg-transparent rounded-full touch-manipulation">
        {/* Cars button */}
        <button
          role="tab"
          aria-selected={value === 'cars'}
          aria-controls="cars-panel"
          id="cars-tab"
          onClick={() => handlePress('cars')}
          onMouseDown={() => setIsPressed('cars')}
          onMouseUp={() => setIsPressed(null)}
          onTouchStart={() => setIsPressed('cars')}
          className={`relative px-5 py-2 text-sm font-normal rounded-full transition-all duration-200 ease-out touch-manipulation flex items-center gap-2 ${
            value === 'cars'
              ? 'bg-neutral-800 dark:bg-neutral-200 text-white dark:text-neutral-900 shadow-sm'
              : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200'
          } ${isPressed === 'cars' ? 'scale-[0.97]' : ''}`}
        >
          <Car className="w-4 h-4" />
          Cars
        </button>
        
        {/* Car Parks button */}
        <button
          role="tab"
          aria-selected={value === 'carparks'}
          aria-controls="carparks-panel"
          id="carparks-tab"
          onClick={() => handlePress('carparks')}
          onMouseDown={() => setIsPressed('carparks')}
          onMouseUp={() => setIsPressed(null)}
          onTouchStart={() => setIsPressed('carparks')}
          className={`relative px-5 py-2 text-sm font-normal rounded-full transition-all duration-200 ease-out touch-manipulation flex items-center gap-2 ${
            value === 'carparks'
              ? 'bg-neutral-800 dark:bg-neutral-200 text-white dark:text-neutral-900 shadow-sm'
              : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200'
          } ${isPressed === 'carparks' ? 'scale-[0.97]' : ''}`}
        >
          <ParkingCircle className="w-4 h-4" />
          Car Parks
        </button>
      </div>
    </div>
  );
};