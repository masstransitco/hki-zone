import { useState, useEffect, useCallback } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useDebounce } from '../../hooks/use-debounce';

interface CarListing {
  id: string;
  title: string;
  make?: string;
  model?: string;
  price?: string;
  year?: string;
  imageUrl?: string;
  images?: string[];
  url: string;
  publishedAt: string;
  specs?: Record<string, any>;
  source: string;
  category: string;
  rank?: number;
}

interface SearchResponse {
  cars: CarListing[];
  totalCount: number;
  hasMore: boolean;
  nextOffset: number | null;
  query: string;
  debug?: any;
}

interface SuggestionItem {
  text: string;
  type: 'make' | 'model';
  count: number;
  display: string;
}

interface SuggestionsResponse {
  suggestions: SuggestionItem[];
  query: string;
  debug?: any;
}

interface FilterOption {
  value: string;
  label: string;
  count: number;
}

interface FiltersResponse {
  makes: FilterOption[];
  years: FilterOption[];
  priceRanges: Record<string, number>;
  debug?: any;
}

const fetcher = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to fetch');
  }
  return response.json();
};

export function useCarSearch(searchTerm: string = '', limit: number = 30) {
  const debouncedTerm = useDebounce(searchTerm, 300);

  const {
    data,
    error,
    isLoading,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
    refetch
  } = useInfiniteQuery<SearchResponse>({
    queryKey: ['car-search', debouncedTerm, limit],
    queryFn: ({ pageParam = 0 }) => {
      const searchUrl = `/api/cars/search?q=${encodeURIComponent(debouncedTerm)}&limit=${limit}&offset=${pageParam}`;
      return fetcher(searchUrl);
    },
    getNextPageParam: (lastPage) => lastPage.nextOffset,
    enabled: Boolean(debouncedTerm && debouncedTerm.length > 0),
    refetchOnWindowFocus: false,
    staleTime: 5000,
    retry: false,
    initialPageParam: 0,
  });

  const refresh = useCallback(() => {
    refetch();
  }, [refetch]);

  // Flatten all pages into a single array
  const allCars = data?.pages.flatMap(page => page.cars) || [];

  return {
    cars: allCars,
    isLoading,
    error,
    hasMore: hasNextPage || false,
    totalCount: data?.pages[0]?.totalCount || 0,
    loadMore: fetchNextPage,
    isFetchingNextPage,
    refresh,
    debug: data?.pages[0]?.debug
  };
}

export function useCarSuggestions(searchTerm: string, enabled: boolean = true) {
  const debouncedTerm = useDebounce(searchTerm, 200);
  
  const shouldFetch = enabled && debouncedTerm && debouncedTerm.length >= 2;
  const suggestionsUrl = shouldFetch 
    ? `/api/cars/suggestions?q=${encodeURIComponent(debouncedTerm)}&limit=10`
    : null;

  const { data, error, isLoading } = useQuery<SuggestionsResponse>({
    queryKey: ['car-suggestions', debouncedTerm],
    queryFn: () => fetcher(suggestionsUrl!),
    enabled: Boolean(shouldFetch),
    refetchOnWindowFocus: false,
    staleTime: 10000,
    retry: false, // Don't retry if the function doesn't exist
  });

  return {
    suggestions: data?.suggestions || [],
    isLoading: shouldFetch ? isLoading : false,
    error,
    debug: data?.debug
  };
}

export function useCarFilters() {
  const { data, error, isLoading } = useQuery<FiltersResponse>({
    queryKey: ['car-filters'],
    queryFn: () => fetcher('/api/cars/filters'),
    refetchOnWindowFocus: false,
    staleTime: 30000, // Cache for 30 seconds
    retry: false, // Don't retry if the function doesn't exist
  });

  return {
    makes: data?.makes || [],
    years: data?.years || [],
    priceRanges: data?.priceRanges || {},
    isLoading,
    error,
    debug: data?.debug
  };
}

// Hook for managing search state
export function useSearchState() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMake, setSelectedMake] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<string | null>(null);
  const [priceRange, setPriceRange] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const clearFilters = useCallback(() => {
    setSelectedMake(null);
    setSelectedYear(null);
    setPriceRange(null);
  }, []);

  const clearAll = useCallback(() => {
    setSearchTerm('');
    clearFilters();
    setShowSuggestions(false);
  }, [clearFilters]);

  return {
    searchTerm,
    setSearchTerm,
    selectedMake,
    setSelectedMake,
    selectedYear,
    setSelectedYear,
    priceRange,
    setPriceRange,
    showSuggestions,
    setShowSuggestions,
    clearFilters,
    clearAll
  };
}