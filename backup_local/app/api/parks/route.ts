import { type NextRequest, NextResponse } from "next/server"
import fs from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'

interface ParkData {
  address: string
  latitude: number
  longitude: number
}

interface EnhancedPark {
  id: string
  name: string
  address: string
  district: string
  type: string
  latitude: number
  longitude: number
  hasCoordinates: boolean
}

function extractDistrictFromAddress(address: string): string {
  const districtMappings = {
    'Fanling': 'New Territories North',
    'Wan Chai': 'Hong Kong Island',
    'Tuen Mun': 'New Territories South',
    'Tsuen Wan': 'New Territories South',
    'Sha Tin': 'New Territories South',
    'Tai Po': 'New Territories North',
    'Yuen Long': 'New Territories North',
    'Kwun Tong': 'Kowloon East',
    'Kowloon': 'Kowloon East',
    'Tsing Yi': 'New Territories South',
    'Tseung Kwan O': 'New Territories South',
    'Sai Kung': 'New Territories South',
    'Central': 'Hong Kong Island',
    'Admiralty': 'Hong Kong Island',
    'Causeway Bay': 'Hong Kong Island',
    'North Point': 'Hong Kong Island',
    'Quarry Bay': 'Hong Kong Island',
    'Chai Wan': 'Hong Kong Island',
    'Shau Kei Wan': 'Hong Kong Island',
    'Aberdeen': 'Hong Kong Island',
    'Stanley': 'Hong Kong Island',
    'Repulse Bay': 'Hong Kong Island',
    'Mid-Levels': 'Hong Kong Island',
    'Pokfulam': 'Hong Kong Island',
    'Kennedy Town': 'Hong Kong Island',
    'Sheung Wan': 'Hong Kong Island',
    'Mong Kok': 'Kowloon West',
    'Tsim Sha Tsui': 'Kowloon West',
    'Yau Ma Tei': 'Kowloon West',
    'Sham Shui Po': 'Kowloon West',
    'Cheung Sha Wan': 'Kowloon West',
    'Lai Chi Kok': 'Kowloon West',
    'Kowloon Tong': 'Kowloon East',
    'Diamond Hill': 'Kowloon East',
    'Wong Tai Sin': 'Kowloon East',
    'Kowloon City': 'Kowloon East',
    'To Kwa Wan': 'Kowloon East',
    'Ma Tau Wai': 'Kowloon East',
    'Hung Hom': 'Kowloon East',
    'Whampoa': 'Kowloon East',
    'Ho Man Tin': 'Kowloon East',
    'Tung Chung': 'Islands',
    'Lantau': 'Islands',
    'Cheung Chau': 'Islands',
    'Lamma': 'Islands',
    'Peng Chau': 'Islands',
    'Ma Wan': 'Islands'
  }

  for (const [area, district] of Object.entries(districtMappings)) {
    if (address.includes(area)) {
      return district
    }
  }

  return 'Other'
}

function generateParkName(address: string): string {
  // Extract meaningful parts from address to create park name
  const parts = address.split(',')[0].trim()
  
  // If it contains "Park", use it as is
  if (parts.toLowerCase().includes('park')) {
    return parts
  }
  
  // If it contains "Road", "Street", "Lane", etc., create a name
  const roadKeywords = ['Road', 'Street', 'Lane', 'Avenue', 'Drive', 'Path', 'Way', 'Close', 'Court', 'Gardens', 'Terrace']
  for (const keyword of roadKeywords) {
    if (parts.includes(keyword)) {
      return `${parts} Park`
    }
  }
  
  // If it contains area names, use them
  const areaNames = ['Fanling', 'Wan Chai', 'Tuen Mun', 'Tsuen Wan', 'Sha Tin', 'Tai Po', 'Yuen Long', 'Central', 'Admiralty', 'Causeway Bay', 'Mong Kok', 'Tsim Sha Tsui']
  for (const area of areaNames) {
    if (address.includes(area)) {
      return `${area} Park`
    }
  }
  
  // Default naming
  return `${parts} Park`
}

function determineParkType(address: string): string {
  if (address.toLowerCase().includes('beach')) return 'Beach Park'
  if (address.toLowerCase().includes('country')) return 'Country Park'
  if (address.toLowerCase().includes('garden')) return 'Garden'
  if (address.toLowerCase().includes('recreation')) return 'Recreation Ground'
  if (address.toLowerCase().includes('playground')) return 'Playground'
  if (address.toLowerCase().includes('sports')) return 'Sports Ground'
  if (address.toLowerCase().includes('swimming')) return 'Swimming Pool'
  if (address.toLowerCase().includes('pier')) return 'Waterfront Park'
  if (address.toLowerCase().includes('promenade')) return 'Waterfront Park'
  return 'Public Park'
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const district = searchParams.get("district")
    const type = searchParams.get("type")
    const search = searchParams.get("search")

    console.log("Parks API called with params:", { district, type, search })

    // Read parks data from JSON file
    const filePath = path.join(process.cwd(), 'public', 'parks_hk.json')
    const fileContents = fs.readFileSync(filePath, 'utf8')
    const parksData: ParkData[] = JSON.parse(fileContents)

    // Transform and enhance parks data
    const enhancedParks: EnhancedPark[] = parksData.map((park, index) => {
      const name = generateParkName(park.address)
      const district = extractDistrictFromAddress(park.address)
      const type = determineParkType(park.address)
      
      return {
        id: `park_${index}`,
        name,
        address: park.address,
        district,
        type,
        latitude: park.latitude,
        longitude: park.longitude,
        hasCoordinates: park.latitude !== null && park.longitude !== null
      }
    })

    // Filter parks based on query parameters
    let filteredParks = enhancedParks

    if (district && district !== 'all') {
      filteredParks = filteredParks.filter(park => 
        park.district === district
      )
    }

    if (type && type !== 'all') {
      filteredParks = filteredParks.filter(park => 
        park.type === type
      )
    }

    if (search && search.trim() !== '') {
      const searchTerm = search.toLowerCase().trim()
      filteredParks = filteredParks.filter(park => 
        park.name.toLowerCase().includes(searchTerm) ||
        park.address.toLowerCase().includes(searchTerm) ||
        park.district.toLowerCase().includes(searchTerm)
      )
    }

    // Get unique districts and types for filter options
    const districts = [...new Set(enhancedParks.map(park => park.district))]
    const types = [...new Set(enhancedParks.map(park => park.type))]

    return NextResponse.json({
      parks: filteredParks,
      total: filteredParks.length,
      metadata: {
        source: 'parks_hk',
        last_updated: new Date().toISOString(),
        districts_available: districts,
        types_available: types,
        total_parks: enhancedParks.length,
        parks_with_coordinates: enhancedParks.filter(p => p.hasCoordinates).length
      }
    })

  } catch (error) {
    console.error("Error in Parks API:", error)
    return NextResponse.json({
      error: "Failed to fetch parks data",
      debug: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}