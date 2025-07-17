"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { 
  Eye, 
  Droplets, 
  Wind, 
  Sun, 
  Navigation,
  MapPin,
  Thermometer,
  Activity
} from "lucide-react"
import { cn } from "@/lib/utils"

interface WeatherData {
  main: {
    temp: number
    feels_like: number
    humidity: number
    pressure: number
  }
  weather: Array<{
    main: string
    description: string
    icon: string
  }>
  wind: {
    speed: number
    deg: number
  }
  visibility: number
  uvi?: number
  name: string
}

interface OneCallData {
  current: {
    temp: number
    feels_like: number
    humidity: number
    uvi: number
    visibility: number
    wind_speed: number
    wind_deg: number
    weather: Array<{
      main: string
      description: string
      icon: string
    }>
  }
  hourly: Array<{
    dt: number
    temp: number
    weather: Array<{
      main: string
      description: string
      icon: string
    }>
    pop: number
  }>
  daily: Array<{
    dt: number
    temp: {
      min: number
      max: number
    }
    weather: Array<{
      main: string
      description: string
      icon: string
    }>
    pop: number
  }>
}

interface WeatherCardProps {
  language?: 'en' | 'zh-TW' | 'zh-CN'
}

const weatherTranslations = {
  en: {
    feelsLike: "Feels like",
    humidity: "Humidity",
    wind: "Wind",
    uv: "UV Index",
    visibility: "Visibility",
    pressure: "Pressure",
    loading: "Loading weather...",
    error: "Failed to load weather",
    hongKong: "Hong Kong",
    kmh: "km/h",
    km: "km",
    degrees: "°",
    hPa: "hPa",
    hourlyForecast: "Hourly Forecast",
    dailyForecast: "6-Day Forecast",
    precipitation: "Precipitation",
    today: "Today",
    tomorrow: "Tomorrow"
  },
  'zh-TW': {
    feelsLike: "體感溫度",
    humidity: "濕度",
    wind: "風速",
    uv: "紫外線指數",
    visibility: "能見度",
    pressure: "氣壓",
    loading: "載入天氣中...",
    error: "載入天氣失敗",
    hongKong: "香港",
    kmh: "公里/小時",
    km: "公里",
    degrees: "°",
    hPa: "百帕",
    hourlyForecast: "逐時預報",
    dailyForecast: "六日預報",
    precipitation: "降水",
    today: "今日",
    tomorrow: "明日"
  },
  'zh-CN': {
    feelsLike: "体感温度",
    humidity: "湿度",
    wind: "风速",
    uv: "紫外线指数",
    visibility: "能见度",
    pressure: "气压",
    loading: "加载天气中...",
    error: "加载天气失败",
    hongKong: "香港",
    kmh: "公里/小时",
    km: "公里",
    degrees: "°",
    hPa: "百帕",
    hourlyForecast: "逐时预报",
    dailyForecast: "六日预报",
    precipitation: "降水",
    today: "今日",
    tomorrow: "明日"
  }
}

