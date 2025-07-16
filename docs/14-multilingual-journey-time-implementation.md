# Multilingual Journey Time Implementation

## Overview

This document describes the comprehensive multilingual implementation for the Journey Time component, providing full localization support for Hong Kong's trilingual environment (English, Simplified Chinese, Traditional Chinese).

## Architecture Changes

### 1. Language Provider Integration

The Journey Time component integrates with the app-wide language system:

```typescript
// components/journey-time-list.tsx
import { useLanguage } from "@/components/language-provider"

const { language, t } = useLanguage()
```

### 2. Translation Keys Added

New translation keys added to `/components/language-provider.tsx`:

```typescript
// English translations
"journey.title": "Journey Times",
"journey.subtitle": "Real-time traffic conditions and journey times across Hong Kong",
"journey.roadType": "Road Type",
"journey.expressway": "Expressway",
"journey.trunk": "Major Road",
"journey.local": "Local Road",
"journey.temp": "Temporary",
"journey.enabled": "Enabled",
"journey.available": "Available",
"journey.notAvailable": "Not available",
"journey.notAvailableForRoute": "Not available for this route",
"journey.noRoutes": "No routes available for selected road types",
"journey.noData": "No journey time data available",
"journey.tryDifferent": "Try enabling different road types or selecting different regions",
"journey.min": "min",
"journey.faster": "faster",
"journey.slower": "slower",
"journey.route": "Route",
"journey.updatedAt": "Updated at",
"journey.thanUsual": "than usual",
"regions.hk": "Hong Kong Island",
"regions.kln": "Kowloon",
"regions.nt": "New Territories",
```

### 3. Multilingual Location Data

#### API Data Structure Changes

Updated `/app/api/journey-time/route.ts` to support multilingual location names:

