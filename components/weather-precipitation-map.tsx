"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Slider } from "@/components/ui/slider"
import { CloudRain, MapPin, Play, Pause } from "lucide-react"

// Leaflet types (we'll load dynamically)
interface LeafletMap {
  remove(): void
  setView(latlng: [number, number], zoom: number): LeafletMap
}

interface LeafletTileLayer {
  addTo(map: LeafletMap): LeafletTileLayer
}

interface LeafletMarker {
  addTo(map: LeafletMap): LeafletMarker
  bindPopup(content: string): LeafletMarker
}

interface LeafletStatic {
  map(element: HTMLElement, options?: any): LeafletMap
  tileLayer(urlTemplate: string, options?: any): LeafletTileLayer
  marker(latlng: [number, number]): LeafletMarker
}

declare global {
  interface Window {
    L?: LeafletStatic
  }
}

interface PrecipitationMapProps {
  language?: 'en' | 'zh-TW' | 'zh-CN'
}

const precipitationTranslations = {
  en: {
    title: "Precipitation Map",
    loading: "Loading map...",
    error: "Failed to load precipitation data",
    noData: "No precipitation data available"
  },
  'zh-TW': {
    title: "降水雷達圖",
    loading: "載入地圖中...",
    error: "載入降水資料失敗",
    noData: "沒有降水資料"
  },
  'zh-CN': {
    title: "降水雷达图",
    loading: "加载地图中...",
    error: "加载降水数据失败",
    noData: "没有降水数据"
  }
}

