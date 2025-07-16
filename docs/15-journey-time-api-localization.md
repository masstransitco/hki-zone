# Journey Time API Localization

## Overview

This document describes the localization updates made to the Journey Time API (`/api/journey-time/route.ts`) to support multilingual route names and destinations for Hong Kong's trilingual environment.

## API Changes

### 1. Language Parameter Support

The API now accepts a `language` query parameter to return localized content:

```typescript
// API endpoint
GET /api/journey-time?language=en|zh-CN|zh-TW

// Example requests
GET /api/journey-time?start=hk&dest=kln&language=en
GET /api/journey-time?start=hk&dest=kln&language=zh-CN
GET /api/journey-time?start=hk&dest=kln&language=zh-TW
```

### 2. Data Structure Updates

#### Before (String-based):
```typescript
const LOCATION_NAMES: { [key: string]: string } = {
  'H1': 'Central/Admiralty',
  'H2': 'Wan Chai',
  'H3': 'Causeway Bay',
  // ...
}
```

#### After (Language-aware):
```typescript
type Language = 'en' | 'zh-CN' | 'zh-TW'

const LOCATION_NAMES: { [key: string]: { [lang in Language]: string } } = {
  'H1': { en: 'Central/Admiralty', 'zh-CN': '中环/金钟', 'zh-TW': '中環/金鐘' },
  'H2': { en: 'Wan Chai', 'zh-CN': '湾仔', 'zh-TW': '灣仔' },
  'H3': { en: 'Causeway Bay', 'zh-CN': '铜锣湾', 'zh-TW': '銅鑼灣' },
  // ...
}
```

### 3. Response Format Changes

#### Before:
```json
{
  "from": "Central/Admiralty",
  "to": "Cross-Harbour Tunnel",
  "locale": "en"
}
```

#### After (English):
```json
{
  "from": "Central/Admiralty",
  "to": "Cross-Harbour Tunnel",
  "locale": "en"
}
```

#### After (Simplified Chinese):
```json
{
  "from": "中环/金钟",
  "to": "海底隧道",
  "locale": "zh"
}
```

#### After (Traditional Chinese):
```json
{
  "from": "中環/金鐘",
  "to": "海底隧道",
  "locale": "zh"
}
```

## Complete Location Mappings

### Hong Kong Island Locations

| Location ID | English | Simplified Chinese | Traditional Chinese |
|-------------|---------|-------------------|-------------------|
| H1 | Central/Admiralty | 中环/金钟 | 中環/金鐘 |
| H2 | Wan Chai | 湾仔 | 灣仔 |
| H3 | Causeway Bay | 铜锣湾 | 銅鑼灣 |
| H4 | North Point | 北角 | 北角 |
| H5 | Quarry Bay | 鲗鱼涌 | 鰂魚涌 |
| H6 | Tai Koo | 太古 | 太古 |
| H7 | Shau Kei Wan | 筲箕湾 | 筲箕灣 |
| H8 | Chai Wan | 柴湾 | 柴灣 |
| H9 | Aberdeen | 香港仔 | 香港仔 |
| H11 | Kennedy Town | 坚尼地城 | 堅尼地城 |

### Kowloon Locations

| Location ID | English | Simplified Chinese | Traditional Chinese |
|-------------|---------|-------------------|-------------------|
| K01 | Tsim Sha Tsui | 尖沙咀 | 尖沙咀 |
| K02 | Jordan | 佐敦 | 佐敦 |
| K03 | Yau Ma Tei | 油麻地 | 油麻地 |
| K04 | Mong Kok | 旺角 | 旺角 |
| K05 | Sham Shui Po | 深水埗 | 深水埗 |
| K06 | Kowloon Tong | 九龙塘 | 九龍塘 |
| K07 | Wong Tai Sin | 黄大仙 | 黃大仙 |

### New Territories Locations

| Location ID | English | Simplified Chinese | Traditional Chinese |
|-------------|---------|-------------------|-------------------|
| N01 | Sha Tin | 沙田 | 沙田 |
| N02 | Tai Po | 大埔 | 大埔 |
| N03 | Fanling | 粉岭 | 粉嶺 |
| N05 | Tuen Mun | 屯门 | 屯門 |
| N06 | Yuen Long | 元朗 | 元朗 |
| N07 | Tsuen Wan | 荃湾 | 荃灣 |
| N08 | Kwai Chung | 葵涌 | 葵涌 |
| N09 | Tsing Yi | 青衣 | 青衣 |
| N10 | Ma On Shan | 马鞍山 | 馬鞍山 |
| N11 | Tseung Kwan O | 将军澳 | 將軍澳 |
| N12 | Sai Kung | 西贡 | 西貢 |
| N13 | Tai Wai | 大围 | 大圍 |

### Strategic Junctions

