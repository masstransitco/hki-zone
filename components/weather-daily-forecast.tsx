"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Calendar, Droplets, ArrowUp, ArrowDown } from "lucide-react"
import { cn } from "@/lib/utils"

interface DailyData {
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
  humidity: number
  uvi: number
}

interface DailyForecastProps {
  language?: 'en' | 'zh-TW' | 'zh-CN'
}

const dailyTranslations = {
  en: {
    title: "5-Day Forecast",
    loading: "Loading forecast...",
    error: "Failed to load forecast",
    precipitation: "Precipitation",
    today: "Today",
    tomorrow: "Tomorrow",
    humidity: "Humidity",
    uv: "UV"
  },
  'zh-TW': {
    title: "五日預報",
    loading: "載入預報中...",
    error: "載入預報失敗",
    precipitation: "降水機率",
    today: "今日",
    tomorrow: "明日",
    humidity: "濕度",
    uv: "紫外線"
  },
  'zh-CN': {
    title: "五日预报",
    loading: "加载预报中...",
    error: "加载预报失败",
    precipitation: "降水概率",
    today: "今日",
    tomorrow: "明日",
    humidity: "湿度",
    uv: "紫外线"
  }
}

export default function WeatherDailyForecast({ language = 'en' }: DailyForecastProps) {
  const [dailyData, setDailyData] = useState<DailyData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const t = dailyTranslations[language]

  useEffect(() => {
    const fetchDailyData = async () => {
      try {
        setLoading(true)
        
        const response = await fetch('/api/weather?type=onecall')
        if (!response.ok) {
          throw new Error('Failed to fetch daily data')
        }

        const data = await response.json()
        
        // Get next 5 days of data (skip today, start from tomorrow)
        const next5Days = data.daily.slice(1, 6).map((day: any) => ({
          dt: day.dt,
          temp: day.temp,
          weather: day.weather,
          pop: day.pop,
          humidity: day.humidity,
          uvi: day.uvi
        }))

        setDailyData(next5Days)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    fetchDailyData()

    // Refresh every hour
    const interval = setInterval(fetchDailyData, 60 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  const formatDay = (timestamp: number, index: number) => {
    const date = new Date(timestamp * 1000)
    const today = new Date()
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000)
    
    if (index === 0) return t.tomorrow
    
    if (language === 'en') {
      return date.toLocaleDateString('en-US', { weekday: 'short' })
    } else {
      return date.toLocaleDateString(language === 'zh-TW' ? 'zh-TW' : 'zh-CN', { weekday: 'short' })
    }
  }

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000)
    if (language === 'en') {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    } else {
      return date.toLocaleDateString(language === 'zh-TW' ? 'zh-TW' : 'zh-CN', { 
        month: 'short', 
        day: 'numeric' 
      })
    }
  }

  const getWeatherIcon = (iconCode: string) => {
    return `https://openweathermap.org/img/wn/${iconCode}@2x.png`
  }

  const getPrecipitationColor = (pop: number) => {
    if (pop >= 0.7) return "text-blue-600 dark:text-blue-400"
    if (pop >= 0.4) return "text-blue-500 dark:text-blue-500"
    if (pop >= 0.1) return "text-gray-500 dark:text-gray-400"
    return "text-gray-400 dark:text-gray-600"
  }

  const getUVColor = (uvi: number) => {
    if (uvi <= 2) return "text-green-600 dark:text-green-400"
    if (uvi <= 5) return "text-yellow-600 dark:text-yellow-400"
    if (uvi <= 7) return "text-orange-600 dark:text-orange-400"
    if (uvi <= 10) return "text-red-600 dark:text-red-400"
    return "text-purple-600 dark:text-purple-400"
  }

  if (loading) {
    return (
      <Card className="mb-4">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            {t.title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="w-16 h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
                  <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
                  <div className="w-20 h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-6 bg-gray-200 dark:bg-gray-700 rounded"></div>
                  <div className="w-8 h-6 bg-gray-200 dark:bg-gray-700 rounded"></div>
                </div>
              </div>
            ))}
          </div>
          <p className="text-center text-muted-foreground mt-4">{t.loading}</p>
        </CardContent>
      </Card>
    )
  }

  if (error || dailyData.length === 0) {
    return (
      <Card className="mb-4 border-red-200 dark:border-red-800">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Calendar className="h-5 w-5 text-red-600 dark:text-red-400" />
            {t.title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-red-600 dark:text-red-400">{t.error}</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          {t.title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {dailyData.map((day, index) => (
            <div
              key={day.dt}
              className="flex items-center justify-between p-3 sm:p-4 rounded-lg border bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
            >
              <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
                {/* Day and Date */}
                <div className="min-w-[60px] sm:min-w-[80px]">
                  <div className="font-medium text-gray-900 dark:text-gray-100 text-sm sm:text-base">
                    {formatDay(day.dt, index)}
                  </div>
                  <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-500">
                    {formatDate(day.dt)}
                  </div>
                </div>
                
                {/* Weather Icon */}
                <div className="flex-shrink-0">
                  <img
                    src={getWeatherIcon(day.weather[0].icon)}
                    alt={day.weather[0].description}
                    className="w-10 h-10 sm:w-12 sm:h-12"
                  />
                </div>
                
                {/* Weather Description */}
                <div className="flex-1 min-w-0 hidden sm:block">
                  <div className="text-sm text-gray-900 dark:text-gray-100 capitalize truncate">
                    {day.weather[0].description}
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <div className="flex items-center gap-1">
                      <Droplets className={cn("h-3 w-3", getPrecipitationColor(day.pop))} />
                      <span className={cn("text-xs", getPrecipitationColor(day.pop))}>
                        {Math.round(day.pop * 100)}%
                      </span>
                    </div>
                    <div className={cn("text-xs", getUVColor(day.uvi))}>
                      {t.uv} {Math.round(day.uvi)}
                    </div>
                  </div>
                </div>
                
                {/* Mobile-only precipitation indicator */}
                <div className="flex items-center gap-1 sm:hidden">
                  <Droplets className={cn("h-3 w-3", getPrecipitationColor(day.pop))} />
                  <span className={cn("text-xs", getPrecipitationColor(day.pop))}>
                    {Math.round(day.pop * 100)}%
                  </span>
                </div>
              </div>
              
              {/* Temperature Range */}
              <div className="flex items-center gap-1 sm:gap-3 text-right">
                <div className="flex items-center gap-1">
                  <ArrowUp className="h-3 w-3 sm:h-4 sm:w-4 text-red-500 dark:text-red-400" />
                  <span className="font-semibold text-gray-900 dark:text-gray-100 text-sm sm:text-base">
                    {Math.round(day.temp.max)}°
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <ArrowDown className="h-3 w-3 sm:h-4 sm:w-4 text-blue-500 dark:text-blue-400" />
                  <span className="text-gray-600 dark:text-gray-400 text-sm sm:text-base">
                    {Math.round(day.temp.min)}°
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
        
        {/* Temperature Range Chart */}
        <div className="mt-6 px-2">
          <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
            Temperature Range (°C)
          </div>
          <div className="relative h-20">
            <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              <defs>
                <linearGradient id="tempRangeGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="rgb(239, 68, 68)" stopOpacity="0.3" />
                  <stop offset="50%" stopColor="rgb(59, 130, 246)" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="rgb(59, 130, 246)" stopOpacity="0.3" />
                </linearGradient>
              </defs>
              
              {/* Temperature range area */}
              <polygon
                points={`${dailyData.map((day, index) => {
                  const x = (index / (dailyData.length - 1)) * 100
                  const minTemp = Math.min(...dailyData.map(d => d.temp.min))
                  const maxTemp = Math.max(...dailyData.map(d => d.temp.max))
                  const tempRange = maxTemp - minTemp || 1
                  const yMax = 20 + ((maxTemp - day.temp.max) / tempRange) * 60
                  return `${x},${yMax}`
                }).join(' ')} ${dailyData.map((day, index) => {
                  const x = (index / (dailyData.length - 1)) * 100
                  const minTemp = Math.min(...dailyData.map(d => d.temp.min))
                  const maxTemp = Math.max(...dailyData.map(d => d.temp.max))
                  const tempRange = maxTemp - minTemp || 1
                  const yMin = 20 + ((maxTemp - day.temp.min) / tempRange) * 60
                  return `${x},${yMin}`
                }).reverse().join(' ')}`}
                fill="url(#tempRangeGradient)"
              />
              
              {/* Max temperature line */}
              <polyline
                points={dailyData.map((day, index) => {
                  const x = (index / (dailyData.length - 1)) * 100
                  const minTemp = Math.min(...dailyData.map(d => d.temp.min))
                  const maxTemp = Math.max(...dailyData.map(d => d.temp.max))
                  const tempRange = maxTemp - minTemp || 1
                  const y = 20 + ((maxTemp - day.temp.max) / tempRange) * 60
                  return `${x},${y}`
                }).join(' ')}
                fill="none"
                stroke="rgb(239, 68, 68)"
                strokeWidth="2"
                strokeLinecap="round"
              />
              
              {/* Min temperature line */}
              <polyline
                points={dailyData.map((day, index) => {
                  const x = (index / (dailyData.length - 1)) * 100
                  const minTemp = Math.min(...dailyData.map(d => d.temp.min))
                  const maxTemp = Math.max(...dailyData.map(d => d.temp.max))
                  const tempRange = maxTemp - minTemp || 1
                  const y = 20 + ((maxTemp - day.temp.min) / tempRange) * 60
                  return `${x},${y}`
                }).join(' ')}
                fill="none"
                stroke="rgb(59, 130, 246)"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}