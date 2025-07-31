# Weather Map Implementation Architecture

## Overview

This document describes the current implementation of the weather map system that migrated from Tomorrow.io to OpenWeatherMap for better reliability and performance. The system provides real-time weather visualization overlays on Google Maps for Hong Kong transit applications.

## Architecture Summary

### Migration: Tomorrow.io → OpenWeatherMap
- **Previous**: Tomorrow.io API with server-side proxy endpoints
- **Current**: OpenWeatherMap Weather Maps 1.0 API with direct tile access
- **Reason**: Eliminated rate limiting issues and simplified architecture

## Current Implementation

### 1. Environment Configuration

**File**: `.env.local`
```env
NEXT_PUBLIC_OPENWEATHER_KEY="0bbcaaa4b5edb666304a4c13a9aa6199"
OPENWEATHER_BASE_URL="https://tile.openweathermap.org/map"
NEXT_PUBLIC_GMAPS_API_KEY="AIzaSyBI3SdCe2OOnwnKd5xHZrCYA4KBxk-51vs"
NEXT_PUBLIC_GMAPS_MAP_ID="8e0a97af9386fef"
```

### 2. Dependencies

**Package**: `@googlemaps/js-api-loader`
- Handles Google Maps JavaScript API loading
- Replaces custom loader implementation
- Provides better error handling and initialization

### 3. Layer Configuration

**File**: `lib/openWeatherFields.ts`

```typescript
export type OwmV1Layer = 
  | 'clouds_new'
  | 'precipitation_new'
  | 'pressure_new'
  | 'wind_new'
  | 'temp_new'
  | 'clouds_cls'
  | 'precipitation_cls';

export const OWM_LAYERS: Record<string, OwmLayer> = {
  precipitation: {
    name: 'Precipitation',
    description: 'Rainfall intensity',
    unit: 'mm/h',
    v1Layer: 'precipitation_new',
    v2Op: 'PR0'
  },
  // ... other layers
};
```

**Available Weather Layers**:
- **Precipitation**: Rainfall intensity (mm/h)
- **Temperature**: Air temperature (°C)
- **Wind**: Wind speed and direction (m/s)
- **Pressure**: Sea level pressure (hPa)
- **Clouds**: Cloud coverage (%)

### 4. Core Components

#### A. WeatherMap Component
**File**: `components/WeatherMap.tsx`

**Features**:
- Support for both Weather Maps 1.0 and 2.0
- Single-layer and multi-layer implementations
- Hong Kong-focused configuration
- Integrated layer controls
- Opacity adjustment
- Google Maps integration with custom styling

**Key Functions**:
```typescript
export function WeatherMap(props: V1Props | V2Props)
export function HKWeatherMap(props: HKWeatherMapProps)
```

**URL Pattern (Weather Maps 1.0)**:
```
https://tile.openweathermap.org/map/{layer}/{z}/{x}/{y}.png?appid={API_KEY}
```

#### B. Layer Management
- **Direct Tile Access**: No server-side proxies required
- **Browser Caching**: Automatic tile caching via browser and CDN
- **Error Handling**: Graceful fallback for missing tiles
- **Performance**: Reduced API calls and improved loading

### 5. Integration Points

#### A. Demo Page
**File**: `app/hkwm/page.tsx`
- Standalone weather map demonstration
- Full layer controls and configuration
- Hong Kong center and zoom optimization

#### B. Signals Page
**File**: `app/signals/page.tsx`
- Weather map integrated into weather category
- Streamlined interface for transit context
- Combined with weather-related signals

### 6. Configuration Constants

**Hong Kong Specifics**:
```typescript
export const HONG_KONG_CENTER = {
  lat: 22.296,
  lng: 114.1722  // Tsim Sha Tsui
};

export const HONG_KONG_BOUNDS = {
  minLat: 22.153,
  maxLat: 22.562,
  minLng: 113.835,
  maxLng: 114.441
};
```

**OpenWeatherMap Configuration**:
```typescript
export const OWM_CONFIG = {
  maxZoom: 18,
  minZoom: 0,
  tileSize: 256,
  opacity: 0.7
};
```

## What's Implemented

### ✅ Completed Features

1. **OpenWeatherMap Integration**
   - Weather Maps 1.0 API implementation
   - Direct tile access (no server proxy)
   - Multiple weather layer support

2. **Google Maps Integration**
   - Custom ImageMapType overlays
   - Hong Kong-optimized styling
   - Proper map initialization and cleanup

3. **Layer Management**
   - Multi-layer support with toggle controls
   - Opacity adjustment slider
   - Real-time layer switching

4. **User Interface**
   - Integrated layer controls
   - Clean, responsive design
   - Proper attribution display

5. **Performance Optimizations**
   - Browser-cached tiles
   - Efficient overlay management
   - Minimal API calls

