"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Clock, Droplets } from "lucide-react"
import { cn } from "@/lib/utils"

interface HourlyData {
  dt: number
  temp: number
  weather: Array<{
    main: string
    description: string
    icon: string
  }>
  pop: number
  humidity: number
}

interface HourlyForecastProps {
  language?: 'en' | 'zh-TW' | 'zh-CN'
}

const hourlyTranslations = {
  en: {
    title: "Hourly Forecast",
    loading: "Loading forecast...",
    error: "Failed to load forecast",
    precipitation: "Precipitation",
    now: "Now"
  },
  'zh-TW': {
    title: "逐時預報",
    loading: "載入預報中...",
    error: "載入預報失敗",
    precipitation: "降水機率",
    now: "現在"
  },
  'zh-CN': {
    title: "逐时预报",
    loading: "加载预报中...",
    error: "加载预报失败",
    precipitation: "降水概率",
    now: "现在"
  }
}

export default function WeatherHourlyForecast({ language = 'en' }: HourlyForecastProps) {
  const [hourlyData, setHourlyData] = useState<HourlyData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const t = hourlyTranslations[language]

  useEffect(() => {
    const fetchHourlyData = async () => {
      try {
        setLoading(true)
        
        const response = await fetch('/api/weather?type=onecall')
        if (!response.ok) {
          throw new Error('Failed to fetch hourly data')
        }

        const data = await response.json()
        
        // Get next 6 hours of data
        const next6Hours = data.hourly.slice(0, 6).map((hour: any) => ({
          dt: hour.dt,
          temp: hour.temp,
          weather: hour.weather,
          pop: hour.pop,
          humidity: hour.humidity
        }))

        setHourlyData(next6Hours)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    fetchHourlyData()

    // Refresh every 30 minutes
    const interval = setInterval(fetchHourlyData, 30 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  const formatTime = (timestamp: number, index: number) => {
    if (index === 0) return t.now
    
    const date = new Date(timestamp * 1000)
    return date.toLocaleTimeString(language === 'en' ? 'en-US' : language === 'zh-TW' ? 'zh-TW' : 'zh-CN', { 
      hour: 'numeric',
      hour12: language === 'en'
    })
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

  if (loading) {
    return (
      <Card className="mb-4">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            {t.title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex-shrink-0 text-center p-3 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse">
                <div className="w-16 h-4 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
                <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-full mx-auto mb-2"></div>
                <div className="w-8 h-6 bg-gray-200 dark:bg-gray-700 rounded mb-1"></div>
                <div className="w-10 h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
              </div>
            ))}
          </div>
          <p className="text-center text-muted-foreground mt-4">{t.loading}</p>
        </CardContent>
      </Card>
    )
  }

  if (error || hourlyData.length === 0) {
    return (
      <Card className="mb-4 border-red-200 dark:border-red-800">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Clock className="h-5 w-5 text-red-600 dark:text-red-400" />
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
          <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          {t.title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {hourlyData.map((hour, index) => (
            <div
              key={hour.dt}
              className={cn(
                "flex-shrink-0 text-center p-4 rounded-lg border transition-all",
                index === 0 
                  ? "bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800" 
                  : "bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800"
              )}
            >
              {/* Time */}
              <div className={cn(
                "text-sm font-medium mb-2",
                index === 0 
                  ? "text-blue-600 dark:text-blue-400" 
                  : "text-gray-600 dark:text-gray-400"
              )}>
                {formatTime(hour.dt, index)}
              </div>
              
              {/* Weather Icon */}
              <div className="mb-2">
                <img
                  src={getWeatherIcon(hour.weather[0].icon)}
                  alt={hour.weather[0].description}
                  className="w-12 h-12 mx-auto"
                />
              </div>
              
              {/* Temperature */}
              <div className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                {Math.round(hour.temp)}°
              </div>
              
              {/* Precipitation */}
              <div className="flex items-center justify-center gap-1">
                <Droplets className={cn("h-3 w-3", getPrecipitationColor(hour.pop))} />
                <span className={cn("text-xs", getPrecipitationColor(hour.pop))}>
                  {Math.round(hour.pop * 100)}%
                </span>
              </div>
            </div>
          ))}
        </div>
        
        {/* Temperature Line Chart Visual */}
        <div className="mt-4 px-2">
          <div className="relative h-16">
            <svg className="w-full h-full" viewBox="0 0 600 100" preserveAspectRatio="xMidYMid meet">
              <defs>
                <linearGradient id="tempGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="rgb(59, 130, 246)" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="rgb(59, 130, 246)" stopOpacity="0.1" />
                </linearGradient>
              </defs>
              
              {/* Temperature line */}
              <polyline
                points={hourlyData.map((hour, index) => {
                  const x = (index / (hourlyData.length - 1)) * 580 + 10
                  const minTemp = Math.min(...hourlyData.map(h => h.temp))
                  const maxTemp = Math.max(...hourlyData.map(h => h.temp))
                  const tempRange = maxTemp - minTemp || 1
                  const y = 90 - ((hour.temp - minTemp) / tempRange) * 60
                  return `${x},${y}`
                }).join(' ')}
                fill="none"
                stroke="rgb(59, 130, 246)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              
              {/* Temperature area */}
              <polygon
                points={`${hourlyData.map((hour, index) => {
                  const x = (index / (hourlyData.length - 1)) * 580 + 10
                  const minTemp = Math.min(...hourlyData.map(h => h.temp))
                  const maxTemp = Math.max(...hourlyData.map(h => h.temp))
                  const tempRange = maxTemp - minTemp || 1
                  const y = 90 - ((hour.temp - minTemp) / tempRange) * 60
                  return `${x},${y}`
                }).join(' ')} 590,90 10,90`}
                fill="url(#tempGradient)"
              />
              
              {/* Temperature points */}
              {hourlyData.map((hour, index) => {
                const x = (index / (hourlyData.length - 1)) * 580 + 10
                const minTemp = Math.min(...hourlyData.map(h => h.temp))
                const maxTemp = Math.max(...hourlyData.map(h => h.temp))
                const tempRange = maxTemp - minTemp || 1
                const y = 90 - ((hour.temp - minTemp) / tempRange) * 60
                
                return (
                  <circle
                    key={index}
                    cx={x}
                    cy={y}
                    r="3"
                    fill="rgb(59, 130, 246)"
                    stroke="white"
                    strokeWidth="2"
                  />
                )
              })}
            </svg>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}