export default function WeatherPrecipitationMap({ language = 'en' }: PrecipitationMapProps) {
  const [loading, setLoading] = useState(true) // Start with true for proper loading state
  const [error, setError] = useState<string | null>(null)
  const [mapReady, setMapReady] = useState(false)
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<LeafletMap | null>(null)
  const initializingRef = useRef(false) // Prevent double initialization
  
  // Animation and intensity controls
  const [isAnimating, setIsAnimating] = useState(false)
  const [intensity, setIntensity] = useState([50])
  const [timeIndex, setTimeIndex] = useState(0)
  const precipLayerRef = useRef<LeafletTileLayer | null>(null)
  const animationIntervalRef = useRef<NodeJS.Timeout | null>(null)
  
  // HKO radar data
  const [radarData, setRadarData] = useState<any>(null)
  const [useHKO, setUseHKO] = useState(true) // Toggle between HKO and OpenWeatherMap

  const t = precipitationTranslations[language]

  // Hong Kong coordinates and zoom level
  const HK_LAT = 22.3193
  const HK_LON = 114.1694
  const ZOOM_LEVEL = 10

  // Generate animation frames using different opacity and layer combinations
  const getAnimationFrames = () => {
    const frames = []
    // Create 10 animation frames with different combinations
    for (let i = 0; i < 10; i++) {
      frames.push({
        index: i,
        opacity: 0.8 + (i / 10) * 0.2, // Vary opacity from 0.8 to 1.0 for better visibility
        layer: i % 3, // Cycle through different layer types
      })
    }
    return frames
  }

  const animationFrames = getAnimationFrames()

  // Fetch HKO radar data
  const fetchHKORadarData = async () => {
    try {
      console.log('[PrecipMap] Fetching HKO radar data via proxy...')
      const response = await fetch('/api/weather/hko-radar')
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.details || `HTTP ${response.status}`)
      }
      
      setRadarData(data)
      console.log('[PrecipMap] HKO radar data loaded:', data)
      return data
    } catch (error) {
      console.error('[PrecipMap] Failed to fetch HKO radar data:', error)
      return null
    }
  }

  // Get HKO radar image URL for specific frame
  const getHKORadarImageUrl = (frameIndex: number, range: number = 1) => {
    if (!radarData?.radar) {
      return null
    }
    
    const rangeKey = `range${range}`
    const rangeData = radarData.radar[rangeKey]
    
    if (!rangeData?.image || !rangeData.image[frameIndex]) {
      return null
    }
    
    // Extract filename from the JavaScript assignment string
    // e.g., 'picture[1][0]="rad_128_png/2d128nradar_202507171042.jpg";'
    const imageString = rangeData.image[frameIndex]
    const match = imageString.match(/"([^"]+)"/)
    
    if (!match) {
      return null
    }
    
    const imagePath = match[1]
    return `https://www.hko.gov.hk/wxinfo/radars/${imagePath}`
  }

  // Animation controls
  const startAnimation = () => {
    if (animationIntervalRef.current) return
    setIsAnimating(true)
    animationIntervalRef.current = setInterval(() => {
      const maxFrames = useHKO && radarData?.radar?.range1?.image ? radarData.radar.range1.image.length : animationFrames.length
      setTimeIndex(prev => (prev + 1) % maxFrames)
    }, 800) // Change frame every 800ms for better visibility
  }

  const stopAnimation = () => {
    if (animationIntervalRef.current) {
      clearInterval(animationIntervalRef.current)
      animationIntervalRef.current = null
    }
    setIsAnimating(false)
  }

  const updatePrecipitationLayer = () => {
    if (!mapInstanceRef.current || !window.L) {
      console.log('[PrecipMap] No map instance or Leaflet available')
      return
    }

    // Remove current layer if it exists
    if (precipLayerRef.current) {
      try {
        mapInstanceRef.current.removeLayer(precipLayerRef.current)
        console.log('[PrecipMap] Removed previous precipitation layer')
      } catch (e) {
        console.log('[PrecipMap] Error removing layer:', e)
      }
    }

    // Calculate opacity based on intensity slider - ensure high visibility
    const baseOpacity = Math.max(0.5, intensity[0] / 100) // Minimum 50% opacity
    const finalOpacity = Math.max(0.8, baseOpacity) // Always high visibility

    if (useHKO && radarData) {
      // Use HKO radar images
      const frameIndex = timeIndex % (radarData.radar?.range1?.image?.length || 1)
      const imageUrl = getHKORadarImageUrl(frameIndex, 1) // Use 128km range
      
      if (!imageUrl) {
        console.log('[PrecipMap] No HKO radar image URL available')
        return
      }

      console.log('[PrecipMap] Creating HKO radar overlay:', {
        imageUrl,
        frameIndex,
        opacity: finalOpacity
      })

      // Define Hong Kong radar image bounds (approximate)
      const hkRadarBounds = [
        [21.9, 113.6], // Southwest corner
        [22.8, 114.8]  // Northeast corner
      ]

      // Create image overlay for HKO radar
      const newLayer = window.L.imageOverlay(imageUrl, hkRadarBounds, {
        opacity: finalOpacity,
        attribution: '© Hong Kong Observatory'
      })

      newLayer.on('load', () => {
        console.log('[PrecipMap] HKO radar image loaded successfully')
      })

      newLayer.on('error', (e) => {
        console.log('[PrecipMap] HKO radar image loading error:', e)
      })

      newLayer.addTo(mapInstanceRef.current)
      precipLayerRef.current = newLayer

      console.log('[PrecipMap] HKO radar overlay added to map')
    } else {
      // Fallback to OpenWeatherMap
      const API_KEY = process.env.NEXT_PUBLIC_OPENWEATHERMAP_API_KEY
      if (!API_KEY) {
        console.log('[PrecipMap] No API key available for OpenWeatherMap fallback')
        return
      }

      const precipitationUrls = [
        `https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=${API_KEY}`,
        `https://tile.openweathermap.org/map/precipitation/{z}/{x}/{y}.png?appid=${API_KEY}`,
        `https://tile.openweathermap.org/map/rain/{z}/{x}/{y}.png?appid=${API_KEY}`
      ]
      
      const selectedUrl = precipitationUrls[0]
      
      console.log('[PrecipMap] Creating OpenWeatherMap fallback layer:', {
        url: selectedUrl,
        opacity: finalOpacity
      })
      
      const newLayer = window.L.tileLayer(selectedUrl, {
        attribution: '© OpenWeatherMap',
        opacity: finalOpacity,
        maxZoom: 19
      })

      newLayer.addTo(mapInstanceRef.current)
      precipLayerRef.current = newLayer
    }
  }

  // Fetch HKO radar data on mount
  useEffect(() => {
    if (useHKO) {
      fetchHKORadarData()
    }
  }, [useHKO])

  // Update precipitation layer when intensity or time changes
  useEffect(() => {
    if (mapReady) {
      updatePrecipitationLayer()
    }
  }, [intensity, timeIndex, mapReady, radarData, useHKO])

  // Cleanup animation on unmount
  useEffect(() => {
    return () => {
      stopAnimation()
    }
  }, [])

  useEffect(() => {
    console.log('[PrecipMap] useEffect triggered, initializing:', initializingRef.current, 'mapExists:', !!mapInstanceRef.current)
    
    // Prevent double initialization in React Strict Mode
    if (initializingRef.current || mapInstanceRef.current) {
      console.log('[PrecipMap] Already initializing or map exists, skipping')
      return
    }

    // Mark as initializing
    initializingRef.current = true
    
    const timeout = setTimeout(() => {
      if (!mapRef.current) {
        console.log('[PrecipMap] No mapRef.current after timeout')
        setError('Map container not available')
        setLoading(false)
        initializingRef.current = false
        return
      }

      initializeMap()
    }, 50)

    function initializeMap() {
      console.log('[PrecipMap] Starting map initialization...')
      setError(null)

      // Check API key
      const API_KEY = process.env.NEXT_PUBLIC_OPENWEATHERMAP_API_KEY
      console.log('[PrecipMap] API Key check:', !!API_KEY)
      
      if (!API_KEY) {
        console.log('[PrecipMap] No API key - stopping')
        setError('OpenWeatherMap API key not configured')
        setLoading(false)
        initializingRef.current = false
        return
      }

      // Initialize map
      const initMap = () => {
        console.log('[PrecipMap] initMap called, window.L available:', !!window.L)
        
        if (!window.L) {
          console.log('[PrecipMap] Leaflet not available, loading...')
          
          // Add CSS
          if (!document.querySelector('link[href*="leaflet"]')) {
            const css = document.createElement('link')
            css.rel = 'stylesheet'
            css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
            document.head.appendChild(css)
          }

          // Add custom CSS to fix z-index issues
          if (!document.querySelector('#leaflet-fix-styles')) {
            const style = document.createElement('style')
            style.id = 'leaflet-fix-styles'
            style.textContent = `
              .leaflet-container {
                position: relative !important;
                z-index: 1 !important;
              }
              .leaflet-control-container {
                z-index: 2 !important;
              }
              .leaflet-control-zoom {
                z-index: 2 !important;
              }
              .leaflet-popup-pane {
                z-index: 3 !important;
              }
            `
            document.head.appendChild(style)
          }
          
          // Add JS - check if already loading or loaded
          if (!document.querySelector('script[src*="leaflet"]')) {
            const script = document.createElement('script')
            script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
            script.onload = () => {
              console.log('[PrecipMap] Leaflet loaded, initializing map...')
              setTimeout(initMap, 100)
            }
            script.onerror = () => {
              console.log('[PrecipMap] Leaflet failed to load')
              setError('Failed to load map library')
              setLoading(false)
              initializingRef.current = false
            }
            document.head.appendChild(script)
          } else {
            // Script already exists, wait for L to be available
            const waitForL = () => {
              if (window.L) {
                console.log('[PrecipMap] Leaflet now available')
                setTimeout(initMap, 100)
              } else {
                setTimeout(waitForL, 100)
              }
            }
            waitForL()
          }
          return
        }

        if (!mapRef.current) {
          console.log('[PrecipMap] mapRef lost during initialization')
          setError('Map container not available')
          setLoading(false)
          initializingRef.current = false
          return
        }

        // Check if container already has a map
        if (mapRef.current.children.length > 0 && mapRef.current.querySelector('.leaflet-container')) {
          console.log('[PrecipMap] Container already has a map, skipping creation')
          setLoading(false)
          setMapReady(true)
          initializingRef.current = false
          return
        }

        try {
          console.log('[PrecipMap] Creating map...')

          // Create map with proper z-index settings
          const map = window.L.map(mapRef.current, {
            zoomControl: true,
            scrollWheelZoom: false,
            zoomSnap: 0.5,
            zoomDelta: 0.5
          }).setView([HK_LAT, HK_LON], ZOOM_LEVEL)

          // Use a minimal, high-contrast base layer without labels
          window.L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png', {
            attribution: '© OpenStreetMap © CARTO',
            subdomains: 'abcd',
            maxZoom: 19
          }).addTo(map)

          // Initialize precipitation layer - will be updated by useEffect
          const precipLayer = window.L.tileLayer(`https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=${API_KEY}`, {
            attribution: '© OpenWeatherMap',
            opacity: intensity[0] / 100,
            maxZoom: 19,
            detectRetina: true
          }).addTo(map)
          
          precipLayerRef.current = precipLayer
          console.log('[PrecipMap] Initial precipitation layer added')

          // Don't add marker - just focus on Hong Kong without the blue pin

          mapInstanceRef.current = map
          setMapReady(true)
          setLoading(false)
          initializingRef.current = false
          console.log('[PrecipMap] Map created successfully!')

        } catch (err) {
          console.error('[PrecipMap] Map creation error:', err)
          setError('Failed to create map')
          setLoading(false)
          initializingRef.current = false
        }
      }

      // Start map initialization
      initMap()
    }

    // Cleanup
    return () => {
      clearTimeout(timeout)
      console.log('[PrecipMap] Cleanup - resetting initialization flag')
      initializingRef.current = false
    }
  }, [])

  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <CloudRain className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          {t.title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative">
          <div 
            ref={mapRef}
            className="h-[300px] bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden"
            style={{
              position: 'relative',
              zIndex: 1,
              isolation: 'isolate'
            }}
          >
            {/* Loading overlay */}
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-lg">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{t.loading}</p>
                </div>
              </div>
            )}
            
            {/* Error overlay */}
            {error && (
              <div className="absolute inset-0 flex items-center justify-center bg-red-50 dark:bg-red-950 rounded-lg">
                <div className="text-center">
                  <p className="text-red-600 dark:text-red-400 mb-2">{t.error}</p>
                  <p className="text-xs text-red-500 dark:text-red-500">{error}</p>
                </div>
              </div>
            )}
          </div>
          
          {/* Precipitation Legend Overlay */}
          {mapReady && !loading && !error && (
            <div className="absolute bottom-2 right-2 bg-white dark:bg-gray-800 bg-opacity-95 dark:bg-opacity-95 rounded-lg p-3 shadow-lg border border-gray-200 dark:border-gray-700">
              <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Precipitation</div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-2 bg-blue-200 dark:bg-blue-300 rounded-sm border border-gray-300 dark:border-gray-600"></div>
                  <span className="text-xs text-gray-600 dark:text-gray-400">Light</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-2 bg-blue-400 dark:bg-blue-500 rounded-sm border border-gray-300 dark:border-gray-600"></div>
                  <span className="text-xs text-gray-600 dark:text-gray-400">Moderate</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-2 bg-blue-600 dark:bg-blue-700 rounded-sm border border-gray-300 dark:border-gray-600"></div>
                  <span className="text-xs text-gray-600 dark:text-gray-400">Heavy</span>
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Precipitation Controls */}
        {mapReady && !loading && !error && (
          <div className="mt-4 space-y-4">
            {/* Intensity Slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Precipitation Intensity
                </label>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {intensity[0]}%
                </span>
              </div>
              <Slider
                value={intensity}
                onValueChange={setIntensity}
                max={100}
                min={0}
                step={10}
                className="w-full"
              />
            </div>

            {/* Data Source Toggle */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Data Source
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setUseHKO(!useHKO)}
                  className={`px-3 py-1 rounded-lg text-xs transition-colors ${
                    useHKO 
                      ? 'bg-green-500 hover:bg-green-600 text-white' 
                      : 'bg-gray-300 hover:bg-gray-400 text-gray-700'
                  }`}
                >
                  {useHKO ? 'HKO Radar' : 'OpenWeatherMap'}
                </button>
              </div>
            </div>

            {/* Animation Controls */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Time Animation
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    console.log('[PrecipMap] Manual refresh triggered')
                    if (useHKO && !radarData) {
                      fetchHKORadarData().then(() => updatePrecipitationLayer())
                    } else {
                      updatePrecipitationLayer()
                    }
                  }}
                  className="flex items-center gap-1 px-2 py-1 bg-gray-500 hover:bg-gray-600 text-white rounded-lg text-xs transition-colors"
                >
                  Refresh
                </button>
                <button
                  onClick={isAnimating ? stopAnimation : startAnimation}
                  className="flex items-center gap-2 px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm transition-colors"
                  disabled={useHKO && !radarData}
                >
                  {isAnimating ? (
                    <>
                      <Pause className="h-3 w-3" />
                      Pause
                    </>
                  ) : (
                    <>
                      <Play className="h-3 w-3" />
                      Play
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Animation Status */}
            <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
              {useHKO ? (
                <>
                  {radarData ? (
                    <>
                      HKO Radar frame: {timeIndex + 1} of {radarData.radar?.range1?.image?.length || 0}
                      {isAnimating && " (animating)"}
                      {!isAnimating && " (paused)"}
                    </>
                  ) : (
                    "Loading HKO radar data..."
                  )}
                </>
              ) : (
                <>
                  OpenWeatherMap frame: {timeIndex + 1} of {animationFrames.length}
                  {isAnimating && " (animating)"}
                  {!isAnimating && " (paused)"}
                </>
              )}
            </div>
          </div>
        )}
        
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
          {useHKO 
            ? "Real-time radar data from Hong Kong Observatory • Updates every 6 minutes" 
            : "Real-time precipitation data from OpenWeatherMap • Use slider to adjust intensity"
          }
        </p>
      </CardContent>
    </Card>
  )
}