import { type NextRequest, NextResponse } from "next/server"

export const dynamic = 'force-dynamic'

interface JourneyTimeData {
  locationId: string
  destinationId: string
  captureDate: string
  journeyType: number
  journeyData: number
  colourId: 1 | 2 | 3
  journeyDesc: string
}

type RouteType = 'expressway' | 'trunk' | 'local' | 'temp'
type Region = 'hk' | 'kln' | 'nt'

interface JourneyTimeCardProps {
  from: string
  to: string
  timeMin: number
  trendMin: number
  colourId: 1 | 2 | 3
  capture: string
  locale?: 'en' | 'zh'
  routeType: RouteType
}

// Location and destination mappings for user-friendly names
const LOCATION_NAMES: { [key: string]: string } = {
  // Hong Kong Island
  'H1': 'Central/Admiralty',
  'H2': 'Wan Chai',
  'H3': 'Causeway Bay',
  'H4': 'North Point',
  'H5': 'Quarry Bay',
  'H6': 'Tai Koo',
  'H7': 'Shau Kei Wan',
  'H8': 'Chai Wan',
  'H9': 'Aberdeen',
  'H11': 'Kennedy Town',
  
  // Kowloon
  'K01': 'Tsim Sha Tsui',
  'K02': 'Jordan',
  'K03': 'Yau Ma Tei',
  'K04': 'Mong Kok',
  'K05': 'Sham Shui Po',
  'K06': 'Kowloon Tong',
  'K07': 'Wong Tai Sin',
  
  // New Territories
  'N01': 'Sha Tin',
  'N02': 'Tai Po',
  'N03': 'Fanling',
  'N05': 'Tuen Mun',
  'N06': 'Yuen Long',
  'N07': 'Tsuen Wan',
  'N08': 'Kwai Chung',
  'N09': 'Tsing Yi',
  'N10': 'Ma On Shan',
  'N11': 'Tseung Kwan O',
  'N12': 'Sai Kung',
  'N13': 'Tai Wai',
  
  // Strategic Routes (Traffic monitoring points)
  'SJ1': 'Strategic Junction 1',
  'SJ2': 'Strategic Junction 2', 
  'SJ3': 'Strategic Junction 3',
  'SJ4': 'Strategic Junction 4',
  'SJ5': 'Strategic Junction 5'
}

const DESTINATION_NAMES: { [key: string]: string } = {
  'CH': 'Cross-Harbour Tunnel',
  'EH': 'Eastern Harbour Tunnel', 
  'WH': 'Western Harbour Tunnel',
  'TKTL': 'Tseung Kwan O',
  'TMCLK': 'Tuen Mun',
  'TPR': 'Tai Po',
  'TKOT': 'TKO Tunnel',
  'ATL': 'Airport',
  'MOS': 'Ma On Shan',
  'ABT': 'Aberdeen Tunnel',
  'ACTT': 'Airport Core Tunnel',
  'ATSCA': 'Airport to SCAR',
  'CWBR': 'Causeway Bay',
  'KTPR': 'Kwai Tsing',
  'LRT': 'Lion Rock Tunnel',
  'PFL': 'Po Fulam',
  'SMT': 'Shing Mun Tunnel',
  'SSCPR': 'Sha Sha Chi',
  'SSYLH': 'Sha Sha Yuen Long',
  'TCT': 'Tai Lam Tunnel',
  'TKOLTT': 'TKO Lam Tin Tunnel',
  'TKTM': 'Tsing Kwan O Tunnel',
  'TLH': 'Tai Lam',
  'TSCA': 'Tsing Sha Control Area',
  'TWCP': 'Tsuen Wan',
  'TWTM': 'Tsuen Wan to Tuen Mun',
  'WNCG': 'Wan Chai to Central'
}

// Region-based filtering system

function regionForLocation(locationId: string): Region {
  if (locationId.startsWith('H')) return 'hk'
  if (locationId.startsWith('K')) return 'kln'
  // N / SJ default to NT
  return 'nt'
}

