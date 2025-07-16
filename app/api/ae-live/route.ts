import { type NextRequest, NextResponse } from "next/server"

export const dynamic = 'force-dynamic'

interface HospitalWaitingTime {
  hospCode: string
  hospNameEn: string
  hospNameB5: string
  hospNameGb: string
  topWait: string
  hospTimeEn: string
  hospCoord: string
}

interface HAResponse {
  success: string
  result: {
    hospData: HospitalWaitingTime[]
    timeEn: string
  }
}

// Hospital directory with complete information
const HOSPITAL_DIRECTORY = [
  {
    hospital_code: 'AHNH',
    hospital_name_en: 'Alice Ho Miu Ling Nethersole Hospital',
    hospital_name_zh: '雅麗氏何妙齡那打素醫院',
    address_en: '11 Chuen On Road, Tai Po, New Territories',
    phone_main: '2689 2000',
    phone_ae: '2689 2000',
    latitude: 22.4708,
    longitude: 114.1291,
    cluster: 'New Territories East',
    type: 'Public',
    website: 'https://www3.ha.org.hk/ahnh/'
  },
  {
    hospital_code: 'CGH',
    hospital_name_en: 'Caritas Medical Centre',
    hospital_name_zh: '明愛醫院',
    address_en: '111 Wing Hong Street, Sham Shui Po, Kowloon',
    phone_main: '3408 7911',
    phone_ae: '3408 7911',
    latitude: 22.3386,
    longitude: 114.1586,
    cluster: 'Kowloon West',
    type: 'Public',
    website: 'https://www3.ha.org.hk/cmc/'
  },
  {
    hospital_code: 'KWH',
    hospital_name_en: 'Kwong Wah Hospital',
    hospital_name_zh: '廣華醫院',
    address_en: '25 Waterloo Road, Yau Ma Tei, Kowloon',
    phone_main: '2332 2311',
    phone_ae: '2332 2311',
    latitude: 22.3118,
    longitude: 114.1698,
    cluster: 'Kowloon Central',
    type: 'Public',
    website: 'https://www3.ha.org.hk/kwh/'
  },
  {
    hospital_code: 'PMH',
    hospital_name_en: 'Princess Margaret Hospital',
    hospital_name_zh: '瑪嘉烈醫院',
    address_en: '2-10 Princess Margaret Hospital Road, Lai Chi Kok, Kowloon',
    phone_main: '2990 1111',
    phone_ae: '2990 1111',
    latitude: 22.3383,
    longitude: 114.1495,
    cluster: 'Kowloon West',
    type: 'Public',
    website: 'https://www3.ha.org.hk/pmh/'
  },
  {
    hospital_code: 'QEH',
    hospital_name_en: 'Queen Elizabeth Hospital',
    hospital_name_zh: '伊利沙伯醫院',
    address_en: '30 Gascoigne Road, Yau Ma Tei, Kowloon',
    phone_main: '2958 8888',
    phone_ae: '2958 8888',
    latitude: 22.3093,
    longitude: 114.1751,
    cluster: 'Kowloon Central',
    type: 'Public',
    website: 'https://www3.ha.org.hk/qeh/'
  },
  {
    hospital_code: 'QMH',
    hospital_name_en: 'Queen Mary Hospital',
    hospital_name_zh: '瑪麗醫院',
    address_en: '102 Pokfulam Road, Pokfulam, Hong Kong',
    phone_main: '2255 3838',
    phone_ae: '2255 3838',
    latitude: 22.3193,
    longitude: 114.1294,
    cluster: 'Hong Kong West',
    type: 'Public',
    website: 'https://www3.ha.org.hk/qmh/'
  },
  {
    hospital_code: 'RHTSK',
    hospital_name_en: 'Ruttonjee Hospital',
    hospital_name_zh: '律敦治醫院',
    address_en: '266 Queen\'s Road East, Wan Chai, Hong Kong',
    phone_main: '2291 1345',
    phone_ae: '2291 1345',
    latitude: 22.2708,
    longitude: 114.1733,
    cluster: 'Hong Kong East',
    type: 'Public',
    website: 'https://www3.ha.org.hk/rhtsk/'
  },
  {
    hospital_code: 'TMH',
    hospital_name_en: 'Tuen Mun Hospital',
    hospital_name_zh: '屯門醫院',
    address_en: '23 Tsing Chung Koon Road, Tuen Mun, New Territories',
    phone_main: '2468 5111',
    phone_ae: '2468 5111',
    latitude: 22.4144,
    longitude: 114.1297,
    cluster: 'New Territories West',
    type: 'Public',
    website: 'https://www3.ha.org.hk/tmh/'
  },
  {
    hospital_code: 'UCH',
    hospital_name_en: 'United Christian Hospital',
    hospital_name_zh: '基督教聯合醫院',
    address_en: '130 Hip Wo Street, Kwun Tong, Kowloon',
    phone_main: '3513 3513',
    phone_ae: '3513 3513',
    latitude: 22.3083,
    longitude: 114.2250,
    cluster: 'Kowloon East',
    type: 'Public',
    website: 'https://www3.ha.org.hk/uch/'
  },
  {
    hospital_code: 'WWH',
    hospital_name_en: 'Yan Chai Hospital',
    hospital_name_zh: '仁濟醫院',
    address_en: '7-11 Yan Chai Street, Tsuen Wan, New Territories',
    phone_main: '2417 8383',
    phone_ae: '2417 8383',
    latitude: 22.4083,
    longitude: 114.1087,
    cluster: 'New Territories West',
    type: 'Public',
    website: 'https://www3.ha.org.hk/ych/'
  },
  {
    hospital_code: 'PYNEH',
    hospital_name_en: 'Pamela Youde Nethersole Eastern Hospital',
    hospital_name_zh: '東區尤德夫人那打素醫院',
    address_en: '3 Lok Man Road, Chai Wan, Hong Kong',
    phone_main: '2595 6111',
    phone_ae: '2595 6111',
    latitude: 22.2566,
    longitude: 114.2386,
    cluster: 'Hong Kong East',
    type: 'Public',
    website: 'https://www3.ha.org.hk/pyneh/'
  },
  {
    hospital_code: 'TKOH',
    hospital_name_en: 'Tseung Kwan O Hospital',
    hospital_name_zh: '將軍澳醫院',
    address_en: '2 Po Ning Lane, Hang Hau, Tseung Kwan O, New Territories',
    phone_main: '2208 0111',
    phone_ae: '2208 0111',
    latitude: 22.2944,
    longitude: 114.2897,
    cluster: 'Kowloon East',
    type: 'Public',
    website: 'https://www3.ha.org.hk/tkoh/'
  },
  {
    hospital_code: 'NLTH',
    hospital_name_en: 'North Lantau Hospital',
    hospital_name_zh: '北大嶼山醫院',
    address_en: '8 Chung Yan Road, Tung Chung, Lantau Island',
    phone_main: '2990 7000',
    phone_ae: '2990 7000',
    latitude: 22.2808,
    longitude: 114.1391,
    cluster: 'New Territories West',
    type: 'Public',
    website: 'https://www3.ha.org.hk/nlth/'
  },
  {
    hospital_code: 'HKEH',
    hospital_name_en: 'Hong Kong Eye Hospital',
    hospital_name_zh: '香港眼科醫院',
    address_en: '147K Argyle Street, Mongkok, Kowloon',
    phone_main: '2762 3000',
    phone_ae: '2762 3000',
    latitude: 22.3166,
    longitude: 114.1686,
    cluster: 'Kowloon Central',
    type: 'Public',
    website: 'https://www3.ha.org.hk/hkeh/'
  },
  {
    hospital_code: 'NDH',
    hospital_name_en: 'North District Hospital',
    hospital_name_zh: '北區醫院',
    address_en: '9 Po Kin Road, Sheung Shui, New Territories',
    phone_main: '2683 8888',
    phone_ae: '2683 8888',
    latitude: 22.4970,
    longitude: 114.1240,
    cluster: 'New Territories East',
    type: 'Public',
    website: 'https://www3.ha.org.hk/ndh/'
  },
  {
    hospital_code: 'PWH',
    hospital_name_en: 'Prince of Wales Hospital',
    hospital_name_zh: '威爾斯親王醫院',
    address_en: '30-32 Ngan Shing Street, Sha Tin, New Territories',
    phone_main: '2632 2211',
    phone_ae: '2632 2211',
    latitude: 22.3805,
    longitude: 114.2020,
    cluster: 'New Territories East',
    type: 'Public',
    website: 'https://www3.ha.org.hk/pwh/'
  },
  {
    hospital_code: 'SJH',
    hospital_name_en: 'St. John Hospital',
    hospital_name_zh: '聖約翰醫院',
    address_en: '2 MacDonnell Road, Mid-Levels, Hong Kong',
    phone_main: '2527 8285',
    phone_ae: '2527 8285',
    latitude: 22.2793,
    longitude: 114.1594,
    cluster: 'Hong Kong West',
    type: 'Private',
    website: 'https://www.sjh.org.hk/'
  },
  {
    hospital_code: 'TSH',
    hospital_name_en: 'Tin Shui Wai Hospital',
    hospital_name_zh: '天水圍醫院',
    address_en: '11 Tin Tan Street, Tin Shui Wai, New Territories',
    phone_main: '2689 1000',
    phone_ae: '2689 1000',
    latitude: 22.4590,
    longitude: 113.9958,
    cluster: 'New Territories West',
    type: 'Public',
    website: 'https://www3.ha.org.hk/tsh/'
  },
  {
    hospital_code: 'POH',
    hospital_name_en: 'Pok Oi Hospital',
    hospital_name_zh: '博愛醫院',
    address_en: '132 San Hing Street, Yuen Long, New Territories',
    phone_main: '2486 8111',
    phone_ae: '2486 8111',
    latitude: 22.4451,
    longitude: 114.0417,
    cluster: 'New Territories West',
    type: 'Public',
    website: 'https://www3.ha.org.hk/poh/'
  }
]

