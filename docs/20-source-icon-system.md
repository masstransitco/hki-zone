# Source Icon System Implementation

## Overview

The source icon system enhances news article display by showing media outlet logos/favicons alongside source names, providing visual recognition and improved user experience. This system integrates seamlessly with the existing news feed masonry, article cards, and article detail components.

## Architecture

### Core Components

1. **Source-to-Favicon Mapping** (`/lib/source-favicon-mapping.ts`)
   - Comprehensive mapping utility from article source names to favicon files
   - Handles source name normalization and variations
   - Provides fallback logic for unmapped sources

2. **Outlet Favicon Component** (`/components/outlet-favicon.tsx`)
   - Reusable favicon display component with multiple size variants
   - Automatic fallback to pill-shaped text badges
   - Next.js Image optimization integration

3. **Favicon Assets** (`/public/favicons-output/`)
   - Collection of 18 Hong Kong news outlet favicons
   - Organized with manifest metadata and multiple format variants
   - Optimized for web display

## Implementation Details

### Source Mapping System

```typescript
// Primary mapping from source names to favicon files
export const SOURCE_FAVICON_MAP: SourceFaviconMapping = {
  "HK01": "hk01.png",
  "HKFP": "hkfp.ico", 
  "RTHK": "rthk.png",
  "SCMP": "scmp.png",
  // ... 18 total outlets with variations
}

// Utility functions
export function getFaviconForSource(source: string): string | null
export function getFaviconUrl(source: string): string | null
export function hasFavicon(source: string): boolean
```

### Supported Media Outlets

The system currently supports favicons for 18 major Hong Kong news outlets:

| Outlet | File | Format | Source Name Variations |
|--------|------|--------|----------------------|
| HK01 | `hk01.png` | PNG | "HK01", "Hong Kong 01", "hk01" |
| Hong Kong Free Press | `hkfp.ico` | ICO | "HKFP", "Hong Kong Free Press", "hkfp" |
| RTHK | `rthk.png` | PNG | "RTHK", "Radio Television Hong Kong", "rthk" |
| South China Morning Post | `scmp.png` | PNG | "SCMP", "South China Morning Post", "scmp" |
| TVB News | `tvb.png` | PNG | "TVB", "TVB News", "Television Broadcasts Limited" |
| Oriental Daily | `oriental.png` | PNG | "Oriental Daily", "ONCC", "oriental" |
| Sing Tao Daily | `singtao.png` | PNG | "SingTao", "Sing Tao", "Sing Tao Daily" |
| Ming Pao | `mingpao.jpg` | JPEG | "Ming Pao", "Ming Pao Daily", "mingpao" |
| The Standard | `standard.png` | PNG | "The Standard", "The Standard HK", "standard" |
| Now News | `nownews.png` | PNG | "Now News", "Now TV", "Now" |
| InMedia | `inmedia.ico` | ICO | "InMedia", "InMedia HK", "inmedia" |
| Coconuts Hong Kong | `coconutshk.ico` | ICO | "Coconuts Hong Kong", "Coconuts", "coconuts" |
| Hong Kong Government News | `newsgov.png` | PNG | "Hong Kong Government News", "Gov News", "Government News" |
| Hong Kong Economic Journal | `hkej.png` | PNG | "HKEJ", "Hong Kong Economic Journal", "Economic Journal" |
| Bastille Post | `bastille.png` | PNG | "Bastille Post", "Bastille", "bastille" |
| Metro Radio | `metroradio.png` | PNG | "Metro Radio", "Metro Broadcast", "metroradio" |
| Commercial Radio Hong Kong | `crhk.ico` | ICO | "Commercial Radio Hong Kong", "881903", "crhk" |
| AM730 | `am730.ico` | ICO | "AM730", "am730" |

### Favicon Component API

```typescript
interface OutletFaviconProps {
  source: string          // Article source name
  size?: "sm" | "md" | "lg"  // Icon size variant
  className?: string      // Additional CSS classes
  showFallback?: boolean  // Show text fallback when no favicon
  fallbackText?: string   // Custom fallback text
}

// Size mappings
const sizeMap = {
  sm: { width: 16, height: 16, className: "w-4 h-4" },    // Article cards
  md: { width: 20, height: 20, className: "w-5 h-5" },    // Article details
  lg: { width: 24, height: 24, className: "w-6 h-6" }     // Headers/large displays
}
```

