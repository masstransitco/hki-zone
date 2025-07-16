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
type Language = 'en' | 'zh-CN' | 'zh-TW'

const LOCATION_NAMES: { [key: string]: { [lang in Language]: string } } = {
  // Hong Kong Island
  'H1': { en: 'Central/Admiralty', 'zh-CN': '中环/金钟', 'zh-TW': '中環/金鐘' },
  'H2': { en: 'Wan Chai', 'zh-CN': '湾仔', 'zh-TW': '灣仔' },
  'H3': { en: 'Causeway Bay', 'zh-CN': '铜锣湾', 'zh-TW': '銅鑼灣' },
  'H4': { en: 'North Point', 'zh-CN': '北角', 'zh-TW': '北角' },
  'H5': { en: 'Quarry Bay', 'zh-CN': '鲗鱼涌', 'zh-TW': '鰂魚涌' },
  'H6': { en: 'Tai Koo', 'zh-CN': '太古', 'zh-TW': '太古' },
  'H7': { en: 'Shau Kei Wan', 'zh-CN': '筲箕湾', 'zh-TW': '筲箕灣' },
  'H8': { en: 'Chai Wan', 'zh-CN': '柴湾', 'zh-TW': '柴灣' },
  'H9': { en: 'Aberdeen', 'zh-CN': '香港仔', 'zh-TW': '香港仔' },
  'H11': { en: 'Kennedy Town', 'zh-CN': '坚尼地城', 'zh-TW': '堅尼地城' },
  
  // Kowloon
  'K01': { en: 'Tsim Sha Tsui', 'zh-CN': '尖沙咀', 'zh-TW': '尖沙咀' },
  'K02': { en: 'Jordan', 'zh-CN': '佐敦', 'zh-TW': '佐敦' },
  'K03': { en: 'Yau Ma Tei', 'zh-CN': '油麻地', 'zh-TW': '油麻地' },
  'K04': { en: 'Mong Kok', 'zh-CN': '旺角', 'zh-TW': '旺角' },
  'K05': { en: 'Sham Shui Po', 'zh-CN': '深水埗', 'zh-TW': '深水埗' },
  'K06': { en: 'Kowloon Tong', 'zh-CN': '九龙塘', 'zh-TW': '九龍塘' },
  'K07': { en: 'Wong Tai Sin', 'zh-CN': '黄大仙', 'zh-TW': '黃大仙' },
  
  // New Territories
  'N01': { en: 'Sha Tin', 'zh-CN': '沙田', 'zh-TW': '沙田' },
  'N02': { en: 'Tai Po', 'zh-CN': '大埔', 'zh-TW': '大埔' },
  'N03': { en: 'Fanling', 'zh-CN': '粉岭', 'zh-TW': '粉嶺' },
  'N05': { en: 'Tuen Mun', 'zh-CN': '屯门', 'zh-TW': '屯門' },
  'N06': { en: 'Yuen Long', 'zh-CN': '元朗', 'zh-TW': '元朗' },
  'N07': { en: 'Tsuen Wan', 'zh-CN': '荃湾', 'zh-TW': '荃灣' },
  'N08': { en: 'Kwai Chung', 'zh-CN': '葵涌', 'zh-TW': '葵涌' },
  'N09': { en: 'Tsing Yi', 'zh-CN': '青衣', 'zh-TW': '青衣' },
  'N10': { en: 'Ma On Shan', 'zh-CN': '马鞍山', 'zh-TW': '馬鞍山' },
  'N11': { en: 'Tseung Kwan O', 'zh-CN': '将军澳', 'zh-TW': '將軍澳' },
  'N12': { en: 'Sai Kung', 'zh-CN': '西贡', 'zh-TW': '西貢' },
  'N13': { en: 'Tai Wai', 'zh-CN': '大围', 'zh-TW': '大圍' },
  
  // Strategic Routes (Traffic monitoring points)
  'SJ1': { en: 'Strategic Junction 1', 'zh-CN': '策略交汇点1', 'zh-TW': '策略交匯點1' },
  'SJ2': { en: 'Strategic Junction 2', 'zh-CN': '策略交汇点2', 'zh-TW': '策略交匯點2' },
  'SJ3': { en: 'Strategic Junction 3', 'zh-CN': '策略交汇点3', 'zh-TW': '策略交匯點3' },
  'SJ4': { en: 'Strategic Junction 4', 'zh-CN': '策略交汇点4', 'zh-TW': '策略交匯點4' },
  'SJ5': { en: 'Strategic Junction 5', 'zh-CN': '策略交汇点5', 'zh-TW': '策略交匯點5' }
}