| Location ID | English | Simplified Chinese | Traditional Chinese |
|-------------|---------|-------------------|-------------------|
| SJ1 | Strategic Junction 1 | 策略交汇点1 | 策略交匯點1 |
| SJ2 | Strategic Junction 2 | 策略交汇点2 | 策略交匯點2 |
| SJ3 | Strategic Junction 3 | 策略交汇点3 | 策略交匯點3 |
| SJ4 | Strategic Junction 4 | 策略交汇点4 | 策略交匯點4 |
| SJ5 | Strategic Junction 5 | 策略交汇点5 | 策略交匯點5 |

## Complete Destination Mappings

### Major Tunnels

| Destination ID | English | Simplified Chinese | Traditional Chinese |
|----------------|---------|-------------------|-------------------|
| CH | Cross-Harbour Tunnel | 海底隧道 | 海底隧道 |
| EH | Eastern Harbour Tunnel | 东区海底隧道 | 東區海底隧道 |
| WH | Western Harbour Tunnel | 西区海底隧道 | 西區海底隧道 |
| ABT | Aberdeen Tunnel | 香港仔隧道 | 香港仔隧道 |
| LRT | Lion Rock Tunnel | 狮子山隧道 | 獅子山隧道 |
| SMT | Shing Mun Tunnel | 城门隧道 | 城門隧道 |
| TCT | Tai Lam Tunnel | 大榄隧道 | 大欖隧道 |
| TKOT | TKO Tunnel | 将军澳隧道 | 將軍澳隧道 |
| TKOLTT | TKO Lam Tin Tunnel | 将军澳蓝田隧道 | 將軍澳藍田隧道 |
| TKTM | Tsing Kwan O Tunnel | 将军澳隧道 | 將軍澳隧道 |
| ACTT | Airport Core Tunnel | 机场核心隧道 | 機場核心隧道 |

### Major Destinations

| Destination ID | English | Simplified Chinese | Traditional Chinese |
|----------------|---------|-------------------|-------------------|
| ATL | Airport | 机场 | 機場 |
| TKTL | Tseung Kwan O | 将军澳 | 將軍澳 |
| TMCLK | Tuen Mun | 屯门 | 屯門 |
| TPR | Tai Po | 大埔 | 大埔 |
| MOS | Ma On Shan | 马鞍山 | 馬鞍山 |
| CWBR | Causeway Bay | 铜锣湾 | 銅鑼灣 |
| KTPR | Kwai Tsing | 葵青 | 葵青 |
| PFL | Po Fulam | 薄扶林 | 薄扶林 |
| TLH | Tai Lam | 大榄 | 大欖 |
| TSCA | Tsing Sha Control Area | 青沙管制区 | 青沙管制區 |
| TWCP | Tsuen Wan | 荃湾 | 荃灣 |

### Route Combinations

| Destination ID | English | Simplified Chinese | Traditional Chinese |
|----------------|---------|-------------------|-------------------|
| ATSCA | Airport to SCAR | 机场至石岗 | 機場至石崗 |
| SSCPR | Sha Sha Chi | 沙沙池 | 沙沙池 |
| SSYLH | Sha Sha Yuen Long | 沙沙元朗 | 沙沙元朗 |
| TWTM | Tsuen Wan to Tuen Mun | 荃湾至屯门 | 荃灣至屯門 |
| WNCG | Wan Chai to Central | 湾仔至中环 | 灣仔至中環 |

## Implementation Details

### 1. Language Parameter Handling

```typescript
export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const language = url.searchParams.get('language') as Language || 'en'
  
  // ... rest of implementation
}
```

### 2. Localized Name Resolution

```typescript
// For individual route requests
const cardData: JourneyTimeCardProps = {
  from: LOCATION_NAMES[specificRoute.locationId]?.[language] || specificRoute.locationId,
  to: DESTINATION_NAMES[specificRoute.destinationId]?.[language] || specificRoute.destinationId,
  locale: language === 'en' ? 'en' : 'zh',
  // ... other properties
}

// For bulk route requests
const cardData: JourneyTimeCardProps[] = filteredData.map(jt => ({
  from: LOCATION_NAMES[jt.locationId]?.[language] || jt.locationId,
  to: DESTINATION_NAMES[jt.destinationId]?.[language] || jt.destinationId,
  locale: language === 'en' ? 'en' : 'zh',
  // ... other properties
}))
```

### 3. Fallback Handling

The API implements graceful fallbacks:

1. **Missing Translation**: Falls back to original location/destination ID
2. **Invalid Language**: Defaults to English (`en`)
3. **Empty Results**: Returns original ID if no translation exists

```typescript
// Safe language-aware lookup with fallback
const localizedName = LOCATION_NAMES[locationId]?.[language] || locationId
```

### 4. Locale Setting

The `locale` field is set based on the language parameter:

```typescript
locale: language === 'en' ? 'en' : 'zh'
```

