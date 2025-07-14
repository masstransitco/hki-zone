# Share Functionality Implementation

## Overview

The HKI News App implements a comprehensive sharing system that supports multiple content types: news articles, AI-generated signals (Perplexity articles), and car listings. The share functionality provides both native sharing capabilities and fallback mechanisms, with content-specific URL generation and analytics tracking.

## Architecture

### Universal ShareButton Component

The `ShareButton` component serves as a universal sharing solution that intelligently handles different content types through a unified interface.

```typescript
interface ShareButtonProps {
  articleId: string
  title?: string
  url?: string
  article?: Article
  car?: any
  isPerplexityArticle?: boolean
  compact?: boolean
}
```

### Content Type Detection

The component automatically detects content type and generates appropriate sharing content:

```typescript
// Content type detection
const isCarListing = !!car
const isPerplexityArticle = Boolean(isPerplexityArticle)
const isRegularArticle = !isCarListing && !isPerplexityArticle

// Dynamic URL generation
const shareUrl = isCarListing 
  ? `${baseUrl}/cars` 
  : isPerplexityArticle 
    ? `${baseUrl}/perplexity`
    : `${baseUrl}/article/${articleId}`
```

## Content-Specific Implementation

### 1. **Car Listings Share**

**Integration:**
```typescript
// In car-bottom-sheet.tsx
<ShareButton 
  articleId={car.id} 
  car={car}
  compact={true}
/>
```

**Generated Content:**
```typescript
const shareTitle = `${car.title || 'Car Listing'} - HKI Cars`
const shareDescription = `${car.title}${car.price ? ` - ${car.price}` : ''}${car.year ? ` (${car.year})` : ''}. View this car listing and more on HKI Cars.`
const shareUrl = `${baseUrl}/cars`
```

**Share Content Example:**
```
Title: BMW X5 xDrive40i - HKI Cars
Description: BMW X5 xDrive40i - HK$850,000 (2023). View this car listing and more on HKI Cars.
URL: https://hki.zone/cars
```

**Analytics Tracking:**
```typescript
analytics.trackEvent('car_share', { 
  carId: articleId, 
  method: 'native' | 'copy' 
})
```

### 2. **Signal Articles Share (Perplexity)**

**Integration:**
```typescript
// In perplexity-public-list.tsx
<ArticleBottomSheet
  articleId={selectedArticleId}
  open={bottomSheetOpen}
  onOpenChange={setBottomSheetOpen}
  isPerplexityArticle={true}
/>

// Which passes to share-button.tsx
<ShareButton 
  articleId={articleId} 
  isPerplexityArticle={isPerplexityArticle}
  compact={true}
/>
```

**API Endpoint Detection:**
```typescript
// Automatically uses correct API endpoint
const endpoint = isPerplexityArticle 
  ? `/api/perplexity/${articleId}` 
  : `/api/articles/${articleId}`
```

**Generated Content:**
```typescript
const shareTitle = `${articleData?.title || 'Signal'} - HKI Signals`
const shareDescription = `${articleData?.summary || articleData?.title || 'Signal article'}. Read this signal and more AI-generated insights on HKI Signals.`
const shareUrl = `${baseUrl}/perplexity`
```

**Share Content Example:**
```
Title: Hong Kong Government Unveils 2024 Digital Governance Initiative - HKI Signals
Description: A comprehensive digital governance initiative for 2024 focusing on streamlining public services and enhancing citizen engagement through technology. Read this signal and more AI-generated insights on HKI Signals.
URL: https://hki.zone/perplexity
```

**Analytics Tracking:**
```typescript
analytics.trackEvent('signal_share', { 
  signalId: articleId, 
  method: 'native' | 'copy' 
})
```

### 3. **Regular Articles Share**

**Integration:**
```typescript
// In article-bottom-sheet.tsx (default behavior)
<ShareButton 
  articleId={articleId} 
  compact={true}
/>
```

**Generated Content:**
```typescript
const shareTitle = articleData?.title || "HKI 香港資訊 Article"
const shareDescription = articleData?.summary || articleData?.content?.substring(0, 200) || "Read the latest Hong Kong news"
const shareUrl = `${baseUrl}/article/${articleId}`
```

**Analytics Tracking:**
```typescript
analytics.trackArticleShare(articleId, "native" | "copy")
```

## Technical Implementation

### Progressive Fallback Strategy

The share functionality implements a three-tier fallback system:

```typescript
const handleShare = async () => {
  if (navigator.share) {
    // 1. Native sharing (mobile-first)
    try {
      await navigator.share({
        title: shareTitle,
        text: shareDescription,
        url: shareUrl,
      })
      trackAnalytics('native')
    } catch (error) {
      console.log('Share cancelled or failed:', error)
    }
  } else {
    // 2. Clipboard with formatted text
    try {
      const shareText = `${shareTitle}\n\n${shareDescription}\n\n${shareUrl}`
      await navigator.clipboard.writeText(shareText)
      setCopied(true)
      trackAnalytics('copy')
    } catch (error) {
      // 3. Simple URL copy fallback
      try {
        await navigator.clipboard.writeText(shareUrl)
        setCopied(true)
        trackAnalytics('copy')
      } catch (fallbackError) {
        console.error("Failed to copy to clipboard:", fallbackError)
      }
    }
  }
}
```

### Data Fetching Strategy