export async function GET(request: NextRequest) {
  try {
    console.log('Fetching A&E waiting times from Hospital Authority...')
    
    // Fetch from Hospital Authority API
    const response = await fetch('https://www.ha.org.hk/aedwt/data/aedWtData.json', {
      headers: {
        'User-Agent': 'hki.zone/ae-fetcher 1.0'
      },
      next: { revalidate: 120 } // Cache for 2 minutes
    })

    if (!response.ok) {
      throw new Error(`HA API returned ${response.status}: ${response.statusText}`)
    }

    const haData: HAResponse = await response.json()
    
    // Debug: Log the hospital names from HA API
    console.log('HA API Hospital Names:', haData.result?.hospData?.map(wt => wt.hospNameEn))
    

    // Create mapping between HA API codes and our hospital codes
    const hospitalCodeMapping: { [key: string]: string } = {
      'AHN': 'AHNH',
      'CMC': 'CGH', 
      'KWH': 'KWH',
      'PMH': 'PMH',
      'QEH': 'QEH',
      'QMH': 'QMH',
      'RH': 'RHTSK',
      'TMH': 'TMH',
      'UCH': 'UCH',
      'YCH': 'WWH',
      'PYN': 'PYNEH',
      'TKO': 'TKOH',
      'NLT': 'NLTH',
      'NDH': 'NDH',
      'PWH': 'PWH',
      'SJH': 'SJH',
      'TSH': 'TSH',
      'POH': 'POH' // Pok Oi Hospital
    }

    // Match HA data with hospital directory
    const enrichedData = HOSPITAL_DIRECTORY.map(hospital => {
      // Find matching waiting time data by hospital code
      const waitingData = haData.result?.hospData?.find(wt => {
        // Try exact hospital code mapping first
        return hospitalCodeMapping[wt.hospCode] === hospital.hospital_code
      })

      // Debug: Log matching results
      if (waitingData) {
        console.log(`Matched: ${hospital.hospital_name_en} <-> ${waitingData.hospNameEn}`)
      } else {
        console.log(`No match found for: ${hospital.hospital_name_en}`)
      }

      return {
        hospital: {
          hospital_code: hospital.hospital_code,
          hospital_name_en: hospital.hospital_name_en,
          hospital_name_zh: hospital.hospital_name_zh,
          address_en: hospital.address_en,
          phone_main: hospital.phone_main,
          phone_ae: hospital.phone_ae,
          latitude: hospital.latitude,
          longitude: hospital.longitude,
          cluster: hospital.cluster,
          type: hospital.type,
          website: hospital.website
        },
        waitingData: waitingData ? {
          id: `ae_live_${hospital.hospital_code}`,
          title: `A&E Waiting Time: ${hospital.hospital_name_en}`,
          body: `Current waiting time: ${waitingData.topWait}. Last updated: ${waitingData.hospTimeEn}`,
          relevance_score: 80,
          source_updated_at: new Date().toISOString(),
          current_wait_time: waitingData.topWait,
          last_updated_time: waitingData.hospTimeEn,
          ha_hospital_code: waitingData.hospCode
        } : null
      }
    })

    return NextResponse.json({
      hospitals: enrichedData,
      total: enrichedData.length,
      last_updated: haData.result?.timeEn || new Date().toISOString(),
      metadata: {
        source: 'hospital_authority',
        api_endpoint: 'https://www.ha.org.hk/aedwt/data/aedWtData.json',
        cache_duration: '2 minutes'
      }
    })

  } catch (error) {
    console.error('Error fetching A&E data:', error)
    
    // Return hospital directory without waiting times as fallback
    const fallbackData = HOSPITAL_DIRECTORY.map(hospital => ({
      hospital,
      waitingData: null
    }))

    return NextResponse.json({
      hospitals: fallbackData,
      total: fallbackData.length,
      last_updated: new Date().toISOString(),
      error: 'Could not fetch real-time waiting times',
      metadata: {
        source: 'hospital_directory_fallback',
        cache_duration: 'none'
      }
    }, { status: 500 })
  }
}