### Fallback Strategy

The system implements a comprehensive fallback hierarchy:

1. **Primary**: Display outlet favicon/logo from `/favicons-output/{outlet}.{ext}`
2. **Fallback**: Show pill-shaped text badge with outlet name
3. **Error Handling**: Graceful degradation if image fails to load

#### Fallback Design

```typescript
// Pill-shaped fallback with clean source name
<div className="flex-shrink-0 flex items-center justify-center rounded-full bg-muted/80 text-muted-foreground text-xs font-medium px-2 py-1 border border-border/40 min-w-fit">
  {cleanSourceName}
</div>
```

## Integration Points

### 1. Article Cards (`/components/article-card.tsx`)

**Location**: Source badge area (lines 106-112)

```typescript
<div className="flex items-center gap-2">
  <OutletFavicon 
    source={article.source} 
    size="sm" 
    showFallback={true}
  />
</div>
```

**Behavior**:
- Shows small (16x16px) favicon for regular articles
- Falls back to pill-shaped badge with outlet name
- Maintains existing `InlineSourcesBadge` for AI-enhanced articles

### 2. Article Detail Sheet (`/components/article-detail-sheet.tsx`)

**Location**: Header source attribution (lines 98-108)

```typescript
<div className="flex items-center gap-2">
  <OutletFavicon 
    source={article.source} 
    size="md" 
    showFallback={true}
  />
  <span className="text-sm text-primary font-medium">
    {article.source.replace(' (AI Enhanced)', '')}
    {article.isAiEnhanced && ' + AI Enhanced'}
  </span>
</div>
```

**Behavior**:
- Shows medium (20x20px) favicon in bottom sheet view
- Preserves existing `PublicSources` functionality for AI-enhanced articles
- Displays alongside source name for better recognition

### 3. Article Detail Page (`/components/article-detail.tsx`)

**Location**: Header source attribution (lines 82-92)

**Behavior**:
- Consistent with bottom sheet implementation
- Medium-sized favicons for full-page article views
- Same fallback strategy as bottom sheet

### 4. Favicon Asset Management

**Manifest Structure** (`/public/favicons-output/manifest.json`):
```json
{
  "hk01": {
    "slug": "hk01",
    "url": "https://www.hk01.com/",
    "picked": {
      "href": "https://www.hk01.com/android-chrome-256x256.png",
      "ext": "png",
      "mime": "image/png",
      "bytes": 16163,
      "file": "hk01.png"
    },
    "candidates": [...]
  }
}
```

**Asset Organization**:
- Root level: Primary favicon files (e.g., `hk01.png`, `hkfp.ico`)
- Subdirectories: Raw assets and metadata
- Manifest: Comprehensive metadata for each outlet

## Performance Optimizations

### 1. Image Loading
- Uses Next.js `Image` component for automatic optimization
- Proper error handling prevents broken image displays
- Lazy loading for performance

### 2. Mapping Efficiency
- Pre-computed source mappings avoid runtime lookups
- Normalized source names for consistent matching
- Partial matching for flexible source name handling

### 3. Fallback Performance
- Immediate fallback rendering without network requests
- CSS-only pill-shaped badges for fast display
- Minimal DOM impact when no favicon available

## Source Name Normalization

### Automatic Cleaning

```typescript
function normalizeSourceName(source: string): string {
  return source
    .replace(' (AI Enhanced)', '')  // Remove AI Enhanced suffix
    .replace(/ \+ AI$/, '')         // Remove + AI suffix
    .trim()
}
```

### Matching Strategy

1. **Exact Match**: Direct lookup in source mapping
2. **Case-Insensitive**: Lowercase comparison
3. **Partial Match**: Substring matching for common patterns
4. **Fallback**: Show original source name in pill badge

## Error Handling

### Image Load Failures

```typescript
onError={(e) => {
  // Hide the image if it fails to load
  const target = e.target as HTMLImageElement
  target.style.display = 'none'
}}
```

