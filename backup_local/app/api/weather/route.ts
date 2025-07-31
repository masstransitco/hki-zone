import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Hong Kong coordinates
const HK_LAT = 22.3193
const HK_LON = 114.1694

export async function GET(request: NextRequest) {
  try {
    const API_KEY = process.env.OPENWEATHERMAP_API_KEY
    
    if (!API_KEY) {
      return NextResponse.json({ error: 'OpenWeatherMap API key not configured' }, { status: 500 })
    }

    const searchParams = request.nextUrl.searchParams
    const type = searchParams.get('type') || 'current'

    switch (type) {
      case 'current':
        return getCurrentWeather(API_KEY)
      case 'forecast':
        return getForecast(API_KEY)
      case 'onecall':
        return getOneCall(API_KEY)
      default:
        return NextResponse.json({ error: 'Invalid weather type' }, { status: 400 })
    }
  } catch (error) {
    console.error('Weather API error:', error)
    return NextResponse.json({ error: 'Failed to fetch weather data' }, { status: 500 })
  }
}

async function getCurrentWeather(apiKey: string) {
  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${HK_LAT}&lon=${HK_LON}&appid=${apiKey}&units=metric`
  
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`OpenWeatherMap API error: ${response.status}`)
  }
  
  const data = await response.json()
  return NextResponse.json(data)
}

async function getForecast(apiKey: string) {
  const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${HK_LAT}&lon=${HK_LON}&appid=${apiKey}&units=metric`
  
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`OpenWeatherMap API error: ${response.status}`)
  }
  
  const data = await response.json()
  return NextResponse.json(data)
}

async function getOneCall(apiKey: string) {
  try {
    // Try OneCall API 2.5 (free tier) instead of 3.0
    const url = `https://api.openweathermap.org/data/2.5/onecall?lat=${HK_LAT}&lon=${HK_LON}&appid=${apiKey}&units=metric&exclude=minutely,alerts`
    
    const response = await fetch(url)
    if (!response.ok) {
      // If OneCall API fails, fallback to combining current + forecast APIs
      console.log('OneCall API failed, using fallback method')
      return getFallbackData(apiKey)
    }
    
    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.log('OneCall API error, using fallback method:', error)
    return getFallbackData(apiKey)
  }
}

async function getFallbackData(apiKey: string) {
  try {
    // Combine current weather + forecast to simulate OneCall response
    const [currentResponse, forecastResponse] = await Promise.all([
      fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${HK_LAT}&lon=${HK_LON}&appid=${apiKey}&units=metric`),
      fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${HK_LAT}&lon=${HK_LON}&appid=${apiKey}&units=metric`)
    ])

    if (!currentResponse.ok || !forecastResponse.ok) {
      throw new Error('Failed to fetch weather data from fallback APIs')
    }

    const [currentData, forecastData] = await Promise.all([
      currentResponse.json(),
      forecastResponse.json()
    ])

    // Transform to OneCall-like structure
    const oneCallData = {
      current: {
        temp: currentData.main.temp,
        feels_like: currentData.main.feels_like,
        humidity: currentData.main.humidity,
        uvi: 5, // Default UV index since it's not available in free API
        visibility: currentData.visibility,
        wind_speed: currentData.wind.speed,
        wind_deg: currentData.wind.deg,
        weather: currentData.weather
      },
      hourly: forecastData.list.slice(0, 24).map((item: any) => ({
        dt: item.dt,
        temp: item.main.temp,
        weather: item.weather,
        pop: item.pop || 0,
        humidity: item.main.humidity
      })),
      daily: []
    }

    // Create daily forecast from 5-day forecast data
    const dailyMap = new Map()
    forecastData.list.forEach((item: any) => {
      const date = new Date(item.dt * 1000).toDateString()
      if (!dailyMap.has(date)) {
        dailyMap.set(date, {
          dt: item.dt,
          temp: { min: item.main.temp, max: item.main.temp },
          weather: item.weather,
          pop: item.pop || 0,
          humidity: item.main.humidity,
          uvi: 5 // Default UV index
        })
      } else {
        const existing = dailyMap.get(date)
        existing.temp.min = Math.min(existing.temp.min, item.main.temp)
        existing.temp.max = Math.max(existing.temp.max, item.main.temp)
        existing.pop = Math.max(existing.pop, item.pop || 0)
      }
    })

    oneCallData.daily = Array.from(dailyMap.values()).slice(0, 8)

    return NextResponse.json(oneCallData)
  } catch (error) {
    throw new Error(`Fallback weather API error: ${error}`)
  }
}