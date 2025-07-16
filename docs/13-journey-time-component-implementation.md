# Journey Time Component Implementation

## Overview

The Journey Time component provides real-time traffic information for Hong Kong's road network, displaying journey times with an intuitive color-coded system based on Hong Kong's road signage standards. The implementation includes region-based filtering, mobile-optimized cards, a modern toggle-based interface, and full multilingual support for English, Simplified Chinese, and Traditional Chinese.

## Architecture

### Component Structure

```
journey-time-list.tsx        # Main container component
├── journey-time-card.tsx    # Individual route card
├── useJourneyTimeData.ts    # Data fetching hook
└── /api/journey-time/route.ts # API endpoint
```

### Data Flow

1. **External API**: Hong Kong Transport Department's Journey Time Indicators (JTI) XML feed
2. **API Layer**: Parses XML, applies region-based filtering, adds route type classification
3. **Hook Layer**: Manages state, caching, and real-time updates
4. **Component Layer**: Renders cards with color-coded journey times

## Hong Kong Road Signage Color System

### Road Type Classification

The component uses Hong Kong's official road signage color system:

```typescript
const routeTypeColors = {
  expressway: {
    border: 'border-green-700',
    bg: 'bg-green-700 dark:bg-green-800',
    text: 'text-white',
    height: 'h-32' // Largest - most important roads
  },
  trunk: {
    border: 'border-blue-700', 
    bg: 'bg-blue-700 dark:bg-blue-800',
    text: 'text-white',
    height: 'h-28' // Medium-large - major roads
  },
  local: {
    border: 'border-gray-500',
    bg: 'bg-gray-600 dark:bg-gray-700',
    text: 'text-white',
    height: 'h-24' // Medium - local roads
  },
  temp: {
    border: 'border-amber-600',
    bg: 'bg-amber-600 dark:bg-amber-700',
    text: 'text-white',
    height: 'h-20' // Smallest - temporary/alert routes
  }
}
```

### Journey Time Color Coding

Journey times are color-coded based on travel duration:

```typescript
const getJourneyTimeColor = (timeMin: number) => {
  if (timeMin <= 10) return 'bg-green-500' // Fast - green
  if (timeMin <= 20) return 'bg-orange-500' // Moderate - orange  
  return 'bg-red-500' // Slow - red
}

const getJourneyTimeTextColor = (timeMin: number) => {
  if (timeMin <= 10) return 'text-white' // Fast - white text
  if (timeMin <= 20) return 'text-orange-500' // Moderate - orange text  
  return 'text-red-500' // Slow - red text
}
```

## Region-Based Filtering System

### Region Classification

Routes are classified into Hong Kong's three main regions:

- **🏝️ Hong Kong Island** (H-prefixed location codes)
- **🏙️ Kowloon** (K-prefixed location codes)
- **🏔️ New Territories** (N-prefixed and SJ-prefixed location codes)

### Smart Tunnel Handling

Cross-harbour tunnels (CH, EH, WH) dynamically determine their destination region:

```typescript
function regionForDestination(destId: string, startRegion: Region): Region {
  const base = DEST_REGION_BASE[destId]
  if (base === 'tunnel') {
    return startRegion === 'hk' ? 'kln' : 'hk'
  }
  return base ?? 'nt'
}
```

### Filter Logic

The filtering system supports:
- **Start Region**: Filter by departure region
- **Destination Region**: Filter by arrival region
- **Road Type**: Multi-select toggle for expressways, major roads, local roads

## Mobile-Optimized Card Design

### Fixed Height Visual Hierarchy

Cards use fixed heights based on road importance:
- **Expressways**: 128px (h-32)
- **Major Roads**: 112px (h-28)
- **Local Roads**: 96px (h-24)
- **Temporary**: 80px (h-20)

### Card Layout Structure

```
┌─────────────────────────────────────────────────────────┐
│ ● From Location →                            [TIME] │
│   To Location                                [INFO] │
│                                                     │
│ [ROAD TYPE ICON]              [TREND INDICATOR]     │
└─────────────────────────────────────────────────────────┘
```

### Responsive Features

- **Multi-line Route Names**: Destination appears on second line
- **Truncation Handling**: Long route names are properly truncated
- **Touch Targets**: 44px minimum touch targets for mobile
- **Flexible Layout**: Adapts to different screen sizes

## API Implementation

### Data Source

- **URL**: `https://resource.data.one.gov.hk/td/jss/Journeytimev2.xml`
- **Update Frequency**: Every 2 minutes
- **Cache Strategy**: 2-minute revalidation with Next.js caching

### Route Type Classification

```typescript
const getRouteType = (destinationId: string): RouteType => {
  const expressways = ['CH', 'EH', 'WH', 'TSCA', 'ATL', 'TMCLK']
  const trunkRoads = ['TKOLTT', 'TKOT', 'ABT', 'LRT', 'TCT', 'SMT', 'TKTM', 'ACTT', 'TPR', 'TKTL', 'MOS', 'KTPR']
  const localRoads = ['WNCG', 'PFL', 'CWBR', 'TLH', 'TWCP', 'TWTM', 'SSCPR', 'SSYLH', 'ATSCA']
  
  if (expressways.includes(destinationId)) return 'expressway'
  if (trunkRoads.includes(destinationId)) return 'trunk'
  if (localRoads.includes(destinationId)) return 'local'
  return 'trunk'
}
```

