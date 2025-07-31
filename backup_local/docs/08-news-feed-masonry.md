# News Feed Masonry Implementation

## Overview

The news feed masonry implementation provides a responsive waterfall layout for displaying articles with variable heights, creating an engaging Pinterest-style grid. This document covers the implementation details, recent improvements, and troubleshooting guide.

## Architecture

### Components

1. **NewsFeedMasonry** (`/components/news-feed-masonry.tsx`)
   - Main component managing the masonry layout
   - Handles infinite scroll and article loading
   - Manages aspect ratio distribution

2. **ArticleCard** (`/components/article-card.tsx`)
   - Individual article display component
   - Supports variable aspect ratios
   - Handles article interactions

3. **CSS Implementation** (`/app/globals.css`)
   - Progressive enhancement approach
   - CSS-first with JavaScript fallback
   - Responsive breakpoints

## Implementation Strategy

### Three-Tier Approach

1. **Primary: CSS Multi-Column Layout**
   - Uses `column-count` for broad browser support
   - Natural waterfall flow
   - Minimal JavaScript overhead

2. **Enhanced: CSS Grid Masonry**
   - Uses `grid-auto-rows: masonry` when supported
   - Better control over spacing
   - Progressive enhancement

3. **Fallback: JavaScript Masonry**
   - Masonry.js library for legacy browsers
   - Absolute positioning with calculated layouts
   - Performance optimized

### CSS Implementation

```css
/* Default: CSS columns for waterfall effect */
.news-feed {
  column-count: 2;
  column-gap: 12px;
  padding: 0 16px;
}

/* CSS Grid masonry for browsers that support it */
@supports (grid-template-rows: masonry) {
  .news-feed {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    grid-auto-rows: masonry;
    grid-gap: 12px;
    column-count: unset;
  }
}
```

### Responsive Breakpoints

- **Mobile (< 640px)**: 2 columns, 12px gap
- **Small (640px+)**: 2 columns, 16px gap
- **Medium (768px+)**: 3 columns, 20px gap
- **Large (1024px+)**: 4 columns, 24px gap
- **XL (1280px+)**: 5 columns, 24px gap

## Article Card Layout

### Variable Aspect Ratios

```javascript
const ASPECT_RATIOS = [
  { class: "aspect-ratio-16-9", weight: 40 }, // 40% landscape
  { class: "aspect-ratio-1-1", weight: 35 },   // 35% square
  { class: "aspect-ratio-4-5", weight: 25 }    // 25% portrait
]
```

### Deterministic Distribution

- Uses article ID as seed for consistent aspect ratios
- Ensures visual variety while maintaining reproducibility
- Prevents layout shifts on re-renders

## Infinite Scroll Implementation

### Core Logic

```javascript
const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
  queryKey: ["articles"],
  queryFn: fetchArticles,
  getNextPageParam: (lastPage) => lastPage.nextPage,
  initialPageParam: 0,
})

// Fetch function excludes AI enhanced articles
async function fetchArticles({ pageParam = 0 }) {
  const response = await fetch(`/api/articles?page=${pageParam}&enriched=false`)
  return response.json()
}

// Intersection observer for triggering loads
const { ref, inView } = useInView({ rootMargin: "600px" })

useEffect(() => {
  if (inView && hasNextPage && !isFetchingNextPage) {
    fetchNextPage()
  }
}, [inView, hasNextPage, isFetchingNextPage, fetchNextPage])
```

### Pagination Strategy

- **Page Size**: 10 articles per page
- **Preload Distance**: 600px before reaching bottom
- **Peek-ahead Logic**: Checks next page availability
- **Error Handling**: Graceful fallbacks to mock data

## Recent Improvements (Session Updates)

### 1. Excluded AI Enhanced Articles

**Purpose**: Remove AI enhanced articles from the news feed masonry to show only original content.

**Implementation**:
- Modified `fetchArticles()` function to include `enriched=false` parameter
- Updated API endpoint to properly handle `isAiEnhanced` filter
- Fixed parameter mapping from `hasEnrichment` to `isAiEnhanced`

**Files Modified**:
- `/components/news-feed-masonry.tsx`: Line 14
- `/app/api/articles/route.ts`: Lines 164-165

**Benefits**:
- Clean separation between original and AI-enhanced content
- Users see only source articles in the main news feed
- AI-enhanced articles available separately in other sections

### 2. Fixed Masonry Layout Issues

**Problem**: Cards were rendering in rows instead of columns, causing poor space utilization.

**Solution**:
- Switched to CSS multi-column layout as primary approach
- Added proper `@supports` queries for progressive enhancement
- Fixed card positioning with `display: inline-block` and `break-inside: avoid`

**Files Modified**:
- `/app/globals.css`: Lines 285-470
- `/components/news-feed-masonry.tsx`: Lines 71-192

### 2. Streamlined Implementation

**Changes Made**:
- Simplified CSS-first approach with three-tier fallback
- Removed complex JavaScript calculations
- Improved performance with native CSS solutions

**Benefits**:
- Better browser compatibility
- Reduced JavaScript overhead
- More predictable layouts

### 3. Fixed Infinite Scroll Pagination

**Problem**: Infinite scroll stopped at 70-80 articles despite having 1000+ available.

**Root Causes**:
- Broken balanced articles logic in `getBalancedArticles()`
- Incorrect `nextPage` detection in API response
- Flawed pagination with `limit + slice` approach

**Solutions Applied**:

