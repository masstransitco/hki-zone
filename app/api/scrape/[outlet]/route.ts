import { NextRequest, NextResponse } from "next/server"
import { runSingleScraper } from "@/lib/scraper-orchestrator"

const OUTLET_NAMES = {
  hkfp: "HKFP",
  singtao: "SingTao",
  hk01: "HK01",
  oncc: "ONCC",
  rthk: "RTHK",
}

export async function POST(
  request: NextRequest,
  { params }: { params: { outlet: string } }
) {
  try {
    const outlet = params.outlet.toLowerCase()
    
    if (!OUTLET_NAMES[outlet]) {
      return NextResponse.json(
        {
          success: false,
          error: `Unknown outlet: ${outlet}`,
          availableOutlets: Object.keys(OUTLET_NAMES),
        },
        { status: 400 }
      )
    }

    console.log(`🚀 Starting ${OUTLET_NAMES[outlet]} scraping...`)
    const startTime = Date.now()

    // Use the enhanced scraper with progress tracking
    const result = await runSingleScraper(outlet, true)

    const duration = Date.now() - startTime
    console.log(`✅ ${OUTLET_NAMES[outlet]} completed in ${duration}ms`)

    return NextResponse.json({
      success: true,
      outlet: result.outlet,
      articlesFound: result.articlesFound,
      articlesSaved: result.articlesSaved,
      duration,
      timestamp: new Date().toISOString(),
    })

  } catch (error) {
    console.error(`💥 ${params.outlet} scraping failed:`, error)

    return NextResponse.json(
      {
        success: false,
        outlet: OUTLET_NAMES[params.outlet.toLowerCase()] || params.outlet,
        error: error.message,
        timestamp: new Date().toISOString(),
        stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
      },
      { status: 500 }
    )
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { outlet: string } }
) {
  const outlet = params.outlet.toLowerCase()
  
  return NextResponse.json({
    outlet: OUTLET_NAMES[outlet] || outlet,
    available: !!OUTLET_NAMES[outlet],
    endpoint: `/api/scrape/${outlet}`,
    method: "POST",
    description: `Scrape ${OUTLET_NAMES[outlet] || outlet} articles`,
    availableOutlets: Object.keys(OUTLET_NAMES),
  })
}