const DEST_REGION_BASE: Record<string, Region | 'tunnel'> = {
  CH: 'tunnel', EH: 'tunnel', WH: 'tunnel',
  ABT: 'hk', WNCG: 'hk', PFL: 'hk',
  ACTT: 'nt', TMCLK: 'nt', ATL: 'nt', ATSCA: 'nt',
  SMT: 'nt', SSCPR: 'nt', SSYLH: 'nt', TKTL: 'nt', TKTM: 'nt',
  TLH: 'nt', TPR: 'nt', TWCP: 'nt', TWTM: 'nt',
  KTPR: 'kln', TSCA: 'kln', TCT: 'kln', LRT: 'kln',
  CWBR: 'kln', MOS: 'kln', TKOLTT: 'kln', TKOT: 'kln',
}

function regionForDestination(destId: string, startRegion: Region): Region {
  const base = DEST_REGION_BASE[destId]
  if (base === 'tunnel') {
    return startRegion === 'hk' ? 'kln' : 'hk'
  }
  return base ?? 'nt'
}

// Route type classification based on HK road signage system
const getRouteType = (destinationId: string): RouteType => {
  // Expressways (Green - motorway signs)
  const expressways = ['CH', 'EH', 'WH', 'TSCA', 'ATL', 'TMCLK'] // Cross-harbour tunnels, Tsing Sha, Airport, major expressway destinations
  
  // Major trunk roads (Blue - trunk road signs)  
  const trunkRoads = ['TKOLTT', 'TKOT', 'ABT', 'LRT', 'TCT', 'SMT', 'TKTM', 'ACTT', 'TPR', 'TKTL', 'MOS', 'KTPR']
  
  // Local/minor roads (Grey - local road signs)
  const localRoads = ['WNCG', 'PFL', 'CWBR', 'TLH', 'TWCP', 'TWTM', 'SSCPR', 'SSYLH', 'ATSCA']
  
  if (expressways.includes(destinationId)) return 'expressway'
  if (trunkRoads.includes(destinationId)) return 'trunk'
  if (localRoads.includes(destinationId)) return 'local'
  
  // Default to trunk for unknown routes
  return 'trunk'
}

// Simple trend calculation based on historical average (mock for now)
const calculateTrend = (currentTime: number, locationId: string, destinationId: string): number => {
  // Mock baseline times - in production, this would come from historical data
  const baselines: { [key: string]: number } = {
    'H1-CH': 8,
    'H1-EH': 12,
    'H1-WH': 10,
    'H2-CH': 6,
    'H2-EH': 15,
    'H2-WH': 12,
    'K01-CH': 5,
    'N01-CH': 25,
    'N05-CH': 35
  }
  
  const key = `${locationId}-${destinationId}`
  const baseline = baselines[key] || currentTime
  return currentTime - baseline
}

async function fetchJourneyTimeData(): Promise<JourneyTimeData[]> {
  try {
    const response = await fetch('https://resource.data.one.gov.hk/td/jss/Journeytimev2.xml', {
      headers: {
        'User-Agent': 'hki.zone/journey-time-fetcher 1.0'
      },
      next: { revalidate: 120 } // Cache for 2 minutes
    })

    if (!response.ok) {
      throw new Error(`Journey Time API returned ${response.status}: ${response.statusText}`)
    }

    const xmlText = await response.text()
    
    // Parse XML manually (simple approach for this specific format)
    const journeyTimes: JourneyTimeData[] = []
    const journeyTimeRegex = /<jtis_journey_time>(.*?)<\/jtis_journey_time>/gs
    let match

    while ((match = journeyTimeRegex.exec(xmlText)) !== null) {
      const content = match[1]
      
      const locationId = content.match(/<LOCATION_ID>(.*?)<\/LOCATION_ID>/)?.[1] || ''
      const destinationId = content.match(/<DESTINATION_ID>(.*?)<\/DESTINATION_ID>/)?.[1] || ''
      const captureDate = content.match(/<CAPTURE_DATE>(.*?)<\/CAPTURE_DATE>/)?.[1] || ''
      const journeyType = parseInt(content.match(/<JOURNEY_TYPE>(.*?)<\/JOURNEY_TYPE>/)?.[1] || '1')
      const journeyData = parseInt(content.match(/<JOURNEY_DATA>(.*?)<\/JOURNEY_DATA>/)?.[1] || '0')
      const colourId = parseInt(content.match(/<COLOUR_ID>(.*?)<\/COLOUR_ID>/)?.[1] || '3') as 1 | 2 | 3
      const journeyDesc = content.match(/<JOURNEY_DESC>(.*?)<\/JOURNEY_DESC>/)?.[1] || ''

      if (locationId && destinationId && journeyData > 0) {
        journeyTimes.push({
          locationId,
          destinationId, 
          captureDate,
          journeyType,
          journeyData,
          colourId,
          journeyDesc
        })
      }
    }

    return journeyTimes
  } catch (error) {
    console.error('Error fetching journey time data:', error)
    throw error
  }
}

