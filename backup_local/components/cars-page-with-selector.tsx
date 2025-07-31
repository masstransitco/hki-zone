"use client"

import * as React from 'react';
import { CategorySelector, CategoryType } from './category-selector';
import CarsFeedWithSearch from './cars-feed-with-search';
import { CarparkFeed } from './carparks/CarparkFeed';

export default function CarsPageWithSelector() {
  const [category, setCategory] = React.useState<CategoryType>('cars');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="pt-16 pb-2">
        <CategorySelector value={category} onChange={setCategory} />
      </div>
      
      {category === 'cars' ? (
        <CarsFeedWithSearch />
      ) : (
        <CarparkFeed />
      )}
    </div>
  );
}