"use client"

import WeatherCard from "./weather-card"
import WeatherPrecipitationMap from "./weather-precipitation-map"
import WeatherHourlyForecast from "./weather-hourly-forecast"
import WeatherDailyForecast from "./weather-daily-forecast"

interface WeatherDashboardProps {
  className?: string
  language?: 'en' | 'zh-TW' | 'zh-CN'
}

export default function WeatherDashboard({ className = "", language = 'en' }: WeatherDashboardProps) {

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Main Weather Card */}
      <WeatherCard language={language} />
      
      {/* Grid Layout for Medium Components */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Precipitation Map */}
        <WeatherPrecipitationMap language={language} />
        
        {/* Hourly Forecast */}
        <WeatherHourlyForecast language={language} />
      </div>
      
      {/* Daily Forecast - Full Width */}
      <WeatherDailyForecast language={language} />
    </div>
  )
}