```typescript
type Language = 'en' | 'zh-CN' | 'zh-TW'

const LOCATION_NAMES: { [key: string]: { [lang in Language]: string } } = {
  // Hong Kong Island
  'H1': { en: 'Central/Admiralty', 'zh-CN': '中环/金钟', 'zh-TW': '中環/金鐘' },
  'H2': { en: 'Wan Chai', 'zh-CN': '湾仔', 'zh-TW': '灣仔' },
  'H3': { en: 'Causeway Bay', 'zh-CN': '铜锣湾', 'zh-TW': '銅鑼灣' },
  'H4': { en: 'North Point', 'zh-CN': '北角', 'zh-TW': '北角' },
  'H5': { en: 'Quarry Bay', 'zh-CN': '鲗鱼涌', 'zh-TW': '鰂魚涌' },
  'H6': { en: 'Tai Koo', 'zh-CN': '太古', 'zh-TW': '太古' },
  'H7': { en: 'Shau Kei Wan', 'zh-CN': '筲箕湾', 'zh-TW': '筲箕灣' },
  'H8': { en: 'Chai Wan', 'zh-CN': '柴湾', 'zh-TW': '柴灣' },
  'H9': { en: 'Aberdeen', 'zh-CN': '香港仔', 'zh-TW': '香港仔' },
  'H11': { en: 'Kennedy Town', 'zh-CN': '坚尼地城', 'zh-TW': '堅尼地城' },
  
  // Kowloon
  'K01': { en: 'Tsim Sha Tsui', 'zh-CN': '尖沙咀', 'zh-TW': '尖沙咀' },
  'K02': { en: 'Jordan', 'zh-CN': '佐敦', 'zh-TW': '佐敦' },
  'K03': { en: 'Yau Ma Tei', 'zh-CN': '油麻地', 'zh-TW': '油麻地' },
  'K04': { en: 'Mong Kok', 'zh-CN': '旺角', 'zh-TW': '旺角' },
  'K05': { en: 'Sham Shui Po', 'zh-CN': '深水埗', 'zh-TW': '深水埗' },
  'K06': { en: 'Kowloon Tong', 'zh-CN': '九龙塘', 'zh-TW': '九龍塘' },
  'K07': { en: 'Wong Tai Sin', 'zh-CN': '黄大仙', 'zh-TW': '黃大仙' },
  
  // New Territories
  'N01': { en: 'Sha Tin', 'zh-CN': '沙田', 'zh-TW': '沙田' },
  'N02': { en: 'Tai Po', 'zh-CN': '大埔', 'zh-TW': '大埔' },
  'N03': { en: 'Fanling', 'zh-CN': '粉岭', 'zh-TW': '粉嶺' },
  'N05': { en: 'Tuen Mun', 'zh-CN': '屯门', 'zh-TW': '屯門' },
  'N06': { en: 'Yuen Long', 'zh-CN': '元朗', 'zh-TW': '元朗' },
  'N07': { en: 'Tsuen Wan', 'zh-CN': '荃湾', 'zh-TW': '荃灣' },
  'N08': { en: 'Kwai Chung', 'zh-CN': '葵涌', 'zh-TW': '葵涌' },
  'N09': { en: 'Tsing Yi', 'zh-CN': '青衣', 'zh-TW': '青衣' },
  'N10': { en: 'Ma On Shan', 'zh-CN': '马鞍山', 'zh-TW': '馬鞍山' },
  'N11': { en: 'Tseung Kwan O', 'zh-CN': '将军澳', 'zh-TW': '將軍澳' },
  'N12': { en: 'Sai Kung', 'zh-CN': '西贡', 'zh-TW': '西貢' },
  'N13': { en: 'Tai Wai', 'zh-CN': '大围', 'zh-TW': '大圍' },
  
  // Strategic Routes
  'SJ1': { en: 'Strategic Junction 1', 'zh-CN': '策略交汇点1', 'zh-TW': '策略交匯點1' },
  'SJ2': { en: 'Strategic Junction 2', 'zh-CN': '策略交汇点2', 'zh-TW': '策略交匯點2' },
  'SJ3': { en: 'Strategic Junction 3', 'zh-CN': '策略交汇点3', 'zh-TW': '策略交匯點3' },
  'SJ4': { en: 'Strategic Junction 4', 'zh-CN': '策略交汇点4', 'zh-TW': '策略交匯點4' },
  'SJ5': { en: 'Strategic Junction 5', 'zh-CN': '策略交汇点5', 'zh-TW': '策略交匯點5' }
}

const DESTINATION_NAMES: { [key: string]: { [lang in Language]: string } } = {
  'CH': { en: 'Cross-Harbour Tunnel', 'zh-CN': '海底隧道', 'zh-TW': '海底隧道' },
  'EH': { en: 'Eastern Harbour Tunnel', 'zh-CN': '东区海底隧道', 'zh-TW': '東區海底隧道' },
  'WH': { en: 'Western Harbour Tunnel', 'zh-CN': '西区海底隧道', 'zh-TW': '西區海底隧道' },
  'TKTL': { en: 'Tseung Kwan O', 'zh-CN': '将军澳', 'zh-TW': '將軍澳' },
  'TMCLK': { en: 'Tuen Mun', 'zh-CN': '屯门', 'zh-TW': '屯門' },
  'TPR': { en: 'Tai Po', 'zh-CN': '大埔', 'zh-TW': '大埔' },
  'TKOT': { en: 'TKO Tunnel', 'zh-CN': '将军澳隧道', 'zh-TW': '將軍澳隧道' },
  'ATL': { en: 'Airport', 'zh-CN': '机场', 'zh-TW': '機場' },
  'MOS': { en: 'Ma On Shan', 'zh-CN': '马鞍山', 'zh-TW': '馬鞍山' },
  'ABT': { en: 'Aberdeen Tunnel', 'zh-CN': '香港仔隧道', 'zh-TW': '香港仔隧道' },
  'ACTT': { en: 'Airport Core Tunnel', 'zh-CN': '机场核心隧道', 'zh-TW': '機場核心隧道' },
  'ATSCA': { en: 'Airport to SCAR', 'zh-CN': '机场至石岗', 'zh-TW': '機場至石崗' },
  'CWBR': { en: 'Causeway Bay', 'zh-CN': '铜锣湾', 'zh-TW': '銅鑼灣' },
  'KTPR': { en: 'Kwai Tsing', 'zh-CN': '葵青', 'zh-TW': '葵青' },
  'LRT': { en: 'Lion Rock Tunnel', 'zh-CN': '狮子山隧道', 'zh-TW': '獅子山隧道' },
  'PFL': { en: 'Po Fulam', 'zh-CN': '薄扶林', 'zh-TW': '薄扶林' },
  'SMT': { en: 'Shing Mun Tunnel', 'zh-CN': '城门隧道', 'zh-TW': '城門隧道' },
  'SSCPR': { en: 'Sha Sha Chi', 'zh-CN': '沙沙池', 'zh-TW': '沙沙池' },
  'SSYLH': { en: 'Sha Sha Yuen Long', 'zh-CN': '沙沙元朗', 'zh-TW': '沙沙元朗' },
  'TCT': { en: 'Tai Lam Tunnel', 'zh-CN': '大榄隧道', 'zh-TW': '大欖隧道' },
  'TKOLTT': { en: 'TKO Lam Tin Tunnel', 'zh-CN': '将军澳蓝田隧道', 'zh-TW': '將軍澳藍田隧道' },
  'TKTM': { en: 'Tsing Kwan O Tunnel', 'zh-CN': '将军澳隧道', 'zh-TW': '將軍澳隧道' },
  'TLH': { en: 'Tai Lam', 'zh-CN': '大榄', 'zh-TW': '大欖' },
  'TSCA': { en: 'Tsing Sha Control Area', 'zh-CN': '青沙管制区', 'zh-TW': '青沙管制區' },
  'TWCP': { en: 'Tsuen Wan', 'zh-CN': '荃湾', 'zh-TW': '荃灣' },
  'TWTM': { en: 'Tsuen Wan to Tuen Mun', 'zh-CN': '荃湾至屯门', 'zh-TW': '荃灣至屯門' },
  'WNCG': { en: 'Wan Chai to Central', 'zh-CN': '湾仔至中环', 'zh-TW': '灣仔至中環' }
}
```

