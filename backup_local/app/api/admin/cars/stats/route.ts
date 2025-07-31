import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // Get total count of cars
    const { count: totalCount, error: totalError } = await supabase
      .from('articles_unified')
      .select('*', { count: 'exact', head: true })
      .eq('category', 'cars')
      .eq('source', '28car')
    
    if (totalError) {
      console.error('Error fetching total car count:', totalError)
      return NextResponse.json(
        { error: 'Failed to fetch car statistics' },
        { status: 500 }
      )
    }
    
    // Get count of cars added in the last 24 hours
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { count: recentCount, error: recentError } = await supabase
      .from('articles_unified')
      .select('*', { count: 'exact', head: true })
      .eq('category', 'cars')
      .eq('source', '28car')
      .gte('created_at', dayAgo)
    
    if (recentError) {
      console.error('Error fetching recent car count:', recentError)
    }
    
    // Get all cars with content to analyze price ranges
    const { data: allCars, error: carsError } = await supabase
      .from('articles_unified')
      .select('id, content')
      .eq('category', 'cars')
      .eq('source', '28car')
      .limit(1000) // Limit to avoid memory issues, can be increased if needed
    
    if (carsError) {
      console.error('Error fetching cars for price analysis:', carsError)
    }
    
    // Parse car specifications from content (using same logic as car feed)
    const parseCarSpecs = (content: string) => {
      const specs: Record<string, string> = {}
      if (!content) return specs
      
      // Split by ", " but first protect numbers with commas
      let tempContent = content
      
      // Find all instances of numbers with commas (prices, mileage, etc.)
      const numberWithCommasRegex = /(\d+,\d+)/g
      const numbersWithCommas = tempContent.match(numberWithCommasRegex) || []
      
      // Replace each number with commas with a placeholder
      numbersWithCommas.forEach((num, index) => {
        tempContent = tempContent.replace(num, `###NUMBER_${index}###`)
      })
      
      // Now split by comma
      const pairs = tempContent.split(',').map(pair => pair.trim())
      
      for (const pair of pairs) {
        const colonIndex = pair.indexOf(':')
        if (colonIndex === -1) continue
        
        const key = pair.substring(0, colonIndex).trim()
        let value = pair.substring(colonIndex + 1).trim()
        
        // Restore numbers with commas
        numbersWithCommas.forEach((num, index) => {
          value = value.replace(`###NUMBER_${index}###`, num)
        })
        
        if (key && value) {
          const lowerKey = key.toLowerCase()
          
          if (lowerKey === 'engine') specs.engine = value
          else if (lowerKey === 'transmission') specs.transmission = value
          else if (lowerKey === 'fuel') specs.fuel = value
          else if (lowerKey === 'mileage') specs.mileage = value
          else if (lowerKey === 'year') specs.year = value
          else if (lowerKey === 'make') specs.make = value
          else if (lowerKey === 'model') specs.model = value
          else if (lowerKey === 'price') specs.price = value
          else if (lowerKey === 'doors') specs.doors = value
          else if (lowerKey === 'color') specs.color = value
        }
      }
      
      return specs
    }
    
    // Analyze price ranges - 4 ranges with top at HK$500k+
    const priceRanges = { 
      under200k: 0,    // Under HK$200k
      range200to300k: 0, // HK$200k - HK$300k
      range300to500k: 0, // HK$300k - HK$500k
      over500k: 0      // HK$500k and above
    }
    
    if (allCars) {
      for (const car of allCars) {
        const specs = parseCarSpecs(car.content || '')
        let price = specs.price || ''
        
        if (price) {
          // Extract numeric value from price string (removing commas for parsing)
          // Handle both HK$ and HKD$ formats
          const cleanPrice = price.replace(/HKD?\$/, '').replace(/減價.*$/, '').trim()
          // Remove commas BEFORE parsing to handle prices like "1,200,000"
          const priceNum = parseInt(cleanPrice.replace(/,/g, ''), 10)
          
          if (priceNum > 0) {
            if (priceNum < 200000) priceRanges.under200k++
            else if (priceNum < 300000) priceRanges.range200to300k++
            else if (priceNum < 500000) priceRanges.range300to500k++
            else priceRanges.over500k++
          }
        }
      }
    }
    
    console.log('Price ranges calculated:', priceRanges)
    
    const stats = {
      total: totalCount || 0,
      recent24h: recentCount || 0,
      priceRanges
    }
    
    return NextResponse.json(stats)
    
  } catch (error) {
    console.error('Error fetching car statistics:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}