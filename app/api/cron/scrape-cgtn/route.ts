import { type NextRequest, NextResponse } from "next/server"
import { runSingleScraper } from "@/lib/scraper-orchestrator"

export const maxDuration = 180 // 180 seconds for CGTN (~97s) + Xinhua (~28s)

export async function GET(request: NextRequest) {
  // Verify the request is from Vercel Cron
  const userAgent = request.headers.get("user-agent")
  if (userAgent !== "vercel-cron/1.0") {
    return new Response("Unauthorized", {
      status: 401,
    })
  }

  try {
    console.log("CGTN/Xinhua Cron job started:", new Date().toISOString())

    // Run both slow international scrapers
    const results = await Promise.allSettled([
      runSingleScraper('cgtn', false),
      runSingleScraper('xinhua', false),
    ])

    const cgtnResult = results[0].status === 'fulfilled' ? results[0].value : { error: results[0].reason?.message }
    const xinhuaResult = results[1].status === 'fulfilled' ? results[1].value : { error: results[1].reason?.message }

    console.log("CGTN/Xinhua Cron job completed:", new Date().toISOString())

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      results: {
        cgtn: cgtnResult,
        xinhua: xinhuaResult,
      },
    })
  } catch (error) {
    console.error("CGTN/Xinhua Cron job failed:", error)

    return NextResponse.json(
      {
        success: false,
        timestamp: new Date().toISOString(),
        error: error.message,
      },
      { status: 500 },
    )
  }
}