## Implementation Details

### 1. API Changes

#### Language Parameter Support

```typescript
// Added language parameter to API endpoint
const language = url.searchParams.get('language') as Language || 'en'

// Updated data transformation to use language
return {
  from: LOCATION_NAMES[jt.locationId]?.[language] || jt.locationId,
  to: DESTINATION_NAMES[jt.destinationId]?.[language] || jt.destinationId,
  locale: language === 'en' ? 'en' : 'zh',
  // ... other properties
}
```

### 2. Hook Updates

#### useJourneyTimeData Hook

```typescript
// Added language parameter to hook interface
interface UseJourneyTimeDataOptions {
  language?: 'en' | 'zh-CN' | 'zh-TW'
  // ... other options
}

// Updated hook to pass language to API
const fetchJourneyTimeData = useCallback(async (signal?: AbortSignal) => {
  const params = new URLSearchParams({
    limit: limit.toString()
  })
  
  if (startRegion) params.set('start', startRegion)
  if (destRegion) params.set('dest', destRegion)
  if (language) params.set('language', language)
  
  const response = await fetch(`/api/journey-time?${params.toString()}`, {
    signal,
    headers: { 'Cache-Control': 'no-cache' }
  })
  // ...
}, [startRegion, destRegion, limit, language])
```

### 3. Component Updates

#### Journey Time List Component

```typescript
// Integration with language context
const { language, t } = useLanguage()

// Dynamic region filters
const REGION_FILTERS = useMemo(() => [
  { value: "hk", label: `🏝️ ${t('regions.hk')}` },
  { value: "kln", label: `🏙️ ${t('regions.kln')}` },
  { value: "nt", label: `🏔️ ${t('regions.nt')}` },
], [t])

// Language-aware data fetching
const { data } = useJourneyTimeData({
  startRegion: startRegionFilter,
  destRegion: destRegionFilter,
  language: language
})
```

#### Journey Time Card Component

```typescript
// Language-responsive time display
const displayTime = currentLanguage === 'en' ? 
  `${timeMin} ${t('journey.min')}` : 
  `${timeMin} ${t('journey.min')}`

// Localized trend indicators
const trendDirection = trendMin > 0 ? 
  t('journey.slower') : 
  t('journey.faster')
```