6. **Error Handling**
   - Graceful fallback for missing tiles
   - Proper cleanup on component unmount
   - Loading states and error boundaries

### ✅ Pages Updated

1. **Demo Page** (`/hkwm`)
   - Full-featured weather map
   - All layer controls enabled
   - Development and testing interface

2. **Signals Page** (`/signals`)
   - Weather map in weather category
   - Integrated with weather signals
   - Streamlined for transit context

## What's NOT Implemented

### 🔄 Potential Enhancements

1. **Weather Maps 2.0 Features**
   - Time-aware forecasting (currently uses 1.0 only)
   - Historical weather data
   - Custom color palettes
   - Server-side opacity control

2. **Advanced Controls**
   - Time slider for forecast animation
   - Custom date/time selection
   - Legend display for weather data
   - Layer opacity per individual layer

3. **Performance Enhancements**
   - Debounced layer switching
   - Preloading of forecast tiles
   - Custom caching strategy
   - Tile size optimization

4. **User Experience**
   - Weather data tooltips on hover
   - Click-to-get-weather-info
   - Saved user preferences
   - Mobile-optimized controls

5. **Data Integration**
   - Weather alerts integration
   - Transit impact correlation
   - Real-time weather station data
   - Severe weather notifications

6. **Accessibility**
   - Screen reader support
   - Keyboard navigation
   - High contrast mode
   - Alternative text for weather data

## Technical Architecture

### Data Flow
```
Browser → OpenWeatherMap Tiles → Google Maps ImageMapType → Display
```

### Component Hierarchy
```
HKWeatherMap
├── Google Maps (via @googlemaps/js-api-loader)
├── ImageMapType Overlays (per active layer)
├── Layer Controls (checkboxes, opacity slider)
└── Attribution
```

### API Endpoints Used
- **OpenWeatherMap Weather Maps 1.0**: `https://tile.openweathermap.org/map/{layer}/{z}/{x}/{y}.png`
- **Google Maps JavaScript API**: Dynamic loading via official loader

## Removed Components

### 🗑️ Cleaned Up
- `app/api/tio/` - All Tomorrow.io proxy endpoints
- `components/HKWeatherVectorMap.tsx` - Old weather map component
- `components/HKTimeSlider.tsx` - Time slider component
- `components/HKLayerToggles.tsx` - Layer toggle component
- `lib/googleMapsLoader.ts` - Custom Google Maps loader
- `lib/tomorrowFields.ts` - Tomorrow.io field definitions
- `types/tio.ts` - Tomorrow.io TypeScript types

## Future Development

### 🚀 Next Steps

1. **Immediate Improvements**
   - Add Weather Maps 2.0 support for time-aware features
   - Implement time slider for forecast animation
   - Add weather data legends

2. **Medium-term Enhancements**
   - Mobile-responsive controls
   - Weather alerts integration
   - Performance monitoring
   - User preference persistence

3. **Long-term Vision**
   - Real-time weather station integration
   - Predictive transit impact analysis
   - Advanced weather visualization modes
   - Integration with Hong Kong Observatory data

## Development Notes

### 🔧 Technical Considerations

1. **API Key Security**
   - OpenWeatherMap key is client-side exposed
   - Restricted to authorized domains in OWM console
   - Consider server-side proxy for production quota management

2. **Performance Monitoring**
   - Monitor tile loading performance
   - Track API usage and costs
   - Implement tile loading analytics

3. **Error Handling**
   - Current implementation gracefully handles missing tiles
   - Consider adding retry logic for failed requests
   - Implement offline fallback modes

4. **Testing Strategy**
   - Unit tests for layer management
   - Integration tests for Google Maps interaction
   - Performance tests for tile loading
   - Cross-browser compatibility testing

## Configuration Management

### 🎛️ Key Settings

```typescript
// Adjust these based on requirements
const DEFAULT_OPACITY = 0.7;
const DEFAULT_ZOOM = 10;
const DEFAULT_LAYERS = ['precipitation'];
const REFRESH_INTERVAL = 15 * 60 * 1000; // 15 minutes
```

### 🗺️ Geographic Configuration

Currently optimized for Hong Kong:
- Center: Tsim Sha Tsui (22.296, 114.1722)
- Bounds: Hong Kong territory
- Zoom levels: 0-18

For other regions, update `HONG_KONG_CENTER` and `HONG_KONG_BOUNDS` in `lib/openWeatherFields.ts`.

---

## Summary

The weather map implementation provides a solid foundation for weather visualization in Hong Kong transit applications. The migration from Tomorrow.io to OpenWeatherMap eliminated rate limiting issues and simplified the architecture while maintaining full functionality. The system is production-ready for current weather display and can be extended with forecast features and advanced visualizations as needed.

**Current Status**: ✅ Production Ready
**Next Priority**: Weather Maps 2.0 integration for time-aware features
**Architecture**: Simplified, performant, and maintainable