export default function WeatherCard({ language = 'en' }: WeatherCardProps) {
  const [currentWeather, setCurrentWeather] = useState<WeatherData | null>(null)
  const [oneCallData, setOneCallData] = useState<OneCallData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const t = weatherTranslations[language]

  useEffect(() => {
    const fetchWeatherData = async () => {
      try {
        setLoading(true)
        
        // Fetch current weather and OneCall data in parallel
        const [currentResponse, oneCallResponse] = await Promise.all([
          fetch('/api/weather?type=current'),
          fetch('/api/weather?type=onecall')
        ])

        if (!currentResponse.ok || !oneCallResponse.ok) {
          throw new Error('Failed to fetch weather data')
        }

        const [currentData, oneCallData] = await Promise.all([
          currentResponse.json(),
          oneCallResponse.json()
        ])

        setCurrentWeather(currentData)
        setOneCallData(oneCallData)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    fetchWeatherData()

    // Refresh every 10 minutes
    const interval = setInterval(fetchWeatherData, 10 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  const getWeatherIcon = (iconCode: string) => {
    const iconUrl = `https://openweathermap.org/img/wn/${iconCode}@4x.png`
    return iconUrl
  }

  const getWindDirection = (degrees: number) => {
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
    const index = Math.round(degrees / 45) % 8
    return directions[index]
  }

  const getUVLevel = (uvi: number) => {
    if (uvi <= 2) return { level: 'Low', color: 'text-green-600 dark:text-green-400' }
    if (uvi <= 5) return { level: 'Moderate', color: 'text-yellow-600 dark:text-yellow-400' }
    if (uvi <= 7) return { level: 'High', color: 'text-orange-600 dark:text-orange-400' }
    if (uvi <= 10) return { level: 'Very High', color: 'text-red-600 dark:text-red-400' }
    return { level: 'Extreme', color: 'text-purple-600 dark:text-purple-400' }
  }

  if (loading) {
    return (
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded mb-4"></div>
            <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded mb-4"></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="h-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
              <div className="h-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
            </div>
          </div>
          <p className="text-center text-muted-foreground mt-4">{t.loading}</p>
        </CardContent>
      </Card>
    )
  }

  if (error || !currentWeather || !oneCallData) {
    return (
      <Card className="mb-6 border-red-200 dark:border-red-800">
        <CardContent className="p-6 text-center">
          <p className="text-red-600 dark:text-red-400">{t.error}</p>
        </CardContent>
      </Card>
    )
  }

  const weather = currentWeather
  const current = oneCallData.current
  const uvData = getUVLevel(current.uvi)

  return (
    <div className="mb-6 space-y-4">
      {/* Main Weather Card */}
      <Card className="overflow-hidden bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-950 dark:to-indigo-950 border-blue-200 dark:border-blue-800">
        <CardContent className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                {t.hongKong}
              </h2>
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {new Date().toLocaleDateString(language === 'en' ? 'en-US' : language === 'zh-TW' ? 'zh-TW' : 'zh-CN', { 
                weekday: 'long', 
                month: 'short', 
                day: 'numeric' 
              })}
            </div>
          </div>

          {/* Main Weather Display */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="relative">
                <img
                  src={getWeatherIcon(weather.weather[0].icon)}
                  alt={weather.weather[0].description}
                  className="w-20 h-20"
                />
              </div>
              <div>
                <div className="text-5xl font-bold text-gray-900 dark:text-gray-100">
                  {Math.round(weather.main.temp)}{t.degrees}
                </div>
                <div className="text-lg text-gray-600 dark:text-gray-400 capitalize">
                  {weather.weather[0].description}
                </div>
                <div className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-500">
                  <Thermometer className="h-4 w-4" />
                  {t.feelsLike} {Math.round(weather.main.feels_like)}{t.degrees}
                </div>
              </div>
            </div>
          </div>

          {/* Weather Details Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white/50 dark:bg-black/20 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <Droplets className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                  {t.humidity}
                </span>
              </div>
              <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {weather.main.humidity}%
              </div>
            </div>

            <div className="bg-white/50 dark:bg-black/20 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <Wind className="h-4 w-4 text-green-600 dark:text-green-400" />
                <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                  {t.wind}
                </span>
              </div>
              <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {Math.round(current.wind_speed * 3.6)} {t.kmh}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-500 flex items-center gap-1">
                <Navigation className="h-3 w-3" style={{ transform: `rotate(${current.wind_deg}deg)` }} />
                {getWindDirection(current.wind_deg)}
              </div>
            </div>

            <div className="bg-white/50 dark:bg-black/20 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <Sun className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                  {t.uv}
                </span>
              </div>
              <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {current.uvi}
              </div>
              <div className={cn("text-xs font-medium", uvData.color)}>
                {uvData.level}
              </div>
            </div>

            <div className="bg-white/50 dark:bg-black/20 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <Eye className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                  {t.visibility}
                </span>
              </div>
              <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {Math.round(current.visibility / 1000)} {t.km}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}