const DESTINATION_NAMES: { [key: string]: { [lang in Language]: string } } = {
  'CH': { en: 'Cross-Harbour Tunnel', 'zh-CN': '海底隧道', 'zh-TW': '海底隧道' },
  'EH': { en: 'Eastern Harbour Tunnel', 'zh-CN': '东区海底隧道', 'zh-TW': '東區海底隧道' },
  'WH': { en: 'Western Harbour Tunnel', 'zh-CN': '西区海底隧道', 'zh-TW': '西區海底隧道' },
  'TKTL': { en: 'Tseung Kwan O', 'zh-CN': '将军澳', 'zh-TW': '將軍澳' },
  'TMCLK': { en: 'Tuen Mun', 'zh-CN': '屯门', 'zh-TW': '屯門' },
  'TPR': { en: 'Tai Po', 'zh-CN': '大埔', 'zh-TW': '大埔' },
  'TKOT': { en: 'TKO Tunnel', 'zh-CN': '将军澳隧道', 'zh-TW': '將軍澳隧道' },
  'ATL': { en: 'Airport', 'zh-CN': '机场', 'zh-TW': '機場' },
  'MOS': { en: 'Ma On Shan', 'zh-CN': '马鞍山', 'zh-TW': '馬鞍山' },
  'ABT': { en: 'Aberdeen Tunnel', 'zh-CN': '香港仔隧道', 'zh-TW': '香港仔隧道' },
  'ACTT': { en: 'Airport Core Tunnel', 'zh-CN': '机场核心隧道', 'zh-TW': '機場核心隧道' },
  'ATSCA': { en: 'Airport to SCAR', 'zh-CN': '机场至石岗', 'zh-TW': '機場至石崗' },
  'CWBR': { en: 'Causeway Bay', 'zh-CN': '铜锣湾', 'zh-TW': '銅鑼灣' },
  'KTPR': { en: 'Kwai Tsing', 'zh-CN': '葵青', 'zh-TW': '葵青' },
  'LRT': { en: 'Lion Rock Tunnel', 'zh-CN': '狮子山隧道', 'zh-TW': '獅子山隧道' },
  'PFL': { en: 'Po Fulam', 'zh-CN': '薄扶林', 'zh-TW': '薄扶林' },
  'SMT': { en: 'Shing Mun Tunnel', 'zh-CN': '城门隧道', 'zh-TW': '城門隧道' },
  'SSCPR': { en: 'Sha Sha Chi', 'zh-CN': '沙沙池', 'zh-TW': '沙沙池' },
  'SSYLH': { en: 'Sha Sha Yuen Long', 'zh-CN': '沙沙元朗', 'zh-TW': '沙沙元朗' },
  'TCT': { en: 'Tai Lam Tunnel', 'zh-CN': '大榄隧道', 'zh-TW': '大欖隧道' },
  'TKOLTT': { en: 'TKO Lam Tin Tunnel', 'zh-CN': '将军澳蓝田隧道', 'zh-TW': '將軍澳藍田隧道' },
  'TKTM': { en: 'Tsing Kwan O Tunnel', 'zh-CN': '将军澳隧道', 'zh-TW': '將軍澳隧道' },
  'TLH': { en: 'Tai Lam', 'zh-CN': '大榄', 'zh-TW': '大欖' },
  'TSCA': { en: 'Tsing Sha Control Area', 'zh-CN': '青沙管制区', 'zh-TW': '青沙管制區' },
  'TWCP': { en: 'Tsuen Wan', 'zh-CN': '荃湾', 'zh-TW': '荃灣' },
  'TWTM': { en: 'Tsuen Wan to Tuen Mun', 'zh-CN': '荃湾至屯门', 'zh-TW': '荃灣至屯門' },
  'WNCG': { en: 'Wan Chai to Central', 'zh-CN': '湾仔至中环', 'zh-TW': '灣仔至中環' }
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
    const language = url.searchParams.get('language') as Language || 'en' // 'en', 'zh-CN', 'zh-TW'
    
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
          from: LOCATION_NAMES[specificRoute.locationId]?.[language] || specificRoute.locationId,
          to: DESTINATION_NAMES[specificRoute.destinationId]?.[language] || specificRoute.destinationId,
          timeMin: specificRoute.journeyData,
          trendMin,
          colourId: specificRoute.colourId,
          capture: specificRoute.captureDate,
          locale: language === 'en' ? 'en' : 'zh',
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
          from: LOCATION_NAMES[jt.locationId]?.[language] || jt.locationId,
          to: DESTINATION_NAMES[jt.destinationId]?.[language] || jt.destinationId,
          timeMin: jt.journeyData,
          trendMin,
          colourId: jt.colourId,
          capture: jt.captureDate,
          locale: language === 'en' ? 'en' : 'zh',
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