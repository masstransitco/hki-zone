import * as React from 'react';
import { useCarparkListings, DistrictKey } from '../../hooks/useCarparkListings';
import { DistrictFilter } from './DistrictFilter';
import { CarparkCard } from './CarparkCard';

export interface CarparkFeedProps {
  initialDistrict?: DistrictKey;
  pageSize?: number;
}

export const CarparkFeed: React.FC<CarparkFeedProps> = ({ initialDistrict = 'ALL', pageSize = 20 }) => {
  const [district, setDistrict] = React.useState<DistrictKey>(initialDistrict);
  const { items, loading, error, done, loadMore } = useCarparkListings({ district, pageSize });

  return (
    <div className="space-y-6">
      <DistrictFilter value={district} onChange={setDistrict} />

      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-md text-sm">
          Error loading listings: {String(error.message || error)}
        </div>
      )}

      {/* Mobile-optimized grid for parking spaces */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {items.map((row) => (
          <CarparkCard key={row.listing_id} row={row} />
        ))}
      </div>

      {/* Loading State */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="aspect-[3/2] bg-neutral-200 dark:bg-neutral-700 rounded-lg"></div>
              <div className="p-3 space-y-2">
                <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-3/4"></div>
                <div className="h-3 bg-neutral-200 dark:bg-neutral-700 rounded w-1/2"></div>
                <div className="h-3 bg-neutral-200 dark:bg-neutral-700 rounded w-1/4"></div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && items.length === 0 && !error && (
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 text-neutral-400">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-full h-full">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
            No parking spaces found
          </h3>
          <p className="text-neutral-600 dark:text-neutral-400 mb-6 max-w-sm mx-auto">
            Try adjusting your district filter or check back later for new listings.
          </p>
        </div>
      )}

      {/* Load More Button */}
      {!done && items.length > 0 && (
        <div className="flex justify-center py-6">
          <button
            type="button"
            disabled={loading}
            onClick={loadMore}
            className="px-6 py-2 rounded-lg border border-neutral-300 dark:border-neutral-600 shadow-sm text-sm font-medium bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Loading…' : 'Load More'}
          </button>
        </div>
      )}

      {/* Results Summary */}
      {items.length > 0 && (
        <div className="text-center py-4 border-t border-neutral-200 dark:border-neutral-800">
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Showing {items.length} parking spaces
            {district !== 'ALL' && ` in ${district === 'HKI' ? 'Hong Kong Island' : district === 'KOWLOON' ? 'Kowloon' : 'New Territories'}`}
          </p>
        </div>
      )}
    </div>
  );
};