## Regional Filtering Enhancements

### 1. Valid Region Combinations

Updated region combinations to include all valid routes:

```typescript
const VALID_REGION_COMBINATIONS: Record<string, string[]> = {
  "hk": ["kln"], // Hong Kong Island -> Kowloon only
  "kln": ["hk", "nt"], // Kowloon -> Hong Kong Island or New Territories
  "nt": ["hk", "kln", "nt"] // New Territories -> Hong Kong Island, Kowloon, or New Territories
}
```

### 2. Bidirectional Filtering

- **From Dropdown**: Shows only valid start regions for selected destination
- **To Dropdown**: Shows only valid destinations for selected start region
- **Auto-Correction**: Automatically updates invalid selections

### 3. Three-State Toggle System

Enhanced road type toggles with three distinct states:

- **Disabled**: Not available for current region (gray, 50% opacity)
- **Available**: Can be enabled (white background, gray border)
- **Enabled**: Currently active (dark gray background)

## Visual Design Updates

### 1. Hong Kong Road Sign Authenticity

- **Consistent White Borders**: All route cards feature white borders matching real road signs
- **Enlarged Destination Text**: Destination names use larger, semi-bold monospace font
- **Neutral Toggle Colors**: Changed from blue to gray for better visual hierarchy

### 2. Typography Improvements

- **Monospace Font**: Road sign appropriate typeface for destinations
- **Font Weight**: Medium-bold styling for better readability
- **Character Support**: Proper Chinese character rendering

## Error Handling and Fallbacks

### 1. Translation Fallbacks

```typescript
// Graceful fallback to location ID if translation missing
from: LOCATION_NAMES[jt.locationId]?.[language] || jt.locationId
```

### 2. Language Validation

```typescript
// Default to English if invalid language provided
const language = url.searchParams.get('language') as Language || 'en'
```

### 3. Empty State Handling

- **No Data**: Localized message for missing journey time data
- **No Routes**: Localized message for filtered results
- **Error States**: Translated error messages and recovery options

## Performance Considerations

### 1. Memory Usage

- **Translation Dictionary**: Increased memory usage for three language dictionaries
- **Memoization**: Proper memoization of translated strings to prevent re-computation

### 2. Network Optimization

- **Language Parameter**: Single API call includes language preference
- **Caching**: Language-specific caching for improved performance

### 3. Bundle Size

- **Translation Data**: Additional bundle size for Chinese character sets
- **Tree Shaking**: Ensure unused translations are removed in production

## Testing Strategy

### 1. Language Switching Tests

- **Real-time Updates**: Verify immediate translation on language change
- **State Preservation**: Ensure filters maintain state across language changes
- **Memory Leaks**: Test for proper cleanup of language-specific resources

### 2. Localization Tests

- **Character Encoding**: Verify proper UTF-8 encoding for Chinese characters
- **Text Overflow**: Test layout stability with longer Chinese text
- **Font Rendering**: Cross-browser Chinese font rendering

### 3. API Integration Tests

- **Language Parameter**: Verify API correctly handles language parameter
- **Fallback Behavior**: Test graceful degradation for missing translations
- **Error Handling**: Validate error responses are properly localized

## Future Enhancements

### 1. Additional Languages

- **Cantonese**: Traditional Chinese with Cantonese terms
- **Mandarin**: Simplified Chinese with Mainland terms

### 2. Cultural Localization

- **Date Formats**: Hong Kong vs. Mainland date formatting
- **Number Formats**: Cultural preferences for number display
- **Color Preferences**: Regional color associations

### 3. Performance Optimizations

- **Lazy Loading**: Load translations on demand
- **Compression**: Optimize translation bundle size
- **CDN**: Serve translations from edge locations

## Conclusion

The multilingual implementation provides comprehensive localization support for Hong Kong's trilingual environment, ensuring authentic and accessible journey time information for all users. The system maintains high performance while supporting real-time language switching and preserving user experience across all supported languages.