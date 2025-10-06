import { type NextRequest, NextResponse } from "next/server"
import { runSingleScraper } from "@/lib/scraper-orchestrator"

export const maxDuration = 60 // 60 seconds for slow scraper

export async function GET(request: NextRequest) {
  // Verify the request is from Vercel Cron
  const userAgent = request.headers.get("user-agent")
  if (userAgent !== "vercel-cron/1.0") {
    return new Response("Unauthorized", {
      status: 401,
    })
  }

  try {
    console.log("HK01 Cron job started:", new Date().toISOString())

    const result = await runSingleScraper('hk01', false)

    console.log("HK01 Cron job completed:", new Date().toISOString())

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      result,
    })
  } catch (error) {
    console.error("HK01 Cron job failed:", error)

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