export async function GET(request: NextRequest) {
  try {
    console.log('Fetching journey time data from Transport Department...')
    
    const url = new URL(request.url)
    const route = url.searchParams.get('route')
    const limit = parseInt(url.searchParams.get('limit') || '20')
    const startRegion = url.searchParams.get('start') as Region | null // 'hk', 'kln', 'nt'
    const destRegion = url.searchParams.get('dest') as Region | null // 'hk', 'kln', 'nt'
    
    const journeyTimeData = await fetchJourneyTimeData()
    
    // Apply region-based filtering
    let filteredData = journeyTimeData.filter(jt => {
      const sReg = regionForLocation(jt.locationId)
      const dReg = regionForDestination(jt.destinationId, sReg)
      
      if (startRegion && sReg !== startRegion) return false
      if (destRegion && dReg !== destRegion) return false
      
      return true
    })
    
    // If specific route requested
    if (route) {
      const [fromId, toId] = route.split('-')
      const specificRoute = filteredData.find(jt => 
        jt.locationId === fromId && jt.destinationId === toId
      )
      
      if (specificRoute) {
        const trendMin = calculateTrend(specificRoute.journeyData, specificRoute.locationId, specificRoute.destinationId)
        
        const cardData: JourneyTimeCardProps = {
          from: LOCATION_NAMES[specificRoute.locationId] || specificRoute.locationId,
          to: DESTINATION_NAMES[specificRoute.destinationId] || specificRoute.destinationId,
          timeMin: specificRoute.journeyData,
          trendMin,
          colourId: specificRoute.colourId,
          capture: specificRoute.captureDate,
          locale: 'en',
          routeType: getRouteType(specificRoute.destinationId)
        }
        
        return NextResponse.json(cardData)
      } else {
        return NextResponse.json({ error: 'Route not found' }, { status: 404 })
      }
    }
    
    // Transform data for card components
    const cardData: JourneyTimeCardProps[] = filteredData
      .slice(0, limit)
      .map(jt => {
        const trendMin = calculateTrend(jt.journeyData, jt.locationId, jt.destinationId)
        
        return {
          from: LOCATION_NAMES[jt.locationId] || jt.locationId,
          to: DESTINATION_NAMES[jt.destinationId] || jt.destinationId,
          timeMin: jt.journeyData,
          trendMin,
          colourId: jt.colourId,
          capture: jt.captureDate,
          locale: 'en',
          routeType: getRouteType(jt.destinationId)
        }
      })
    
    return NextResponse.json({
      journeyTimes: cardData,
      total: filteredData.length,
      lastUpdated: journeyTimeData[0]?.captureDate || new Date().toISOString(),
      metadata: {
        source: 'transport_department',
        api_endpoint: 'https://resource.data.one.gov.hk/td/jss/Journeytimev2.xml',
        cache_duration: '2 minutes',
        start_region: startRegion || 'all',
        dest_region: destRegion || 'all'
      }
    })

  } catch (error) {
    console.error('Error in journey time API:', error)
    
    return NextResponse.json({
      journeyTimes: [],
      total: 0,
      lastUpdated: new Date().toISOString(),
      error: 'Could not fetch journey time data',
      metadata: {
        source: 'fallback',
        cache_duration: 'none'
      }
    }, { status: 500 })
  }
}