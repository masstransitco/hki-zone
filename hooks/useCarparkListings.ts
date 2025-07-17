import * as React from 'react';
import { fetchCarparkListings } from '../lib/fetchCarparkListings';

export type DistrictKey = 'ALL' | 'HKI' | 'KOWLOON' | 'NT';

export interface UseCarparkListingsOpts {
  district?: DistrictKey;
  pageSize?: number;
}

export function useCarparkListings({ district = 'ALL', pageSize = 20 }: UseCarparkListingsOpts = {}) {
  const [items, setItems] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);
  const [offset, setOffset] = React.useState(0);
  const [done, setDone] = React.useState(false);

  const load = React.useCallback(async (reset = false) => {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const off = reset ? 0 : offset;
      const distParam = district === 'ALL' ? undefined : district;
      const rows = await fetchCarparkListings({ 
        district: distParam, 
        limit: pageSize, 
        offset: off,
        includePayload: true // Include payload for image selection
      });
      if (reset) {
        setItems(rows);
      } else {
        setItems(prev => [...prev, ...rows]);
      }
      setOffset(off + rows.length);
      if (rows.length < pageSize) setDone(true);
      else setDone(false);
    } catch (err: any) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [district, pageSize, offset, loading]);

  React.useEffect(() => {
    setOffset(0);
    setDone(false);
    load(true);
  }, [district]);

  return { items, loading, error, done, loadMore: () => load(false) };
}