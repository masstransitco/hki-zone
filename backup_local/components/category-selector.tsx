"use client"

import * as React from 'react';
import { Car, ParkingCircle } from 'lucide-react';

export type CategoryType = 'cars' | 'carparks';

export interface CategorySelectorProps {
  value: CategoryType;
  onChange: (category: CategoryType) => void;
}

export const CategorySelector: React.FC<CategorySelectorProps> = ({ value, onChange }) => {
  return (
    <div className="flex bg-neutral-100 dark:bg-neutral-800 rounded-lg p-1 mb-6">
      <button
        type="button"
        onClick={() => onChange('cars')}
        className={[
          'flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors',
          value === 'cars'
            ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-sm'
            : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100',
        ].join(' ')}
      >
        <Car className="w-4 h-4" />
        Cars
      </button>
      <button
        type="button"
        onClick={() => onChange('carparks')}
        className={[
          'flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors',
          value === 'carparks'
            ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-sm'
            : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100',
        ].join(' ')}
      >
        <ParkingCircle className="w-4 h-4" />
        Car Parks
      </button>
    </div>
  );
};