#### A. Fixed Pagination Logic (`/lib/supabase.ts`)
```javascript
// Before (broken)
const { data, error } = await query.limit(sourceLimit * (page + 1))
const sourceArticles = data.slice(startIndex, startIndex + sourceLimit)

// After (fixed)
const { data, error } = await query.range(startIndex, endIndex)
```

#### B. Enhanced nextPage Detection (`/app/api/articles/route.ts`)
```javascript
// Better nextPage logic with peek-ahead
let hasMore = false
if (transformedArticles.length === limit) {
  const nextPageArticles = await getArticles(page + 1, 1, filters)
  hasMore = nextPageArticles.length > 0
}
```

#### C. Simplified Main Query (`/lib/supabase.ts`)
```javascript
// Switched to regular query for better pagination reliability
export async function getArticles(page = 0, limit = 10, filters?) {
  return getArticlesRegular(page, limit, filters)
}
```

### 4. Consistent Spacing Implementation

**Problem**: Inconsistent spacing between CSS Grid and JavaScript masonry fallbacks.

**Solution**:
- Unified spacing configuration across all implementations
- Responsive gap adjustments
- Proper margin handling for last cards

**CSS Updates**:
```css
.news-card {
  margin-bottom: 12px; /* Base vertical spacing */
}

@media (min-width: 640px) {
  .news-card { margin-bottom: 16px; }
}

@media (min-width: 768px) {
  .news-card { margin-bottom: 20px; }
}

@media (min-width: 1024px) {
  .news-card { margin-bottom: 24px; }
}
```

## Performance Optimizations

### 1. Image Loading
- Uses `loading="lazy"` for images
- Proper aspect ratio containers prevent layout shifts
- Optimized image dimensions

### 2. JavaScript Masonry
- Only loads when CSS solutions fail
- Debounced resize handling (100ms)
- Disabled animations (`transitionDuration: 0`)
- Proper cleanup on unmount

### 3. Infinite Scroll
- Large preload margin (600px) for smooth UX
- Efficient intersection observer
- Minimal re-renders with React Query

## Troubleshooting Guide

### Common Issues

#### 1. Cards Not Flowing in Columns
**Symptoms**: Cards appear in rows instead of waterfall layout

**Solutions**:
- Check if `column-count` is being applied correctly
- Verify `break-inside: avoid` is set on cards
- Ensure `display: inline-block` for card containers

#### 2. Infinite Scroll Stopping Early
**Symptoms**: Stops loading at 70-80 articles

**Debug Steps**:
1. Check browser console for `nextPage` values
2. Verify database has more articles: `SELECT COUNT(*) FROM articles;`
3. Test API directly: `/api/articles?page=8`
4. Check if `hasNextPage` is becoming false prematurely

#### 3. Inconsistent Spacing
**Symptoms**: Gaps vary between different screen sizes

**Solutions**:
- Verify responsive media queries are working
- Check if JavaScript masonry is overriding CSS
- Ensure proper margin calculations

#### 4. Layout Shifts During Loading
**Symptoms**: Cards jump around when images load

**Solutions**:
- Implement proper aspect ratio containers
- Use `imagesLoaded` library for JavaScript fallback
- Pre-calculate image dimensions when possible

### Performance Issues

#### 1. Slow Initial Load
- Reduce initial page size if needed
- Implement skeleton loading states
- Optimize image sizes and formats

#### 2. Memory Leaks
- Verify masonry cleanup on unmount
- Check for proper event listener removal
- Monitor React Query cache size

#### 3. Poor Scroll Performance
- Reduce intersection observer margin if needed
- Implement virtual scrolling for very large datasets
- Optimize re-render frequency

## Testing

### Manual Testing Checklist

1. **Layout Verification**
   - [ ] 2-column minimum on mobile
   - [ ] Proper scaling across breakpoints
   - [ ] No broken card layouts
   - [ ] Consistent spacing

2. **Infinite Scroll**
   - [ ] Loads more content when scrolling
   - [ ] Shows loading indicator
   - [ ] Handles end of content gracefully
   - [ ] Works across all breakpoints

3. **Aspect Ratio Distribution**
   - [ ] Mix of landscape/square/portrait cards
   - [ ] Consistent ratios on refresh
   - [ ] No layout shifts

4. **Performance**
   - [ ] Smooth scrolling
   - [ ] No memory leaks
   - [ ] Responsive resize handling

### Browser Compatibility

- **Modern Browsers**: CSS Grid Masonry (where supported)
- **Standard Browsers**: CSS Multi-Column Layout
- **Legacy Browsers**: JavaScript Masonry Fallback

## Future Improvements

### Potential Enhancements

1. **Virtual Scrolling**
   - Implement for very large datasets (10k+ articles)
   - Reduce DOM nodes for better performance

2. **Advanced Filtering**
   - Category-based masonry layouts
   - Source-balanced infinite scroll
   - Real-time updates

3. **Accessibility**
   - Keyboard navigation improvements
   - Screen reader optimizations
   - Focus management

4. **Analytics**
   - Track scroll depth
   - Monitor layout performance
   - A/B test different aspect ratio distributions

## Conclusion

The news feed masonry implementation provides a robust, scalable solution for displaying articles in an engaging waterfall layout. The recent improvements have addressed major issues with infinite scroll pagination and layout consistency, resulting in a smooth user experience that works across all devices and browsers.

The three-tier approach ensures maximum compatibility while leveraging modern CSS features where available, providing excellent performance and maintainability.