### API Parameters

- `start`: Starting region (hk, kln, nt)
- `dest`: Destination region (hk, kln, nt)
- `limit`: Maximum number of results (default: 20)
- `route`: Specific route lookup (format: locationId-destinationId)

## User Interface Components

### Region Selector

```typescript
// Single-row layout with arrow
<div className="flex items-center gap-3">
  <Select value={startRegion}>...</Select>
  <ArrowRight className="h-5 w-5 text-gray-400" />
  <Select value={destRegion}>...</Select>
</div>
```

### Road Type Toggle Buttons

```typescript
// Icon-based toggle system
{Object.entries(ROUTE_TYPE_ICONS).map(([routeType, icon]) => (
  <button
    className={`w-12 h-12 rounded-full ${
      isActive ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600'
    }`}
    onClick={() => toggleRouteType(routeType)}
  >
    {icon}
  </button>
))}
```

### Journey Time Card

```typescript
// Mobile-optimized layout
<div className={`${colors.bg} ${colors.height} flex flex-col justify-between`}>
  <div className="flex items-start gap-3">
    <div className={`w-3 h-3 rounded-full ${pillColor} animate-pulse`} />
    <div className="flex-1">
      <div>{from} →</div>
      <div>{to}</div>
    </div>
    <div className={`text-xl font-bold ${timeTextColor}`}>
      {displayTime}
    </div>
  </div>
  <div className="flex items-center justify-between">
    <div className="road-type-icon">{routeTypeIcon}</div>
    <div className="trend-indicator">{trendIndicator}</div>
  </div>
</div>
```

## Performance Optimizations

### Caching Strategy

- **Server-side**: 2-minute revalidation with Next.js
- **Client-side**: React Query with 2-minute stale time
- **Memory**: Memoized filtering and computations

### Real-time Updates

- **Auto-refresh**: Configurable interval (default: 2 minutes)
- **Stale Detection**: Visual indicators for outdated data
- **Error Handling**: Graceful fallbacks and retry logic

### Mobile Performance

- **Lazy Loading**: Components load on demand
- **Optimized Animations**: Hardware-accelerated transitions
- **Touch Optimization**: Proper touch targets and feedback

## Development Patterns

### State Management

```typescript
// Region filters with random defaults
const [startRegion, setStartRegion] = useState(() => {
  const { start } = getRandomRegionPair()
  return start
})

// Multi-select road type filters
const [routeTypeFilters, setRouteTypeFilters] = useState({
  expressway: true,
  trunk: true,
  local: true
})
```

### Error Handling

```typescript
// API error handling
try {
  const journeyTimeData = await fetchJourneyTimeData()
  // Process data
} catch (error) {
  return NextResponse.json({
    journeyTimes: [],
    error: 'Could not fetch journey time data',
    metadata: { source: 'fallback' }
  }, { status: 500 })
}
```

### Type Safety

```typescript
type Region = 'hk' | 'kln' | 'nt'
type RouteType = 'expressway' | 'trunk' | 'local' | 'temp'

interface JourneyTimeCardProps {
  from: string
  to: string
  timeMin: number
  trendMin: number
  colourId: 1 | 2 | 3
  capture: string
  locale?: 'en' | 'zh'
  routeType: RouteType
  onRouteClick?: (from: string, to: string) => void
}
```

## Testing Considerations

### Unit Testing

- Component rendering with different props
- Filter logic validation
- Color system consistency
- Mobile responsiveness

### Integration Testing

- API endpoint functionality
- Real-time data updates
- Cross-browser compatibility
- Performance benchmarks

### User Experience Testing

- Touch interaction accuracy
- Color accessibility (contrast ratios)
- Loading states and error handling
- Multi-language support

## Deployment Notes

### Environment Variables

```env
# No additional environment variables required
# Uses public Hong Kong government API
```

### Build Configuration

```javascript
// next.config.mjs
const nextConfig = {
  // Enable image optimization for route icons
  images: {
    domains: ['resource.data.one.gov.hk']
  }
}
```

### Monitoring

- API response times
- Error rates and failure patterns
- User interaction metrics
- Performance monitoring

## Future Enhancements

### Planned Features

1. **Predictive Journey Times**: Machine learning for traffic prediction
2. **Route Comparison**: Side-by-side route analysis
3. **Historical Data**: Trend analysis and patterns
4. **Push Notifications**: Real-time traffic alerts
5. **Offline Support**: Cached data for offline viewing

### Technical Improvements

1. **WebSocket Integration**: Real-time data streaming
2. **Progressive Web App**: Enhanced mobile experience
3. **Geolocation**: Automatic region detection
4. **Voice Interface**: Accessibility improvements
5. **Analytics Integration**: User behavior tracking

## Language Support Implementation