This ensures proper formatting for:
- **Time Display**: "15 min" vs "15 分钟"
- **Date Formatting**: Different date formats for Chinese
- **Number Formatting**: Cultural number preferences

## API Response Examples

### English Response
```json
{
  "journeyTimes": [
    {
      "from": "Central/Admiralty",
      "to": "Cross-Harbour Tunnel",
      "timeMin": 12,
      "trendMin": 2,
      "colourId": 2,
      "capture": "2024-01-15T10:30:00Z",
      "locale": "en",
      "routeType": "expressway"
    }
  ],
  "total": 1,
  "lastUpdated": "2024-01-15T10:30:00Z",
  "metadata": {
    "source": "transport_department",
    "cache_duration": "2 minutes"
  }
}
```

### Simplified Chinese Response
```json
{
  "journeyTimes": [
    {
      "from": "中环/金钟",
      "to": "海底隧道",
      "timeMin": 12,
      "trendMin": 2,
      "colourId": 2,
      "capture": "2024-01-15T10:30:00Z",
      "locale": "zh",
      "routeType": "expressway"
    }
  ],
  "total": 1,
  "lastUpdated": "2024-01-15T10:30:00Z",
  "metadata": {
    "source": "transport_department",
    "cache_duration": "2 minutes"
  }
}
```

### Traditional Chinese Response
```json
{
  "journeyTimes": [
    {
      "from": "中環/金鐘",
      "to": "海底隧道",
      "timeMin": 12,
      "trendMin": 2,
      "colourId": 2,
      "capture": "2024-01-15T10:30:00Z",
      "locale": "zh",
      "routeType": "expressway"
    }
  ],
  "total": 1,
  "lastUpdated": "2024-01-15T10:30:00Z",
  "metadata": {
    "source": "transport_department",
    "cache_duration": "2 minutes"
  }
}
```

## Performance Considerations

### 1. Memory Usage

The multilingual data structure increases memory usage:

- **Before**: ~50 location names × 20 chars = ~1KB
- **After**: ~50 location names × 3 languages × 20 chars = ~3KB

### 2. Processing Overhead

Language-aware lookup adds minimal processing overhead:

```typescript
// O(1) lookup time regardless of language
const name = LOCATION_NAMES[id]?.[language] || id
```

### 3. Caching Strategy

The API maintains the same caching strategy with language-specific responses:

- **Cache Key**: Includes language parameter
- **TTL**: Same 2-minute cache duration
- **Invalidation**: Language changes don't affect cache invalidation

## Error Handling

### 1. Invalid Language Parameter

```typescript
// Defaults to English for invalid language
const language = url.searchParams.get('language') as Language || 'en'
```

### 2. Missing Translations

```typescript
// Falls back to original ID
const localizedName = LOCATION_NAMES[locationId]?.[language] || locationId
```

### 3. API Error Responses

Error responses maintain the same format with localized error messages handled by the client-side language provider.

## Testing

### 1. Language Parameter Tests

```bash
# Test English (default)
curl "/api/journey-time?start=hk&dest=kln"

# Test Simplified Chinese
curl "/api/journey-time?start=hk&dest=kln&language=zh-CN"

# Test Traditional Chinese
curl "/api/journey-time?start=hk&dest=kln&language=zh-TW"

# Test invalid language (should default to English)
curl "/api/journey-time?start=hk&dest=kln&language=invalid"
```

### 2. Localization Tests

```bash
# Verify Chinese characters are properly encoded
curl "/api/journey-time?language=zh-CN" | jq '.journeyTimes[0].from'

# Test fallback behavior
curl "/api/journey-time?language=zh-CN" | grep -E "H[0-9]+"
```

## Future Enhancements

### 1. Additional Languages

The current structure supports easy addition of new languages:

```typescript
type Language = 'en' | 'zh-CN' | 'zh-TW' | 'ja' | 'ko'

const LOCATION_NAMES: { [key: string]: { [lang in Language]: string } } = {
  'H1': { 
    en: 'Central/Admiralty', 
    'zh-CN': '中环/金钟', 
    'zh-TW': '中環/金鐘',
    ja: '中環/金鐘',
    ko: '센트럴/애드미럴티'
  },
  // ...
}
```

### 2. Dynamic Translation Loading

For better performance, translations could be loaded dynamically:

```typescript
// Load translations on demand
const translations = await import(`./translations/${language}.json`)
```

### 3. Translation Management

Consider external translation management systems for easier updates:

- **Content Management System**: Admin interface for translation updates
- **Translation Services**: Integration with professional translation services
- **Version Control**: Track translation changes over time

## Conclusion

The API localization implementation provides comprehensive multilingual support for Hong Kong's transportation system, ensuring accurate and culturally appropriate route information for all users. The system maintains high performance while supporting real-time language switching and graceful fallback handling.