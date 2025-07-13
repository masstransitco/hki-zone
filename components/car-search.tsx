'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { useCarSearch, useCarSuggestions, useSearchState } from '../lib/hooks/use-car-search';
import { cn } from '../lib/utils';

interface CarSearchProps {
  onResults?: (results: any[], isSearching: boolean) => void;
  className?: string;
}

function CarSearch({ onResults, className }: CarSearchProps) {
  const {
    searchTerm,
    setSearchTerm,
    showSuggestions,
    setShowSuggestions,
    clearAll
  } = useSearchState();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const isSearchingRef = useRef(false);
  const lastNotifiedState = useRef<{searchTerm: string, resultsCount: number}>({searchTerm: '', resultsCount: 0});

  // Build effective search query
  const effectiveSearchTerm = useMemo(() => {
    const term = searchTerm.trim();
    
    // Update the searching flag
    isSearchingRef.current = term.length > 0;
    
    return term;
  }, [searchTerm]);

  const { cars: rawCars, isLoading, hasMore, loadMore, debug } = useCarSearch(effectiveSearchTerm);
  const { suggestions, isLoading: suggestionsLoading } = useCarSuggestions(
    searchTerm, 
    Boolean(showSuggestions)
  );

  // Pass results to parent - notify when search term or results change
  useEffect(() => {
    const isSearching = effectiveSearchTerm.trim().length > 0;
    const currentState = {searchTerm: effectiveSearchTerm, resultsCount: rawCars.length};
    
    // Only notify if something actually changed
    if (currentState.searchTerm !== lastNotifiedState.current.searchTerm || 
        currentState.resultsCount !== lastNotifiedState.current.resultsCount) {
      lastNotifiedState.current = currentState;
      onResults?.(rawCars, isSearching);
    }
  }, [effectiveSearchTerm, rawCars.length]);

  // Handle clicking outside suggestions
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        searchInputRef.current &&
        !searchInputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [setShowSuggestions]);

  const handleSuggestionClick = (suggestion: any) => {
    setSearchTerm(suggestion.text);
    setShowSuggestions(false);
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Search Input with Suggestions */}
      <div className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            ref={searchInputRef}
            type="text"
            placeholder="Search cars by make, model..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            className="pl-10 pr-12"
          />
          {searchTerm && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchTerm('');
                setShowSuggestions(false);
              }}
              className="absolute right-1 top-1 h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Suggestions Dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div
            ref={suggestionsRef}
            className="absolute top-full left-0 right-0 z-50 mt-1 bg-background border rounded-md shadow-lg max-h-60 overflow-auto"
          >
            {suggestions.map((suggestion, index) => (
              <button
                key={`${suggestion.type}-${suggestion.text}-${index}`}
                onClick={() => handleSuggestionClick(suggestion)}
                className="w-full px-3 py-2 text-left hover:bg-muted text-sm flex items-center gap-2"
              >
                <Search className="h-4 w-4 text-muted-foreground" />
                <span className="flex-1">{suggestion.text}</span>
                <span className="text-xs text-muted-foreground">({suggestion.count})</span>
              </button>
            ))}
          </div>
        )}
      </div>



      {/* Search Results Summary */}
      {!isLoading && rawCars.length > 0 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Found {rawCars.length} car{rawCars.length !== 1 ? 's' : ''}
            {effectiveSearchTerm && ` for "${effectiveSearchTerm}"`}
          </span>
          {hasMore && (
            <Button variant="outline" size="sm" onClick={loadMore}>
              Load more
            </Button>
          )}
        </div>
      )}

      {/* No Results - only show when search is complete and has no results */}
      {!isLoading && rawCars.length === 0 && effectiveSearchTerm.trim().length > 0 && (
        <div className="text-center py-8">
          <Search className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
          <h3 className="text-lg font-medium mb-1">No cars found</h3>
          <p className="text-muted-foreground mb-4">
            Try adjusting your search terms or filters
          </p>
          <Button variant="outline" onClick={clearAll}>
            Clear all filters
          </Button>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
          <p className="text-muted-foreground">Searching cars...</p>
        </div>
      )}

      {/* Debug Info (dev only) */}
      {debug && process.env.NODE_ENV === 'development' && (
        <details className="text-xs text-muted-foreground">
          <summary>Debug Info</summary>
          <pre className="mt-2 p-2 bg-muted rounded overflow-auto">
            {JSON.stringify(debug, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}

export default CarSearch;