### Missing Favicons
- Graceful fallback to text badge
- No broken image icons
- Consistent visual experience

### Invalid Source Names
- Handles undefined or null sources
- Graceful degradation to fallback display
- No crashes or error states

## Usage Guidelines

### When to Use Favicons

✅ **Recommended**:
- Article cards in news feeds
- Article detail headers
- Source attribution areas
- Any outlet name display

❌ **Not Recommended**:
- AI-enhanced article source lists (use existing `PublicSources`)
- Inline citations within article content
- Admin interfaces (unless specifically needed)

### Size Selection

- **Small (16px)**: Article cards, compact lists
- **Medium (20px)**: Article headers, detail views
- **Large (24px)**: Page headers, featured displays

### Fallback Configuration

```typescript
// Show favicon with text fallback
<OutletFavicon source={source} showFallback={true} />

// Favicon only (hide if not available)
<OutletFavicon source={source} showFallback={false} />

// Custom fallback text
<OutletFavicon source={source} fallbackText="News" />
```

## Maintenance

### Adding New Outlets

1. **Add Favicon Asset**:
   ```bash
   # Place favicon in /public/favicons-output/
   cp new-outlet-favicon.png /public/favicons-output/newoutlet.png
   ```

2. **Update Mapping**:
   ```typescript
   // Add to SOURCE_FAVICON_MAP in source-favicon-mapping.ts
   "New Outlet Name": "newoutlet.png",
   "new outlet": "newoutlet.png",
   ```

3. **Update Manifest** (optional):
   ```json
   {
     "newoutlet": {
       "slug": "newoutlet",
       "url": "https://newoutlet.com/",
       "picked": {
         "file": "newoutlet.png",
         "ext": "png"
       }
     }
   }
   ```

### Updating Existing Favicons

1. Replace favicon file in `/public/favicons-output/`
2. Clear browser cache if needed
3. Test display across all components

### Source Name Variations

Add new variations to the mapping when encountering new source name formats:

```typescript
// Add variations to SOURCE_FAVICON_MAP
"Source Name Variant": "existing-outlet.png",
"Another Format": "existing-outlet.png",
```

## Testing

### Visual Testing Checklist

1. **Article Cards**
   - [ ] Favicons display correctly in news feed
   - [ ] Fallback text badges appear for unmapped sources
   - [ ] Consistent sizing across cards
   - [ ] No broken image icons

2. **Article Details**
   - [ ] Favicons show in bottom sheet headers
   - [ ] Fallback badges work in detail views
   - [ ] Proper alignment with source text
   - [ ] No layout shifts

3. **Responsive Behavior**
   - [ ] Icons scale appropriately across screen sizes
   - [ ] Text fallbacks remain readable
   - [ ] No overflow issues on mobile

4. **Error Scenarios**
   - [ ] Graceful handling of missing favicon files
   - [ ] Proper fallback for unmapped sources
   - [ ] No JavaScript errors in console

### Browser Compatibility

- **Modern Browsers**: Full favicon support with Next.js optimization
- **Legacy Browsers**: CSS fallback badges work universally
- **No JavaScript**: CSS-only fallbacks still function

## Future Enhancements

### Potential Improvements

1. **Automatic Favicon Collection**
   - Script to automatically fetch favicons from outlet websites
   - Regular updates to keep logos current
   - Quality scoring for best favicon selection

2. **Advanced Mapping**
   - Machine learning for source name matching
   - Domain-based favicon detection
   - Real-time favicon updates

3. **Performance Optimization**
   - WebP format support for modern browsers
   - CDN integration for faster loading
   - Sprite sheets for common favicons

4. **Analytics Integration**
   - Track favicon display success rates
   - Monitor fallback usage patterns
   - A/B test favicon vs. text-only displays

## Conclusion

The source icon system significantly enhances the visual appeal and usability of news article displays by providing instant visual recognition of media outlets. The comprehensive fallback strategy ensures a consistent experience across all scenarios, while the modular architecture allows for easy maintenance and expansion.

The system integrates seamlessly with existing components without disrupting AI-enhanced article functionality or breaking existing layouts, providing a polished user experience that aligns with modern news aggregation interfaces.