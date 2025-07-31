import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  try {
    console.log('Fetching hospital information...')
    
    // Try to get hospital information from the database
    const { data: hospitals, error } = await supabase
      .from('hospital_info')
      .select('*')
      .order('hospital_name_en')
    
    if (error) {
      console.error('Error fetching hospitals:', error)
      
      // If hospital_info table doesn't exist, return fallback data
      const fallbackHospitals = [
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
          hospital_code: 'HKBH',
          hospital_name_en: 'Hong Kong Baptist Hospital',
          hospital_name_zh: '香港浸信會醫院',
          address_en: '222 Waterloo Road, Kowloon Tong, Kowloon',
          phone_main: '2339 8888',
          phone_ae: '2339 8888',
          latitude: 22.3358,
          longitude: 114.1833,
          cluster: 'Kowloon East',
          type: 'Private',
          website: 'https://www.hkbh.org.hk/'
        },
        {
          hospital_code: 'HKSH',
          hospital_name_en: 'Hong Kong Sanatorium & Hospital',
          hospital_name_zh: '香港養和醫院',
          address_en: '2 Village Road, Happy Valley, Hong Kong',
          phone_main: '2572 0211',
          phone_ae: '2572 0211',
          latitude: 22.2708,
          longitude: 114.1833,
          cluster: 'Hong Kong East',
          type: 'Private',
          website: 'https://www.hksh.com/'
        },
        {
          hospital_code: 'SJSH',
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
          hospital_code: 'OLMH',
          hospital_name_en: 'Our Lady of Maryknoll Hospital',
          hospital_name_zh: '聖母醫院',
          address_en: '118 Shatin Pass Road, Wong Tai Sin, Kowloon',
          phone_main: '2354 2111',
          phone_ae: '2354 2111',
          latitude: 22.3408,
          longitude: 114.1795,
          cluster: 'Kowloon East',
          type: 'Private',
          website: 'https://www.olmh.org.hk/'
        }
      ]
      
      return NextResponse.json({
        hospitals: fallbackHospitals,
        total: fallbackHospitals.length,
        usingFallback: true
      })
    }
    
    console.log(`Successfully fetched ${hospitals.length} hospitals`)
    
    return NextResponse.json({
      hospitals: hospitals,
      total: hospitals.length,
      usingFallback: false
    })
    
  } catch (error) {
    console.error('Error in hospitals API:', error)
    
    return NextResponse.json(
      { error: 'Failed to fetch hospitals' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const { hospital_code, hospital_name_en, hospital_name_zh, address_en, phone_main, phone_ae, latitude, longitude, cluster, type, website } = await request.json()
    
    const { data, error } = await supabase
      .from('hospital_info')
      .upsert({
        hospital_code,
        hospital_name_en,
        hospital_name_zh,
        address_en,
        phone_main,
        phone_ae,
        latitude,
        longitude,
        cluster,
        type,
        website,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'hospital_code'
      })
      .select()
    
    if (error) {
      console.error('Error creating/updating hospital:', error)
      return NextResponse.json(
        { error: 'Failed to create/update hospital' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({
      success: true,
      hospital: data[0]
    })
    
  } catch (error) {
    console.error('Error in POST hospitals API:', error)
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    )
  }
}