```typescript
// Intelligent API endpoint selection
useEffect(() => {
  if (!articleData && !article && !isCarListing) {
    const fetchArticleData = async () => {
      try {
        const endpoint = isPerplexityArticle 
          ? `/api/perplexity/${articleId}` 
          : `/api/articles/${articleId}`
        const response = await fetch(endpoint)
        if (response.ok) {
          const data = await response.json()
          setArticleData(data)
        }
      } catch (error) {
        console.error('Failed to fetch article data for sharing:', error)
      }
    }
    fetchArticleData()
  }
}, [articleId, article, articleData, isCarListing, isPerplexityArticle])
```

### Change Detection System

To prevent infinite loops, the component implements a change detection system:

```typescript
const lastNotifiedState = useRef<{searchTerm: string, resultsCount: number}>({
  searchTerm: '', 
  resultsCount: 0
})

useEffect(() => {
  const currentState = {searchTerm: effectiveSearchTerm, resultsCount: rawCars.length}
  
  // Only notify if something actually changed
  if (currentState.searchTerm !== lastNotifiedState.current.searchTerm || 
      currentState.resultsCount !== lastNotifiedState.current.resultsCount) {
    lastNotifiedState.current = currentState
    onResults?.(rawCars, isSearching)
  }
}, [effectiveSearchTerm, rawCars.length])
```

## Bottom Sheet Integration

### Enhanced ArticleBottomSheet

The `ArticleBottomSheet` component now supports content type awareness:

```typescript
interface ArticleBottomSheetProps {
  articleId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  isPerplexityArticle?: boolean  // New prop for signals
}

export default function ArticleBottomSheet({ 
  articleId, 
  open, 
  onOpenChange,
  isPerplexityArticle = false
}: ArticleBottomSheetProps) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        {/* Share button with content type awareness */}
        <ShareButton 
          articleId={articleId} 
          isPerplexityArticle={isPerplexityArticle}
          compact={true}
        />
        {/* Content display */}
        <ArticleDetailSheet articleId={articleId} />
      </DrawerContent>
    </Drawer>
  )
}
```

### Car-Specific Bottom Sheet

```typescript
export default function CarBottomSheet({ car, open, onOpenChange }: CarBottomSheetProps) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        {/* Car-specific share button */}
        <ShareButton 
          articleId={car.id} 
          car={car}
          compact={true}
        />
        {/* Car detail display */}
        <CarDetailSheet car={car} />
      </DrawerContent>
    </Drawer>
  )
}
```

## Bug Fixes Implemented

### 1. **Car Share Button Fix (January 2025)**

**Problem:** Car bottom sheet was sharing mock article data instead of actual car information.

**Root Cause:** ShareButton was fetching from `/api/articles/${carId}` which returned generic mock data.

**Solution:** 
- Added `car` prop to pass car data directly
- Implemented car-specific URL and content generation
- Added car-specific analytics tracking

### 2. **Signal Share Button Fix (January 2025)**

**Problem:** Signal bottom sheet was sharing mock article data instead of actual signal content.

**Root Cause:** ShareButton was fetching from `/api/articles/${signalId}` instead of `/api/perplexity/${signalId}`.

**Solution:**
- Added `isPerplexityArticle` prop for content type detection
- Implemented intelligent API endpoint selection
- Added signal-specific analytics tracking
- Enhanced ArticleBottomSheet to support content type awareness

### 3. **Search State Management Fix (January 2025)**

**Problem:** Search mode would deactivate when no results were found, showing regular feed instead of "no results" message.

**Root Cause:** `setIsSearchActive(results.length > 0)` only activated search mode when results existed.

**Solution:**
- Changed to `setIsSearchActive(isSearching)` based on actual search state
- Updated search callback to pass both results and search state
- Fixed infinite loop prevention with proper change detection

## Analytics Integration

### Content-Specific Tracking

```typescript
// Car sharing analytics
analytics.trackEvent('car_share', { 
  carId: articleId, 
  method: 'native' | 'copy',
  carMake: car.make,
  carModel: car.model,
  carPrice: car.price
})

// Signal sharing analytics
analytics.trackEvent('signal_share', { 
  signalId: articleId, 
  method: 'native' | 'copy',
  category: signal.category,
  signalType: 'perplexity'
})

// Article sharing analytics (existing)
analytics.trackArticleShare(articleId, "native" | "copy")
```

### Performance Metrics

- **Native Share Success Rate**: Track percentage of successful native shares vs fallbacks
- **Content Type Distribution**: Monitor which content types are shared most frequently
- **Platform Analytics**: Track sharing patterns across different devices and platforms

## Implementation Files

### Core Components
- `components/share-button.tsx` - Universal share button with multi-content support
- `components/article-bottom-sheet.tsx` - Enhanced with content type awareness
- `components/car-bottom-sheet.tsx` - Car-specific bottom sheet integration
- `components/perplexity-public-list.tsx` - Signal feed with share integration

### API Endpoints
- `/api/articles/[id]` - Regular article data for sharing
- `/api/perplexity/[id]` - Signal article data for sharing
- `/api/cars` - Car listing data (embedded in components)

### Analytics
- `lib/analytics.ts` - Enhanced with content-specific tracking events
- Content-specific event types: `car_share`, `signal_share`, `article_share`

## Future Enhancements

### Planned Features
- **Deep linking**: Direct links to specific content within feeds
- **Social platform optimization**: Platform-specific content formatting
- **Share preview generation**: Dynamic Open Graph image generation
- **Share analytics dashboard**: Admin interface for sharing metrics
- **Bulk sharing**: Administrative tools for content promotion

### Technical Improvements
- **TypeScript interfaces**: Stricter typing for share content generation
- **Error handling**: Enhanced error recovery and user feedback
- **Performance optimization**: Reduced bundle size through dynamic imports
- **Accessibility**: Screen reader support and keyboard navigation