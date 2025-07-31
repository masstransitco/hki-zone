# Weather Map Opacity Fix

## Quick Solution for Solid Color Rectangles

Based on the analysis, the weather tiles contain actual data but appear as solid colors due to low opacity. Here's the immediate fix:

## 1. Update Default Opacity

**File**: `/Users/markau/panora8A/lib/openWeatherFields.ts`

```typescript
// Change line 108 from:
opacity: 0.7

// To:
opacity: 0.9
```

## 2. Add Layer-Specific Opacity (Recommended)

**File**: `/Users/markau/panora8A/lib/openWeatherFields.ts`

Add this configuration after the existing `OWM_CONFIG`:

```typescript
// Layer-specific opacity settings for better visibility
export const LAYER_OPACITY: Record<OwmLayerKey, number> = {
  precipitation: 0.8,  // Semi-transparent for rainfall
  temperature: 0.6,    // Lower opacity for temperature gradients
  pressure: 0.7,       // Medium opacity for pressure lines
  wind: 0.9,          // High opacity for wind arrows
  clouds: 0.5         // Lower opacity for cloud coverage
};
```

## 3. Update WeatherMap Component

**File**: `/Users/markau/panora8A/components/WeatherMap.tsx`

Modify the HKWeatherMap component to use layer-specific opacity:

```typescript
// Import the new opacity configuration
import { LAYER_OPACITY } from '@/lib/openWeatherFields';

// In the useEffect around line 297, replace:
opacity: currentOpacity,

// With:
opacity: LAYER_OPACITY[layerKey] || currentOpacity,
```

## 4. Test Different Zoom Levels

The analysis shows that different layers work better at different zoom levels:

**Best zoom levels for each layer:**
- **Precipitation**: zoom 6-8 (regional level shows more data)
- **Temperature**: zoom 8-12 (good at all levels)
- **Pressure**: zoom 8-12 (good at all levels)  
- **Wind**: zoom 8-10 (optimal detail)
- **Clouds**: zoom 6-10 (varies by cloud coverage)

## 5. Alternative: Use Weather Maps 2.0

For even better control, consider using the Weather Maps 2.0 API with custom color palettes:

```typescript
// Example URL for Weather Maps 2.0 with enhanced colors
const v2Url = `https://maps.openweathermap.org/maps/2.0/weather/TA2/${z}/${x}/${y}?appid=${key}&palette=0:0000FF;10:00FFFF;20:00FF00;30:FFFF00;40:FF0000`;
```

## Testing the Fix

1. **Make the opacity change** in `openWeatherFields.ts`
2. **Visit** `/hkwm` page in your browser
3. **Enable different layers** using the controls
4. **Adjust zoom levels** to see optimal visibility
5. **Check the network tab** to ensure tiles are loading correctly

## Expected Results

After applying these fixes:
- Weather data should be **clearly visible** instead of appearing as solid colors
- **Different layers** will have appropriate opacity levels for their data type
- **Zoom levels** will show varying levels of detail appropriately
- **Multiple layers** can be combined without overwhelming the base map

## Files to Modify

1. `/Users/markau/panora8A/lib/openWeatherFields.ts` - Update default opacity
2. `/Users/markau/panora8A/components/WeatherMap.tsx` - Implement layer-specific opacity (optional)

The weather data is working correctly - this is purely a visualization enhancement!