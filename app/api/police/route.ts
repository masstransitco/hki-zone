import { type NextRequest, NextResponse } from "next/server"
import fs from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'

interface PoliceStation {
  name: string
  address: string
  district: string
  services: string[]
  latitude: number | null
  longitude: number | null
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const district = searchParams.get("district")
    const service = searchParams.get("service")
    const search = searchParams.get("search")

    console.log("Police API called with params:", { district, service, search })

    // Read police station data from JSON file
    const filePath = path.join(process.cwd(), 'public', 'hk_police_with_coords.json')
    const fileContents = fs.readFileSync(filePath, 'utf8')
    const policeStations: PoliceStation[] = JSON.parse(fileContents)

    // Filter stations based on query parameters
    let filteredStations = policeStations

    if (district && district !== 'all') {
      filteredStations = filteredStations.filter(station => 
        station.district === district
      )
    }

    if (service && service !== 'all') {
      filteredStations = filteredStations.filter(station => 
        station.services.includes(service)
      )
    }

    if (search && search.trim() !== '') {
      const searchTerm = search.toLowerCase().trim()
      filteredStations = filteredStations.filter(station => 
        station.name.toLowerCase().includes(searchTerm) ||
        station.address.toLowerCase().includes(searchTerm) ||
        station.district.toLowerCase().includes(searchTerm)
      )
    }

    // Get unique districts for filter options
    const districts = [...new Set(policeStations.map(station => station.district))]
    
    // Get unique services for filter options
    const services = [...new Set(policeStations.flatMap(station => station.services))]

    // Transform stations to include additional metadata
    const transformedStations = filteredStations.map(station => ({
      ...station,
      id: station.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase(),
      hasCoordinates: station.latitude !== null && station.longitude !== null,
      primaryService: station.services[0] || 'Report Room',
      serviceCount: station.services.length
    }))

    return NextResponse.json({
      stations: transformedStations,
      total: transformedStations.length,
      metadata: {
        source: 'hk_police_with_coords',
        last_updated: new Date().toISOString(),
        districts_available: districts,
        services_available: services,
        total_stations: policeStations.length,
        stations_with_coordinates: policeStations.filter(s => s.latitude !== null && s.longitude !== null).length
      }
    })

  } catch (error) {
    console.error("Error in Police API:", error)
    return NextResponse.json({
      error: "Failed to fetch police station data",
      debug: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}