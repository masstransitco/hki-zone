import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY
    const GOOGLE_CSE_ID = process.env.GOOGLE_CSE_ID
    
    console.log('🧪 Testing Google Custom Search API...')
    console.log('API Key:', GOOGLE_API_KEY ? `${GOOGLE_API_KEY.substring(0, 10)}...` : 'MISSING')
    console.log('CSE ID:', GOOGLE_CSE_ID || 'MISSING')
    
    if (!GOOGLE_API_KEY || !GOOGLE_CSE_ID) {
      return NextResponse.json({
        error: 'Missing Google API credentials',
        GOOGLE_API_KEY: GOOGLE_API_KEY ? 'PRESENT' : 'MISSING',
        GOOGLE_CSE_ID: GOOGLE_CSE_ID ? 'PRESENT' : 'MISSING'
      }, { status: 400 })
    }
    
    const query = 'Hong Kong politics news'
    const searchUrl = new URL('https://customsearch.googleapis.com/customsearch/v1')
    searchUrl.searchParams.set('cx', GOOGLE_CSE_ID)
    searchUrl.searchParams.set('key', GOOGLE_API_KEY)
    searchUrl.searchParams.set('searchType', 'image')
    searchUrl.searchParams.set('q', query)
    searchUrl.searchParams.set('rights', 'cc_publicdomain,cc_attribute,cc_sharealike')
    searchUrl.searchParams.set('num', '3')
    searchUrl.searchParams.set('safe', 'active')
    searchUrl.searchParams.set('imgSize', 'medium')
    
    console.log('🔍 Search URL:', searchUrl.toString().replace(GOOGLE_API_KEY, 'API_KEY'))
    
    const response = await fetch(searchUrl.toString())
    console.log('📡 Response status:', response.status)
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ API Error:', errorText)
      return NextResponse.json({
        error: 'Google API request failed',
        status: response.status,
        details: errorText
      }, { status: response.status })
    }
    
    const data = await response.json()
    console.log('📊 Response data keys:', Object.keys(data))
    console.log('📊 Items found:', data.items?.length || 0)
    
    return NextResponse.json({
      success: true,
      query,
      itemsFound: data.items?.length || 0,
      items: data.items?.slice(0, 3).map(item => ({
        url: item.link,
        title: item.title,
        snippet: item.snippet
      })) || [],
      searchInfo: data.searchInformation
    })
    
  } catch (error) {
    console.error('💥 Test failed:', error)
    return NextResponse.json({
      error: 'Test failed',
      message: error.message
    }, { status: 500 })
  }
}