### Multilingual Architecture

The Journey Time component supports Hong Kong's trilingual environment with complete localization:

#### **Supported Languages:**
- **English (EN)**: Primary interface language
- **Simplified Chinese (简体中文)**: Mainland China standard
- **Traditional Chinese (繁體中文)**: Hong Kong/Taiwan standard

#### **Localized Content:**

**1. User Interface Elements:**
```typescript
// Component labels and messages
"journey.title": "Journey Times" | "行程时间" | "行程時間"
"journey.roadType": "Road Type" | "道路类型" | "道路類型"
"journey.expressway": "Expressway" | "高速公路" | "高速公路"
"journey.trunk": "Major Road" | "主要道路" | "主要道路"
"journey.local": "Local Road" | "本地道路" | "本地道路"
```

**2. Region Names:**
```typescript
"regions.hk": "Hong Kong Island" | "香港岛" | "香港島"
"regions.kln": "Kowloon" | "九龙" | "九龍"
"regions.nt": "New Territories" | "新界" | "新界"
```

**3. Route Location Names:**
```typescript
// Hong Kong Island locations
'H1': 'Central/Admiralty' | '中环/金钟' | '中環/金鐘'
'H2': 'Wan Chai' | '湾仔' | '灣仔'
'H3': 'Causeway Bay' | '铜锣湾' | '銅鑼灣'

// Kowloon locations
'K01': 'Tsim Sha Tsui' | '尖沙咀' | '尖沙咀'
'K04': 'Mong Kok' | '旺角' | '旺角'

// New Territories locations
'N01': 'Sha Tin' | '沙田' | '沙田'
'N05': 'Tuen Mun' | '屯门' | '屯門'
```

**4. Destination Names:**
```typescript
// Major tunnels and destinations
'CH': 'Cross-Harbour Tunnel' | '海底隧道' | '海底隧道'
'EH': 'Eastern Harbour Tunnel' | '东区海底隧道' | '東區海底隧道'
'WH': 'Western Harbour Tunnel' | '西区海底隧道' | '西區海底隧道'
'ATL': 'Airport' | '机场' | '機場'
```

### Implementation Details

#### **1. Language Context Integration:**
```typescript
// Component uses app-wide language context
const { language, t } = useLanguage()

// Dynamic region filters based on language
const REGION_FILTERS = useMemo(() => [
  { value: "hk", label: `🏝️ ${t('regions.hk')}` },
  { value: "kln", label: `🏙️ ${t('regions.kln')}` },
  { value: "nt", label: `🏔️ ${t('regions.nt')}` },
], [t])
```

#### **2. API Language Support:**
```typescript
// API endpoint accepts language parameter
const language = url.searchParams.get('language') as Language || 'en'

// Localized name lookup
from: LOCATION_NAMES[jt.locationId]?.[language] || jt.locationId,
to: DESTINATION_NAMES[jt.destinationId]?.[language] || jt.destinationId,
```

#### **3. Hook Integration:**
```typescript
// Hook passes language to API
const { data } = useJourneyTimeData({
  startRegion: startRegionFilter,
  destRegion: destRegionFilter,
  language: language
})
```

### Visual Design Updates

#### **Card Design Enhancements:**
- **Consistent White Borders**: All route cards feature white borders matching Hong Kong road signage
- **Enlarged Destination Text**: Destination names use larger, semi-bold monospace font for road sign authenticity
- **Neutral Toggle Colors**: Road type toggles use gray instead of blue for better visual hierarchy

#### **Three-State Toggle System:**
- **Disabled State**: Gray background (50% opacity) - Not available for current region
- **Available State**: White background with gray border - Can be toggled on
- **Enabled State**: Dark gray background - Currently active

#### **Smart Region Filtering:**
- **Bidirectional Logic**: Both "From" and "To" dropdowns filter based on each other
- **Data-Driven**: Only shows regions with actual journey time data
- **Auto-Correction**: Automatically updates invalid selections

### Language Switching Behavior

#### **Real-Time Updates:**
- **Instant Translation**: All text updates immediately when language changes
- **Consistent Experience**: UI labels and route names change together
- **Preserved State**: Filter selections and toggle states maintained

#### **Fallback Handling:**
- **Graceful Degradation**: Falls back to original location ID if translation missing
- **Error Prevention**: Prevents blank or undefined text display
- **Type Safety**: TypeScript ensures proper language key usage

### Testing Considerations

#### **Language-Specific Testing:**
- **Character Encoding**: Verify Chinese characters display correctly
- **Text Overflow**: Ensure longer Chinese text fits in containers
- **Font Rendering**: Test font fallbacks for Chinese characters
- **Input Validation**: Validate language parameter handling

#### **Cross-Browser Compatibility:**
- **Font Support**: Chinese character rendering across browsers
- **Layout Stability**: Text expansion/contraction handling
- **Memory Usage**: Multiple language dictionaries impact

This implementation provides a robust, mobile-optimized journey time system that aligns with Hong Kong's transportation infrastructure while offering an intuitive user experience through modern web technologies and comprehensive multilingual support.